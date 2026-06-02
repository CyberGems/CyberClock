use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Manager, WebviewWindow, Emitter, WindowEvent};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri_plugin_dialog::DialogExt;
use chrono::{Local, Timelike};

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
pub struct AppSettings {
    pub theme: String,
    pub clock_format: String,
    pub show_seconds: bool,
    pub always_on_top: bool,
    pub start_with_windows: bool,
    pub window_mode: String,
    pub mini_position: Option<(i32, i32)>,
    pub mini_opacity: f64,
    pub mini_design: u32,
    pub mini_position_locked: bool,
    pub preferred_display_id: Option<u32>,
    pub alarm_half_hour: AlarmSettings,
    pub alarm_full_hour: AlarmSettings,
    pub alarm_volume: f64,
    pub relax_volume: f64,
    pub relax_auto_timer: u32,
    pub last_relax_track: Option<String>,
    pub scanlines: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "cyber-blue".to_string(),
            clock_format: "12h".to_string(),
            show_seconds: true,
            always_on_top: false,
            start_with_windows: false,
            window_mode: "mini".to_string(),
            mini_position: None,
            mini_opacity: 1.0,
            mini_design: 1,
            mini_position_locked: false,
            preferred_display_id: None,
            alarm_half_hour: AlarmSettings::default(),
            alarm_full_hour: AlarmSettings {
                enabled: true,
                sound: "chime-digital".to_string(),
                custom_path: None,
            },
            alarm_volume: 0.75,
            relax_volume: 0.8,
            relax_auto_timer: 0,
            last_relax_track: None,
            scanlines: true,
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
// Alarm State
// ─────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AlarmState {
    pub last_half_hour: Mutex<Option<(u32, u32)>>, // (hour, minute)
    pub last_full_hour: Mutex<Option<u32>>,         // hour
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
    
    // Update always on top for all windows
    let aot = settings.always_on_top;
    for window in app.webview_windows().values() {
        let _ = window.set_always_on_top(aot);
    }
    
    settings
}

#[tauri::command]
fn close_window(window: WebviewWindow) {
    let _ = window.close();
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
        return true;
    }
    false
}

#[tauri::command]
fn switch_to_full_mode(app: AppHandle) {
    // Save mode
    let mut settings = load_settings(&app);
    settings.window_mode = "full".to_string();
    save_settings_to_file(&app, &settings);
    
    // Hide mini, show main
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

#[tauri::command]
fn switch_to_mini_mode(app: AppHandle) {
    // Save mode
    let mut settings = load_settings(&app);
    settings.window_mode = "mini".to_string();
    save_settings_to_file(&app, &settings);
    
    // Hide main, show mini
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.show();
        let _ = mini.set_focus();
    }
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
                
                // Menu dimensions (from tauri.conf.json) - these are logical pixels
                // Tauri will handle the DPI scaling automatically when we use PhysicalPosition
                let menu_width = 270;
                let menu_height = 420;
                
                // Calculate position, adjusting if menu would go off-screen
                let mut pos_x = screen_x;
                let mut pos_y = screen_y;
                
                // If menu would go off right edge, position from left of click point
                if screen_x + menu_width > monitor_pos.x + monitor_size.width as i32 {
                    pos_x = screen_x - menu_width;
                }
                
                // If menu would go off bottom edge, position above click point
                if screen_y + menu_height > monitor_pos.y + monitor_size.height as i32 {
                    pos_y = screen_y - menu_height;
                }
                
                // Ensure we don't go off left or top edge
                if pos_x < monitor_pos.x {
                    pos_x = monitor_pos.x;
                }
                if pos_y < monitor_pos.y {
                    pos_y = monitor_pos.y;
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
    // Hide menu first
    if let Some(menu) = app.get_webview_window("menu") {
        let _ = menu.hide();
    }
    
    match action.as_str() {
        "full" => {
            switch_to_full_mode(app);
            true
        }
        "close" => {
            app.exit(0);
            true
        }
        "aot" => {
            let mut settings = load_settings(&app);
            settings.always_on_top = !settings.always_on_top;
            save_settings_to_file(&app, &settings);
            
            // Apply to all windows
            let aot = settings.always_on_top;
            for window in app.webview_windows().values() {
                let _ = window.set_always_on_top(aot);
            }
            
            // Broadcast update
            let _ = app.emit("settings:updated", &settings);
            true
        }
        "timer" | "stopwatch" | "relax" | "settings" => {
            if let Some(window) = app.get_webview_window(&action) {
                let _ = window.show();
                let _ = window.set_focus();
                // Send settings to the window
                let settings = load_settings(&app);
                let _ = window.emit("settings:init", &settings);
            }
            true
        }
        _ => false
    }
}

#[derive(Serialize, Deserialize)]
pub struct MonitorInfo {
    id: u32,
    label: String,
    primary: bool,
    current: bool,
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
            screens.push(MonitorInfo {
                id,
                label: m.name().unwrap_or(&format!("Display {}", i)).to_string(),
                primary: is_primary,
                current: settings.preferred_display_id.map_or(false, |pid| pid == id),
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
                let size = monitor.size();
                let position = monitor.position();
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
            // Add to startup via registry
            let exe_path = std::env::current_exe().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let _ = Command::new("reg")
                .args(["add", "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", 
                       "/v", "CyberClock", "/d", &exe_path, "/f"])
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

fn check_alarms(app: &AppHandle) {
    let settings = load_settings(app);
    let now = Local::now();
    let minute = now.minute();
    let hour = now.hour();
    
    let alarm_state = app.state::<AlarmState>();
    
    // Check half-hour alarm
    if settings.alarm_half_hour.enabled && minute == 30 {
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

// ─────────────────────────────────────────────────────────────
// Tray Icon Setup
// ─────────────────────────────────────────────────────────────

fn setup_tray(app: &AppHandle) -> Result<(), tauri::Error> {
    // Build tray context menu
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", "Show", true, None::<&str>)?,
            &MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "full", "Switch to Full Mode", true, None::<&str>)?,
            &MenuItem::with_id(app, "mini", "Switch to Mini Mode", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?,
            &MenuItem::with_id(app, "timer", "Timer", true, None::<&str>)?,
            &MenuItem::with_id(app, "stopwatch", "Stopwatch", true, None::<&str>)?,
            &MenuItem::with_id(app, "relax", "Relax", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("CyberClock")
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    let settings = load_settings(app);
                    if settings.window_mode == "full" {
                        if let Some(main) = app.get_webview_window("main") {
                            let _ = main.show();
                            let _ = main.set_focus();
                        }
                    } else {
                        if let Some(mini) = app.get_webview_window("mini") {
                            let _ = mini.show();
                            let _ = mini.set_focus();
                        }
                    }
                }
                "hide" => {
                    let settings = load_settings(app);
                    if settings.window_mode == "full" {
                        if let Some(main) = app.get_webview_window("main") {
                            let _ = main.hide();
                        }
                    } else {
                        if let Some(mini) = app.get_webview_window("mini") {
                            let _ = mini.hide();
                        }
                    }
                    // Also hide all child windows
                    for w in ["settings", "timer", "stopwatch", "relax", "menu"] {
                        if let Some(win) = app.get_webview_window(w) {
                            let _ = win.hide();
                        }
                    }
                }
                "full" => switch_to_full_mode(app.clone()),
                "mini" => switch_to_mini_mode(app.clone()),
                "settings" => {
                    if let Some(w) = app.get_webview_window("settings") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "timer" => {
                    if let Some(w) = app.get_webview_window("timer") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "stopwatch" => {
                    if let Some(w) = app.get_webview_window("stopwatch") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "relax" => {
                    if let Some(w) = app.get_webview_window("relax") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left click toggles visibility of the main / mini window
            if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                let settings = load_settings(app);
                if settings.window_mode == "full" {
                    if let Some(main) = app.get_webview_window("main") {
                        let visible = main.is_visible().unwrap_or(false);
                        if visible { let _ = main.hide(); } else { let _ = main.show(); let _ = main.set_focus(); }
                    }
                } else {
                    if let Some(mini) = app.get_webview_window("mini") {
                        let visible = mini.is_visible().unwrap_or(false);
                        if visible { let _ = mini.hide(); } else { let _ = mini.show(); let _ = mini.set_focus(); }
                    }
                }
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
    
    // Show appropriate window based on mode
    if settings.window_mode == "full" {
        if let Some(main) = app.get_webview_window("main") {
            // Set size to work area
            if let Some(monitor) = main.available_monitors().ok().and_then(|monitors| monitors.first().cloned()) {
                let size = monitor.size();
                let _ = main.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(size.width, size.height)));
            }
            let _ = main.show();
        }
    } else {
        if let Some(mini) = app.get_webview_window("mini") {
            // Set position if saved
            if let Some((x, y)) = settings.mini_position {
                let _ = mini.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
            }
            let _ = mini.show();
        }
    }
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
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AlarmState::default())
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
                    if let WindowEvent::Resized(_size) = event {
                        let w = MINI_TARGET_WIDTH.load(Ordering::Acquire);
                        let h = MINI_TARGET_HEIGHT.load(Ordering::Acquire);
                        let _ = mini_for_resize
                            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(f64::from(w), f64::from(h))));
                    }
                });
            }
            
            // Load settings and show initial window
            show_initial_window(app.handle());
            
            // Setup alarm check interval (every 30 seconds)
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    check_alarms(&app_handle);
                }
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
            get_screens,
            select_display,
            open_file_dialog,
            set_startup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}