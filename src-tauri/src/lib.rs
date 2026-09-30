use chrono::{Datelike, TimeZone};
use chrono::{Local, Timelike};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::tray::TrayIconBuilder;
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;

use log::{info, warn};

mod settings;
#[cfg(windows)]
mod speech;
mod time_sync;
mod updater;

use settings::{
    get_settings as load_settings, init_settings_store, persist, storage_dir,
    update as update_settings,
};
pub use settings::{
    AlarmSettings, AppSettings, CustomAlarm, RelaxSchedulerSettings, SavedFloatWidget,
    SettingsStore,
};
use updater::{
    check_for_updates, download_update, get_app_version, init_updater, install_update, is_msstore,
    is_portable, pending_update_version, set_auto_update, UpdaterState,
};

// ─────────────────────────────────────────────────────────────
// Alarm State
// ─────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AlarmState {
    pub last_quarter_hour: Mutex<Option<(u32, u32)>>, // (hour, minute)
    pub last_half_hour: Mutex<Option<(u32, u32)>>,    // (hour, minute)
    pub last_full_hour: Mutex<Option<u32>>,           // hour
    pub last_voice_announcement: Mutex<Option<(u32, u32)>>, // (hour, minute)
    pub relax_next_run: Mutex<Option<chrono::DateTime<Local>>>,
    // Runtime-only snooze times keyed by alarm id. Snoozes intentionally
    // reset when the app exits; the alarm definition itself remains intact.
    pub snoozed_alarms: Mutex<HashMap<String, i64>>,
    // Live relax playback state, reported by the main window so the tray
    // can show what's playing without touching the audio engine itself.
    pub relax_playing: Mutex<Option<String>>, // track id, or None
}

/// Lock a mutex without panicking on poison: if another thread
/// panicked while holding it, recover the inner value and keep
/// working instead of killing this thread too.
fn lock_or_recover<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

// ─────────────────────────────────────────────────────────────
// Active-window broadcast
// ─────────────────────────────────────────────────────────────
// WebView2 on Windows does not reliably expose visibility/focus to the
// page (document.hidden / document.hasFocus() / native isFocused() all
// keep reporting a window hidden via .hide() as visible+focused). That
// left the main window's analog-clock rAF loop painting off-screen while
// in mini mode. The backend is the only component that knows for certain
// which window is active, so it broadcasts that here. Frontends gate their
// render loops on this signal. `label` is "main", "mini" or "none".
fn broadcast_active_window(app: &AppHandle, label: &str) {
    let _ = app.emit("cc:active-window", label);
}

/// The window that should receive user-facing one-shot events
/// (alarm chimes, relax triggers): the visible window of the
/// current mode, else the visible window of the other mode.
/// Routing these to the active window instead of broadcasting
/// app-wide fixes the double chime — previously both main and
/// mini listened on `alarm:chime` and each played the sound in
/// its own AudioContext.
fn active_event_target(app: &AppHandle) -> Option<String> {
    for label in ["main", "mini"] {
        if let Some(win) = app.get_webview_window(label) {
            if win.is_visible().unwrap_or(false) {
                return Some(label.to_string());
            }
        }
    }
    None
}

/// A due alarm stays reachable for this long after its minute starts.
/// The scheduler sleeps in chunks, so requiring the exact second `:00`
/// made every alarm miss its window.
const ALARM_GRACE_SECS: i64 = 90;

fn occurrence_is_pending(scheduled: chrono::DateTime<Local>, now: chrono::DateTime<Local>) -> bool {
    now.signed_duration_since(scheduled).num_seconds() <= ALARM_GRACE_SECS
}

fn emit_to_active(app: &AppHandle, event: &str, payload: serde_json::Value) {
    match active_event_target(app) {
        Some(label) => {
            let _ = app.emit_to(label.as_str(), event, payload);
        }
        None => {
            // Hidden webviews still play audio. An app-wide emit would
            // make main and mini announce the same chime. One window is enough.
            let label = if app.get_webview_window("main").is_some() {
                "main"
            } else {
                "mini"
            };
            let _ = app.emit_to(label, event, payload);
        }
    }
}

/// The visible window plays the sound. The other window still shows the
/// notice, marked silent, so opening it later does not replay the chime.
fn emit_alarm_chime(app: &AppHandle, payload: serde_json::Value) {
    let active = active_event_target(app);
    for label in ["main", "mini"] {
        if app.get_webview_window(label).is_none() {
            continue;
        }
        let mut data = payload.clone();
        let plays_sound = match active.as_deref() {
            Some(current) => current == label,
            None => label == "main",
        };
        if !plays_sound {
            data["silent"] = serde_json::Value::Bool(true);
        }
        let _ = app.emit_to(label, "alarm:chime", data);
    }
}

// ─────────────────────────────────────────────────────────────
// Window target sizes shared between resize handlers and
// set_window_size so skin changes work correctly across DPI
// differences between monitors.
// ─────────────────────────────────────────────────────────────

static MINI_TARGET_WIDTH: AtomicU32 = AtomicU32::new(260);
static MINI_TARGET_HEIGHT: AtomicU32 = AtomicU32::new(48);
static FLOAT_SPAWN_LOCK: Mutex<()> = Mutex::new(());
static APP_EXITING: AtomicBool = AtomicBool::new(false);
static EDGE_LIMITS_ENABLED: AtomicBool = AtomicBool::new(true);
/// Top-level HWNDs of floating analog clocks. Their window is a square so the
/// context menu and drop shadow can paint, but clicks outside the dial should
/// reach whatever sits behind the widget.
static ANALOG_HIT_ROOTS: OnceLock<Mutex<HashSet<isize>>> = OnceLock::new();
/// Analog windows whose context menu is open. While set, the whole square
/// stays clickable so menu items outside the circle still work.
static ANALOG_MENU_CAPTURE: OnceLock<Mutex<HashSet<isize>>> = OnceLock::new();
/// CSS size of `.float-analog-shell` (border-box). Kept in sync with analog.css.
const ANALOG_DIAL_CSS_PX: f64 = 266.0;
/// Kept at 0. Pixels outside the opaque dial are transparent, and a window
/// region paints them white (a bright arc along the top of the circle).
const ANALOG_DIAL_HIT_SLACK_CSS_PX: f64 = 0.0;
/// True while Windows is inside a widget drag loop. The page cursor only
/// lasts until that loop starts and replaces it with the arrow.
#[cfg(windows)]
static WIDGET_DRAG_CURSOR: AtomicBool = AtomicBool::new(false);
static FLOAT_TARGET_SIZES: OnceLock<Mutex<HashMap<String, (u32, u32)>>> = OnceLock::new();
const MAX_FLOAT_WINDOWS: usize = 10;

fn float_target_sizes() -> &'static Mutex<HashMap<String, (u32, u32)>> {
    FLOAT_TARGET_SIZES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn analog_hit_roots() -> &'static Mutex<HashSet<isize>> {
    ANALOG_HIT_ROOTS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn analog_menu_capture() -> &'static Mutex<HashSet<isize>> {
    ANALOG_MENU_CAPTURE.get_or_init(|| Mutex::new(HashSet::new()))
}

fn remember_window_target(window: &WebviewWindow, width: u32, height: u32) {
    match window.label() {
        "mini" => {
            MINI_TARGET_WIDTH.store(width, Ordering::Release);
            MINI_TARGET_HEIGHT.store(height, Ordering::Release);
        }
        label if label.starts_with("float-") => {
            lock_or_recover(float_target_sizes()).insert(label.to_string(), (width, height));
        }
        _ => {}
    }
}

fn forget_float_target(label: &str) {
    if label.starts_with("float-") {
        lock_or_recover(float_target_sizes()).remove(label);
    }
}

fn target_size_for(window: &WebviewWindow) -> Option<(u32, u32)> {
    match window.label() {
        "mini" => Some((
            MINI_TARGET_WIDTH.load(Ordering::Acquire),
            MINI_TARGET_HEIGHT.load(Ordering::Acquire),
        )),
        label if label.starts_with("float-") => {
            lock_or_recover(float_target_sizes()).get(label).copied()
        }
        _ => None,
    }
}

/// Re-assert a window's desired logical size after WebView2 reports a
/// resize or DPI change. Comparing physical pixels first avoids a resize
/// feedback loop while still correcting the known cross-monitor shrink.
fn restore_target_size(window: &WebviewWindow) {
    let Some((width, height)) = target_size_for(window) else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let expected_width = (f64::from(width) * scale).round() as u32;
    let expected_height = (f64::from(height) * scale).round() as u32;
    let already_correct = window
        .outer_size()
        .map(|size| {
            size.width.abs_diff(expected_width) <= 1 && size.height.abs_diff(expected_height) <= 1
        })
        .unwrap_or(false);
    if !already_correct {
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
            f64::from(width),
            f64::from(height),
        )));
    }
}

/// Half the mini window's default width/height in logical px —
/// used by every "center the mini clock" call site.
const MINI_CENTER_OFFSET: (i32, i32) = (130, 24);

fn center_mini_on_monitor(monitor: &tauri::Monitor) -> (i32, i32) {
    let pos = monitor.position();
    let size = monitor.size();
    (
        pos.x + (size.width as i32 / 2) - MINI_CENTER_OFFSET.0,
        pos.y + (size.height as i32 / 2) - MINI_CENTER_OFFSET.1,
    )
}

// ─────────────────────────────────────────────────────────────
// Always-on-top + window visibility helpers
// ─────────────────────────────────────────────────────────────

fn apply_always_on_top(app: &AppHandle, aot: bool) {
    for (label, window) in app.webview_windows() {
        match label.as_str() {
            "mini" | "menu" | "tray_menu" => {
                let _ = window.set_always_on_top(aot);
            }
            "main" => {
                let _ = window.set_always_on_top(false);
            }
            label if label.starts_with("float-") => {
                let _ = window.set_always_on_top(aot);
            }
            _ => {}
        }
    }
}

fn is_click_through_window(label: &str) -> bool {
    label == "mini" || label.starts_with("float-")
}

/// Pass mouse events through the mini clock and every floating widget.
/// One setting covers all of them. Applied when it changes, when a
/// widget is created, and every time one of those windows is shown,
/// because Windows can drop the flag across hide/show cycles.
fn apply_click_through(app: &AppHandle, on: bool) {
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.set_ignore_cursor_events(on);
    }
    for (label, win) in app.webview_windows() {
        if label.starts_with("float-") {
            let _ = win.set_ignore_cursor_events(on);
        }
    }
}

fn reapply_click_through(app: &AppHandle, window: &WebviewWindow) {
    if !is_click_through_window(window.label()) {
        return;
    }
    let on = load_settings(app).mini_click_through;
    let _ = window.set_ignore_cursor_events(on);
}

/// main or mini currently visible and not minimized.
fn is_any_clock_window_visible(app: &AppHandle) -> bool {
    ["main", "mini"].iter().any(|label| {
        app.get_webview_window(label)
            .and_then(|w| w.is_visible().ok())
            .unwrap_or(false)
            && !app
                .get_webview_window(label)
                .and_then(|w| w.is_minimized().ok())
                .unwrap_or(false)
    })
}

fn hide_all_clock_windows(app: &AppHandle) {
    for label in ["main", "mini", "menu"] {
        if let Some(win) = app.get_webview_window(label) {
            let _ = win.hide();
        }
    }
}

fn show_clock_window(app: &AppHandle) {
    let settings = load_settings(app);
    let target_win = if settings.window_mode == "full" {
        "main"
    } else {
        "mini"
    };
    if let Some(win) = app.get_webview_window(target_win) {
        // Automatic display: showing the full clock from the tray or
        // the hotkey also picks the monitor where the mouse is.
        if target_win == "main" {
            place_full_clock(&win, &settings);
        }
        let _ = win.unminimize();
        let _ = win.show();
        // The taskbar may have never registered our DeleteTab (boot
        // race) or may have restarted and dropped it — re-assert.
        refresh_taskbar_tab(&win);
        let _ = win.set_focus();
        if target_win == "mini" {
            reapply_click_through(app, &win);
        }
        broadcast_active_window(app, target_win);
    }
}

// ─────────────────────────────────────────────────────────────
// Settings commands
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

/// Say one sentence with the Windows voice. WebView2 is not used:
/// selecting a voice there makes Windows read the sentence twice.
#[tauri::command]
fn speak_announcement(text: String, voice_name: String, volume: f64) -> bool {
    #[cfg(windows)]
    {
        speech::enqueue(text, voice_name, volume as f32)
    }
    #[cfg(not(windows))]
    {
        let _ = (text, voice_name, volume);
        false
    }
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    set_auto_update(settings.auto_update);
    EDGE_LIMITS_ENABLED.store(settings.mini_edge_limits, Ordering::Release);
    let _ = persist(&app, &settings);

    // Reset next run for relax scheduler
    let state = app.state::<AlarmState>();
    *lock_or_recover(&state.relax_next_run) = None;

    apply_always_on_top(&app, settings.always_on_top);
    apply_click_through(&app, settings.mini_click_through);
    Ok(settings)
}

/// Preferred replacement for `save_settings`: merges a partial
/// JSON patch into the settings under the exclusive lock, so
/// concurrent writers cannot clobber each other.
#[tauri::command]
fn patch_settings(app: AppHandle, patch: serde_json::Value) -> Result<AppSettings, String> {
    let merged = settings::patch_settings(&app, patch)?;
    set_auto_update(merged.auto_update);
    EDGE_LIMITS_ENABLED.store(merged.mini_edge_limits, Ordering::Release);

    // Reset next run for relax scheduler
    let state = app.state::<AlarmState>();
    *lock_or_recover(&state.relax_next_run) = None;

    apply_always_on_top(&app, merged.always_on_top);
    apply_click_through(&app, merged.mini_click_through);
    if merged.mini_edge_limits {
        if let Some(mini) = app.get_webview_window("mini") {
            clamp_window_to_monitors(&mini);
        }
        for (label, win) in app.webview_windows() {
            if label.starts_with("float-") {
                clamp_window_to_monitors(&win);
            }
        }
    }
    for (label, win) in app.webview_windows() {
        if label.starts_with("float-") {
            let _ = win.set_skip_taskbar(!merged.show_widgets_in_taskbar);
        }
    }
    Ok(merged)
}

#[tauri::command]
fn snooze_alarm(app: AppHandle, alarm_id: String, minutes: u32) -> Result<(), String> {
    let id = alarm_id.trim().to_string();
    if id.is_empty() {
        return Err("alarm id is required".to_string());
    }
    let duration = minutes.clamp(1, 120);
    let until = (Local::now() + chrono::Duration::minutes(i64::from(duration))).timestamp();
    let mut found = false;
    update_settings(&app, |settings| {
        for (index, alarm) in settings.custom_alarms.iter_mut().enumerate() {
            let current_id = if alarm.id.trim().is_empty() {
                format!("alarm-{}", index + 1)
            } else {
                alarm.id.clone()
            };
            if current_id == id {
                alarm.enabled = true;
                found = true;
                break;
            }
        }
        if found {
            Ok(())
        } else {
            Err("alarm not found".to_string())
        }
    })?;
    let state = app.state::<AlarmState>();
    lock_or_recover(&state.snoozed_alarms).insert(id.clone(), until);
    let _ = app.emit("settings:updated", load_settings(&app));
    let _ = app.emit(
        "alarm:snoozed",
        serde_json::json!({
            "alarmId": id,
            "until": until,
            "minutes": duration,
        }),
    );
    Ok(())
}

/// The notice was dismissed. When the alarm is marked delete-after, it
/// leaves the schedule. Snooze does not call this.
#[tauri::command]
fn dismiss_alarm(app: AppHandle, alarm_id: String) -> Result<(), String> {
    let id = alarm_id.trim().to_string();
    if id.is_empty() {
        return Ok(());
    }
    let mut deleted = false;
    update_settings(&app, |settings| {
        let index = settings
            .custom_alarms
            .iter()
            .enumerate()
            .position(|(index, alarm)| {
                let current_id = if alarm.id.trim().is_empty() {
                    format!("alarm-{}", index + 1)
                } else {
                    alarm.id.clone()
                };
                current_id == id
            });
        if let Some(index) = index {
            if settings.custom_alarms[index].delete_after {
                settings.custom_alarms.remove(index);
                deleted = true;
            }
        }
        Ok(())
    })?;
    if deleted {
        let _ = app.emit("settings:updated", load_settings(&app));
    }
    let _ = app.emit(
        "alarm:dismissed",
        serde_json::json!({ "alarmId": id, "deleted": deleted }),
    );
    Ok(())
}

#[tauri::command]
fn reset_settings(app: AppHandle) -> AppSettings {
    let default_settings = AppSettings::default();
    set_auto_update(default_settings.auto_update);
    EDGE_LIMITS_ENABLED.store(default_settings.mini_edge_limits, Ordering::Release);
    let _ = persist(&app, &default_settings);

    // Reset next run for relax scheduler
    let state = app.state::<AlarmState>();
    *lock_or_recover(&state.relax_next_run) = None;

    apply_always_on_top(&app, default_settings.always_on_top);
    apply_click_through(&app, default_settings.mini_click_through);
    for (label, win) in app.webview_windows() {
        if label.starts_with("float-") {
            let _ = win.set_skip_taskbar(true);
        }
    }

    // Broadcast updated settings to all windows
    let _ = app.emit("settings:updated", &default_settings);
    default_settings
}

// ─────────────────────────────────────────────────────────────
// Backup & Data commands
// ─────────────────────────────────────────────────────────────

/// Export all current settings to a user-chosen JSON file.
#[tauri::command]
async fn export_backup(app: AppHandle, window: WebviewWindow) -> Result<bool, String> {
    let settings = load_settings(&app);
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("serialize: {}", e))?;

    let (tx, rx) = std::sync::mpsc::channel();

    let now = chrono::Local::now();
    let default_name = format!("cyberclock-backup-{}.json", now.format("%Y%m%d-%H%M%S"));

    window
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("JSON", &["json"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let picked = rx.recv().map_err(|_| "dialog cancelled".to_string())?;
    let Some(file_path) = picked else {
        return Ok(false); // user cancelled
    };
    let path = file_path
        .as_path()
        .ok_or_else(|| "invalid path".to_string())?;

    fs::write(path, &json).map_err(|e| format!("write: {}", e))?;
    info!("Backup exported to {:?}", path);
    Ok(true)
}

/// Import settings from a user-chosen JSON backup file.
#[tauri::command]
async fn import_backup(app: AppHandle, window: WebviewWindow) -> Result<Option<AppSettings>, String> {
    let (tx, rx) = std::sync::mpsc::channel();

    window
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let picked = rx.recv().map_err(|_| "dialog cancelled".to_string())?;
    let Some(file_path) = picked else {
        return Ok(None); // user cancelled
    };
    let path = file_path
        .as_path()
        .ok_or_else(|| "invalid path".to_string())?
        .to_path_buf();

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("read: {}", e))?;
    let imported: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("invalid backup: {}", e))?;

    // Apply the imported settings
    set_auto_update(imported.auto_update);
    EDGE_LIMITS_ENABLED.store(imported.mini_edge_limits, Ordering::Release);
    let _ = persist(&app, &imported);

    // Reset relax scheduler
    let state = app.state::<AlarmState>();
    *lock_or_recover(&state.relax_next_run) = None;

    apply_always_on_top(&app, imported.always_on_top);
    apply_click_through(&app, imported.mini_click_through);

    // Broadcast to all windows
    let _ = app.emit("settings:updated", &imported);

    info!("Backup imported from {:?}", path);
    Ok(Some(imported))
}

/// Open the application data folder in the system file manager.
#[tauri::command]
fn open_data_folder(app: AppHandle) -> bool {
    let dir = storage_dir(&app);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        Command::new("explorer")
            .arg(dir.to_string_lossy().to_string())
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .spawn()
            .is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = dir;
        false
    }
}

// ─────────────────────────────────────────────────────────────
// Window management commands
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn close_window(window: WebviewWindow) {
    if window.label() == "main" || window.label() == "mini" {
        exit_app(window.app_handle());
    } else {
        let _ = window.close();
    }
}

// ─────────────────────────────────────────────────────────────
// Clean application exit
// ─────────────────────────────────────────────────────────────
// Closing every WebviewWindow BEFORE calling app.exit() lets each
// HWND be destroyed first. Otherwise Chromium's static teardown
// races to UnregisterClass("Chrome_WidgetWin_0") while windows of
// that class still exist, producing:
//   "Failed to unregister class Chrome_WidgetWin_0. Error = 1412"
// (ERROR_CLASS_HAS_WINDOWS) in the terminal on exit.
fn exit_app(app: &AppHandle) {
    APP_EXITING.store(true, Ordering::SeqCst);
    for window in app.webview_windows().values() {
        let _ = window.close();
    }
    // give the webview runtime a beat to actually destroy the HWNDs
    // before we tear the process down.
    std::thread::sleep(std::time::Duration::from_millis(150));
    app.exit(0);
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) {
    let _ = window.minimize();
}

// ─────────────────────────────────────────────────────────────
// Floating stopwatch / timer windows
// ─────────────────────────────────────────────────────────────
// Each call spawns one fully independent window (own WebView, own
// JS clock). Labels are unique ("float-sw-3") so windows never
// share state; closing a window destroys its clock. Skins, tint,
// language and zoom are read from the global settings on load.
// Timers chime locally in their own window; the backend broadcast
// (alarm:chime) is intentionally not involved.
fn float_window_count(app: &AppHandle) -> usize {
    app.webview_windows()
        .keys()
        .filter(|label| label.starts_with("float-"))
        .count()
}

fn spawn_float_window(app: &AppHandle, kind: &str) -> Option<String> {
    spawn_float_window_with_slot(app, kind, None, None)
}

fn spawn_float_window_with_slot(
    app: &AppHandle,
    kind: &str,
    target_label: Option<&str>,
    target_pos: Option<(i32, i32)>,
) -> Option<String> {
    let _spawn_guard = lock_or_recover(&FLOAT_SPAWN_LOCK);
    let kind = match kind {
        "timer" => "timer",
        "cal" | "calendar" => "cal",
        "analog" => "analog",
        "relax" => "relax",
        _ => "sw",
    };
    if kind == "relax" {
        if let Some(existing) = app.get_webview_window("float-relax-1") {
            let _ = existing.unminimize();
            let _ = existing.show();
            reapply_click_through(app, &existing);
            let _ = existing.set_focus();
            return Some(existing.label().to_string());
        }
    }
    if float_window_count(app) >= MAX_FLOAT_WINDOWS {
        warn!(
            "spawn_float: refusing, {} float windows alive",
            MAX_FLOAT_WINDOWS
        );
        return None;
    }
    let (seq, label) = if let Some(lbl) = target_label {
        if app.get_webview_window(lbl).is_some() {
            return None;
        }
        let parsed_seq = lbl
            .split('-')
            .next_back()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(1);
        (parsed_seq, lbl.to_string())
    } else {
        // Find the first available slot 1, 2, 3...
        let mut seq = 1;
        while app
            .get_webview_window(&format!("float-{}-{}", kind, seq))
            .is_some()
        {
            seq += 1;
        }
        (seq, format!("float-{}-{}", kind, seq))
    };
    let settings = load_settings(app);
    let zoom = if settings.mini_zoom.is_finite() && settings.mini_zoom > 0.0 {
        settings.mini_zoom
    } else {
        1.0
    };
    // Compact size per float kind
    let (title, wide, tall) = match kind {
        "timer" => ("Timer · CyberClock", 286.0, 92.0),
        "cal" => ("Calendar · CyberClock", 286.0, 268.0),
        "analog" => ("Analog Clock · CyberClock", 316.0, 316.0),
        "relax" => ("Relax · CyberClock", 300.0, 176.0),
        _ => ("Stopwatch · CyberClock", 286.0, 52.0),
    };
    let cascade = ((seq - 1) % 8) as f64 * 30.0;
    let url = if kind == "cal" {
        WebviewUrl::App("float/cal.html".into())
    } else if kind == "analog" {
        WebviewUrl::App("float/analog.html".into())
    } else if kind == "relax" {
        WebviewUrl::App("float/relax.html".into())
    } else {
        WebviewUrl::App("float/float.html".into())
    };
    // The window label encodes the kind ("float-timer-3" / "float-sw-3");
    // the frontend reads it via getCurrentWindow().label. A plain
    // path-only WebviewUrl::App is used because the PathBuf variant
    // resolves through Url::join, which can mangle a "?kind=" query
    // into the file path and produce an unloadable webview.
    // Open the window on the monitor where the user invoked it (tray
    // click), near the cursor and clamped inside that monitor's bounds,
    // or restore saved position if available.
    let mut custom_pos = false;
    let mut target_phys_pos: Option<(i32, i32)> = None;
    let (mut pos_x, mut pos_y) = (200.0 + cascade, 200.0 + cascade);
    if let Some((x, y)) = target_pos {
        pos_x = x as f64;
        pos_y = y as f64;
        custom_pos = true;
    } else if kind == "cal" {
        if let Some((x, y)) = settings.float_cal_position {
            pos_x = x as f64;
            pos_y = y as f64;
            custom_pos = true;
        }
    } else if kind == "analog" {
        if let Some((x, y)) = settings.float_analog_position {
            pos_x = x as f64;
            pos_y = y as f64;
            custom_pos = true;
        }
    } else if kind == "relax" {
        if let Some((x, y)) = settings.float_relax_position {
            pos_x = x as f64;
            pos_y = y as f64;
            custom_pos = true;
        }
    }

    if custom_pos {
        let px = pos_x as i32;
        let py = pos_y as i32;
        if let Ok(monitors) = app.available_monitors() {
            let found_mon = monitors.iter().find(|m| is_position_in_monitor(px, py, m));
            if let Some(m) = found_mon {
                target_phys_pos = Some((px, py));
                let sf = m.scale_factor();
                pos_x = px as f64 / sf;
                pos_y = py as f64 / sf;
            } else {
                custom_pos = false;
            }
        }
    }

    if !custom_pos {
        if let Ok(cursor) = app.cursor_position() {
            let mon = app
                .monitor_from_point(cursor.x, cursor.y)
                .ok()
                .flatten()
                .or_else(|| app.primary_monitor().ok().flatten());
            if let Some(mon) = mon {
                let sf = mon.scale_factor();
                let work_area = mon.work_area();
                let mpos = work_area.position;
                let msize = work_area.size;
                let win_w = wide * zoom * sf;
                let win_h = tall * zoom * sf;
                let margin = 12.0;
                let min_x = mpos.x as f64 + margin;
                let min_y = mpos.y as f64 + margin;
                let max_x = (mpos.x as f64 + msize.width as f64 - win_w - margin).max(min_x);
                let max_y = (mpos.y as f64 + msize.height as f64 - win_h - margin).max(min_y);
                let x = cursor.x - win_w / 2.0 + cascade;
                let y = cursor.y - win_h / 2.0 + cascade;
                pos_x = x.clamp(min_x, max_x) / sf;
                pos_y = y.clamp(min_y, max_y) / sf;
            }
        }
    }

    let builder = WebviewWindowBuilder::new(app, &label, url)
        .title(title)
        .inner_size(wide * zoom, tall * zoom)
        .position(pos_x, pos_y)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .minimizable(true)
        .maximizable(false)
        .closable(true)
        .skip_taskbar(!settings.show_widgets_in_taskbar)
        .always_on_top(settings.always_on_top)
        .visible(true)
        .focused(true);
    match builder.build() {
        Ok(win) => {
            if let Some((px, py)) = target_phys_pos {
                let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    px, py,
                )));
            }
            if kind == "cal" {
                let app_handle = app.clone();
                let _ = update_settings(&app_handle, |s| {
                    s.float_cal_open = true;
                    Ok(())
                });
            } else if kind == "analog" {
                let app_handle = app.clone();
                let _ = update_settings(&app_handle, |s| {
                    s.float_analog_open = true;
                    Ok(())
                });
            } else if kind == "relax" {
                let app_handle = app.clone();
                let _ = update_settings(&app_handle, |s| {
                    s.float_relax_open = true;
                    Ok(())
                });
            } else if kind == "timer" || kind == "sw" {
                let app_handle = app.clone();
                let l = label.clone();
                let k = kind.to_string();
                let initial_pos = target_phys_pos.or(Some((pos_x as i32, pos_y as i32)));
                let _ = update_settings(&app_handle, |s| {
                    if let Some(entry) = s.open_float_widgets.iter_mut().find(|w| w.label == l) {
                        if entry.position.is_none() {
                            entry.position = initial_pos;
                        }
                    } else {
                        s.open_float_widgets.push(SavedFloatWidget {
                            kind: k,
                            label: l,
                            position: initial_pos,
                        });
                    }
                    Ok(())
                });
            }
            remember_window_target(
                &win,
                (wide * zoom).round() as u32,
                (tall * zoom).round() as u32,
            );
            clamp_window_to_monitors(&win);
            #[cfg(windows)]
            attach_window_drag_subclass(&win);
            let float_for_resize = win.clone();
            let float_label = win.label().to_string();
            let app_for_event = app.clone();
            let kind_for_event = kind.to_string();
            win.on_window_event(move |event| match event {
                WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                    restore_target_size(&float_for_resize);
                    #[cfg(windows)]
                    if kind_for_event == "analog" {
                        sync_analog_hit_region(&float_for_resize);
                    }
                }
                WindowEvent::Moved(pos) => {
                    if kind_for_event == "cal" {
                        let _ = update_settings(&app_for_event, |s| {
                            s.float_cal_position = Some((pos.x, pos.y));
                            Ok(())
                        });
                    } else if kind_for_event == "analog" {
                        let _ = update_settings(&app_for_event, |s| {
                            s.float_analog_position = Some((pos.x, pos.y));
                            Ok(())
                        });
                    } else if kind_for_event == "relax" {
                        let _ = update_settings(&app_for_event, |s| {
                            s.float_relax_position = Some((pos.x, pos.y));
                            Ok(())
                        });
                    } else if kind_for_event == "timer" || kind_for_event == "sw" {
                        let _ = update_settings(&app_for_event, |s| {
                            if let Some(entry) = s
                                .open_float_widgets
                                .iter_mut()
                                .find(|w| w.label == float_label)
                            {
                                entry.position = Some((pos.x, pos.y));
                            } else {
                                s.open_float_widgets.push(SavedFloatWidget {
                                    kind: kind_for_event.clone(),
                                    label: float_label.clone(),
                                    position: Some((pos.x, pos.y)),
                                });
                            }
                            Ok(())
                        });
                    }
                }
                WindowEvent::Destroyed => {
                    forget_float_target(&float_label);
                    if !APP_EXITING.load(Ordering::SeqCst) {
                        if kind_for_event == "cal" {
                            let cal_count = app_for_event
                                .webview_windows()
                                .keys()
                                .filter(|l| l.starts_with("float-cal-"))
                                .count();
                            if cal_count == 0 {
                                let _ = update_settings(&app_for_event, |s| {
                                    s.float_cal_open = false;
                                    Ok(())
                                });
                            }
                        } else if kind_for_event == "analog" {
                            let analog_count = app_for_event
                                .webview_windows()
                                .keys()
                                .filter(|l| l.starts_with("float-analog-"))
                                .count();
                            if analog_count == 0 {
                                let _ = update_settings(&app_for_event, |s| {
                                    s.float_analog_open = false;
                                    Ok(())
                                });
                            }
                        } else if kind_for_event == "relax" {
                            let relax_count = app_for_event
                                .webview_windows()
                                .keys()
                                .filter(|l| l.starts_with("float-relax-"))
                                .count();
                            if relax_count == 0 {
                                let _ = update_settings(&app_for_event, |s| {
                                    s.float_relax_open = false;
                                    Ok(())
                                });
                            }
                        } else if kind_for_event == "timer" || kind_for_event == "sw" {
                            let _ = update_settings(&app_for_event, |s| {
                                s.open_float_widgets.retain(|w| w.label != float_label);
                                Ok(())
                            });
                        }
                    }
                }
                _ => {}
            });
            info!("spawn_float: {} opened ({})", label, kind);
            reapply_click_through(app, &win);
            let _ = win.set_focus();
            Some(label)
        }
        Err(e) => {
            warn!("spawn_float: failed to build {}: {}", label, e);
            None
        }
    }
}

// NOTE: These float/menu commands MUST be `async`. Sync commands run
// inline on the main thread inside WebView2's WebMessageReceived
// handler; creating a new webview from there re-enters WebView2 and
// leaves the tray/mini menus unresponsive (observed: menu closes and
// nothing spawns, afterwards no menu item reacts). Async commands run
// on the async runtime and the window creation is dispatched safely
// through the event loop instead.
#[tauri::command]
async fn spawn_float(app: AppHandle, kind: String) -> Option<String> {
    spawn_float_window(&app, kind.as_str())
}

#[tauri::command]
fn get_window_position(window: WebviewWindow) -> (i32, i32) {
    window
        .outer_position()
        .map(|p| (p.x, p.y))
        .unwrap_or((0, 0))
}

#[tauri::command]
fn move_window(window: WebviewWindow, x: i32, y: i32) {
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
        x, y,
    )));
    clamp_window_to_monitors(&window);
}

#[tauri::command]
fn set_window_size(window: WebviewWindow, width: i32, height: i32, recenter: Option<bool>) {
    // Reject invalid values.
    // Wide display faces (Orbitron bold, seconds, AM/PM) grow the mini
    // bar past the old 2000px cap once zoom is applied.
    if width <= 0 || height <= 0 || width > 4096 || height > 4096 {
        return;
    }

    // Zoom-style resizes grow the window around its visual center so the
    // clock stays where the user placed it; the final position is clamped
    // to the monitor's work area so it never ends up partially off-screen
    // (e.g. near the bottom edge). Skipped for plain skin swaps, which keep
    // the top-left anchor.
    if recenter.unwrap_or(false) {
        if let (Ok(pos), Ok(old_size)) = (window.outer_position(), window.outer_size()) {
            let new_phys_width =
                (width as f64 * window.scale_factor().unwrap_or(1.0)).round() as i32;
            let new_phys_height =
                (height as f64 * window.scale_factor().unwrap_or(1.0)).round() as i32;

            // Keep the old center fixed under the new size.
            let mut new_x = pos.x + (old_size.width as i32 - new_phys_width) / 2;
            let mut new_y = pos.y + (old_size.height as i32 - new_phys_height) / 2;

            // Clamp fully inside the work area of the monitor that hosts
            // the window's (old) center.
            if let Ok(Some(monitor)) = window.current_monitor() {
                let wa = monitor.work_area();
                let wa_x = wa.position.x;
                let wa_y = wa.position.y;
                let wa_w = wa.size.width as i32;
                let wa_h = wa.size.height as i32;
                if new_x < wa_x {
                    new_x = wa_x;
                }
                if new_y < wa_y {
                    new_y = wa_y;
                }
                if new_x + new_phys_width > wa_x + wa_w {
                    new_x = wa_x + wa_w - new_phys_width;
                }
                if new_y + new_phys_height > wa_y + wa_h {
                    new_y = wa_y + wa_h - new_phys_height;
                }
            }

            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                new_x, new_y,
            )));
        }
    }

    // Store the target size so the matching window's resize handler can
    // re-apply it when DPI scaling tries to corrupt the window size.
    remember_window_target(&window, width as u32, height as u32);
    // Use Logical size so Tauri calculates the correct physical size
    // for the monitor the window is currently on.
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
        width as f64,
        height as f64,
    )));
}

#[tauri::command]
fn toggle_always_on_top(window: WebviewWindow) -> bool {
    let is_on_top = window.is_always_on_top().unwrap_or(false);
    let _ = window.set_always_on_top(!is_on_top);
    !is_on_top
}

// ─────────────────────────────────────────────────────────────
// Help menu support (tray "Help" section)
// ─────────────────────────────────────────────────────────────

// Where the compiled open-taskbar-settings.exe can be found:
// - Dev: OUT_DIR from build.rs (CC_OPEN_TASKBAR_HELPER env, baked at
//   compile time by cargo:rustc-env).
// - Packaged: the NSIS installer ships it via tauri.conf.json `resources`
//   (resources/open-taskbar-settings.exe under the resource dir).
fn resolve_taskbar_helper(app: &AppHandle) -> Option<std::path::PathBuf> {
    let env_path = option_env!("CC_OPEN_TASKBAR_HELPER");
    if let Some(p) = env_path {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    // Packaged: bundled resource next to the install dir.
    if let Ok(res_dir) = app.path().resource_dir() {
        let res = res_dir.join("open-taskbar-settings.exe");
        if res.exists() {
            return Some(res);
        }
    }
    // Dev/fallback: next to the current executable.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let beside = dir.join("open-taskbar-settings.exe");
            if beside.exists() {
                return Some(beside);
            }
        }
    }
    None
}

/// Open Windows taskbar settings on the tray-icon page. Uses the
/// OpenTaskbarSettings.exe helper (build.rs compiles CyberLauncher's C#
/// source) which additionally navigates to the nested "Select which icons
/// appear on the taskbar" page on Win10 via UI Automation. Falls back to
/// ms-settings:taskbar when the helper is unavailable.
#[tauri::command]
fn open_taskbar_settings(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        if let Some(helper) = resolve_taskbar_helper(&app) {
            use std::os::windows::process::CommandExt;
            use std::process::Command;
            let _ = Command::new(helper)
                .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
                .spawn();
            return;
        }
        warn!("open_taskbar_settings: helper exe missing; falling back to ms-settings:taskbar");
    }

    let _ = open_external_url("ms-settings:taskbar".to_string());
}

/// Open the classic Windows "Date and Time" control panel applet
/// (timedate.cpl), the same dialog Windows shows from the taskbar
/// clock's context menu ("Adjust date/time" on Win10 / "Date/time
/// properties" on Win11). The applet name is a fixed string, so the
/// command exposes no injection surface.
#[tauri::command]
fn open_datetime_properties() {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        let _ = Command::new("control.exe")
            .arg("timedate.cpl")
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .spawn();
    }
}

/// Open an external URL with the OS default handler (ShellExecute).
/// Only https URLs (plus the ms-settings scheme used above) are accepted —
/// the value is validated before launch so the frontend can never ask the
/// backend to run arbitrary protocols or executables.
#[tauri::command]
fn open_external_url(url: String) -> bool {
    let parsed = url.trim();
    let allowed = parsed.starts_with("https://") || parsed.starts_with("ms-settings:");
    if !allowed {
        warn!("open_external_url: rejected non-https url {:?}", parsed);
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        // `cmd /c start "" <url>` — the empty title argument is required
        // so cmd doesn't treat the URL as the window title.
        Command::new("cmd")
            .args(["/C", "start", "", parsed])
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .spawn()
            .is_ok()
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = parsed;
        false
    }
}

#[tauri::command]
fn open_window(app: AppHandle, name: String) -> bool {
    if let Some(window) = app.get_webview_window(&name) {
        let _ = window.show();
        reapply_click_through(&app, &window);
        let _ = window.set_focus();
        refresh_taskbar_tab(&window);
        return true;
    }
    false
}

/// Show the dedicated About window centered on the monitor that currently
/// holds the clock (main or mini), so the dialog feels attached to the app
/// instead of popping up on an arbitrary display.
fn show_about_window(app: &AppHandle) {
    let Some(win) = app.get_webview_window("about") else {
        return;
    };
    // Center on the monitor of the first *visible* clock or widget window; fall back
    // to the primary monitor when all are hidden.
    let reference = app
        .webview_windows()
        .into_iter()
        .find(|(lbl, w)| {
            (lbl == "main" || lbl == "mini" || lbl.starts_with("float-"))
                && w.is_visible().unwrap_or(false)
        })
        .and_then(|(_, w)| w.current_monitor().ok().flatten())
        .or_else(|| win.primary_monitor().ok().flatten());

    if let Some(m) = reference {
        let scale = m.scale_factor();
        let size = match win.outer_size() {
            Ok(s) if s.width > 100 && s.height > 100 => s,
            _ => tauri::PhysicalSize {
                width: (740.0 * scale).round() as u32,
                height: (535.0 * scale).round() as u32,
            },
        };
        let work = m.work_area();
        let x = work.position.x + (work.size.width as i32 - size.width as i32) / 2;
        let y = work.position.y + (work.size.height as i32 - size.height as i32) / 2;
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            x, y,
        )));
    }
    let _ = win.show();
    let _ = win.set_focus();
    let _ = app.emit("about:opened", ());
    refresh_taskbar_tab(&win);
}

#[tauri::command]
fn hide_window(app: AppHandle, name: String) -> bool {
    if let Some(window) = app.get_webview_window(&name) {
        let _ = window.hide();
        if name == "main" || name == "mini" {
            broadcast_active_window(&app, "none");
        }
        return true;
    }
    false
}

// ─────────────────────────────────────────────────────────────
// Taskbar tab registration (Windows)
// ─────────────────────────────────────────────────────────────
// On Windows, tao stamps every top-level window with WS_EX_APPWINDOW
// and implements skipTaskbar as a single ITaskbarList::DeleteTab call
// at window creation, discarding the result. That one-shot message
// cannot land when the taskbar does not exist yet: with Start with
// Windows, CyberClock frequently comes up before Explorer finishes
// creating the taskbar, so the registration is lost and the visible
// mini clock keeps a regular taskbar button forever (Explorer also
// drops all registrations when it restarts).
//
// Re-assert the registration after every show of these windows, and
// poll briefly on other platforms no-ops.

/// Re-assert the taskbar tab state of a window: skip-taskbar labels
/// get DeleteTab again, the main window gets its tab back (AddTab).
fn refresh_taskbar_tab(win: &WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        let _ = win.set_skip_taskbar(win.label() != "main");
    }
    #[cfg(not(target_os = "windows"))]
    let _ = win;
}

/// Self-healing poll: re-assert the tab state of every VISIBLE window
/// a few times a minute. Covers the boot race (taskbar created after
/// us) and Explorer restarts, where all DeleteTab/AddTab registrations
/// are lost. Hidden windows have no tab to fix; their next show()
/// re-asserts through `refresh_taskbar_tab`.
#[cfg(target_os = "windows")]
fn spawn_taskbar_tab_poll(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        for label in ["main", "mini", "menu", "tray_menu", "about"] {
            if let Some(win) = app.get_webview_window(label) {
                if win.is_visible().unwrap_or(false) {
                    refresh_taskbar_tab(&win);
                }
            }
        }
    });
}

fn is_position_in_monitor(x: i32, y: i32, monitor: &tauri::Monitor) -> bool {
    let pos = monitor.position();
    let size = monitor.size();
    x >= pos.x && x < pos.x + size.width as i32 && y >= pos.y && y < pos.y + size.height as i32
}

fn find_monitor_for_window(window: &WebviewWindow) -> Option<(usize, tauri::Monitor)> {
    let monitors = window.available_monitors().ok()?;

    // First try using Tauri's native current_monitor()
    if let Ok(Some(current_mon)) = window.current_monitor() {
        if let Some(current_name) = current_mon.name() {
            if let Some(idx) = monitors.iter().position(|m| m.name() == Some(current_name)) {
                return Some((idx, current_mon));
            }
        }
    }

    // Fallback: Use window's center position to find the monitor
    if let Ok(pos) = window.outer_position() {
        if let Ok(size) = window.outer_size() {
            let center_x = pos.x + (size.width as i32 / 2);
            let center_y = pos.y + (size.height as i32 / 2);

            for (idx, m) in monitors.iter().enumerate() {
                if is_position_in_monitor(center_x, center_y, m) {
                    return Some((idx, m.clone()));
                }
            }
        }
    }

    None
}

#[derive(Clone, Copy, Debug)]
struct WinRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[allow(dead_code)]
impl WinRect {
    fn width(&self) -> i32 {
        self.right - self.left
    }
    fn height(&self) -> i32 {
        self.bottom - self.top
    }
    fn overlaps_vertical(&self, top: i32, bottom: i32) -> bool {
        self.top < bottom && self.bottom > top
    }
    fn overlaps_horizontal(&self, left: i32, right: i32) -> bool {
        self.left < right && self.right > left
    }
    fn intersection_area(&self, other: &WinRect) -> i64 {
        let ix0 = self.left.max(other.left);
        let ix1 = self.right.min(other.right);
        let iy0 = self.top.max(other.top);
        let iy1 = self.bottom.min(other.bottom);
        if ix1 > ix0 && iy1 > iy0 {
            (ix1 - ix0) as i64 * (iy1 - iy0) as i64
        } else {
            0
        }
    }
    fn distance_squared_to_point(&self, px: i32, py: i32) -> i64 {
        let dx = if px < self.left {
            self.left - px
        } else if px > self.right {
            px - self.right
        } else {
            0
        };
        let dy = if py < self.top {
            self.top - py
        } else if py > self.bottom {
            py - self.bottom
        } else {
            0
        };
        (dx as i64) * (dx as i64) + (dy as i64) * (dy as i64)
    }
}

/// Clamp a floating window (mini clock, timer, calendar, analog clock) to the
/// multi-monitor work areas. Across adjacent monitors, windows transition freely.
/// At edges where there is no adjacent monitor, window edges are clamped so they
/// cannot be dragged off-screen or lost in the void.
fn clamp_window_to_monitors(window: &WebviewWindow) -> bool {
    let app = window.app_handle();
    let settings = load_settings(app);
    let edge_limits = settings.mini_edge_limits;

    let (pos, size) = match (window.outer_position(), window.outer_size()) {
        (Ok(p), Ok(s)) => (p, s),
        _ => return false,
    };

    #[cfg(windows)]
    let work_areas = get_all_work_areas();
    #[cfg(not(windows))]
    let work_areas: Vec<WinRect> = match window.available_monitors() {
        Ok(monitors) if !monitors.is_empty() => monitors
            .iter()
            .map(|m| {
                let wa = m.work_area();
                WinRect {
                    left: wa.position.x,
                    top: wa.position.y,
                    right: wa.position.x + wa.size.width as i32,
                    bottom: wa.position.y + wa.size.height as i32,
                }
            })
            .collect(),
        _ => return false,
    };

    if work_areas.is_empty() {
        return false;
    }

    let win_w = size.width as i32;
    let win_h = size.height as i32;
    if win_w <= 0 || win_h <= 0 {
        return false;
    }

    let mut cur = WinRect {
        left: pos.x,
        top: pos.y,
        right: pos.x + win_w,
        bottom: pos.y + win_h,
    };

    if clamp_rect_coords(&mut cur, &work_areas, edge_limits) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            cur.left, cur.top,
        )));
        return true;
    }

    false
}

fn clamp_rect_coords(cur: &mut WinRect, work_areas: &[WinRect], edge_limits: bool) -> bool {
    let orig = *cur;
    let win_w = cur.right - cur.left;
    let win_h = cur.bottom - cur.top;
    if win_w <= 0 || win_h <= 0 || work_areas.is_empty() {
        return false;
    }

    // Up to 2 iterations for multi-axis stability
    for _ in 0..2 {
        let center_x = cur.left + win_w / 2;
        let center_y = cur.top + win_h / 2;

        // Find primary monitor: contains center, highest overlap, or nearest
        let primary_idx = {
            if let Some(idx) = work_areas.iter().position(|r| {
                center_x >= r.left && center_x < r.right && center_y >= r.top && center_y < r.bottom
            }) {
                idx
            } else {
                let (best_idx, best_overlap) = work_areas
                    .iter()
                    .enumerate()
                    .map(|(i, r)| (i, r.intersection_area(cur)))
                    .max_by_key(|&(_, a)| a)
                    .unwrap_or((0, 0));
                if best_overlap > 0 {
                    best_idx
                } else {
                    work_areas
                        .iter()
                        .enumerate()
                        .min_by_key(|(_, r)| r.distance_squared_to_point(center_x, center_y))
                        .map(|(i, _)| i)
                        .unwrap_or(0)
                }
            }
        };

        let primary = work_areas[primary_idx];

        if !edge_limits {
            // Safety fallback: if 100% disconnected from all screens, snap to nearest
            let total_overlap: i64 = work_areas.iter().map(|r| r.intersection_area(cur)).sum();
            if total_overlap == 0 {
                let target_x = cur
                    .left
                    .clamp(primary.left, (primary.right - win_w).max(primary.left));
                let target_y = cur
                    .top
                    .clamp(primary.top, (primary.bottom - win_h).max(primary.top));
                cur.left = target_x;
                cur.right = target_x + win_w;
                cur.top = target_y;
                cur.bottom = target_y + win_h;
            }
            break;
        }

        // Left boundary: if cur.left < primary.left, check if another monitor is adjacent to the left
        // spanning the window's vertical range [cur.top, cur.bottom].
        if cur.left < primary.left {
            let has_left_monitor = work_areas.iter().enumerate().any(|(i, r)| {
                i != primary_idx
                    && r.right >= primary.left - 16
                    && r.left < primary.left
                    && r.overlaps_vertical(cur.top, cur.bottom)
            });
            if !has_left_monitor {
                let shift = primary.left - cur.left;
                cur.left += shift;
                cur.right += shift;
            }
        }

        // Right boundary: if cur.right > primary.right, check if another monitor is adjacent to the right
        // spanning the window's vertical range [cur.top, cur.bottom].
        if cur.right > primary.right {
            let has_right_monitor = work_areas.iter().enumerate().any(|(i, r)| {
                i != primary_idx
                    && r.left <= primary.right + 16
                    && r.right > primary.right
                    && r.overlaps_vertical(cur.top, cur.bottom)
            });
            if !has_right_monitor {
                let shift = cur.right - primary.right;
                cur.left -= shift;
                cur.right -= shift;
            }
        }

        // Top boundary: if cur.top < primary.top, check if another monitor is adjacent above
        // spanning the window's horizontal range [cur.left, cur.right].
        if cur.top < primary.top {
            let has_top_monitor = work_areas.iter().enumerate().any(|(i, r)| {
                i != primary_idx
                    && r.bottom >= primary.top - 16
                    && r.top < primary.top
                    && r.overlaps_horizontal(cur.left, cur.right)
            });
            if !has_top_monitor {
                let shift = primary.top - cur.top;
                cur.top += shift;
                cur.bottom += shift;
            }
        }

        // Bottom boundary: if cur.bottom > primary.bottom, check if another monitor is adjacent below
        // spanning the window's horizontal range [cur.left, cur.right].
        if cur.bottom > primary.bottom {
            let has_bottom_monitor = work_areas.iter().enumerate().any(|(i, r)| {
                i != primary_idx
                    && r.top <= primary.bottom + 16
                    && r.bottom > primary.bottom
                    && r.overlaps_horizontal(cur.left, cur.right)
            });
            if !has_bottom_monitor {
                let shift = cur.bottom - primary.bottom;
                cur.top -= shift;
                cur.bottom -= shift;
            }
        }
    }

    cur.left != orig.left || cur.top != orig.top
}

#[cfg(windows)]
unsafe extern "system" fn enum_monitors_callback(
    hmonitor: windows_sys::Win32::Graphics::Gdi::HMONITOR,
    _hdc: windows_sys::Win32::Graphics::Gdi::HDC,
    _rect: *mut windows_sys::Win32::Foundation::RECT,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> i32 {
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITORINFO};
    let list = &mut *(lparam as *mut Vec<WinRect>);
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if GetMonitorInfoW(hmonitor, &mut info) != 0 {
        list.push(WinRect {
            left: info.rcWork.left,
            top: info.rcWork.top,
            right: info.rcWork.right,
            bottom: info.rcWork.bottom,
        });
    }
    1
}

#[cfg(windows)]
fn get_all_work_areas() -> Vec<WinRect> {
    use windows_sys::Win32::Graphics::Gdi::EnumDisplayMonitors;
    let mut list = Vec::new();
    unsafe {
        EnumDisplayMonitors(
            std::ptr::null_mut(),
            std::ptr::null(),
            Some(enum_monitors_callback),
            &mut list as *mut _ as isize,
        );
    }
    list
}

#[cfg(windows)]
fn analog_hit_root(hwnd: windows_sys::Win32::Foundation::HWND) -> Option<isize> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetAncestor, GetParent, GA_ROOT};
    let roots = lock_or_recover(analog_hit_roots());
    let self_key = hwnd as isize;
    if roots.contains(&self_key) {
        return Some(self_key);
    }
    unsafe {
        let root = GetAncestor(hwnd, GA_ROOT);
        let root_key = root as isize;
        if !root.is_null() && roots.contains(&root_key) {
            return Some(root_key);
        }
        let mut cur = hwnd;
        for _ in 0..8 {
            let parent = GetParent(cur);
            if parent.is_null() {
                break;
            }
            let key = parent as isize;
            if roots.contains(&key) {
                return Some(key);
            }
            cur = parent;
        }
    }
    None
}

/// True when the cursor is on the visible dial. The dial is a fixed CSS
/// circle centered in the window; zoom only grows the transparent margin.
#[cfg(windows)]
fn analog_cursor_on_dial(root: isize) -> bool {
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    // These two live in user32. windows-sys 0.61 does not export them from
    // the features this crate already enables.
    #[link(name = "user32")]
    extern "system" {
        fn ScreenToClient(hwnd: windows_sys::Win32::Foundation::HWND, lppoint: *mut POINT) -> i32;
        fn GetClientRect(hwnd: windows_sys::Win32::Foundation::HWND, lprect: *mut RECT) -> i32;
    }

    let root_hwnd = root as windows_sys::Win32::Foundation::HWND;
    let mut pt = POINT { x: 0, y: 0 };
    unsafe {
        if GetCursorPos(&mut pt) == 0 || ScreenToClient(root_hwnd, &mut pt) == 0 {
            return true;
        }
        let mut rc = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if GetClientRect(root_hwnd, &mut rc) == 0 {
            return true;
        }
        let w = (rc.right - rc.left) as f64;
        let h = (rc.bottom - rc.top) as f64;
        if w <= 1.0 || h <= 1.0 {
            return true;
        }
        let dpi = GetDpiForWindow(root_hwnd);
        let scale = if dpi == 0 { 1.0 } else { dpi as f64 / 96.0 };
        let radius = (ANALOG_DIAL_CSS_PX / 2.0 + ANALOG_DIAL_HIT_SLACK_CSS_PX) * scale;
        let dx = pt.x as f64 - w / 2.0;
        let dy = pt.y as f64 - h / 2.0;
        dx * dx + dy * dy <= radius * radius
    }
}

#[cfg(windows)]
fn subclass_analog_descendants(root: windows_sys::Win32::Foundation::HWND) {
    use windows_sys::Win32::UI::WindowsAndMessaging::EnumChildWindows;
    unsafe {
        EnumChildWindows(root, Some(subclass_analog_child_cb), 0);
    }
}

#[cfg(windows)]
unsafe extern "system" fn subclass_analog_child_cb(
    hwnd: windows_sys::Win32::Foundation::HWND,
    _lparam: windows_sys::Win32::Foundation::LPARAM,
) -> i32 {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;
    SetWindowSubclass(hwnd, Some(window_drag_subclass_proc), 0xCC02, 0);
    1
}

#[cfg(windows)]
fn note_analog_hit_window(window: &WebviewWindow) {
    if !window.label().starts_with("float-analog") {
        return;
    }
    if let Ok(hwnd) = window.hwnd() {
        let raw = hwnd.0 as isize;
        lock_or_recover(analog_hit_roots()).insert(raw);
        subclass_analog_descendants(hwnd.0 as _);
        apply_analog_hit_tree(hwnd.0 as _, false);
    }
}

/// Clip the analog window to the dial. Hit-testing the square in
/// WM_NCHITTEST does not reach WebView2's child, so the transparent
/// margin still stole clicks. The window region does: pixels outside
/// the ellipse belong to whatever is behind. The menu clears the
/// region while it is open, because it is drawn in that margin.
#[cfg(windows)]
fn apply_analog_window_region(hwnd: windows_sys::Win32::Foundation::HWND, full: bool) {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::HiDpi::GetDpiForWindow;

    #[link(name = "user32")]
    extern "system" {
        fn SetWindowRgn(
            hwnd: windows_sys::Win32::Foundation::HWND,
            hrgn: *mut core::ffi::c_void,
            redraw: i32,
        ) -> i32;
        fn GetWindowRect(hwnd: windows_sys::Win32::Foundation::HWND, lprect: *mut RECT) -> i32;
        fn GetClientRect(hwnd: windows_sys::Win32::Foundation::HWND, lprect: *mut RECT) -> i32;
        fn ClientToScreen(
            hwnd: windows_sys::Win32::Foundation::HWND,
            lppoint: *mut windows_sys::Win32::Foundation::POINT,
        ) -> i32;
    }
    #[link(name = "gdi32")]
    extern "system" {
        fn CreateEllipticRgn(x1: i32, y1: i32, x2: i32, y2: i32) -> *mut core::ffi::c_void;
        fn DeleteObject(ho: *mut core::ffi::c_void) -> i32;
    }

    unsafe {
        if full {
            SetWindowRgn(hwnd, std::ptr::null_mut(), 1);
            return;
        }
        let mut rc = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if GetWindowRect(hwnd, &mut rc) == 0 {
            return;
        }
        let w = rc.right - rc.left;
        let h = rc.bottom - rc.top;
        if w <= 1 || h <= 1 {
            return;
        }
        let mut client = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        let mut origin = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
        if GetClientRect(hwnd, &mut client) == 0 || ClientToScreen(hwnd, &mut origin) == 0 {
            return;
        }
        let cw = client.right - client.left;
        let ch = client.bottom - client.top;
        if cw <= 1 || ch <= 1 {
            return;
        }
        let dpi = GetDpiForWindow(hwnd);
        let scale = if dpi == 0 { 1.0 } else { dpi as f64 / 96.0 };
        let mut d =
            ((ANALOG_DIAL_CSS_PX + ANALOG_DIAL_HIT_SLACK_CSS_PX * 2.0) * scale).round() as i32;
        d = d.min(cw).min(ch).max(1);
        // Region coordinates are window-relative. The dial is centered in
        // the client area, which is not always the window rectangle.
        let left = (origin.x - rc.left) + (cw - d) / 2;
        let top = (origin.y - rc.top) + (ch - d) / 2;
        let rgn = CreateEllipticRgn(left, top, left + d, top + d);
        if rgn.is_null() {
            return;
        }
        if SetWindowRgn(hwnd, rgn, 1) == 0 {
            DeleteObject(rgn);
        }
    }
}

/// Only the top-level window is clipped. A region on the WebView2 host
/// paints that host's white background along the top of the dial.
#[cfg(windows)]
fn apply_analog_hit_tree(root: windows_sys::Win32::Foundation::HWND, full: bool) {
    use windows_sys::Win32::UI::WindowsAndMessaging::EnumChildWindows;
    apply_analog_window_region(root, full);
    unsafe {
        EnumChildWindows(root, Some(analog_region_child_cb), if full { 1 } else { 0 });
    }
}

#[cfg(windows)]
unsafe extern "system" fn analog_region_child_cb(
    hwnd: windows_sys::Win32::Foundation::HWND,
    lparam: windows_sys::Win32::Foundation::LPARAM,
) -> i32 {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetAncestor, GA_ROOT};

    #[link(name = "user32")]
    extern "system" {
        fn GetWindowRect(hwnd: windows_sys::Win32::Foundation::HWND, lprect: *mut RECT) -> i32;
    }

    let root = GetAncestor(hwnd, GA_ROOT);
    if root.is_null() {
        return 1;
    }
    let mut root_rc = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    let mut child_rc = root_rc;
    if GetWindowRect(root, &mut root_rc) == 0 || GetWindowRect(hwnd, &mut child_rc) == 0 {
        return 1;
    }
    let rw = root_rc.right - root_rc.left;
    let rh = root_rc.bottom - root_rc.top;
    let cw = child_rc.right - child_rc.left;
    let ch = child_rc.bottom - child_rc.top;
    if (cw - rw).abs() <= 8 && (ch - rh).abs() <= 8 {
        clear_window_region(hwnd);
    }
    let _ = lparam;
    1
}

#[cfg(windows)]
fn clear_window_region(hwnd: windows_sys::Win32::Foundation::HWND) {
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowRgn(
            hwnd: windows_sys::Win32::Foundation::HWND,
            hrgn: *mut core::ffi::c_void,
            redraw: i32,
        ) -> i32;
    }
    unsafe {
        SetWindowRgn(hwnd, std::ptr::null_mut(), 1);
    }
}

#[cfg(windows)]
fn sync_analog_hit_region(window: &WebviewWindow) {
    if !window.label().starts_with("float-analog") {
        return;
    }
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let raw = hwnd.0 as isize;
    let full = lock_or_recover(analog_menu_capture()).contains(&raw);
    apply_analog_hit_tree(hwnd.0 as _, full);
}

/// Closed-hand cursor kept up for the whole native drag. The page sets
/// `cursor: grabbing` only until `startDragging` enters the system move
/// loop, which then forces the arrow.
#[cfg(windows)]
fn show_widget_drag_cursor() {
    #[link(name = "user32")]
    extern "system" {
        fn SetCursor(hcursor: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
    }
    let cursor = grabbing_cursor();
    if !cursor.is_null() {
        unsafe {
            SetCursor(cursor);
        }
    }
}

#[cfg(windows)]
fn grabbing_cursor() -> *mut core::ffi::c_void {
    static CURSOR: OnceLock<isize> = OnceLock::new();
    let raw = CURSOR.get_or_init(|| unsafe { create_grabbing_cursor() as isize });
    *raw as *mut core::ffi::c_void
}

#[cfg(windows)]
unsafe fn create_grabbing_cursor() -> *mut core::ffi::c_void {
    #[link(name = "user32")]
    extern "system" {
        fn GetDC(hwnd: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
        fn ReleaseDC(hwnd: *mut core::ffi::c_void, hdc: *mut core::ffi::c_void) -> i32;
        fn CreateIconIndirect(info: *const GrabIconInfo) -> *mut core::ffi::c_void;
        fn LoadCursorW(
            instance: *mut core::ffi::c_void,
            name: *const u16,
        ) -> *mut core::ffi::c_void;
    }
    #[link(name = "gdi32")]
    extern "system" {
        fn CreateDIBSection(
            hdc: *mut core::ffi::c_void,
            pbmi: *const GrabBitmapInfo,
            usage: u32,
            bits: *mut *mut u8,
            section: *mut core::ffi::c_void,
            offset: u32,
        ) -> *mut core::ffi::c_void;
        fn CreateBitmap(
            width: i32,
            height: i32,
            planes: u32,
            bit_count: u32,
            bits: *const u8,
        ) -> *mut core::ffi::c_void;
        fn DeleteObject(obj: *mut core::ffi::c_void) -> i32;
    }

    #[repr(C)]
    struct GrabIconInfo {
        f_icon: i32,
        x_hotspot: u32,
        y_hotspot: u32,
        hbm_mask: *mut core::ffi::c_void,
        hbm_color: *mut core::ffi::c_void,
    }
    #[repr(C)]
    struct GrabBitmapHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_pels: i32,
        y_pels: i32,
        clr_used: u32,
        clr_important: u32,
    }
    #[repr(C)]
    struct GrabBitmapInfo {
        header: GrabBitmapHeader,
        colors: u32,
    }

    // 32×32 closed hand. `o` outline, `s` fill, `.` transparent.
    // Hotspot sits in the palm so the hand stays where the click began.
    const HAND: [&str; 32] = [
        "................................",
        "................................",
        "..........oo..oo..oo............",
        ".........osssoosssoossso........",
        "........ossssssssssssssso.......",
        ".......ossssssssssssssssso......",
        "......ossssssssssssssssssso.....",
        ".....ossssssssssssssssssssso....",
        "....oossssssssssssssssssssso....",
        "...oosssssssssssssssssssssso....",
        "..oossssssssssssssssssssssso....",
        "..osssssssssssssssssssssssso....",
        "..osssssssssssssssssssssssso....",
        "...ossssssssssssssssssssssso....",
        "...ossssssssssssssssssssssso....",
        "....osssssssssssssssssssssso....",
        "....osssssssssssssssssssssso....",
        ".....ossssssssssssssssssssso....",
        ".....ossssssssssssssssssssso....",
        "......osssssssssssssssssssso....",
        "......oossssssssssssssssssso....",
        ".......ossssssssssssssssssso....",
        ".......oosssssssssssssssssso....",
        "........osssssssssssssssssso....",
        "........oossssssssssssssso......",
        ".........ooooooooooooooooo......",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
    ];

    const SIZE: i32 = 32;
    let info = GrabBitmapInfo {
        header: GrabBitmapHeader {
            size: std::mem::size_of::<GrabBitmapHeader>() as u32,
            width: SIZE,
            height: -SIZE,
            planes: 1,
            bit_count: 32,
            compression: 0,
            size_image: 0,
            x_pels: 0,
            y_pels: 0,
            clr_used: 0,
            clr_important: 0,
        },
        colors: 0,
    };
    let hdc = GetDC(std::ptr::null_mut());
    let mut bits: *mut u8 = std::ptr::null_mut();
    let color = CreateDIBSection(hdc, &info, 0, &mut bits, std::ptr::null_mut(), 0);
    ReleaseDC(std::ptr::null_mut(), hdc);
    if color.is_null() || bits.is_null() {
        return LoadCursorW(std::ptr::null_mut(), 32649usize as *const u16);
    }

    let pixels = std::slice::from_raw_parts_mut(bits, (SIZE * SIZE * 4) as usize);
    let mut mask = [0xffu8; (32 * 4) as usize];
    for y in 0..32 {
        let row = HAND[y].as_bytes();
        for x in 0..32 {
            let px = (y * 32 + x) * 4;
            let (b, g, r, a) = match row[x] {
                b'o' => (255u8, 255, 255, 255),
                b's' => (36u8, 36, 40, 255),
                _ => (0u8, 0, 0, 0),
            };
            pixels[px] = b;
            pixels[px + 1] = g;
            pixels[px + 2] = r;
            pixels[px + 3] = a;
            if a != 0 {
                let byte = y * 4 + x / 8;
                mask[byte] &= !(0x80u8 >> (x % 8));
            }
        }
    }

    let mono = CreateBitmap(SIZE, SIZE, 1, 1, mask.as_ptr());
    let icon = GrabIconInfo {
        f_icon: 0,
        x_hotspot: 14,
        y_hotspot: 12,
        hbm_mask: mono,
        hbm_color: color,
    };
    let cursor = CreateIconIndirect(&icon);
    if !mono.is_null() {
        DeleteObject(mono);
    }
    DeleteObject(color);
    if cursor.is_null() {
        LoadCursorW(std::ptr::null_mut(), 32649usize as *const u16)
    } else {
        cursor
    }
}

#[cfg(windows)]
unsafe extern "system" fn window_drag_subclass_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows_sys::Win32::Foundation::WPARAM,
    lparam: windows_sys::Win32::Foundation::LPARAM,
    uid_subclass: usize,
    _ref_data: usize,
) -> windows_sys::Win32::Foundation::LRESULT {
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        WM_CREATE, WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE, WM_MOVING, WM_NCDESTROY, WM_NCHITTEST,
        WM_PARENTNOTIFY, WM_SETCURSOR,
    };

    // The analog window is a square larger than the dial. Clicks in that
    // margin (and in the square's corners outside the circle) pass through
    // to whatever is behind. The menu opens inside the same window, so while
    // it is up the full square stays live.
    if msg == WM_NCHITTEST {
        if let Some(root) = analog_hit_root(hwnd) {
            let menu_open = lock_or_recover(analog_menu_capture()).contains(&root);
            if !menu_open && !analog_cursor_on_dial(root) {
                return windows_sys::Win32::UI::WindowsAndMessaging::HTTRANSPARENT as _;
            }
        }
    }

    // WebView2 creates its input child after the page loads. Subclass it so
    // the same hit test runs on the window that actually receives the cursor.
    if msg == WM_PARENTNOTIFY {
        let event = (wparam & 0xFFFF) as u32;
        if event == WM_CREATE && analog_hit_root(hwnd).is_some() {
            let child = lparam as windows_sys::Win32::Foundation::HWND;
            if !child.is_null() {
                SetWindowSubclass(child, Some(window_drag_subclass_proc), 0xCC02, 0);
            }
        }
    }

    // The system move loop replaces the page's grabbing cursor with the
    // arrow on the first move. Put the closed hand back and keep it
    // there until the drag ends.
    if msg == WM_ENTERSIZEMOVE {
        WIDGET_DRAG_CURSOR.store(true, Ordering::Release);
        show_widget_drag_cursor();
    }
    if msg == WM_EXITSIZEMOVE {
        WIDGET_DRAG_CURSOR.store(false, Ordering::Release);
    }
    if msg == WM_SETCURSOR && WIDGET_DRAG_CURSOR.load(Ordering::Acquire) {
        show_widget_drag_cursor();
        return 1;
    }

    if msg == WM_MOVING {
        WIDGET_DRAG_CURSOR.store(true, Ordering::Release);
        show_widget_drag_cursor();
        if EDGE_LIMITS_ENABLED.load(Ordering::Acquire) {
            let rect = &mut *(lparam as *mut windows_sys::Win32::Foundation::RECT);
            let work_areas = get_all_work_areas();
            if !work_areas.is_empty() {
                let mut cur = WinRect {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                };
                if clamp_rect_coords(&mut cur, &work_areas, true) {
                    rect.left = cur.left;
                    rect.top = cur.top;
                    rect.right = cur.right;
                    rect.bottom = cur.bottom;
                }
            }
        }
        DefSubclassProc(hwnd, msg, wparam, lparam);
        return 1;
    }

    if msg == WM_NCDESTROY {
        let key = hwnd as isize;
        lock_or_recover(analog_hit_roots()).remove(&key);
        lock_or_recover(analog_menu_capture()).remove(&key);
        RemoveWindowSubclass(hwnd, Some(window_drag_subclass_proc), uid_subclass);
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

#[cfg(windows)]
fn attach_window_drag_subclass(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        use windows_sys::Win32::UI::Shell::SetWindowSubclass;
        note_analog_hit_window(window);
        unsafe {
            SetWindowSubclass(hwnd.0 as _, Some(window_drag_subclass_proc), 0xCC01, 0);
        }
    }
}

/// While the analog context menu is open, clicks anywhere in its window
/// count. Otherwise only the visible dial does. Also subclasses WebView2
/// children, which may not exist yet at window creation.
#[tauri::command]
fn set_analog_menu_capture(window: WebviewWindow, capture: bool) {
    #[cfg(windows)]
    {
        if !window.label().starts_with("float-analog") {
            return;
        }
        if let Ok(hwnd) = window.hwnd() {
            let raw = hwnd.0 as isize;
            lock_or_recover(analog_hit_roots()).insert(raw);
            if capture {
                lock_or_recover(analog_menu_capture()).insert(raw);
            } else {
                lock_or_recover(analog_menu_capture()).remove(&raw);
            }
            subclass_analog_descendants(hwnd.0 as _);
            apply_analog_hit_tree(hwnd.0 as _, capture);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, capture);
    }
}

#[tauri::command]
fn clamp_current_window_to_monitors(window: WebviewWindow) -> bool {
    #[cfg(windows)]
    attach_window_drag_subclass(&window);
    clamp_window_to_monitors(&window)
}

#[cfg(not(windows))]
fn get_all_work_areas() -> Vec<WinRect> {
    Vec::new()
}

/// Relocate open mini clock and floating widgets to the center of the
/// active display (where the user's cursor currently is).
fn center_open_widgets_on_active_monitor(app: &AppHandle) {
    #[cfg(windows)]
    let active_work_area: Option<WinRect> = {
        use windows_sys::Win32::Foundation::POINT;
        use windows_sys::Win32::Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut pt = POINT { x: 0, y: 0 };
        unsafe {
            if GetCursorPos(&mut pt) != 0 {
                let mon = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
                if !mon.is_null() {
                    let mut info = MONITORINFO {
                        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                        ..Default::default()
                    };
                    if GetMonitorInfoW(mon, &mut info) != 0 {
                        Some(WinRect {
                            left: info.rcWork.left,
                            top: info.rcWork.top,
                            right: info.rcWork.right,
                            bottom: info.rcWork.bottom,
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        }
    };

    #[cfg(not(windows))]
    let active_work_area: Option<WinRect> = None;

    let target_wa = active_work_area.or_else(|| {
        let work_areas = get_all_work_areas();
        work_areas.first().copied()
    });

    let Some(wa) = target_wa else { return };
    let wa_w = wa.right - wa.left;
    let wa_h = wa.bottom - wa.top;
    if wa_w <= 0 || wa_h <= 0 {
        return;
    }

    let settings = load_settings(app);
    let is_mini = settings.window_mode != "full";

    // Categorize open windows into modular dashboard columns:
    // Column 1 (Bars): Mini clock (if active) + Timers & Stopwatches
    // Column 2 (Calendar): Floating Calendar
    // Column 3 (Analog): Floating Analog Clock
    let mut bars: Vec<(WebviewWindow, i32, i32)> = Vec::new();
    let mut cals: Vec<(WebviewWindow, i32, i32)> = Vec::new();
    let mut analogs: Vec<(WebviewWindow, i32, i32)> = Vec::new();

    if is_mini {
        if let Some(mini) = app.get_webview_window("mini") {
            let size = mini
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(260, 48));
            bars.push((mini, size.width as i32, size.height as i32));
        }
    }

    let mut float_windows = Vec::new();
    for (label, win) in app.webview_windows() {
        if label.starts_with("float-") && win.is_visible().unwrap_or(false) {
            float_windows.push(win);
        }
    }
    float_windows.sort_by(|a, b| a.label().cmp(b.label()));

    for win in float_windows {
        let label = win.label().to_string();
        if label.starts_with("float-cal") {
            let size = win
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(286, 268));
            cals.push((win, size.width as i32, size.height as i32));
        } else if label.starts_with("float-analog") {
            let size = win
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(316, 316));
            analogs.push((win, size.width as i32, size.height as i32));
        } else if label.starts_with("float-relax") {
            let size = win
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(300, 176));
            bars.push((win, size.width as i32, size.height as i32));
        } else if label.starts_with("float-timer") {
            let size = win
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(286, 92));
            bars.push((win, size.width as i32, size.height as i32));
        } else {
            let size = win
                .outer_size()
                .unwrap_or(tauri::PhysicalSize::new(286, 52));
            bars.push((win, size.width as i32, size.height as i32));
        }
    }

    let mut active_cols: Vec<Vec<(WebviewWindow, i32, i32)>> = Vec::new();
    if !bars.is_empty() {
        active_cols.push(bars);
    }
    if !cals.is_empty() {
        active_cols.push(cals);
    }
    if !analogs.is_empty() {
        active_cols.push(analogs);
    }

    if active_cols.is_empty() {
        return;
    }

    let col_gap = 16;
    let row_gap = 10;

    let total_width: i32 = active_cols
        .iter()
        .map(|col| col.iter().map(|(_, w, _)| *w).max().unwrap_or(0))
        .sum::<i32>()
        + (active_cols.len().saturating_sub(1) as i32) * col_gap;

    let max_height: i32 = active_cols
        .iter()
        .map(|col| {
            let heights_sum: i32 = col.iter().map(|(_, _, h)| *h).sum();
            let gaps: i32 = (col.len().saturating_sub(1) as i32) * row_gap;
            heights_sum + gaps
        })
        .max()
        .unwrap_or(0);

    let start_x = wa.left + ((wa_w - total_width).max(0)) / 2;
    let group_top_y = wa.top + ((wa_h - max_height).max(0)) / 2;

    let mut current_col_x = start_x;
    for col in active_cols {
        let col_w = col.iter().map(|(_, w, _)| *w).max().unwrap_or(0);
        let col_h: i32 = col.iter().map(|(_, _, h)| *h).sum::<i32>()
            + (col.len().saturating_sub(1) as i32) * row_gap;
        let col_top_y = group_top_y + (max_height - col_h).max(0) / 2;

        let mut curr_y = col_top_y;
        for (win, w, h) in col {
            let win_x = current_col_x + (col_w - w).max(0) / 2;
            let win_y = curr_y;

            let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                win_x, win_y,
            )));
            let _ = win.unminimize();
            let _ = win.show();
            reapply_click_through(app, &win);
            clamp_window_to_monitors(&win);

            let label = win.label().to_string();
            if label == "mini" {
                refresh_taskbar_tab(&win);
                let _ = update_settings(app, |s| {
                    s.mini_position = Some((win_x, win_y));
                    Ok(())
                });
            } else if label.starts_with("float-cal") {
                let _ = update_settings(app, |s| {
                    s.float_cal_position = Some((win_x, win_y));
                    Ok(())
                });
            } else if label.starts_with("float-analog") {
                let _ = update_settings(app, |s| {
                    s.float_analog_position = Some((win_x, win_y));
                    Ok(())
                });
            } else if label.starts_with("float-relax") {
                let _ = update_settings(app, |s| {
                    s.float_relax_position = Some((win_x, win_y));
                    Ok(())
                });
            }

            curr_y += h + row_gap;
        }

        current_col_x += col_w + col_gap;
    }

    let _ = app.emit("settings:updated", load_settings(app));
}

#[tauri::command]
fn center_open_widgets(app: AppHandle) {
    center_open_widgets_on_active_monitor(&app);
}

/// The monitor that currently holds the mouse pointer: the "active"
/// monitor, CyberLauncher style. Used when automatic display selection
/// is enabled so full mode opens wherever the user is working.
fn monitor_under_cursor(window: &WebviewWindow) -> Option<tauri::Monitor> {
    let pos = window.cursor_position().ok()?;
    window.available_monitors().ok()?.into_iter().find(|m| {
        let mp = m.position();
        let ms = m.size();
        let px = pos.x as i32;
        let py = pos.y as i32;
        px >= mp.x && px < mp.x + ms.width as i32 && py >= mp.y && py < mp.y + ms.height as i32
    })
}

/// Size and position the full clock on its monitor. Automatic mode
/// (CyberLauncher style) picks the monitor that holds the mouse
/// pointer; otherwise the preferred display from the Display tab is
/// used. Full mode fills the monitor's WORK AREA, so taskbars docked
/// on any edge are respected.
fn place_full_clock(main: &WebviewWindow, settings: &AppSettings) {
    let mut monitor = if settings.display_auto {
        monitor_under_cursor(main)
    } else {
        None
    };
    if monitor.is_none() {
        let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
        monitor = main.available_monitors().ok().and_then(|monitors| {
            monitors
                .get(display_id)
                .or_else(|| monitors.first())
                .cloned()
        });
    }
    if let Some(m) = monitor {
        let work_area = m.work_area();
        info!(
            "place_full_clock: monitor {:?} work area {:?}",
            m.name(),
            (work_area.position, work_area.size)
        );
        let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            work_area.position.x,
            work_area.position.y,
        )));
        let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
            work_area.size.width,
            work_area.size.height,
        )));
    }
}

// ─────────────────────────────────────────────────────────────
// Clock accuracy (NTP drift check + warning notification)
// ─────────────────────────────────────────────────────────────
// A dead CMOS battery (or any timezone mishap) leaves the system clock
// wrong after boot, which silently corrupts every alarm and chime.
// This loop measures the drift against network time servers
// (read-only, no privileges) and sends a system notification when the
// deviation exceeds a minute, so a wrong clock is caught at startup
// instead of through mysterious errors later on.

/// Notify from this much drift on (60 s). Smaller deviations only show
/// in the settings readout.
const CLOCK_DRIFT_NOTIFY_MS: i64 = 60_000;

/// Send the drift notification at most once per process: a machine
/// with a dead battery would otherwise get a toast every 6 hours.
static CLOCK_DRIFT_NOTIFIED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Persisted status of the last clock accuracy check (serializable
/// over IPC: `Measurement` itself is an internal type).
#[derive(Clone, serde::Serialize)]
pub struct ClockAccuracy {
    pub drift_ms: Option<i64>,
    pub checked_at: Option<i64>,
    pub source: Option<String>,
}

/// Run one measurement, persist the result, broadcast it to the
/// windows and (optionally) notify. Returns the status that the
/// caller (command or loop) can pass on.
fn run_clock_check(app: &AppHandle, notify_allowed: bool) -> ClockAccuracy {
    let status = |drift_ms: Option<i64>, source: Option<&str>| ClockAccuracy {
        drift_ms,
        checked_at: if drift_ms.is_some() {
            Some(Local::now().timestamp())
        } else {
            None
        },
        source: source.map(|s| s.to_string()),
    };

    match time_sync::measure() {
        Ok(m) => {
            let now = Local::now().timestamp();
            let _ = update_settings(app, |s| {
                s.clock_drift_ms = Some(m.drift_ms);
                s.clock_checked_at = Some(now);
                Ok(())
            });
            let _ = app.emit(
                "clock:accuracy",
                serde_json::json!({
                    "driftMs": m.drift_ms,
                    "checkedAt": now,
                    "source": m.source,
                }),
            );
            info!("clock accuracy: drift {} ms ({})", m.drift_ms, m.source);

            if m.drift_ms.abs() <= CLOCK_DRIFT_NOTIFY_MS {
                CLOCK_DRIFT_NOTIFIED.store(false, Ordering::SeqCst);
            } else if notify_allowed && !CLOCK_DRIFT_NOTIFIED.swap(true, Ordering::SeqCst) {
                send_clock_notification(app, m.drift_ms);
            }
            status(Some(m.drift_ms), Some(m.source))
        }
        Err(e) => {
            // Transient failures keep the last good persisted values;
            // this result only tells the requesting UI that the check
            // itself could not run.
            warn!("clock accuracy: no time source reachable: {}", e);
            let _ = app.emit(
                "clock:accuracy",
                serde_json::json!({ "driftMs": null, "checkedAt": null, "source": "unreachable" }),
            );
            status(None, Some("unreachable"))
        }
    }
}

/// Background loop: at boot the network often is not up yet when the
/// Run key fires, so retry for ~10 minutes; afterwards re-check every
/// 6 hours while auto-check is enabled.
fn clock_accuracy_loop(app: AppHandle) {
    for _ in 0..10 {
        std::thread::sleep(std::time::Duration::from_secs(30));
        let check = run_clock_check(&app, true);
        if let Some(drift) = check.drift_ms {
            let s = load_settings(&app);
            if s.clock_auto_sync
                && drift.abs() > CLOCK_DRIFT_NOTIFY_MS
                && is_time_sync_task_registered()
            {
                info!(
                    "clock accuracy: auto-syncing system clock due to drift of {} ms",
                    drift
                );
                let _ = sync_system_clock_internal(&app);
            }
            break;
        }
    }
    loop {
        std::thread::sleep(std::time::Duration::from_secs(6 * 3600));
        let s = load_settings(&app);
        if s.clock_accuracy_enabled {
            let check = run_clock_check(&app, true);
            if let Some(drift) = check.drift_ms {
                if s.clock_auto_sync
                    && drift.abs() > CLOCK_DRIFT_NOTIFY_MS
                    && is_time_sync_task_registered()
                {
                    info!("clock accuracy: auto-syncing system clock (periodic) due to drift of {} ms", drift);
                    let _ = sync_system_clock_internal(&app);
                }
            }
        }
    }
}

fn send_clock_notification(app: &AppHandle, drift_ms: i64) {
    use tauri_plugin_notification::NotificationExt;
    let drift = format_drift(drift_ms);
    let (title, body) = if display_language(app) == "es" {
        (
            "CyberClock",
            format!(
                "La hora del sistema parece incorrecta: desfase de {}. Sincroniza el reloj de Windows.",
                drift
            ),
        )
    } else {
        (
            "CyberClock",
            format!(
                "The system time seems wrong: off by {}. Sync your Windows clock.",
                drift
            ),
        )
    };
    if let Err(e) = app.notification().builder().title(title).body(&body).show() {
        warn!("clock accuracy: notification failed: {}", e);
    }
}

/// Humanize a drift for the notification: "1.4 s", "5 min", "3 h",
/// "2 d" (units are language-neutral).
fn format_drift(ms: i64) -> String {
    let abs = ms.abs();
    if abs < 60_000 {
        format!("{:.1} s", abs as f64 / 1000.0)
    } else if abs < 3_600_000 {
        format!("{} min", abs / 60_000)
    } else if abs < 86_400_000 {
        format!("{} h", abs / 3_600_000)
    } else {
        format!("{} d", abs / 86_400_000)
    }
}

/// UI language for backend-generated text: the explicit setting wins,
/// "auto" falls back to the system UI language (English as last resort).
fn display_language(app: &AppHandle) -> String {
    match load_settings(app).language.as_str() {
        "es" => "es".to_string(),
        "en" => "en".to_string(),
        _ => system_ui_language(),
    }
}

#[cfg(target_os = "windows")]
fn system_ui_language() -> String {
    use windows_sys::Win32::Globalization::GetUserDefaultLocaleName;
    const BUF_LEN: usize = 85; // LOCALE_NAME_MAX_LENGTH
    let mut buf = [0u16; BUF_LEN];
    let len = unsafe { GetUserDefaultLocaleName(buf.as_mut_ptr(), BUF_LEN as i32) };
    if len > 1 {
        let locale = String::from_utf16_lossy(&buf[..(len - 1) as usize]);
        if locale.to_ascii_lowercase().starts_with("es") {
            return "es".to_string();
        }
    }
    "en".to_string()
}

#[cfg(not(target_os = "windows"))]
fn system_ui_language() -> String {
    "en".to_string()
}

/// Manual "Check now": measures off-thread (a server timeout can take
/// seconds) and returns the persisted status.
#[tauri::command]
async fn check_clock_accuracy(app: AppHandle) -> ClockAccuracy {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_for_thread = app.clone();
    std::thread::spawn(move || {
        let _ = tx.send(run_clock_check(&app_for_thread, true));
    });
    rx.recv().unwrap_or_else(|_| ClockAccuracy {
        drift_ms: None,
        checked_at: None,
        source: Some("unreachable".to_string()),
    })
}

const TIME_SYNC_TASK_NAME: &str = "CyberClockTimeSync";

#[cfg(target_os = "windows")]
fn is_time_sync_task_registered() -> bool {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    // 1. Check if schtasks /query succeeds (which requires read permission on the task)
    let status = Command::new("schtasks.exe")
        .args(["/query", "/tn", TIME_SYNC_TASK_NAME])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .status();
    if let Ok(s) = status {
        if s.success() {
            return true;
        }
    }
    // 2. Also check if the task file exists in System32\Tasks
    std::path::Path::new(r"C:\Windows\System32\Tasks")
        .join(TIME_SYNC_TASK_NAME)
        .exists()
}

#[cfg(not(target_os = "windows"))]
fn is_time_sync_task_registered() -> bool {
    false
}

fn sync_system_clock_internal(app: &AppHandle) -> Result<ClockAccuracy, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        let has_task = is_time_sync_task_registered();
        let mut ran_ok = false;
        if has_task {
            info!(
                "sync_system_clock: triggering scheduled task {}",
                TIME_SYNC_TASK_NAME
            );
            let status = Command::new("schtasks.exe")
                .args(["/run", "/tn", TIME_SYNC_TASK_NAME])
                .creation_flags(0x0800_0000)
                .status();
            ran_ok = match status {
                Ok(s) => s.success(),
                Err(_) => false,
            };
        }

        if !ran_ok {
            info!("sync_system_clock: task run failed or not registered, invoking elevated cmd");
            let script = "Start-Process cmd.exe -ArgumentList '/c net start w32time & w32tm /resync /force' -Verb RunAs -WindowStyle Hidden -Wait";
            let status = Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    script,
                ])
                .creation_flags(0x0800_0000)
                .status()
                .map_err(|e| format!("failed to launch elevated time sync: {}", e))?;
            if !status.success() {
                return Err("Time sync elevation canceled or failed".to_string());
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(2000));
        let accuracy = run_clock_check(app, false);
        Ok(accuracy)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Unsupported operating system".to_string())
    }
}

#[tauri::command]
fn get_time_sync_task_status() -> bool {
    is_time_sync_task_registered()
}

#[tauri::command]
async fn setup_time_sync_task() -> Result<bool, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            use std::process::Command;
            let temp_dir = std::env::temp_dir();
            let ps1_path = temp_dir.join("cc_setup_time_sync.ps1");
            let ps_script = format!(
                r#"$tn = '{0}'
$cmd = 'cmd.exe /c net start w32time & w32tm /resync /force'
schtasks.exe /create /tn $tn /tr $cmd /sc ONCE /st 00:00 /ru 'SYSTEM' /rl HIGHEST /f
try {{
    $svc = New-Object -ComObject 'Schedule.Service'
    $svc.Connect()
    $task = $svc.GetFolder('\').GetTask($tn)
    $sec = $task.GetSecurityDescriptor(0xF)
    if ($sec -and ($sec -notmatch ';;;AU\)')) {{
        $sec = $sec + '(A;;GRGX;;;AU)'
        $task.SetSecurityDescriptor($sec, 0)
    }}
}} catch {{}}
"#,
                TIME_SYNC_TASK_NAME
            );
            let _ = std::fs::write(&ps1_path, ps_script);
            let launcher = format!(
                "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{}\"' -Verb RunAs -WindowStyle Hidden -Wait",
                ps1_path.to_string_lossy()
            );
            let _ = Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &launcher,
                ])
                .creation_flags(0x0800_0000)
                .status();
            let _ = std::fs::remove_file(&ps1_path);

            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = tx.send(Ok(is_time_sync_task_registered()));
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = tx.send(Err("Unsupported operating system".to_string()));
        }
    });
    rx.recv()
        .unwrap_or_else(|_| Err("task setup thread crashed".to_string()))
}

#[tauri::command]
async fn remove_time_sync_task() -> Result<bool, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            use std::process::Command;
            let script = format!(
                "Start-Process schtasks.exe -ArgumentList '/delete /tn \"{}\" /f' -Verb RunAs -WindowStyle Hidden -Wait",
                TIME_SYNC_TASK_NAME
            );
            let _ = Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-Command",
                    &script,
                ])
                .creation_flags(0x0800_0000)
                .output();

            let _ = tx.send(Ok(!is_time_sync_task_registered()));
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = tx.send(Err("Unsupported operating system".to_string()));
        }
    });
    rx.recv()
        .unwrap_or_else(|_| Err("task removal thread crashed".to_string()))
}

#[tauri::command]
async fn sync_system_clock(app: AppHandle) -> Result<ClockAccuracy, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_for_thread = app.clone();
    std::thread::spawn(move || {
        let _ = tx.send(sync_system_clock_internal(&app_for_thread));
    });
    rx.recv()
        .unwrap_or_else(|_| Err("sync thread crashed".to_string()))
}

// ─────────────────────────────────────────────────────────────
// Background loops (relax scheduler, monitor watcher)
// ─────────────────────────────────────────────────────────────

fn compute_next_relax_run(time_str: &str) -> chrono::DateTime<Local> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 2 {
        return Local::now();
    }
    let h: u32 = parts[0].parse().unwrap_or(22);
    let m: u32 = parts[1].parse().unwrap_or(0);

    let now = Local::now();
    let today_candidate = now
        .date_naive()
        .and_hms_opt(h, m, 0)
        .unwrap_or_else(|| now.naive_local());

    let today_dt = Local
        .from_local_datetime(&today_candidate)
        .single()
        .unwrap_or(now);

    if today_dt > now {
        today_dt
    } else {
        today_dt + chrono::Duration::days(1)
    }
}

fn relax_scheduler_loop(app: AppHandle) {
    loop {
        std::thread::sleep(std::time::Duration::from_secs(5));

        let settings = load_settings(&app);
        if !settings.relax_scheduler.enabled {
            continue;
        }

        let state = app.state::<AlarmState>();
        let now = Local::now();

        let mut next_run_opt = lock_or_recover(&state.relax_next_run);

        let next_run = match *next_run_opt {
            Some(dt) => dt,
            None => {
                let dt = compute_next_relax_run(&settings.relax_scheduler.time);
                *next_run_opt = Some(dt);
                dt
            }
        };

        if now >= next_run {
            // Master audio mute: never trigger relax playback while muted.
            if load_settings(&app).audio_muted {
                *next_run_opt = Some(now + chrono::Duration::minutes(1));
                continue;
            }

            // Trigger!
            let trigger_data = serde_json::json!({
                "track": settings.relax_scheduler.track,
                "duration": settings.relax_scheduler.duration,
            });

            let repeat = settings.relax_scheduler.repeat;
            let next_dt = if repeat > 0 {
                now + chrono::Duration::minutes(repeat as i64)
            } else {
                // One-shot: disable scheduler in settings
                let _ = update_settings(&app, |s| {
                    s.relax_scheduler.enabled = false;
                    Ok(())
                });
                let updated = load_settings(&app);
                let _ = app.emit("settings:updated", &updated);

                // Fallback to one year from now
                now + chrono::Duration::days(365)
            };

            // The relax engine lives in the main window (mini/menu have no
            // audio). Emit to main specifically — its webview stays alive
            // even when hidden, so the trigger lands regardless of which
            // window happens to be visible.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("relax:trigger", &trigger_data);
            } else {
                let _ = app.emit("relax:trigger", trigger_data);
            }
            // Keep the visible window's settings UI in sync (one-shot
            // disable above already broadcast app-wide in that branch).
            *next_run_opt = Some(next_dt);
        }
    }
}

fn watch_monitors(app: AppHandle) {
    let mut last_monitors_signature = String::new();
    loop {
        std::thread::sleep(std::time::Duration::from_secs(3));

        // Find any window to query monitors
        let window = app.webview_windows().values().next().cloned();
        if let Some(win) = window {
            if let Ok(monitors) = win.available_monitors() {
                // Create a signature of the current monitors to detect changes
                let mut sig = String::new();
                for m in &monitors {
                    let pos = m.position();
                    let size = m.size();
                    sig.push_str(&format!(
                        "name:{:?};x:{};y:{};w:{};h:{};scale:{:?}|",
                        m.name(),
                        pos.x,
                        pos.y,
                        size.width,
                        size.height,
                        m.scale_factor()
                    ));
                }

                if last_monitors_signature != sig {
                    if !last_monitors_signature.is_empty() {
                        // Display change detected!
                        handle_display_change(app.clone());
                    }
                    last_monitors_signature = sig;
                }
            }
        }
    }
}

fn handle_display_change(app: AppHandle) {
    // Find any window to get monitors
    let monitors = if let Some(win) = app.webview_windows().values().next() {
        win.available_monitors().unwrap_or_default()
    } else {
        Vec::new()
    };

    if monitors.is_empty() {
        return;
    }

    let mut settings_changed = false;
    let mut settings = load_settings(&app);

    let preferred_id = settings.preferred_display_id.unwrap_or(0) as usize;
    if preferred_id >= monitors.len() {
        // Preferred monitor is disconnected! Fallback to primary
        let primary_idx = if let Some(win) = app.webview_windows().values().next() {
            if let Ok(Some(pm)) = win.primary_monitor() {
                monitors
                    .iter()
                    .position(|m| m.name() == pm.name())
                    .unwrap_or(0)
            } else {
                0
            }
        } else {
            0
        };
        settings.preferred_display_id = Some(primary_idx as u32);
        settings_changed = true;
    }

    // Reposition the active windows
    if settings.window_mode == "full" {
        if let Some(main) = app.get_webview_window("main") {
            if main.is_visible().unwrap_or(false) {
                let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
                if let Some(monitor) = monitors.get(display_id).or_else(|| monitors.first()) {
                    let work_area = monitor.work_area();
                    let size = work_area.size;
                    let position = work_area.position;
                    let _ = main.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(position.x, position.y),
                    ));
                    let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                        size.width,
                        size.height,
                    )));
                }
            }
        }
    } else if let Some(mini) = app.get_webview_window("mini") {
        if mini.is_visible().unwrap_or(false) {
            let mut reposition_needed = true;
            if let Some((x, y)) = settings.mini_position {
                // Check if it is still within any monitor's work area/bounds
                if monitors.iter().any(|m| is_position_in_monitor(x, y, m)) {
                    reposition_needed = false;
                }
            }

            if reposition_needed {
                // Move to center of preferred display
                let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
                if let Some(monitor) = monitors.get(display_id).or_else(|| monitors.first()) {
                    let (x, y) = center_mini_on_monitor(monitor);
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                    settings.mini_position = Some((x, y));
                    settings_changed = true;
                }
            }
        }
    }

    if settings_changed {
        let _ = persist(&app, &settings);
    }

    // Broadcast the update so frontends refresh their screen lists
    let _ = app.emit("settings:updated", &settings);
}

// ─────────────────────────────────────────────────────────────
// Global hotkey (show / hide the clock)
// ─────────────────────────────────────────────────────────────
// Optional system-wide shortcut (default Alt+Shift+C) that toggles the
// visibility of the clock in its current mode. An empty setting means
// no hotkey is registered.

/// Normalize casual user input ("alt+shift+c") into the plugin's
/// canonical form ("Alt+Shift+KeyC"). Empty input is valid: the user
/// disabled the hotkey. Returns None for unparseable combinations.
fn normalize_hotkey(input: &str) -> Option<String> {
    let input = input.trim();
    if input.is_empty() {
        return Some(String::new());
    }

    let (mut ctrl, mut alt, mut shift, mut win) = (false, false, false, false);
    let mut key: Option<String> = None;
    for part in input.split('+').map(str::trim).filter(|p| !p.is_empty()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => ctrl = true,
            "alt" => alt = true,
            "shift" => shift = true,
            "super" | "win" | "windows" | "meta" | "cmd" => win = true,
            _ => {
                if key.is_some() {
                    return None; // more than one non-modifier key
                }
                let lower = part.to_ascii_lowercase();
                let token = if lower.len() == 1 {
                    let c = lower.chars().next()?;
                    if c.is_ascii_digit() {
                        format!("Digit{}", c.to_ascii_uppercase())
                    } else if c.is_ascii_alphabetic() {
                        format!("Key{}", c.to_ascii_uppercase())
                    } else {
                        return None;
                    }
                } else {
                    // Named keys pass through uppercased: F1..F24,
                    // Space, Up, Down, Home, Media*, etc.
                    part.to_ascii_uppercase()
                };
                key = Some(token);
            }
        }
    }

    // A bare Shift (or no modifier at all) would hijack normal typing.
    if key.is_none() || !(ctrl || alt || win) {
        return None;
    }

    let mut out = String::new();
    if ctrl {
        out.push_str("Control+");
    }
    if alt {
        out.push_str("Alt+");
    }
    if shift {
        out.push_str("Shift+");
    }
    if win {
        out.push_str("Super+");
    }
    out.push_str(&key?);
    Some(out)
}

/// Place the mini clock in the corner of the click's monitor that
/// sits nearest the tray icon, and return the new physical origin.
#[cfg(windows)]
fn move_mini_near_anchor(mini: &tauri::WebviewWindow, anchor_x: i32, anchor_y: i32) -> Option<(i32, i32)> {
    let (left, top, right, bottom) = work_area_containing(anchor_x, anchor_y)?;
    let size = mini
        .outer_size()
        .unwrap_or(tauri::PhysicalSize::new(260, 48));
    let w = size.width as i32;
    let h = size.height as i32;
    let margin = 12;
    let max_x = (right - w - margin).max(left);
    let max_y = (bottom - h - margin).max(top);
    let x = if (anchor_x - left) <= (right - anchor_x) {
        left + margin
    } else {
        max_x
    };
    let y = if (anchor_y - top) <= (bottom - anchor_y) {
        top + margin
    } else {
        max_y
    };
    let x = x.clamp(left, max_x);
    let y = y.clamp(top, max_y);
    let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    Some((x, y))
}

#[cfg(not(windows))]
fn move_mini_near_anchor(
    _mini: &tauri::WebviewWindow,
    _anchor_x: i32,
    _anchor_y: i32,
) -> Option<(i32, i32)> {
    None
}

/// True when the mini window's center and the tray click share a work area.
#[cfg(windows)]
fn mini_is_on_anchor_monitor(mini: &tauri::WebviewWindow, anchor_x: i32, anchor_y: i32) -> bool {
    let Ok(pos) = mini.outer_position() else {
        return false;
    };
    let Ok(size) = mini.outer_size() else {
        return false;
    };
    let cx = pos.x + (size.width as i32) / 2;
    let cy = pos.y + (size.height as i32) / 2;
    match (
        work_area_containing(anchor_x, anchor_y),
        work_area_containing(cx, cy),
    ) {
        (Some(click_area), Some(clock_area)) => click_area == clock_area,
        _ => false,
    }
}

#[cfg(not(windows))]
fn mini_is_on_anchor_monitor(
    _mini: &tauri::WebviewWindow,
    _anchor_x: i32,
    _anchor_y: i32,
) -> bool {
    true
}

/// Left click on the tray icon. Shows the clock in its current mode
/// and brings it forward. Never hides it. An unlocked mini that is
/// on another monitor moves next to that tray. A locked mini stays
/// put and flashes so it can be spotted.
fn reveal_clock_at(app: &AppHandle, anchor_x: i32, anchor_y: i32) {
    let settings = load_settings(app);
    if settings.window_mode == "full" {
        if let Some(main) = app.get_webview_window("main") {
            let hidden =
                !main.is_visible().unwrap_or(false) || main.is_minimized().unwrap_or(false);
            if hidden {
                place_full_clock(&main, &settings);
            }
            let _ = main.unminimize();
            let _ = main.show();
            let _ = main.set_focus();
            refresh_taskbar_tab(&main);
            broadcast_active_window(app, "main");
        }
        return;
    }

    let Some(mini) = app.get_webview_window("mini") else {
        return;
    };
    let same_monitor = mini_is_on_anchor_monitor(&mini, anchor_x, anchor_y);
    let _ = mini.unminimize();
    let _ = mini.show();
    refresh_taskbar_tab(&mini);
    reapply_click_through(app, &mini);
    if !settings.mini_position_locked && !same_monitor {
        if let Some((x, y)) = move_mini_near_anchor(&mini, anchor_x, anchor_y) {
            let mut settings = settings;
            settings.mini_position = Some((x, y));
            let _ = persist(app, &settings);
            let _ = app.emit("settings:updated", &settings);
        }
    }
    let _ = mini.set_focus();
    let _ = mini.emit("mini:locate", ());
    broadcast_active_window(app, "mini");
}

/// Global hotkey behavior: hide the clock if it is on screen,
/// otherwise bring it back in its current mode. The tray icon does
/// not use this. A left click only reveals the clock.
fn toggle_clock_visibility(app: &AppHandle) {
    if is_any_clock_window_visible(app) {
        hide_all_clock_windows(app);
        broadcast_active_window(app, "none");
    } else {
        show_clock_window(app);
    }
}

fn register_app_hotkey(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let settings = load_settings(app);
    info!("hotkey: setup value {:?}", settings.hotkey_toggle);
    let Some(shortcut) = normalize_hotkey(&settings.hotkey_toggle) else {
        warn!("hotkey: unparseable value {:?}", settings.hotkey_toggle);
        return;
    };
    if shortcut.is_empty() {
        info!("hotkey: disabled");
        return;
    }
    let result = app
        .global_shortcut()
        .on_shortcut(shortcut.as_str(), |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_clock_visibility(app);
            }
        });
    if let Err(e) = result {
        warn!("hotkey: could not register {:?}: {}", shortcut, e);
    } else {
        info!("hotkey: registered {}", shortcut);
    }
}

/// Replace the global hotkey. Empty input unregisters it. On failure
/// (invalid combination or taken by another app) the previous hotkey
/// stays registered and an error is returned.
#[tauri::command]
fn set_hotkey(app: AppHandle, hotkey: String) -> Result<String, String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let Some(normalized) = normalize_hotkey(&hotkey) else {
        return Err("invalid-hotkey".to_string());
    };

    let old = load_settings(&app).hotkey_toggle;
    if let Some(old_sc) = normalize_hotkey(&old) {
        if !old_sc.is_empty() {
            let _ = app.global_shortcut().unregister(old_sc.as_str());
        }
    }

    if !normalized.is_empty() {
        let result =
            app.global_shortcut()
                .on_shortcut(normalized.as_str(), |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_clock_visibility(app);
                    }
                });
        if let Err(e) = result {
            // Keep behavior consistent with the persisted settings:
            // bring the old hotkey back before reporting the failure.
            if let Some(old_sc) = normalize_hotkey(&old) {
                if !old_sc.is_empty() {
                    let _ = app.global_shortcut().on_shortcut(
                        old_sc.as_str(),
                        |app, _shortcut, event| {
                            if event.state == ShortcutState::Pressed {
                                toggle_clock_visibility(app);
                            }
                        },
                    );
                }
            }
            warn!("hotkey: could not register {:?}: {}", normalized, e);
            return Err("register-failed".to_string());
        }
    }

    let _ = update_settings(&app, |s| {
        s.hotkey_toggle = normalized.clone();
        Ok(())
    });
    let _ = app.emit("settings:updated", &load_settings(&app));
    info!("hotkey: set to {:?}", normalized);
    Ok(normalized)
}

// ─────────────────────────────────────────────────────────────
// Mode switching commands
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn switch_to_full_mode(app: AppHandle) {
    let mut settings = load_settings(&app);
    settings.window_mode = "full".to_string();

    // Keep the preferred display in sync with where the mini was, so
    // the manual selection in the Display tab follows the user.
    if let Some(mini) = app.get_webview_window("mini") {
        if let Some((idx, _monitor)) = find_monitor_for_window(&mini) {
            settings.preferred_display_id = Some(idx as u32);
        }

        // Also save its current position
        if let Ok(pos) = mini.outer_position() {
            settings.mini_position = Some((pos.x, pos.y));
        }

        let _ = mini.hide();
    }

    if let Some(main) = app.get_webview_window("main") {
        place_full_clock(&main, &settings);
        let _ = main.show();
        let _ = main.set_focus();
        refresh_taskbar_tab(&main);
    }

    let _ = persist(&app, &settings);
    let _ = app.emit("settings:updated", &settings);
    broadcast_active_window(&app, "main");
}

#[tauri::command]
fn switch_to_mini_mode(app: AppHandle) {
    let mut settings = load_settings(&app);
    settings.window_mode = "mini".to_string();

    let mut detected_monitor = None;
    if let Some(main) = app.get_webview_window("main") {
        if let Some((idx, monitor)) = find_monitor_for_window(&main) {
            settings.preferred_display_id = Some(idx as u32);
            detected_monitor = Some(monitor);
        }
        let _ = main.hide();
    }

    if let Some(mini) = app.get_webview_window("mini") {
        let mut positioned = false;
        if let Some((x, y)) = settings.mini_position {
            if let Some(ref monitor) = detected_monitor {
                if is_position_in_monitor(x, y, monitor) {
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                    positioned = true;
                }
            } else if let Ok(monitors) = mini.available_monitors() {
                if monitors.iter().any(|m| is_position_in_monitor(x, y, m)) {
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                    positioned = true;
                }
            }
        }

        if !positioned {
            let monitor = detected_monitor.or_else(|| {
                mini.available_monitors()
                    .ok()
                    .and_then(|m| m.first().cloned())
            });
            if let Some(m) = monitor {
                let (x, y) = center_mini_on_monitor(&m);
                let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    x, y,
                )));
            }
        }
        clamp_window_to_monitors(&mini);
        let _ = mini.show();
        let _ = mini.set_focus();
        reapply_click_through(&app, &mini);
        refresh_taskbar_tab(&mini);
    }

    let _ = persist(&app, &settings);
    let _ = app.emit("settings:updated", &settings);
    broadcast_active_window(&app, "mini");
}

// ─────────────────────────────────────────────────────────────
// Mini preview (live peek from the settings modal)
// ─────────────────────────────────────────────────────────────

/// Peek state captured when the preview starts, so the mini window
/// can be put back exactly where it was when it ends.
struct MiniPreviewState {
    moved: bool,
    orig_pos: Option<(i32, i32)>,
}

static MINI_PREVIEW: std::sync::Mutex<Option<MiniPreviewState>> = std::sync::Mutex::new(None);

/// Bottom-right corner of the settings window's monitor — where the
/// mini docks when its own position would not be visible from there
/// (off-screen or another display).
fn mini_dock_pos(app: &AppHandle, mini: &WebviewWindow) -> Option<(i32, i32)> {
    let main = app.get_webview_window("main")?;
    let (_, monitor) = find_monitor_for_window(&main)?;
    let wa = monitor.work_area();
    let size = mini.outer_size().ok()?;
    let margin = 24;
    Some((
        wa.position.x + wa.size.width as i32 - size.width as i32 - margin,
        wa.position.y + wa.size.height as i32 - size.height as i32 - margin,
    ))
}

/// Show/hide the real mini window as a live preview while the "Modo
/// Mini" tab is open in the settings modal (full mode only). The mini
/// re-applies every settings change on its own — this only makes it
/// visible, pass-through so it can never steal clicks, and restores
/// its position, visibility and click-through when the peek ends.
#[tauri::command]
fn set_mini_preview(app: AppHandle, on: bool) {
    let settings = load_settings(&app);
    let Some(mini) = app.get_webview_window("mini") else {
        return;
    };

    if on {
        // In mini mode the clock is already on screen.
        if settings.window_mode != "full" || mini.is_visible().unwrap_or(true) {
            return;
        }
        let orig_pos = mini.outer_position().ok().map(|p| (p.x, p.y));
        let mut moved = false;
        if let Some((x, y)) = orig_pos {
            let on_settings_monitor = app
                .get_webview_window("main")
                .and_then(|main| find_monitor_for_window(&main))
                .map(|(_, m)| is_position_in_monitor(x, y, &m))
                .unwrap_or(true);
            if !on_settings_monitor {
                if let Some((dx, dy)) = mini_dock_pos(&app, &mini) {
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(dx, dy),
                    ));
                    moved = true;
                }
            }
        }
        *MINI_PREVIEW.lock().unwrap() = Some(MiniPreviewState { moved, orig_pos });
        let _ = mini.show();
        refresh_taskbar_tab(&mini);
        // The preview must never intercept the user's clicks or drags.
        // Windows can drop the flag on show — set it after, not before.
        let _ = mini.set_ignore_cursor_events(true);
        // show() can briefly activate the mini on Windows; hand focus
        // straight back to the settings window.
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.set_focus();
        }
    } else {
        let state = MINI_PREVIEW.lock().unwrap().take();
        // Switching to mini mode mid-peek makes the clock legitimately
        // visible — only hide when the app is still in full mode.
        if settings.window_mode == "full" {
            let _ = mini.hide();
        }
        if let Some(st) = state {
            if st.moved {
                if let Some((x, y)) = st.orig_pos {
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                }
            }
        }
        let _ = mini.set_ignore_cursor_events(settings.mini_click_through);
    }
}

// ─────────────────────────────────────────────────────────────
// Clock context menu
// ─────────────────────────────────────────────────────────────

#[allow(clippy::type_complexity)]
static MINI_MENU_ANCHOR: std::sync::Mutex<Option<(i32, i32, i32, i32, i32, i32)>> =
    std::sync::Mutex::new(None);
static CURRENT_MENU_CALLER: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);
static MINI_MENU_LAST_HEIGHT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(360);

fn position_mini_context_menu(menu: &WebviewWindow, logical_w: f64, logical_h: f64) {
    let scale = menu.scale_factor().unwrap_or(1.0);
    let menu_width = (logical_w * scale).round() as i32;
    let menu_height = (logical_h * scale).round() as i32;
    let gap = (8.0 * scale).round() as i32;

    let anchor = MINI_MENU_ANCHOR.lock().ok().and_then(|g| *g);
    let (clock_x, clock_y, clock_w, clock_h, screen_x, screen_y) = match anchor {
        Some(a) => a,
        None => return,
    };

    if let Ok(monitors) = menu.available_monitors() {
        let found_monitor = monitors
            .iter()
            .find(|m| is_position_in_monitor(screen_x, screen_y, m))
            .or_else(|| monitors.first());

        if let Some(found_monitor) = found_monitor {
            let work_area = found_monitor.work_area();
            let monitor_pos = work_area.position;
            let monitor_size = work_area.size;

            let mon_left = monitor_pos.x;
            let mon_top = monitor_pos.y;
            let mon_right = monitor_pos.x + monitor_size.width as i32;
            let mon_bottom = monitor_pos.y + monitor_size.height as i32;

            let room_below = clock_y + clock_h + gap + menu_height <= mon_bottom;
            let room_above = clock_y - gap - menu_height >= mon_top;
            let room_right = clock_x + clock_w + gap + menu_width <= mon_right;
            let room_left = clock_x - gap - menu_width >= mon_left;

            let (mut pos_x, mut pos_y) = if room_below {
                (clock_x, clock_y + clock_h + gap)
            } else if room_above {
                (clock_x, clock_y - menu_height - gap)
            } else {
                let clock_center = clock_x + clock_w / 2;
                let mon_center = mon_left + (mon_right - mon_left) / 2;
                let go_right = if room_right && room_left {
                    clock_center <= mon_center
                } else {
                    room_right
                };
                let x = if go_right {
                    clock_x + clock_w + gap
                } else {
                    clock_x - menu_width - gap
                };
                (x, clock_y)
            };

            if pos_x + menu_width > mon_right {
                pos_x = mon_right - menu_width;
            }
            if pos_x < mon_left {
                pos_x = mon_left;
            }
            if pos_y + menu_height > mon_bottom {
                pos_y = mon_bottom - menu_height;
            }
            if pos_y < mon_top {
                pos_y = mon_top;
            }

            let _ = menu.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: menu_width as u32,
                height: menu_height as u32,
            }));
            let _ = menu.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                pos_x, pos_y,
            )));
        }
    }
}

#[tauri::command]
fn open_mini_context_menu(
    app: AppHandle,
    window: WebviewWindow,
    _x: i32,
    _y: i32,
    screen_x: i32,
    screen_y: i32,
) -> bool {
    if let Some(menu) = app.get_webview_window("menu") {
        let (clock_x, clock_y, clock_w, clock_h) =
            match (window.outer_position(), window.outer_size()) {
                (Ok(p), Ok(s)) => (p.x, p.y, s.width as i32, s.height as i32),
                _ => (screen_x, screen_y, 0, 0),
            };

        if let Ok(mut g) = MINI_MENU_ANCHOR.lock() {
            *g = Some((clock_x, clock_y, clock_w, clock_h, screen_x, screen_y));
        }

        let caller_label = window.label().to_string();
        let same_caller = CURRENT_MENU_CALLER
            .lock()
            .ok()
            .and_then(|c| c.clone())
            .as_deref()
            == Some(caller_label.as_str());
        if menu.is_visible().unwrap_or(false) && same_caller {
            let _ = menu.hide();
            let _ = app.emit("menu:closed", ());
            return false;
        }

        if let Ok(mut c) = CURRENT_MENU_CALLER.lock() {
            *c = Some(caller_label.clone());
        }

        let last_h = MINI_MENU_LAST_HEIGHT.load(std::sync::atomic::Ordering::Relaxed) as f64;
        position_mini_context_menu(&menu, 286.0, last_h);

        let caller_kind = if caller_label.starts_with("float-timer-") {
            "timer"
        } else if caller_label.starts_with("float-sw-") {
            "sw"
        } else if caller_label.starts_with("float-relax-") {
            "relax"
        } else {
            "mini"
        };
        let _ = menu.emit(
            "menu:caller",
            serde_json::json!({
                "caller": caller_label,
                "kind": caller_kind
            }),
        );

        let _ = menu.show();
        let _ = menu.set_focus();
        refresh_taskbar_tab(&menu);
        return true;
    }
    false
}

#[tauri::command]
fn get_menu_caller() -> Option<serde_json::Value> {
    let caller = CURRENT_MENU_CALLER.lock().ok().and_then(|c| c.clone())?;
    let kind = if caller.starts_with("float-timer-") {
        "timer"
    } else if caller.starts_with("float-sw-") {
        "sw"
    } else if caller.starts_with("float-relax-") {
        "relax"
    } else {
        "mini"
    };
    Some(serde_json::json!({
        "caller": caller,
        "kind": kind
    }))
}

#[tauri::command]
fn get_pending_update() -> Option<String> {
    pending_update_version()
}

#[tauri::command]
fn get_open_float_labels(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("float-"))
        .cloned()
        .collect()
}

#[tauri::command]
fn mini_menu_ready(app: AppHandle, width: f64, height: f64) {
    MINI_MENU_LAST_HEIGHT.store(height.round() as u32, std::sync::atomic::Ordering::Relaxed);
    if let Some(menu) = app.get_webview_window("menu") {
        position_mini_context_menu(&menu, width, height);
    }
}

#[tauri::command]
fn close_mini_context_menu(app: AppHandle) {
    if let Some(menu) = app.get_webview_window("menu") {
        if !menu.is_visible().unwrap_or(false) {
            return;
        }
        let _ = menu.hide();
        let _ = app.emit("menu:closed", ());
    }
}

// Must be async: see the note above spawn_float. This command spawns
// float windows for both the tray menu and the mini context menu.
#[tauri::command]
async fn menu_action(app: AppHandle, action: String) -> bool {
    // Hide menu first (except for "aot" which needs a visual delay in the UI)
    if action != "aot" {
        if let Some(menu) = app.get_webview_window("menu") {
            if menu.is_visible().unwrap_or(false) {
                let _ = menu.hide();
                let _ = app.emit("menu:closed", ());
            }
        }
    }

    match action.as_str() {
        "full" => {
            switch_to_full_mode(app);
            true
        }
        "new_timer" => spawn_float_window(&app, "timer").is_some(),
        "new_stopwatch" => spawn_float_window(&app, "sw").is_some(),
        "new_calendar" => spawn_float_window(&app, "cal").is_some(),
        "new_analog" => spawn_float_window(&app, "analog").is_some(),
        "new_relax" => spawn_float_window(&app, "relax").is_some(),
        "new_alarm" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", "new-alarm");
            }
            true
        }
        "close_other_timers" => {
            let caller = CURRENT_MENU_CALLER
                .lock()
                .ok()
                .and_then(|c| c.clone())
                .unwrap_or_default();
            for (label, win) in app.webview_windows() {
                if label.starts_with("float-timer-") && label != caller {
                    let _ = win.close();
                }
            }
            true
        }
        "close_other_sw" => {
            let caller = CURRENT_MENU_CALLER
                .lock()
                .ok()
                .and_then(|c| c.clone())
                .unwrap_or_default();
            for (label, win) in app.webview_windows() {
                if label.starts_with("float-sw-") && label != caller {
                    let _ = win.close();
                }
            }
            true
        }
        "close_current_timer" | "close_current_sw" | "close_current_relax" => {
            let caller = CURRENT_MENU_CALLER
                .lock()
                .ok()
                .and_then(|c| c.clone())
                .unwrap_or_default();
            if let Some(win) = app.get_webview_window(&caller) {
                let _ = win.close();
            }
            true
        }
        "close" => {
            exit_app(&app);
            true
        }
        "center_widgets" | "center-widgets" => {
            center_open_widgets_on_active_monitor(&app);
            true
        }
        "aot" => {
            let aot = {
                let mut settings = load_settings(&app);
                settings.always_on_top = !settings.always_on_top;
                let aot = settings.always_on_top;
                let _ = persist(&app, &settings);
                aot
            };
            apply_always_on_top(&app, aot);

            // Broadcast update
            let _ = app.emit("settings:updated", load_settings(&app));
            true
        }
        "home" | "timer" | "stopwatch" | "relax" | "settings" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", &action);
            }
            true
        }
        "about" => {
            show_about_window(&app);
            true
        }
        _ => {
            if let Some(note_id) = action.strip_prefix("open-note:") {
                // Forward only well-formed ISO date note ids to the
                // main window — arbitrary strings are never relayed.
                if is_valid_note_id(note_id) {
                    switch_to_full_mode(app.clone());
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.emit("mini:menu-action", &action);
                    }
                    true
                } else {
                    warn!("menu_action: rejected malformed open-note id {:?}", note_id);
                    false
                }
            } else {
                false
            }
        }
    }
}

/// Calendar note ids are ISO dates ("YYYY-MM-DD"); anything else is
/// not a valid target.
fn is_valid_note_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    bytes.len() == 10
        && bytes.iter().enumerate().all(|(i, &b)| match i {
            4 | 7 => b == b'-',
            _ => b.is_ascii_digit(),
        })
}

// ─────────────────────────────────────────────────────────────
// Display / screens commands
// ─────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize)]
pub struct MonitorInfo {
    id: u32,
    label: String,
    primary: bool,
    current: bool,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[tauri::command]
fn get_screens(window: WebviewWindow, app: AppHandle) -> Vec<MonitorInfo> {
    let settings = load_settings(&app);
    let mut screens = Vec::new();

    if let Ok(monitors) = window.available_monitors() {
        let primary_monitor = window.primary_monitor().ok();

        for (i, m) in monitors.iter().enumerate() {
            let id = i as u32;
            let is_primary = primary_monitor.as_ref().is_some_and(|pm| {
                match (pm.as_ref().and_then(|p| p.name()), m.name()) {
                    (Some(pn), Some(mn)) => pn == mn,
                    (None, None) => true,
                    _ => false,
                }
            });
            let size = m.size();
            let pos = m.position();
            screens.push(MonitorInfo {
                id,
                label: m.name().unwrap_or(&format!("Display {}", i)).to_string(),
                primary: is_primary,
                current: settings.preferred_display_id.is_some_and(|pid| pid == id),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
            });
        }
    }
    screens
}

#[tauri::command]
fn select_display(app: AppHandle, window: WebviewWindow, id: u32) -> bool {
    let mut settings = load_settings(&app);
    settings.preferred_display_id = Some(id);
    let _ = persist(&app, &settings);

    // Move main window to selected display
    if let Some(main) = app.get_webview_window("main") {
        if let Ok(monitors) = window.available_monitors() {
            if let Some(monitor) = monitors.get(id as usize) {
                // Full mode fills the WORK AREA of the chosen display:
                // taskbars are respected on every edge.
                let work_area = monitor.work_area();
                let size = work_area.size;
                let position = work_area.position;
                let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    position.x, position.y,
                )));
                let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                    size.width,
                    size.height,
                )));
            }
        }
    }

    // Broadcast update
    let _ = app.emit("settings:updated", &settings);
    true
}

#[tauri::command]
fn reset_mini_position(app: AppHandle) {
    let mut settings = load_settings(&app);
    settings.mini_position = None;
    let _ = persist(&app, &settings);
    // Also move the mini window back to default center-ish position
    if let Some(mini) = app.get_webview_window("mini") {
        if let Ok(monitors) = mini.available_monitors() {
            if let Some(monitor) = monitors.first() {
                let (x, y) = center_mini_on_monitor(monitor);
                let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    x, y,
                )));
            }
        }
    }
    let _ = app.emit("settings:updated", &settings);
}

#[tauri::command]
fn save_mini_position(app: AppHandle) -> bool {
    if let Some(mini) = app.get_webview_window("mini") {
        clamp_window_to_monitors(&mini);
        if let Ok(pos) = mini.outer_position() {
            let mut settings = load_settings(&app);
            settings.mini_position = Some((pos.x, pos.y));

            // Also update preferred_display_id based on where the mini is right now
            if let Some((idx, _)) = find_monitor_for_window(&mini) {
                settings.preferred_display_id = Some(idx as u32);
            }

            let _ = persist(&app, &settings);
            let _ = app.emit("settings:updated", &settings);
            return true;
        }
    }
    false
}

// ─────────────────────────────────────────────────────────────
// Custom alarm sound picking: copy into app data dir
// ─────────────────────────────────────────────────────────────
// The picked file is copied to `<app_data_dir>/alarm-sounds/` and
// the stored `customPath` points at the copy. Two reasons:
//  1. The webview's asset protocol scope can then be limited to
//     that folder instead of the whole filesystem.
//  2. The sound keeps working after the user deletes or moves
//     the original file.
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "m4a", "flac", "aac"];

fn alarm_sounds_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = storage_dir(app).join("alarm-sounds");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn import_alarm_sound(app: &AppHandle, src: &Path) -> Result<String, String> {
    let dir = alarm_sounds_dir(app).ok_or_else(|| "cannot create alarm-sounds dir".to_string())?;
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!("unsupported audio format: {}", ext));
    }

    // Deterministic name per source file: re-importing the same
    // file overwrites its copy instead of accumulating garbage.
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("custom")
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();
    let dest = dir.join(format!("{}.{}", stem, ext));
    fs::copy(src, &dest).map_err(|e| format!("copy failed: {}", e))?;
    info!("Alarm sound imported: {:?}", dest);
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_file_dialog(
    app: AppHandle,
    window: WebviewWindow,
    extensions: Option<Vec<String>>,
) -> Option<String> {
    let requested = extensions.unwrap_or_default();
    let mut filters: Vec<String> = requested
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| AUDIO_EXTENSIONS.contains(&ext.as_str()))
        .collect();
    if filters.is_empty() {
        filters = AUDIO_EXTENSIONS.iter().map(|ext| (*ext).to_string()).collect();
    }
    let filter_refs: Vec<&str> = filters.iter().map(String::as_str).collect();
    let (tx, rx) = std::sync::mpsc::channel();
    window
        .dialog()
        .file()
        .add_filter("Audio", &filter_refs)
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let picked = rx.recv().ok().flatten()?;
    let path = picked.as_path()?.to_path_buf();

    match import_alarm_sound(&app, &path) {
        Ok(stored) => Some(stored),
        Err(e) => {
            warn!("open_file_dialog: {}", e);
            None
        }
    }
}

#[tauri::command]
fn set_startup(app: AppHandle, on: bool) {
    let _ = update_settings(&app, |s| {
        s.start_with_windows = on;
        Ok(())
    });

    // Windows: register/unregister in HKCU\...\Run via reg.exe.
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let result = if on {
            let exe_path = std::env::current_exe()
                .ok()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let reg_value = format!("\"{}\" --startup", exe_path);
            Command::new("reg")
                .args([
                    "add",
                    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "CyberClock",
                    "/d",
                    &reg_value,
                    "/f",
                ])
                .output()
        } else {
            Command::new("reg")
                .args([
                    "delete",
                    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "CyberClock",
                    "/f",
                ])
                .output()
        };
        match result {
            Ok(out) if !out.status.success() => {
                warn!(
                    "set_startup({}): reg.exe failed: {}",
                    on,
                    String::from_utf8_lossy(&out.stderr)
                );
            }
            Err(e) => warn!("set_startup({}): reg.exe failed: {}", on, e),
            _ => {}
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Alarm System
// ─────────────────────────────────────────────────────────────

fn parse_time(time_str: &str) -> (u32, u32) {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 2 {
        let h = parts[0].parse().unwrap_or(0);
        let m = parts[1].parse().unwrap_or(0);
        (h, m)
    } else {
        (0, 0)
    }
}

fn is_time_in_alarm_schedule(now: chrono::DateTime<Local>, settings: &AppSettings) -> bool {
    if !settings.alarm_schedule_enabled {
        return true;
    }
    let (sh, sm) = parse_time(&settings.alarm_schedule_start);
    let (eh, em) = parse_time(&settings.alarm_schedule_end);
    let now_minutes = now.hour() * 60 + now.minute();
    let start_minutes = sh * 60 + sm;
    let end_minutes = eh * 60 + em;
    if start_minutes <= end_minutes {
        now_minutes >= start_minutes && now_minutes <= end_minutes
    } else {
        // Crosses midnight
        now_minutes >= start_minutes || now_minutes <= end_minutes
    }
}

fn check_alarms(app: &AppHandle) {
    let settings = load_settings(app);
    let now = Local::now();
    let minute = now.minute();
    let hour = now.hour();

    // Master audio mute: no chimes at all while muted (the frontend also
    // guards its audio engine, but the scheduler is the single source of
    // truth — it never even emits the event).
    if settings.audio_muted {
        return;
    }

    if !is_time_in_alarm_schedule(now, &settings) {
        return;
    }

    let alarm_state = app.state::<AlarmState>();

    // Check quarter-hour alarm (at :00, :15, :30, and :45) - suppressed if voice announcer is active
    if !settings.voice_announcer.enabled
        && settings.alarm_quarter_hour.enabled
        && (minute % 15 == 0)
    {
        let mut last = lock_or_recover(&alarm_state.last_quarter_hour);
        if last.map_or(true, |(h, m)| h != hour || m != minute) {
            *last = Some((hour, minute));
            drop(last);

            let alarm_data = serde_json::json!({
                "type": "quarter-hour",
                "sound": settings.alarm_quarter_hour.sound,
                "customPath": settings.alarm_quarter_hour.custom_path,
                "volume": settings.chime_volume
            });

            emit_to_active(app, "alarm:chime", alarm_data);
        }
    }

    // Check half-hour alarm (at :00 and :30) - suppressed if voice announcer is active
    if !settings.voice_announcer.enabled
        && settings.alarm_half_hour.enabled
        && (minute == 0 || minute == 30)
    {
        let mut last = lock_or_recover(&alarm_state.last_half_hour);
        if last.map_or(true, |(h, m)| h != hour || m != minute) {
            *last = Some((hour, minute));
            drop(last);

            let alarm_data = serde_json::json!({
                "type": "half-hour",
                "sound": settings.alarm_half_hour.sound,
                "customPath": settings.alarm_half_hour.custom_path,
                "volume": settings.chime_volume
            });

            emit_to_active(app, "alarm:chime", alarm_data);
        }
    }

    // Check full-hour alarm - suppressed if voice announcer is active
    if !settings.voice_announcer.enabled && settings.alarm_full_hour.enabled && minute == 0 {
        let mut last = lock_or_recover(&alarm_state.last_full_hour);
        if last.map_or(true, |h| h != hour) {
            *last = Some(hour);
            drop(last);

            let alarm_data = serde_json::json!({
                "type": "full-hour",
                "sound": settings.alarm_full_hour.sound,
                "customPath": settings.alarm_full_hour.custom_path,
                "volume": settings.chime_volume
            });

            emit_to_active(app, "alarm:chime", alarm_data);
        }
    }

    // Check voice time announcer
    if settings.voice_announcer.enabled {
        let is_interval_hit = match settings.voice_announcer.interval.as_str() {
            "15m" => minute % 15 == 0,
            "30m" => minute == 0 || minute == 30,
            _ => minute == 0,
        };

        if is_interval_hit {
            let in_quiet = if settings.voice_announcer.quiet_hours_enabled {
                let (sh, sm) = parse_time(&settings.voice_announcer.quiet_hours_start);
                let (eh, em) = parse_time(&settings.voice_announcer.quiet_hours_end);
                let now_minutes = hour * 60 + minute;
                let start_minutes = sh * 60 + sm;
                let end_minutes = eh * 60 + em;
                if start_minutes <= end_minutes {
                    now_minutes >= start_minutes && now_minutes <= end_minutes
                } else {
                    now_minutes >= start_minutes || now_minutes <= end_minutes
                }
            } else {
                false
            };

            if !in_quiet {
                let mut last = lock_or_recover(&alarm_state.last_voice_announcement);
                if last.map_or(true, |(h, m)| h != hour || m != minute) {
                    *last = Some((hour, minute));
                    drop(last);

                    let announce_data = serde_json::json!({
                        "hour": hour,
                        "minute": minute
                    });

                    emit_to_active(app, "voice:announce-time", announce_data);
                }
            }
        }
    }
}

fn custom_alarm_days_mask_for_chrono_weekday(wd: chrono::Weekday) -> u8 {
    match wd {
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Tue => 2,
        chrono::Weekday::Wed => 4,
        chrono::Weekday::Thu => 8,
        chrono::Weekday::Fri => 16,
        chrono::Weekday::Sat => 32,
        chrono::Weekday::Sun => 64,
    }
}

fn alarm_repeat_mask(alarm: &CustomAlarm) -> u8 {
    match alarm.repeat_mode.as_str() {
        "daily" => 127,
        "weekdays" => 31,
        "weekends" => 96,
        "once" => 0,
        _ => alarm.days_mask,
    }
}

fn compute_next_custom_alarm_datetime(
    now: chrono::DateTime<Local>,
    alarm: &CustomAlarm,
    snoozed_until: Option<i64>,
) -> Option<chrono::DateTime<Local>> {
    if let Some(timestamp) = snoozed_until {
        if timestamp > now.timestamp() {
            return Local.timestamp_opt(timestamp, 0).single();
        }
    }

    if alarm.repeat_mode == "once" || (alarm.repeat_mode.is_empty() && alarm.days_mask == 0) {
        let date = alarm
            .date
            .as_deref()
            .and_then(|value| chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
            .unwrap_or_else(|| now.date_naive());
        let candidate = date
            .and_hms_opt(alarm.hour, alarm.minute, 0)
            .and_then(|naive| Local.from_local_datetime(&naive).single())?;
        return occurrence_is_pending(candidate, now).then_some(candidate);
    }

    let mask = alarm_repeat_mask(alarm);
    if mask == 0 {
        return None;
    }

    // Search today plus the following eight days. This covers every
    // weekly pattern and lets DST gaps/ambiguities be skipped safely.
    for offset in 0..=8 {
        let date = now.date_naive() + chrono::Duration::days(offset);
        let Some(candidate_naive) = date.and_hms_opt(alarm.hour, alarm.minute, 0) else {
            continue;
        };
        let Some(candidate) = Local.from_local_datetime(&candidate_naive).single() else {
            continue;
        };
        if !occurrence_is_pending(candidate, now) {
            continue;
        }
        let weekday_mask = custom_alarm_days_mask_for_chrono_weekday(candidate.weekday());
        if mask & weekday_mask != 0 {
            return Some(candidate);
        }
    }

    None
}

fn custom_alarm_matches_now(now: chrono::DateTime<Local>, alarm: &CustomAlarm) -> bool {
    if now.hour() != alarm.hour || now.minute() != alarm.minute {
        return false;
    }
    if alarm.repeat_mode == "once" || (alarm.repeat_mode.is_empty() && alarm.days_mask == 0) {
        return alarm
            .date
            .as_deref()
            .map(|date| date == now.date_naive().to_string())
            .unwrap_or(true);
    }
    let mask = alarm_repeat_mask(alarm);
    mask & custom_alarm_days_mask_for_chrono_weekday(now.weekday()) != 0
}

fn send_alarm_notification(app: &AppHandle, alarm: &CustomAlarm) {
    use tauri_plugin_notification::NotificationExt;

    let title = if alarm.label.trim().is_empty() {
        "Alarm".to_string()
    } else {
        alarm.label.clone()
    };
    let body = if alarm.message.trim().is_empty() {
        "CyberClock alarm".to_string()
    } else {
        alarm.message.clone()
    };
    if let Err(error) = app.notification().builder().title(title).body(body).show() {
        warn!("alarm notification failed: {}", error);
    }
}

fn custom_alarms_scheduler(app: AppHandle) {
    // IDs make the scheduler independent of the old three-slot limit and
    // keep snoozes stable when the user inserts or deletes an alarm.
    let mut last_fired_by_id: HashMap<String, i64> = HashMap::new();

    loop {
        let settings = load_settings(&app);
        let now = Local::now();
        let state = app.state::<AlarmState>();
        let snoozed = lock_or_recover(&state.snoozed_alarms).clone();

        let mut nexts: Vec<(chrono::DateTime<Local>, usize, String)> = Vec::new();
        for (idx, alarm) in settings.custom_alarms.iter().enumerate() {
            if !alarm.enabled {
                continue;
            }
            let id = if alarm.id.trim().is_empty() {
                format!("alarm-{}", idx + 1)
            } else {
                alarm.id.clone()
            };
            if let Some(next_dt) =
                compute_next_custom_alarm_datetime(now, alarm, snoozed.get(&id).copied())
            {
                nexts.push((next_dt, idx, id));
            }
        }

        if nexts.is_empty() {
            std::thread::sleep(std::time::Duration::from_secs(15));
            continue;
        }

        nexts.sort_by_key(|(dt, _, _)| dt.timestamp());
        let (earliest, earliest_idx, earliest_id) = nexts[0].clone();
        let delay_secs = earliest.signed_duration_since(now).num_seconds();
        // Stay asleep until the minute is about to start. Waking a few
        // seconds early used to fail the exact-minute check, then sleep
        // past the alarm entirely.
        if delay_secs > 1 {
            let chunk = std::cmp::min(delay_secs.saturating_sub(1), 30).max(1);
            std::thread::sleep(std::time::Duration::from_secs(chunk as u64));
            continue;
        }

        let now2 = Local::now();
        let current_settings = load_settings(&app);
        if let Some(alarm) = current_settings.custom_alarms.get(earliest_idx) {
            if alarm.enabled {
                let occurrence = earliest.timestamp();
                let already = last_fired_by_id
                    .get(&earliest_id)
                    .copied()
                    .map(|timestamp| timestamp == occurrence)
                    .unwrap_or(false);

                if already {
                    std::thread::sleep(std::time::Duration::from_secs(15));
                    continue;
                }

                let snooze_timestamp = lock_or_recover(&state.snoozed_alarms)
                    .get(&earliest_id)
                    .copied();
                let is_snooze = snooze_timestamp
                    .map(|timestamp| now2.timestamp() + 1 >= timestamp)
                    .unwrap_or(false);
                let should_fire = is_snooze || custom_alarm_matches_now(now2, alarm) || delay_secs <= 1;

                if should_fire {
                    last_fired_by_id.insert(earliest_id.clone(), occurrence);
                    if is_snooze {
                        lock_or_recover(&state.snoozed_alarms).remove(&earliest_id);
                    }

                    let alarm_data = serde_json::json!({
                        "type": "custom",
                        "alarmId": earliest_id,
                        "label": alarm.label,
                        "message": alarm.message,
                        "repeatMode": alarm.repeat_mode,
                        "snoozeMinutes": alarm.snooze_minutes,
                        "sound": alarm.sound,
                        "customPath": alarm.custom_path,
                        "soundRepeatCount": alarm.sound_repeat_count,
                        "soundUntilDismiss": alarm.sound_until_dismiss,
                        "soundPauseSecs": alarm.sound_pause_secs,
                        "deleteAfter": alarm.delete_after,
                        "volume": current_settings.alarm_volume,
                        "audioMuted": current_settings.audio_muted
                    });

                    emit_alarm_chime(&app, alarm_data);
                    send_alarm_notification(&app, alarm);

                        // A one-time alarm becomes inactive after firing.
                        // Snooze re-enables it through the command above.
                        if alarm.repeat_mode == "once" {
                            let fired_id = earliest_id.clone();
                            let fired_index = earliest_idx;
                            let _ = update_settings(&app, |settings| {
                                if let Some((_, item)) = settings
                                    .custom_alarms
                                    .iter_mut()
                                    .enumerate()
                                    .find(|(index, item)| {
                                        item.id == fired_id
                                            || (item.id.trim().is_empty() && *index == fired_index)
                                    })
                                {
                                    item.enabled = false;
                                }
                                Ok(())
                            });
                            let _ = app.emit("settings:updated", load_settings(&app));
                        }
                }
            }
        }

        // Recalculate frequently so a newly-created alarm or a time change
        // becomes live without restarting CyberClock.
        std::thread::sleep(std::time::Duration::from_secs(10));
    }
}

// ─────────────────────────────────────────────────────────────
// Custom HTML Tray Menu (CyberPaste style)
// ─────────────────────────────────────────────────────────────

#[derive(Clone, serde::Serialize)]
pub struct TrayMenuState {
    pub version: String,
    pub is_visible: bool,
    pub window_mode: String,
    pub language: String,
    pub update_available: bool,
    pub theme: String,
    pub mini_zoom: f64,
    pub auto_update: bool,
    pub audio_muted: bool,
    pub mini_click_through: bool,
    pub relax_playing: Option<String>,
    /// Friendly form of the configured show/hide hotkey
    /// ("Alt+Shift+C"); empty when the shortcut is disabled.
    pub hotkey: String,
    pub show_suite_recommendations: bool,
}

static TRAY_MENU_ANCHOR: std::sync::Mutex<Option<(i32, i32)>> = std::sync::Mutex::new(None);
static TRAY_MENU_PENDING_SHOW: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

const TRAY_MENU_WIDTH: f64 = 250.0;
const TRAY_MENU_SHADOW_PAD: f64 = 20.0;
// Collapsed help section baseline; the tray window re-reports its real
// size via tray_menu_ready once rendered (help expands the menu, the
// About modal resizes it further).
const TRAY_MENU_EST_HEIGHT: f64 = 600.0;

/// Work area of the monitor containing (anchor_x, anchor_y) — the desktop
/// region that EXCLUDES the taskbar. Clamping the tray menu to the full
/// monitor bounds lets it open behind/over a taskbar docked to any edge
/// (e.g. a vertical taskbar on the left). GetMonitorInfoW gives the
/// per-monitor work area, so this is correct on every screen.
#[cfg(windows)]
fn work_area_containing(anchor_x: i32, anchor_y: i32) -> Option<(i32, i32, i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let monitor = unsafe {
        MonitorFromPoint(
            POINT {
                x: anchor_x,
                y: anchor_y,
            },
            MONITOR_DEFAULTTONEAREST,
        )
    };
    if monitor.is_null() {
        return None;
    }
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    let ok = unsafe { GetMonitorInfoW(monitor, &mut info) };
    if ok == 0 {
        return None;
    }
    Some((
        info.rcWork.left,
        info.rcWork.top,
        info.rcWork.right,
        info.rcWork.bottom,
    ))
}

fn tray_menu_geometry(
    win: &tauri::WebviewWindow,
    anchor_x: i32,
    anchor_y: i32,
    logical_w: f64,
    logical_h: f64,
) -> (i32, i32, u32, u32) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let width_px = (logical_w * scale).round() as i32;
    let height_px = (logical_h * scale).round() as i32;

    let monitor = win
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .find(|m| is_position_in_monitor(anchor_x, anchor_y, m))
        .or_else(|| win.primary_monitor().ok().flatten())
        .or_else(|| win.current_monitor().ok().flatten());

    // Prefer the taskbar-free work area when the anchor sits on the
    // primary monitor; otherwise clamp to the monitor's full bounds.
    #[cfg(windows)]
    let work_area = work_area_containing(anchor_x, anchor_y);
    #[cfg(not(windows))]
    let work_area: Option<(i32, i32, i32, i32)> = None;

    let (min_x, min_y, max_x, max_y) = if let Some((wa_x0, wa_y0, wa_x1, wa_y1)) = work_area {
        (wa_x0, wa_y0, wa_x1, wa_y1)
    } else if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        (
            pos.x,
            pos.y,
            pos.x + size.width as i32,
            pos.y + size.height as i32,
        )
    } else {
        (0, 0, 1920, 1080)
    };

    let gap = (4.0 * scale).round() as i32;
    let shadow_pad_px = (TRAY_MENU_SHADOW_PAD * scale).round() as i32;

    // Maximum card height must not exceed the available monitor work area
    let max_card_h = (max_y - min_y - 2 * gap).max(200);
    let card_w = (width_px - 2 * shadow_pad_px).max(1);
    let card_h = (height_px - 2 * shadow_pad_px).min(max_card_h).max(1);
    let final_w_px = card_w + 2 * shadow_pad_px;
    let final_h_px = card_h + 2 * shadow_pad_px;

    // Vertical taskbar on the left edge: the icon sits inside the strip
    // left of the work area. Open to the RIGHT of the icon, vertically
    // centered on it. Any other edge keeps the classic above/below.
    let anchor_in_left_strip = anchor_x < min_x;
    let (mut card_x, mut card_y);
    if anchor_in_left_strip {
        card_x = anchor_x + gap;
        card_y = anchor_y - card_h / 2;
    } else {
        card_x = anchor_x - card_w / 2;
        let is_taskbar_at_top = anchor_y < (min_y + max_y) / 2;
        if is_taskbar_at_top {
            card_y = anchor_y + gap;
        } else {
            // Taskbar is at bottom (standard Windows):
            // Card opens upwards above the taskbar, clamped to work area top.
            card_y = (anchor_y - card_h - gap).max(min_y);
        }
    }

    // Clamp the CARD inside the work area (bleed overhangs are fine).
    card_x = card_x.clamp(min_x, (max_x - card_w).max(min_x));
    card_y = card_y.clamp(min_y, (max_y - card_h).max(min_y));

    // Convert card back to window coordinates: shift by the bleed.
    let x = card_x - shadow_pad_px;
    let y = card_y - shadow_pad_px;

    (x, y, final_w_px as u32, final_h_px as u32)
}

/// Strip the keyboard-event prefixes ("KeyC" -> "C", "Digit5" -> "5")
/// from the canonical hotkey so the tray hint reads like the user typed
/// it in Settings ("Alt+Shift+C", not "Alt+Shift+KeyC").
fn friendly_hotkey(canonical: &str) -> String {
    canonical
        .split('+')
        .map(|part| {
            part.strip_prefix("Key")
                .or_else(|| part.strip_prefix("Digit"))
                .unwrap_or(part)
        })
        .collect::<Vec<_>>()
        .join("+")
}

pub fn collect_tray_menu_state(app: &AppHandle) -> TrayMenuState {
    let settings = load_settings(app);
    let is_visible = is_any_clock_window_visible(app);
    let relax_playing = app
        .state::<AlarmState>()
        .relax_playing
        .lock()
        .ok()
        .and_then(|g| g.clone());

    let pending_ver = pending_update_version();
    let is_skipped = match (&settings.skipped_update_version, &pending_ver) {
        (Some(skipped), Some(pending)) => skipped == pending,
        _ => false,
    };
    let update_available = pending_ver.is_some() && !is_skipped;

    TrayMenuState {
        version: app.package_info().version.to_string(),
        is_visible,
        window_mode: settings.window_mode.clone(),
        language: settings.language.clone(),
        update_available,
        theme: settings.theme.clone(),
        mini_zoom: settings.mini_zoom,
        auto_update: settings.auto_update,
        audio_muted: settings.audio_muted,
        mini_click_through: settings.mini_click_through,
        relax_playing,
        hotkey: friendly_hotkey(&settings.hotkey_toggle),
        show_suite_recommendations: settings.show_suite_recommendations,
    }
}

#[tauri::command]
fn get_tray_menu_state(app: AppHandle) -> TrayMenuState {
    collect_tray_menu_state(&app)
}

#[tauri::command]
fn report_relax_playing(app: AppHandle, track: Option<String>) {
    let state = app.state::<AlarmState>();
    *lock_or_recover(&state.relax_playing) = track;
}

#[tauri::command]
fn hide_tray_menu(app: AppHandle) {
    if let Some(win) = app.get_webview_window("tray_menu") {
        let _ = win.hide();
        let _ = app.emit("tray-menu-hide", ());
    }
}

/// Bring the currently configured clock window to the foreground before the
/// custom tray menu takes focus. This restores discoverability when the clock
/// is visible but has fallen behind another window, without changing the
/// user's Always on Top preference or showing a deliberately hidden clock.
fn focus_clock_for_tray_menu(app: &AppHandle) {
    let settings = load_settings(app);
    let target_label = if settings.window_mode == "full" {
        "main"
    } else {
        "mini"
    };
    let Some(clock) = app.get_webview_window(target_label) else {
        return;
    };
    if !clock.is_visible().unwrap_or(false) || clock.is_minimized().unwrap_or(false) {
        return;
    }

    let _ = clock.show();
    reapply_click_through(app, &clock);
    let _ = clock.set_focus();
}

#[tauri::command]
fn tray_menu_ready(app: AppHandle, width: f64, height: f64) {
    let Some(win) = app.get_webview_window("tray_menu") else {
        return;
    };

    // Re-apply the window geometry on EVERY ready report — the menu grows
    // when the Help section expands (or the About modal opens), and the
    // size only becomes known once rendered. Anchoring to the tray click
    // point and clamping to the monitor is handled by tray_menu_geometry;
    // if no anchor is recorded yet (first show), use a safe fallback.
    let (anchor_x, anchor_y) = TRAY_MENU_ANCHOR
        .lock()
        .ok()
        .and_then(|g| *g)
        .unwrap_or((100, 100));
    let (x, y, w, h) = tray_menu_geometry(&win, anchor_x, anchor_y, width, height);
    let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: w,
        height: h,
    }));
    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));

    // The show/focus sequence runs only for the first report after a
    // pending show; later reports (Help expand/collapse) just resize.
    if TRAY_MENU_PENDING_SHOW.swap(false, std::sync::atomic::Ordering::SeqCst) {
        let _ = win.show();
        let _ = win.set_focus();
        refresh_taskbar_tab(&win);
    }
}

// Must be async: see the note above spawn_float. This is the entry
// point for the tray menu ("New Timer" / "New Stopwatch" etc.).
#[tauri::command]
async fn tray_menu_action(app: AppHandle, action: String) {
    hide_tray_menu(app.clone());

    match action.as_str() {
        "toggle_visibility" => {
            toggle_clock_visibility(&app);
        }
        "reveal" => {
            if is_any_clock_window_visible(&app) {
                focus_clock_for_tray_menu(&app);
            } else {
                show_clock_window(&app);
            }
        }
        "show" => {
            show_clock_window(&app);
        }
        "hide" => {
            hide_all_clock_windows(&app);
            broadcast_active_window(&app, "none");
        }
        "full" => {
            switch_to_full_mode(app);
        }
        "mini" => {
            switch_to_mini_mode(app);
        }
        "new_timer_tray" => {
            spawn_float_window(&app, "timer");
        }
        "new_stopwatch_tray" => {
            spawn_float_window(&app, "sw");
        }
        "new_timer" => {
            spawn_float_window(&app, "timer");
        }
        "new_stopwatch" => {
            spawn_float_window(&app, "sw");
        }
        "new_calendar" | "new_calendar_tray" => {
            spawn_float_window(&app, "cal");
        }
        "new_analog" | "new_analog_tray" => {
            spawn_float_window(&app, "analog");
        }
        "new_relax" | "new_relax_tray" => {
            spawn_float_window(&app, "relax");
        }
        "new_alarm" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", "new-alarm");
            }
        }
        "home" | "timer" | "stopwatch" | "relax" | "settings" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", &action);
            }
        }
        // Quick relax toggle from the tray: main plays/stops without
        // leaving whatever view the user was on.
        "relax_toggle" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("tray:relax-toggle", ());
            }
        }
        "about" => {
            show_about_window(&app);
        }
        "center_widgets" | "center-widgets" => {
            center_open_widgets_on_active_monitor(&app);
        }
        "check-updates" | "check_updates" => {
            show_about_window(&app);
            let _ = app.emit("about:trigger-check", ());
        }
        "quit" => {
            exit_app(&app);
        }
        _ => {}
    }
}

pub fn show_tray_menu_at(app: AppHandle, anchor_x: i32, anchor_y: i32) {
    if let Ok(mut slot) = TRAY_MENU_ANCHOR.lock() {
        *slot = Some((anchor_x, anchor_y));
    }

    focus_clock_for_tray_menu(&app);

    let state = collect_tray_menu_state(&app);
    let _ = app.emit("tray-menu-state", &state);
    let _ = app.emit("tray-menu-show", ());

    let window_label = "tray_menu";
    let est_w = TRAY_MENU_WIDTH + 2.0 * TRAY_MENU_SHADOW_PAD;
    let est_h = TRAY_MENU_EST_HEIGHT + 2.0 * TRAY_MENU_SHADOW_PAD;

    let Some(win) = app.get_webview_window(window_label) else {
        return;
    };

    let (x, y, w_px, h_px) = tray_menu_geometry(&win, anchor_x, anchor_y, est_w, est_h);
    let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: w_px,
        height: h_px,
    }));
    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    TRAY_MENU_PENDING_SHOW.store(true, std::sync::atomic::Ordering::SeqCst);
    let _ = win.show();
    let _ = win.set_focus();
    refresh_taskbar_tab(&win);
}

fn setup_tray(app: &AppHandle) -> Result<(), tauri::Error> {
    let default_icon = app
        .default_window_icon()
        .cloned()
        .ok_or(tauri::Error::InvalidIcon(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "default window icon missing",
        )))?;
    let _tray = TrayIconBuilder::with_id("main")
        .icon(default_icon)
        .tooltip(format!("CyberClock v{}", app.package_info().version))
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    position,
                    rect,
                    ..
                } => {
                    let app = tray.app_handle();
                    hide_tray_menu(app.clone());
                    let (x, y) = {
                        use tauri::{Position, Size};
                        match (rect.position, rect.size) {
                            (Position::Physical(p), Size::Physical(s)) => {
                                (p.x + (s.width as i32) / 2, p.y + (s.height as i32) / 2)
                            }
                            _ => (position.x.round() as i32, position.y.round() as i32),
                        }
                    };
                    reveal_clock_at(app, x, y);
                }
                TrayIconEvent::Click {
                    button: MouseButton::Right,
                    button_state: MouseButtonState::Up,
                    position,
                    rect,
                    ..
                } => {
                    let app = tray.app_handle().clone();
                    // Anchor at the icon's CENTER: vertical taskbars put the
                    // icon mid-bar, and menus (native ones too) open beside/
                    // above that center — anchoring at the rect's top edge
                    // made the menu float visibly higher than other tray
                    // menus and far away on a left-edge taskbar.
                    let (x, y) = {
                        use tauri::{Position, Size};
                        match (rect.position, rect.size) {
                            (Position::Physical(p), Size::Physical(s)) => {
                                (p.x + (s.width as i32) / 2, p.y + (s.height as i32) / 2)
                            }
                            _ => (position.x.round() as i32, position.y.round() as i32),
                        }
                    };
                    if let Some(win) = app.get_webview_window("tray_menu") {
                        if win.is_visible().unwrap_or(false) {
                            hide_tray_menu(app);
                            return;
                        }
                    }
                    show_tray_menu_at(app, x, y);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────
// Window Initialization
// ─────────────────────────────────────────────────────────────

fn show_initial_window(app: &AppHandle) {
    let mut settings = load_settings(app);

    // Reconcile the saved Start-with-Windows preference with the actual
    // HKCU Run entry: the registry is what really decides whether the app
    // boots with Windows, and the NSIS installer's checkbox (or msconfig,
    // antivirus cleanups…) can change it behind the settings file's back.
    // The Settings UI must reflect reality.
    #[cfg(target_os = "windows")]
    {
        let registered = {
            use std::process::Command;
            Command::new("reg")
                .args([
                    "query",
                    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "CyberClock",
                ])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        };
        if registered != settings.start_with_windows {
            let actual = registered;
            let _ = update_settings(app, |s| {
                s.start_with_windows = actual;
                Ok(())
            });
            settings.start_with_windows = actual;
        }
    }

    // Hide all windows first
    for window in app.webview_windows().values() {
        let _ = window.hide();
    }

    let is_startup = std::env::args().any(|arg| arg == "--startup");
    let is_mini = if is_startup && settings.start_in_mini_mode {
        true
    } else {
        settings.window_mode != "full"
    };

    // Show appropriate window based on mode
    if !is_mini {
        if let Some(main) = app.get_webview_window("main") {
            // Automatic selection: the monitor that holds the mouse
            // pointer, else the preferred display. Full mode fills the
            // monitor's work area (taskbars respected on every edge).
            place_full_clock(&main, &settings);
            let _ = main.show();
            // Re-assert the taskbar tab: a boot-time start can beat the
            // taskbar creation, losing the AddTab registration.
            refresh_taskbar_tab(&main);
        }
    } else if let Some(mini) = app.get_webview_window("mini") {
        // Set position if saved and valid
        let mut positioned = false;
        if let Some((x, y)) = settings.mini_position {
            if let Ok(monitors) = mini.available_monitors() {
                if monitors.iter().any(|m| is_position_in_monitor(x, y, m)) {
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                    positioned = true;
                }
            }
        }
        if !positioned {
            // Center on preferred display or first
            let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
            if let Ok(monitors) = mini.available_monitors() {
                let monitor = monitors
                    .get(display_id)
                    .or_else(|| monitors.first())
                    .cloned();
                if let Some(m) = monitor {
                    let (x, y) = center_mini_on_monitor(&m);
                    let _ = mini.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                }
            }
        }
        clamp_window_to_monitors(&mini);
        #[cfg(windows)]
        attach_window_drag_subclass(&mini);
        let _ = mini.show();
        // Re-assert the taskbar DeleteTab: at a Run-key boot start the
        // taskbar may not exist yet, and the one-shot registration tao
        // performs at creation is silently lost (the mini then keeps a
        // permanent taskbar button).
        refresh_taskbar_tab(&mini);
        reapply_click_through(app, &mini);
    }

    broadcast_active_window(app, if is_mini { "mini" } else { "main" });

    // Restore floating windows if they were open before closing
    if settings.restore_float_widgets {
        if settings.float_cal_open {
            spawn_float_window(app, "cal");
        }
        if settings.float_analog_open {
            spawn_float_window(app, "analog");
        }
        if settings.float_relax_open {
            spawn_float_window(app, "relax");
        }
        let saved_widgets = settings.open_float_widgets.clone();
        for widget in saved_widgets {
            spawn_float_window_with_slot(app, &widget.kind, Some(&widget.label), widget.position);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Application Entry Point
// ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window when second instance is launched
            let settings = load_settings(app);
            if settings.window_mode == "full" {
                if let Some(main) = app.get_webview_window("main") {
                    place_full_clock(&main, &settings);
                    let _ = main.unminimize();
                    let _ = main.show();
                    refresh_taskbar_tab(&main);
                    let _ = main.set_focus();
                }
            } else if let Some(mini) = app.get_webview_window("mini") {
                let _ = mini.unminimize();
                let _ = mini.show();
                reapply_click_through(app, &mini);
                refresh_taskbar_tab(&mini);
                let _ = mini.set_focus();
            }
            broadcast_active_window(
                app,
                if settings.window_mode == "full" {
                    "main"
                } else {
                    "mini"
                },
            );
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("cyberclock".into()),
                    }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AlarmState::default())
        .manage(UpdaterState::default())
        .setup(|app| {
            // Setup tray icon
            setup_tray(app.handle())?;

            // Full mode is work-area sized by definition (CyberLauncher
            // style): the clock fills its monitor's work area, only
            // minimize is allowed. Any other resize (a stray caption
            // double-click maximize/restore, mixed-DPI glitches) snaps
            // back to the work area of the monitor the window is on.
            if let Some(main) = app.get_webview_window("main") {
                // No maximize box: without it a caption double-click can
                // not toggle maximize/restore in the first place.
                let _ = main.set_maximizable(false);
                let main_for_resize = main.clone();
                main.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. }
                        if !APP_EXITING.load(Ordering::SeqCst) =>
                    {
                        api.prevent_close();
                        let _ = main_for_resize.emit("main:close-requested", ());
                    }
                    WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                        if main_for_resize.is_minimized().unwrap_or(true) {
                            return;
                        }
                        if let Ok(Some(monitor)) = main_for_resize.current_monitor() {
                            let work_area = monitor.work_area();
                            let pos = work_area.position;
                            let size = work_area.size;
                            let in_place = main_for_resize
                                .outer_position()
                                .map(|p| p.x == pos.x && p.y == pos.y)
                                .unwrap_or(false)
                                && main_for_resize.outer_size().ok().is_some_and(|s| {
                                    s.width == size.width && s.height == size.height
                                });
                            if !in_place {
                                let _ = main_for_resize.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition::new(pos.x, pos.y),
                                ));
                                let _ = main_for_resize.set_size(tauri::Size::Physical(
                                    tauri::PhysicalSize::new(size.width, size.height),
                                ));
                            }
                        }
                    }
                    _ => {}
                });
            }

            // The mini window is non-resizable (tauri.conf.json). However,
            // moving between monitors with different DPI can still cause
            // Webview2 to apply incorrect scaling (progressive ~20% shrink).
            // Re-apply the mini target only when the physical size is wrong.
            if let Some(mini) = app.get_webview_window("mini") {
                #[cfg(windows)]
                attach_window_drag_subclass(&mini);
                let mini_for_resize = mini.clone();
                let app_for_resize = app.handle().clone();
                mini.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. }
                        if !APP_EXITING.load(Ordering::SeqCst) =>
                    {
                        api.prevent_close();
                        exit_app(&app_for_resize);
                    }
                    WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                        restore_target_size(&mini_for_resize);
                        // While the settings peek is docked, follow
                        // resizes (zoom changes) so the mini never
                        // spills past the work area edge.
                        let peek_moved = MINI_PREVIEW
                            .lock()
                            .ok()
                            .and_then(|guard| guard.as_ref().map(|st| st.moved))
                            .unwrap_or(false);
                        if peek_moved {
                            if let Some((x, y)) = mini_dock_pos(&app_for_resize, &mini_for_resize) {
                                let _ = mini_for_resize.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition::new(x, y),
                                ));
                            }
                        }
                    }
                    _ => {}
                });
            }

            // Configure tray_menu window blur dismiss
            if let Some(tray_menu) = app.get_webview_window("tray_menu") {
                let tm_blur = tray_menu.clone();
                tray_menu.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        let win = tm_blur.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                            if !win.is_focused().unwrap_or(false) {
                                let _ = win.hide();
                            }
                        });
                    }
                });
            }

            // Load settings and show initial window
            let settings = load_settings(app.handle());
            EDGE_LIMITS_ENABLED.store(settings.mini_edge_limits, Ordering::Release);
            init_updater(app.handle(), settings.auto_update);
            show_initial_window(app.handle());

            // Keep taskbar tabs honest: re-assert DeleteTab/AddTab on the
            // visible windows so a boot start that beat the taskbar (or an
            // Explorer restart, which drops every registration) cannot
            // leave a phantom taskbar button on the mini clock.
            #[cfg(target_os = "windows")]
            spawn_taskbar_tab_poll(app.handle().clone());

            // Fixed-interval chime checker (:00 / :15 / :30 / :45).
            // 15s cadence so a chime never fires more than 15s late.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(15));
                check_alarms(&app_handle);
            });

            // Scheduler for custom alarms
            let app_for_custom = app.handle().clone();
            std::thread::spawn(move || {
                custom_alarms_scheduler(app_for_custom);
            });

            // Watch monitors for layout and DPI changes (robust multi-monitor support)
            let app_for_monitors = app.handle().clone();
            std::thread::spawn(move || {
                watch_monitors(app_for_monitors);
            });

            // Relax scheduler loop (robust backend time check)
            let app_for_relax = app.handle().clone();
            std::thread::spawn(move || {
                relax_scheduler_loop(app_for_relax);
            });

            // Clock accuracy loop (NTP drift check + wrong-time warning)
            let app_for_clock = app.handle().clone();
            std::thread::spawn(move || {
                clock_accuracy_loop(app_for_clock);
            });

            // Global hotkey (show/hide the clock)
            register_app_hotkey(app.handle());

            info!(
                "CyberClock v{} started (mode: {})",
                app.package_info().version,
                settings.window_mode
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            speak_announcement,
            save_settings,
            patch_settings,
            snooze_alarm,
            dismiss_alarm,
            reset_settings,
            close_window,
            minimize_window,
            get_window_position,
            move_window,
            set_window_size,
            toggle_always_on_top,
            open_window,
            hide_window,
            spawn_float,
            switch_to_full_mode,
            switch_to_mini_mode,
            set_mini_preview,
            open_mini_context_menu,
            close_mini_context_menu,
            mini_menu_ready,
            menu_action,
            get_menu_caller,
            get_open_float_labels,
            get_tray_menu_state,
            report_relax_playing,
            hide_tray_menu,
            tray_menu_ready,
            tray_menu_action,
            get_screens,
            select_display,
            reset_mini_position,
            save_mini_position,
            open_file_dialog,
            set_startup,
            get_app_version,
            is_portable,
            is_msstore,
            check_for_updates,
            get_pending_update,
            download_update,
            install_update,
            open_taskbar_settings,
            open_datetime_properties,
            check_clock_accuracy,
            get_time_sync_task_status,
            setup_time_sync_task,
            remove_time_sync_task,
            sync_system_clock,
            set_hotkey,
            open_external_url,
            clamp_current_window_to_monitors,
            set_analog_menu_capture,
            center_open_widgets,
            export_backup,
            import_backup,
            open_data_folder
        ]);

    // Build the app without starting the event loop, so the settings
    // store can be managed BEFORE the config windows are created (the
    // frontend's onInit invokes get_settings as soon as a window loads
    // — managing state inside setup() would be too late and panic).
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.manage(init_settings_store(app.handle()));
    app.run(|_, _| {});
}

#[cfg(test)]
mod alarm_schedule_tests {
    use super::occurrence_is_pending;
    use chrono::{Local, TimeZone};

    #[test]
    fn a_due_alarm_stays_pending_through_the_grace_window() {
        let now = Local.with_ymd_and_hms(2026, 9, 29, 12, 11, 20).single().unwrap();
        let scheduled = Local.with_ymd_and_hms(2026, 9, 29, 12, 11, 0).single().unwrap();
        let upcoming = Local.with_ymd_and_hms(2026, 9, 29, 12, 12, 0).single().unwrap();
        let missed = Local.with_ymd_and_hms(2026, 9, 29, 12, 8, 0).single().unwrap();
        assert!(occurrence_is_pending(scheduled, now));
        assert!(occurrence_is_pending(upcoming, now));
        assert!(!occurrence_is_pending(missed, now));
    }
}
