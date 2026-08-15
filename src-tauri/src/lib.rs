use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Manager, WebviewWindow, Emitter, WindowEvent};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_dialog::DialogExt;
use chrono::{Local, Timelike};
use chrono::{Datelike, TimeZone};

mod updater;
use updater::{
    check_for_updates, download_update, get_app_version, init_updater, install_update,
    set_auto_update, UpdaterState,
};

// ─────────────────────────────────────────────────────────────
// Settings Structures
// ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct AlarmSettings {
    pub enabled: bool,
    pub sound: String,
    pub custom_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct CustomAlarm {
    pub enabled: bool,
    pub hour: u32,   // 0-23
    pub minute: u32, // 0-59
    // Bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
    pub days_mask: u8,
    pub sound: String,
    pub custom_path: Option<String>,
}

impl Default for CustomAlarm {
    fn default() -> Self {
        Self {
            enabled: false,
            hour: 9,
            minute: 0,
            days_mask: 0,
            sound: "chime-digital".to_string(),
            custom_path: None,
        }
    }
}

impl Default for AlarmSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            sound: "chime-digital".to_string(),
            custom_path: None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct RelaxSchedulerSettings {
    pub enabled: bool,
    pub time: String,
    pub repeat: u32,
    pub track: String,
    pub duration: u32,
}

impl Default for RelaxSchedulerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            time: "22:00".to_string(),
            repeat: 60,
            track: "random-one".to_string(),
            duration: 15,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub clock_format: String,
    pub show_seconds: bool,
    pub always_on_top: bool,
    pub start_with_windows: bool,
    pub start_in_mini_mode: bool,
    pub window_mode: String,
    pub mini_position: Option<(i32, i32)>,
    pub mini_opacity: f64,
    pub mini_bg_opacity: f64,
    pub mini_design: u32,
    pub mini_position_locked: bool,
    pub preferred_display_id: Option<u32>,
    pub alarm_half_hour: AlarmSettings,
    pub alarm_full_hour: AlarmSettings,
    pub alarm_quarter_hour: AlarmSettings,
    pub alarm_schedule_enabled: bool,
    pub alarm_schedule_start: String,
    pub alarm_schedule_end: String,
    pub alarm_volume: f64,
    pub relax_volume: f64,
    pub relax_auto_timer: u32,
    pub last_relax_track: Option<String>,
    pub mini_scanlines: bool,
    pub mini_collapse_date: bool,

    // Roadmap B: Custom alarm times (HH:MM) with day-of-week repetition
    // (No snooze for now)
    pub custom_alarms: Vec<CustomAlarm>,

    pub relax_scheduler: RelaxSchedulerSettings,

    pub language: String,
    pub breathe_pattern: String,
    pub auto_update: bool,

    // Calendar day notes: ISO date key "YYYY-MM-DD" -> note text
    pub calendar_notes: HashMap<String, String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "cyber-blue".to_string(),
            clock_format: "12h".to_string(),
            show_seconds: true,
            always_on_top: false,
            start_with_windows: true,
            start_in_mini_mode: true,
            window_mode: "mini".to_string(),
            mini_position: None,
            mini_opacity: 1.0,
            mini_bg_opacity: 1.0,
            mini_design: 1,
            mini_position_locked: false,
            preferred_display_id: None,
            alarm_half_hour: AlarmSettings::default(),
            alarm_full_hour: AlarmSettings {
                enabled: true,
                sound: "chime-digital".to_string(),
                custom_path: None,
            },
            alarm_quarter_hour: AlarmSettings::default(),
            alarm_schedule_enabled: false,
            alarm_schedule_start: "08:00".to_string(),
            alarm_schedule_end: "17:00".to_string(),
            alarm_volume: 0.75,
            relax_volume: 0.8,
            relax_auto_timer: 0,
            last_relax_track: None,
            mini_scanlines: true,
            mini_collapse_date: false,
            custom_alarms: vec![CustomAlarm::default(), CustomAlarm::default(), CustomAlarm::default()],
            relax_scheduler: RelaxSchedulerSettings::default(),
            language: "auto".to_string(),
            breathe_pattern: "box".to_string(),
            auto_update: true,
            calendar_notes: HashMap::new(),
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Settings File Management
// ─────────────────────────────────────────────────────────────

fn get_settings_path(app: &AppHandle) -> PathBuf {
    let mut path = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&path).ok();
    path.push("cyberclock-settings.json");
    path
}

fn load_settings(app: &AppHandle) -> AppSettings {
    let path = get_settings_path(app);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

fn save_settings_to_file(app: &AppHandle, settings: &AppSettings) {
    let path = get_settings_path(app);
    if let Ok(content) = serde_json::to_string_pretty(settings) {
        fs::write(path, content).ok();
    }
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

// ─────────────────────────────────────────────────────────────
// Alarm State
// ─────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AlarmState {
    pub last_half_hour: Mutex<Option<(u32, u32)>>, // (hour, minute)
    pub last_full_hour: Mutex<Option<u32>>,         // hour
    pub last_quarter_hour: Mutex<Option<(u32, u32)>>, // (hour, minute)
    pub relax_next_run: Mutex<Option<chrono::DateTime<Local>>>,
}

// ─────────────────────────────────────────────────────────────
// Mini window target height — shared between resize handler and
// set_window_size command so skin changes work correctly across
// DPI differences between monitors.
// ─────────────────────────────────────────────────────────────

static MINI_TARGET_WIDTH: AtomicU32 = AtomicU32::new(260);
static MINI_TARGET_HEIGHT: AtomicU32 = AtomicU32::new(48);

// ─────────────────────────────────────────────────────────────
// Tauri Commands
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> AppSettings {
    save_settings_to_file(&app, &settings);
    set_auto_update(settings.auto_update);

    // Reset next run for relax scheduler
    let state = app.state::<AlarmState>();
    if let Ok(mut next_run) = state.relax_next_run.lock() {
        *next_run = None;
    }
    
    // Update always on top for always-on-top windows only (mini, menu)
    let aot = settings.always_on_top;
    for (label, window) in app.webview_windows() {
        if label == "mini" || label == "menu" {
            let _ = window.set_always_on_top(aot);
        } else if label == "main" {
            let _ = window.set_always_on_top(false);
        }
    }
    
    settings
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    let _ = window.close();
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

#[tauri::command]
fn get_window_position(window: WebviewWindow) -> (i32, i32) {
    window
        .outer_position()
        .map(|p| (p.x, p.y))
        .unwrap_or((0, 0))
}

#[tauri::command]
fn move_window(window: WebviewWindow, x: i32, y: i32) {
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
}

#[tauri::command]
fn set_window_size(window: WebviewWindow, width: i32, height: i32) {
    // Reject invalid values.
    if width <= 0 || height <= 0 || width > 2000 || height > 2000 {
        return;
    }
    // Store the target size so the Resized handler can re-apply it
    // when DPI scaling tries to corrupt the window size.
    MINI_TARGET_WIDTH.store(width as u32, Ordering::Release);
    MINI_TARGET_HEIGHT.store(height as u32, Ordering::Release);
    // Use Logical size so Tauri calculates the correct physical size
    // for the monitor the window is currently on.
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width as f64, height as f64)));
}

#[tauri::command]
fn toggle_always_on_top(window: WebviewWindow) -> bool {
    let is_on_top = window.is_always_on_top().unwrap_or(false);
    let _ = window.set_always_on_top(!is_on_top);
    !is_on_top
}

#[tauri::command]
fn open_window(app: AppHandle, name: String) -> bool {
    if let Some(window) = app.get_webview_window(&name) {
        let _ = window.show();
        let _ = window.set_focus();
        return true;
    }
    false
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
                let m_pos = m.position();
                let m_size = m.size();
                if center_x >= m_pos.x && center_x < m_pos.x + m_size.width as i32
                    && center_y >= m_pos.y && center_y < m_pos.y + m_size.height as i32 {
                    return Some((idx, m.clone()));
                }
            }
        }
    }
    
    None
}

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
        
    let today_dt = Local.from_local_datetime(&today_candidate)
        .single()
        .unwrap_or_else(|| now);
        
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
        
        let mut next_run_opt = match state.relax_next_run.lock() {
            Ok(guard) => guard,
            Err(_) => continue,
        };
        
        let next_run = match *next_run_opt {
            Some(dt) => dt,
            None => {
                let dt = compute_next_relax_run(&settings.relax_scheduler.time);
                *next_run_opt = Some(dt);
                dt
            }
        };
        
        if now >= next_run {
            // Trigger!
            let trigger_data = serde_json::json!({
                "track": settings.relax_scheduler.track,
                "duration": settings.relax_scheduler.duration,
            });
            let _ = app.emit("relax:trigger", trigger_data);
            
            // Compute next run
            let repeat = settings.relax_scheduler.repeat;
            let next_dt = if repeat > 0 {
                now + chrono::Duration::minutes(repeat as i64)
            } else {
                // One-shot: disable scheduler in settings
                let mut updated_settings = settings.clone();
                updated_settings.relax_scheduler.enabled = false;
                save_settings_to_file(&app, &updated_settings);
                let _ = app.emit("settings:updated", &updated_settings);
                
                // Fallback to one year from now
                now + chrono::Duration::days(365)
            };
            
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
                        m.name(), pos.x, pos.y, size.width, size.height, m.scale_factor()
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
    let mut settings = load_settings(&app);
    let mut settings_changed = false;
    
    // Find any window to get monitors
    let monitors = if let Some(win) = app.webview_windows().values().next() {
        win.available_monitors().unwrap_or_default()
    } else {
        Vec::new()
    };
    
    if monitors.is_empty() {
        return;
    }
    
    let preferred_id = settings.preferred_display_id.unwrap_or(0) as usize;
    if preferred_id >= monitors.len() {
        // Preferred monitor is disconnected! Fallback to primary
        let primary_idx = if let Some(win) = app.webview_windows().values().next() {
            if let Ok(Some(pm)) = win.primary_monitor() {
                monitors.iter().position(|m| m.name() == pm.name()).unwrap_or(0)
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
                    let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(position.x, position.y)));
                    let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, size.height)));
                }
            }
        }
    } else {
        if let Some(mini) = app.get_webview_window("mini") {
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
                        let pos = monitor.position();
                        let size = monitor.size();
                        let x = pos.x + (size.width as i32 / 2) - 130;
                        let y = pos.y + (size.height as i32 / 2) - 24;
                        let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                        settings.mini_position = Some((x, y));
                        settings_changed = true;
                    }
                }
            }
        }
    }
    
    if settings_changed {
        save_settings_to_file(&app, &settings);
    }
    
    // Broadcast the update so frontends refresh their screen lists
    let _ = app.emit("settings:updated", &settings);
}

#[tauri::command]
fn switch_to_full_mode(app: AppHandle) {
    // Save mode
    let mut settings = load_settings(&app);
    settings.window_mode = "full".to_string();
    
    let mut detected_monitor = None;
    if let Some(mini) = app.get_webview_window("mini") {
        // Detect monitor of mini
        if let Some((idx, monitor)) = find_monitor_for_window(&mini) {
            settings.preferred_display_id = Some(idx as u32);
            detected_monitor = Some(monitor);
        }
        
        // Also save its current position
        if let Ok(pos) = mini.outer_position() {
            settings.mini_position = Some((pos.x, pos.y));
        }
        
        let _ = mini.hide();
    }
    
    if let Some(main) = app.get_webview_window("main") {
        // Position on detected or preferred display
        let monitor = detected_monitor.or_else(|| {
            let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
            main.available_monitors().ok().and_then(|monitors| {
                monitors.get(display_id).or_else(|| monitors.first()).cloned()
            })
        });
        
        if let Some(m) = monitor {
            let work_area = m.work_area();
            let size = work_area.size;
            let position = work_area.position;
            let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(position.x, position.y)));
            let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, size.height)));
        }
        let _ = main.show();
        let _ = main.set_focus();
    }
    
    save_settings_to_file(&app, &settings);
    let _ = app.emit("settings:updated", &settings);
    broadcast_active_window(&app, "main");
}

#[tauri::command]
fn switch_to_mini_mode(app: AppHandle) {
    // Save mode
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
                    let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                    positioned = true;
                }
            } else {
                if let Ok(monitors) = mini.available_monitors() {
                    if monitors.iter().any(|m| is_position_in_monitor(x, y, m)) {
                        let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                        positioned = true;
                    }
                }
            }
        }
        
        if !positioned {
            let monitor = detected_monitor.or_else(|| {
                mini.available_monitors().ok().and_then(|m| m.first().cloned())
            });
            if let Some(m) = monitor {
                let pos = m.position();
                let size = m.size();
                let x = pos.x + (size.width as i32 / 2) - 130;
                let y = pos.y + (size.height as i32 / 2) - 24;
                let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
            }
        }
        
        let _ = mini.show();
        let _ = mini.set_focus();
    }
    
    save_settings_to_file(&app, &settings);
    let _ = app.emit("settings:updated", &settings);
    broadcast_active_window(&app, "mini");
}

#[tauri::command]
fn open_mini_context_menu(app: AppHandle, _x: i32, _y: i32, screen_x: i32, screen_y: i32) {
    if let Some(menu) = app.get_webview_window("menu") {
        // Get screen dimensions to prevent menu from going off-screen
        if let Ok(monitors) = menu.available_monitors() {
            // Find the monitor where the click happened
            // We need to find which monitor contains the click point
            let found_monitor = monitors.iter().find(|m| {
                let pos = m.position();
                let size = m.size();
                // Check if the click point is within this monitor's bounds
                screen_x >= pos.x && screen_x < pos.x + size.width as i32
                    && screen_y >= pos.y && screen_y < pos.y + size.height as i32
            });
            
            if let Some(found_monitor) = found_monitor {
                let monitor_pos = found_monitor.position();
                let monitor_size = found_monitor.size();
                let scale = found_monitor.scale_factor();

                // Menu dimensions (logical px in tauri.conf.json) → physical
                let menu_width = (270.0 * scale) as i32;
                let menu_height = (500.0 * scale) as i32;
                let gap = (8.0 * scale) as i32;

                // Monitor edges
                let mon_left = monitor_pos.x;
                let mon_top = monitor_pos.y;
                let mon_right = monitor_pos.x + monitor_size.width as i32;
                let mon_bottom = monitor_pos.y + monitor_size.height as i32;

                // Anchor the menu to the mini clock window (not the cursor) so it never
                // covers the clock while the user adjusts sliders.
                let (clock_x, clock_y, clock_w, clock_h) = app
                    .get_webview_window("mini")
                    .and_then(|mini| {
                        match (mini.outer_position(), mini.outer_size()) {
                            (Ok(p), Ok(s)) => Some((p.x, p.y, s.width as i32, s.height as i32)),
                            _ => None,
                        }
                    })
                    .unwrap_or((screen_x, screen_y, 0, 0));

                // Does the menu fit on each side of the clock (with a gap)?
                let room_below = clock_y + clock_h + gap + menu_height <= mon_bottom;
                let room_above = clock_y - gap - menu_height >= mon_top;
                let room_right = clock_x + clock_w + gap + menu_width <= mon_right;
                let room_left = clock_x - gap - menu_width >= mon_left;

                // Placement priority: below → above → side. Below/above read best when
                // they fit; sides handle the case where the clock sits mid-screen and
                // there's no vertical room either way.
                let (mut pos_x, mut pos_y) = if room_below {
                    (clock_x, clock_y + clock_h + gap)
                } else if room_above {
                    (clock_x, clock_y - menu_height - gap)
                } else {
                    // Go to the side with more room: if the clock leans left of the
                    // monitor centre, open on the right, and vice-versa.
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
                    (x, clock_y) // vertical is clamped to the screen below
                };

                // Final clamp so the menu always stays fully on the monitor
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

                // Set position using physical coordinates
                let _ = menu.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(pos_x, pos_y)));
            } else {
                // Fallback: just use the screen coordinates directly
                // This handles edge cases where click is between monitors
                let _ = menu.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(screen_x, screen_y)));
            }
        } else {
            // Fallback if we can't get monitors
            let _ = menu.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(screen_x, screen_y)));
        }
        
        let _ = menu.show();
        let _ = menu.set_focus();
    }
}

#[tauri::command]
fn close_mini_context_menu(app: AppHandle) {
    if let Some(menu) = app.get_webview_window("menu") {
        let _ = menu.hide();
    }
}

#[tauri::command]
fn menu_action(app: AppHandle, action: String) -> bool {
    // Hide menu first (except for "aot" which needs a visual delay in the UI)
    if action != "aot" {
        if let Some(menu) = app.get_webview_window("menu") {
            let _ = menu.hide();
        }
    }
    
    match action.as_str() {
        "full" => {
            switch_to_full_mode(app);
            true
        }
        "close" => {
            exit_app(&app);
            true
        }
        "aot" => {
            let mut settings = load_settings(&app);
            settings.always_on_top = !settings.always_on_top;
            save_settings_to_file(&app, &settings);
            
            // Apply to always-on-top windows only (mini, menu)
            let aot = settings.always_on_top;
            for (label, window) in app.webview_windows() {
                if label == "mini" || label == "menu" {
                    let _ = window.set_always_on_top(aot);
                } else if label == "main" {
                    let _ = window.set_always_on_top(false);
                }
            }
            
            // Broadcast update
            let _ = app.emit("settings:updated", &settings);
            true
        }
        "timer" | "stopwatch" | "relax" | "settings" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", &action);
            }
            true
        }
        _ => {
            if action.starts_with("open-note:") {
                switch_to_full_mode(app.clone());
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.emit("mini:menu-action", &action);
                }
                true
            } else {
                false
            }
        }
    }
}

#[derive(Serialize, Deserialize)]
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
            let is_primary = primary_monitor.as_ref().map_or(false, |pm| {
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
                current: settings.preferred_display_id.map_or(false, |pid| pid == id),
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
    save_settings_to_file(&app, &settings);
    
    // Move main window to selected display
    if let Some(main) = app.get_webview_window("main") {
        if let Ok(monitors) = window.available_monitors() {
            if let Some(monitor) = monitors.get(id as usize) {
                let work_area = monitor.work_area();
                let size = work_area.size;
                let position = work_area.position;
                let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(position.x, position.y)));
                let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, size.height)));
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
    save_settings_to_file(&app, &settings);
    // Also move the mini window back to default center-ish position
    if let Some(mini) = app.get_webview_window("mini") {
        if let Ok(monitors) = mini.available_monitors() {
            if let Some(monitor) = monitors.first() {
                let pos = monitor.position();
                let size = monitor.size();
                let x = pos.x + (size.width as i32 / 2) - 130;
                let y = pos.y + (size.height as i32 / 2) - 24;
                let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
            }
        }
    }
    let _ = app.emit("settings:updated", &settings);
}

#[tauri::command]
fn save_mini_position(app: AppHandle) -> bool {
    if let Some(mini) = app.get_webview_window("mini") {
        if let Ok(pos) = mini.outer_position() {
            let mut settings = load_settings(&app);
            settings.mini_position = Some((pos.x, pos.y));
            
            // Also update preferred_display_id based on where the mini is right now
            if let Some((idx, _)) = find_monitor_for_window(&mini) {
                settings.preferred_display_id = Some(idx as u32);
            }
            
            save_settings_to_file(&app, &settings);
            let _ = app.emit("settings:updated", &settings);
            return true;
        }
    }
    false
}

#[tauri::command]
async fn open_file_dialog(window: WebviewWindow) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    window.dialog().file().pick_file(move |file_path| {
        let _ = tx.send(file_path);
    });
    
    rx.recv().ok().flatten().map(|p| p.to_string())
}

#[tauri::command]
fn set_startup(app: AppHandle, on: bool) {
    let mut settings = load_settings(&app);
    settings.start_with_windows = on;
    save_settings_to_file(&app, &settings);
    
    // On Windows, we would use registry or startup folder
    // For now, just save the setting
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if on {
            // Add to startup via registry with --startup flag
            let exe_path = std::env::current_exe().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let reg_value = format!("\"{}\" --startup", exe_path);
            let _ = Command::new("reg")
                .args(["add", "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", 
                       "/v", "CyberClock", "/d", &reg_value, "/f"])
                .output();
        } else {
            let _ = Command::new("reg")
                .args(["delete", "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", 
                       "/v", "CyberClock", "/f"])
                .output();
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

    if !is_time_in_alarm_schedule(now, &settings) {
        return;
    }

    let alarm_state = app.state::<AlarmState>();

    // Check quarter-hour alarm (at :00, :15, :30, and :45)
    if settings.alarm_quarter_hour.enabled && (minute == 0 || minute == 15 || minute == 30 || minute == 45) {
        let mut last = alarm_state.last_quarter_hour.lock().unwrap();
        if last.map_or(true, |(h, m)| h != hour || m != minute) {
            *last = Some((hour, minute));
            drop(last);

            // Emit alarm event
            let alarm_data = serde_json::json!({
                "type": "quarter-hour",
                "sound": settings.alarm_quarter_hour.sound,
                "customPath": settings.alarm_quarter_hour.custom_path,
                "volume": settings.alarm_volume
            });

            let _ = app.emit("alarm:chime", alarm_data);
        }
    }

    // Check half-hour alarm (at :00 and :30)
    if settings.alarm_half_hour.enabled && (minute == 0 || minute == 30) {
        let mut last = alarm_state.last_half_hour.lock().unwrap();
        if last.map_or(true, |(h, m)| h != hour || m != minute) {
            *last = Some((hour, minute));
            drop(last);

            // Emit alarm event
            let alarm_data = serde_json::json!({
                "type": "half-hour",
                "sound": settings.alarm_half_hour.sound,
                "customPath": settings.alarm_half_hour.custom_path,
                "volume": settings.alarm_volume
            });

            let _ = app.emit("alarm:chime", alarm_data);
        }
    }

    // Check full-hour alarm
    if settings.alarm_full_hour.enabled && minute == 0 {
        let mut last = alarm_state.last_full_hour.lock().unwrap();
        if last.map_or(true, |h| h != hour) {
            *last = Some(hour);
            drop(last);

            // Emit alarm event
            let alarm_data = serde_json::json!({
                "type": "full-hour",
                "sound": settings.alarm_full_hour.sound,
                "customPath": settings.alarm_full_hour.custom_path,
                "volume": settings.alarm_volume
            });

            let _ = app.emit("alarm:chime", alarm_data);
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

fn compute_next_custom_alarm_datetime(now: chrono::DateTime<Local>, alarm: &CustomAlarm) -> chrono::DateTime<Local> {
    // Find the next occurrence on enabled days at HH:MM local time.
    // We only schedule for current+next 7 days window.
    // If days_mask is 0, treat it as "no days enabled" -> return now+365d.
    if alarm.days_mask == 0 {
        return now + chrono::Duration::days(365);
    }

    // Candidate for today at alarm time
    let today_candidate = now
        .date_naive()
        .and_hms_opt(alarm.hour, alarm.minute, 0)
        .unwrap_or_else(|| now.naive_local());

    let today_dt = Local.from_local_datetime(&today_candidate)
        .single()
        .unwrap_or_else(|| now);

    if (today_dt >= now) && ((alarm.days_mask & custom_alarm_days_mask_for_chrono_weekday(today_dt.weekday())) != 0) {
        return today_dt;
    }

    // Otherwise search forward day by day (up to 7 days)
    for i in 1..=8 {
        let d = now.date_naive() + chrono::Duration::days(i);
        let cand_naive = d.and_hms_opt(alarm.hour, alarm.minute, 0).unwrap();
        let cand_dt = Local.from_local_datetime(&cand_naive).single().unwrap();
        let mask = custom_alarm_days_mask_for_chrono_weekday(cand_dt.weekday());
        if (alarm.days_mask & mask) != 0 {
            return cand_dt;
        }
    }

    // Fallback (shouldn't happen)
    now + chrono::Duration::days(365)
}

fn custom_alarms_scheduler(app: AppHandle) {
    // Keep a small "last fired" memory to avoid double emits
    // across rapid rescheduling. We store the last fired unix timestamp per slot index.
    let mut last_fired_by_idx: Vec<Option<i64>> = vec![None; 3];

    loop {
        let settings = load_settings(&app);
        let now = Local::now();

        let mut nexts: Vec<(chrono::DateTime<Local>, usize)> = Vec::new();

        for (idx, alarm) in settings.custom_alarms.iter().enumerate() {
            if !alarm.enabled {
                continue;
            }
            if idx >= 3 {
                break;
            }
            let next_dt = compute_next_custom_alarm_datetime(now, alarm);
            nexts.push((next_dt, idx));
        }

        // If no custom alarms enabled, sleep a bit and re-check
        if nexts.is_empty() {
            std::thread::sleep(std::time::Duration::from_secs(15));
            continue;
        }

        // pick earliest next time
        nexts.sort_by_key(|(dt, _)| dt.timestamp());
        let (earliest, earliest_idx) = nexts[0].clone();

        let delay = earliest.signed_duration_since(now);
        let delay_secs = delay.num_seconds();

        // Sleep in chunks but don't go too long
        if delay_secs > 5 {
            let chunk = std::cmp::min(delay_secs.saturating_sub(2), 30);
            std::thread::sleep(std::time::Duration::from_secs(chunk as u64));
            continue;
        }

        // Within trigger window: verify again and fire when exact minute matches
        let now2 = Local::now();
        let idx = earliest_idx;
        if idx < settings.custom_alarms.len() {
            let alarm = &settings.custom_alarms[idx];
            if alarm.enabled {
                let should_fire =
                    now2.hour() == alarm.hour
                        && now2.minute() == alarm.minute
                        && (alarm.days_mask & custom_alarm_days_mask_for_chrono_weekday(now2.weekday()) != 0);

                if should_fire {
                    let fired_ts = now2.timestamp();
                    let already = last_fired_by_idx
                        .get(idx)
                        .and_then(|x| *x)
                        .map(|t| t == fired_ts)
                        .unwrap_or(false);

                    if !already {
                        last_fired_by_idx[idx] = Some(fired_ts);

                        let alarm_data = serde_json::json!({
                            "type": "custom",
                            "sound": alarm.sound,
                            "customPath": alarm.custom_path,
                            "volume": settings.alarm_volume
                        });

                        let _ = app.emit("alarm:chime", alarm_data);
                    }
                }
            }
        }

        // Wait a little before recalculating next occurrences to avoid tight loop
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
}

static TRAY_MENU_ANCHOR: std::sync::Mutex<Option<(i32, i32)>> = std::sync::Mutex::new(None);
static TRAY_MENU_PENDING_SHOW: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

const TRAY_MENU_WIDTH: f64 = 250.0;
const TRAY_MENU_SHADOW_PAD: f64 = 20.0;
const TRAY_MENU_EST_HEIGHT: f64 = 330.0;

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
        .find(|m| {
            let pos = m.position();
            let size = m.size();
            anchor_x >= pos.x
                && anchor_x < pos.x + size.width as i32
                && anchor_y >= pos.y
                && anchor_y < pos.y + size.height as i32
        })
        .or_else(|| win.primary_monitor().ok().flatten())
        .or_else(|| win.current_monitor().ok().flatten());

    let (min_x, min_y, max_x, max_y) = if let Some(m) = monitor {
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
    let mut x = anchor_x - width_px / 2;
    let mut y = anchor_y - height_px - gap + shadow_pad_px;

    x = x.clamp(min_x + 4, (max_x - width_px - 4).max(min_x + 4));
    if y + height_px - shadow_pad_px < min_y + 4 {
        // Not enough room above — open below the icon
        y = anchor_y + gap - shadow_pad_px;
    }
    y = y.clamp(min_y + 4, (max_y - height_px - 4).max(min_y + 4));

    (
        x,
        y,
        width_px.max(1) as u32,
        height_px.max(1) as u32,
    )
}

pub fn collect_tray_menu_state(app: &AppHandle) -> TrayMenuState {
    let settings = load_settings(app);
    let active_win_name = if settings.window_mode == "full" { "main" } else { "mini" };
    let is_visible = if let Some(win) = app.get_webview_window(active_win_name) {
        win.is_visible().unwrap_or(false) && !win.is_minimized().unwrap_or(false)
    } else {
        false
    };

    TrayMenuState {
        version: app.package_info().version.to_string(),
        is_visible,
        window_mode: settings.window_mode.clone(),
        language: settings.language.clone(),
        update_available: false,
        theme: settings.theme.clone(),
    }
}

#[tauri::command]
fn get_tray_menu_state(app: AppHandle) -> TrayMenuState {
    collect_tray_menu_state(&app)
}

#[tauri::command]
fn hide_tray_menu(app: AppHandle) {
    if let Some(win) = app.get_webview_window("tray_menu") {
        let _ = win.hide();
        let _ = app.emit("tray-menu-hide", ());
    }
}

#[tauri::command]
fn tray_menu_ready(app: AppHandle, width: f64, height: f64) {
    let Some(win) = app.get_webview_window("tray_menu") else {
        return;
    };

    if TRAY_MENU_PENDING_SHOW.swap(false, std::sync::atomic::Ordering::SeqCst) {
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
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn tray_menu_action(app: AppHandle, action: String) {
    hide_tray_menu(app.clone());
    let settings = load_settings(&app);

    match action.as_str() {
        "toggle_visibility" => {
            let active_win = if settings.window_mode == "full" { "main" } else { "mini" };
            if let Some(win) = app.get_webview_window(active_win) {
                let vis = win.is_visible().unwrap_or(false) && !win.is_minimized().unwrap_or(false);
                if vis {
                    let _ = win.hide();
                    broadcast_active_window(&app, "none");
                } else {
                    let _ = win.unminimize();
                    let _ = win.show();
                    let _ = win.set_focus();
                    broadcast_active_window(&app, active_win);
                }
            }
        }
        "show" => {
            let active_win = if settings.window_mode == "full" { "main" } else { "mini" };
            if let Some(win) = app.get_webview_window(active_win) {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
                broadcast_active_window(&app, active_win);
            }
        }
        "hide" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.hide();
            }
            if let Some(mini) = app.get_webview_window("mini") {
                let _ = mini.hide();
            }
            if let Some(menu) = app.get_webview_window("menu") {
                let _ = menu.hide();
            }
            broadcast_active_window(&app, "none");
        }
        "full" => {
            switch_to_full_mode(app);
        }
        "mini" => {
            switch_to_mini_mode(app);
        }
        "timer" | "stopwatch" | "relax" | "settings" | "about" => {
            switch_to_full_mode(app.clone());
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.emit("mini:menu-action", &action);
            }
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
}

fn setup_tray(app: &AppHandle) -> Result<(), tauri::Error> {
    let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip(format!("CyberClock v{}", app.package_info().version))
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
            match event {
                TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                    let app = tray.app_handle();
                    hide_tray_menu(app.clone());
                    let settings = load_settings(app);
                    let active_win = if settings.window_mode == "full" { "main" } else { "mini" };
                    if let Some(win) = app.get_webview_window(active_win) {
                        let visible = win.is_visible().unwrap_or(false);
                        if visible {
                            let _ = win.hide();
                            broadcast_active_window(app, "none");
                        } else {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                            broadcast_active_window(app, active_win);
                        }
                    }
                }
                TrayIconEvent::Click { button: MouseButton::Right, button_state: MouseButtonState::Up, position, rect, .. } => {
                    let app = tray.app_handle().clone();
                    let (x, y) = {
                        use tauri::{Position, Size};
                        match (rect.position, rect.size) {
                            (Position::Physical(p), Size::Physical(s)) => {
                                (p.x + (s.width as i32) / 2, p.y)
                            }
                            _ => (position.x.round() as i32, position.y.round() as i32),
                        }
                    };
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
    let settings = load_settings(app);
    
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
            // Find preferred display or fallback to first
            let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
            if let Ok(monitors) = main.available_monitors() {
                let monitor = monitors.get(display_id).or_else(|| monitors.first()).cloned();
                if let Some(m) = monitor {
                    let work_area = m.work_area();
                    let size = work_area.size;
                    let position = work_area.position;
                    let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(position.x, position.y)));
                    let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, size.height)));
                }
            }
            let _ = main.show();
        }
    } else {
        if let Some(mini) = app.get_webview_window("mini") {
            // Set position if saved and valid
            let mut positioned = false;
            if let Some((x, y)) = settings.mini_position {
                if let Ok(monitors) = mini.available_monitors() {
                    if monitors.iter().any(|m| is_position_in_monitor(x, y, m)) {
                        let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                        positioned = true;
                    }
                }
            }
            if !positioned {
                // Center on preferred display or first
                let display_id = settings.preferred_display_id.unwrap_or(0) as usize;
                if let Ok(monitors) = mini.available_monitors() {
                    let monitor = monitors.get(display_id).or_else(|| monitors.first()).cloned();
                    if let Some(m) = monitor {
                        let pos = m.position();
                        let size = m.size();
                        let x = pos.x + (size.width as i32 / 2) - 130;
                        let y = pos.y + (size.height as i32 / 2) - 24;
                        let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
                    }
                }
            }
            let _ = mini.show();
        }
    }

    broadcast_active_window(app, if is_mini { "mini" } else { "main" });
}

// ─────────────────────────────────────────────────────────────
// Application Entry Point
// ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window when second instance is launched
            let settings = load_settings(app);
            if settings.window_mode == "full" {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.unminimize();
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            } else {
                if let Some(mini) = app.get_webview_window("mini") {
                    let _ = mini.unminimize();
                    let _ = mini.show();
                    let _ = mini.set_focus();
                }
            }
            broadcast_active_window(app, if settings.window_mode == "full" { "main" } else { "mini" });
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AlarmState::default())
        .manage(UpdaterState::default())
        .setup(|app| {
            // Setup tray icon
            setup_tray(app.handle())?;

            // The mini window is non-resizable (tauri.conf.json). However,
            // moving between monitors with different DPI can still cause
            // Webview2 to apply incorrect scaling (progressive ~20% shrink).
            // We force the correct logical size on every resize event to
            // counteract this. The height is read from MINI_TARGET_HEIGHT
            // so that skin changes (which call set_window_size) work correctly.
            if let Some(mini) = app.get_webview_window("mini") {
                let mini_for_resize = mini.clone();
                mini.on_window_event(move |event| {
                    match event {
                        WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
                            let w = MINI_TARGET_WIDTH.load(Ordering::Acquire);
                            let h = MINI_TARGET_HEIGHT.load(Ordering::Acquire);
                            let _ = mini_for_resize.set_size(tauri::Size::Logical(
                                tauri::LogicalSize::new(f64::from(w), f64::from(h)),
                            ));
                        }
                        _ => {}
                    }
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
            init_updater(app.handle(), settings.auto_update);
            show_initial_window(app.handle());

            // Setup alarm check interval (every 30 seconds) for fixed (:30 / :00)
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    check_alarms(&app_handle);
                }
            });

            // Scheduler for custom alarms (roadmap B)
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            close_window,
            minimize_window,
            get_window_position,
            move_window,
            set_window_size,
            toggle_always_on_top,
            open_window,
            hide_window,
            switch_to_full_mode,
            switch_to_mini_mode,
            open_mini_context_menu,
            close_mini_context_menu,
            menu_action,
            get_tray_menu_state,
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
            check_for_updates,
            download_update,
            install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}