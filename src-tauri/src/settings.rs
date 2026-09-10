use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::{AppHandle, Manager};

use log::{error, info, warn};

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
    // Brand wordmark drawn on the analog clock face (uppercased, max 16).
    pub clock_brand: String,
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
    pub audio_muted: bool,
    pub relax_auto_timer: u32,
    pub last_relax_track: Option<String>,
    pub mini_scanlines: bool,
    pub mini_collapse_date: bool,
    pub mini_solar_real: bool,
    pub mini_zoom: f64,

    // Custom alarm times (HH:MM) with day-of-week repetition.
    pub custom_alarms: Vec<CustomAlarm>,

    pub relax_scheduler: RelaxSchedulerSettings,

    pub language: String,
    pub breathe_pattern: String,
    pub auto_update: bool,

    // Calendar day notes: ISO date key "YYYY-MM-DD" -> note text
    pub calendar_notes: HashMap<String, String>,
}

impl Default for AppSettings {
    fn default() -> AppSettings {
        AppSettings {
            theme: "cyber-blue".to_string(),
            clock_format: "12h".to_string(),
            clock_brand: "CYBERGEMS".to_string(),
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
            audio_muted: false,
            relax_auto_timer: 0,
            last_relax_track: None,
            mini_scanlines: true,
            mini_collapse_date: false,
            mini_solar_real: false,
            mini_zoom: 1.0,
            custom_alarms: vec![
                CustomAlarm::default(),
                CustomAlarm::default(),
                CustomAlarm::default(),
            ],
            relax_scheduler: RelaxSchedulerSettings::default(),
            language: "auto".to_string(),
            breathe_pattern: "box".to_string(),
            auto_update: true,
            calendar_notes: HashMap::new(),
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Settings Store — single source of truth for the whole app.
// All threads (alarm scheduler, monitor watcher, relax scheduler,
// IPC commands) read and write through this shared state, so
// there is exactly one reader/writer path to the JSON file and
// no cross-thread read-modify-write races. Writes are atomic
// (temp file + rename) and keep a `.bak` copy of the last known
// good file so a crash mid-write can never destroy user data.
// ─────────────────────────────────────────────────────────────

pub struct SettingsStore {
    path: PathBuf,
    state: RwLock<AppSettings>,
}

pub fn init_settings_store(app: &AppHandle) -> SettingsStore {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if let Err(e) = fs::create_dir_all(&dir) {
        error!("Settings: cannot create config dir {:?}: {}", dir, e);
    }
    let path = dir.join("cyberclock-settings.json");

    let (settings, origin) = read_settings_file(&path);
    info!("Settings: loaded from {:?} ({})", path, origin);

    SettingsStore {
        path,
        state: RwLock::new(settings),
    }
}

fn read_settings_file(path: &std::path::Path) -> (AppSettings, &'static str) {
    match fs::read_to_string(path) {
        Ok(content) => {
            if let Ok(s) = serde_json::from_str::<AppSettings>(&content) {
                return (s, "ok");
            }
            error!("Settings: file {:?} is corrupt; trying backup", path);
        }
        Err(e) => {
            if e.kind() != std::io::ErrorKind::NotFound {
                error!("Settings: cannot read {:?}: {}", path, e);
            }
        }
    }

    // Primary file unreadable/corrupt — fall back to the backup
    // copy of the last known good settings.
    let bak = backup_path(path);
    if let Ok(content) = fs::read_to_string(&bak) {
        if let Ok(s) = serde_json::from_str::<AppSettings>(&content) {
            warn!("Settings: recovered from backup {:?}", bak);
            return (s, "backup");
        }
    }

    (AppSettings::default(), "defaults")
}

fn backup_path(path: &std::path::Path) -> PathBuf {
    path.with_extension("json.bak")
}

/// Snapshot of the current settings. Never blocks long: the
/// in-memory state is the source of truth, the file only mirrors it.
pub fn get_settings(app: &AppHandle) -> AppSettings {
    let store = app.state::<SettingsStore>();
    store
        .state
        .read()
        .map(|s| s.clone())
        .unwrap_or_else(|_| AppSettings::default())
}

/// Write settings into the shared state and persist atomically:
/// serialize to a temp file, rotate the current good file to
/// `.bak`, then rename the temp file into place.
pub fn persist(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    update(app, |s| {
        *s = settings.clone();
        Ok(())
    })
}

/// Atomically mutate the settings: the mutation runs while holding
/// the exclusive lock, then the result is persisted to disk. This
/// closes the read-modify-write race — concurrent writers queue on
/// the lock instead of clobbering each other's patches.
pub fn update<F: FnOnce(&mut AppSettings) -> Result<(), String>>(
    app: &AppHandle,
    mutate: F,
) -> Result<(), String> {
    let store = app.state::<SettingsStore>();
    let mut guard = store
        .state
        .write()
        .map_err(|e| format!("settings lock poisoned: {}", e))?;

    mutate(&mut guard)?;

    let content = serde_json::to_string_pretty(&*guard).map_err(|e| {
        error!("Settings: cannot serialize: {}", e);
        format!("settings serialize: {}", e)
    })?;

    let dir = store
        .path
        .parent()
        .ok_or_else(|| "settings path has no parent".to_string())?
        .to_path_buf();
    let file_name = store
        .path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("cyberclock-settings.json")
        .to_string();
    let tmp = dir.join(format!("{}.tmp", file_name));
    let bak = backup_path(&store.path);

    // 1. Write the new content to a temp file.
    if let Err(e) = fs::write(&tmp, &content) {
        error!("Settings: cannot write temp file {:?}: {}", tmp, e);
        return Err(format!("settings write: {}", e));
    }

    // 2. Rotate the current good file to .bak. Windows renames
    //    fail on existing destinations, so drop any stale backup
    //    first; if this step fails we still have a fresh temp file.
    if store.path.exists() {
        let _ = fs::remove_file(&bak);
        if let Err(e) = fs::rename(&store.path, &bak) {
            warn!("Settings: could not rotate backup: {}", e);
        }
    }

    // 3. Promote the temp file to be the settings file.
    if let Err(e) = fs::rename(&tmp, &store.path) {
        error!("Settings: cannot promote temp file: {}", e);
        // Restore the backup as the live file so we never leave
        // the app without a settings file on disk.
        if !store.path.exists() && bak.exists() {
            let _ = fs::rename(&bak, &store.path);
        }
        return Err(format!("settings rename: {}", e));
    }

    Ok(())
}

/// Merge a partial settings JSON (camelCase, as sent by the
/// frontend) into the current settings and persist atomically.
/// The server-side merge under the exclusive lock removes the
/// read-modify-write race the old get→merge→save flow had across
/// windows and threads. Returns the merged settings.
pub fn patch_settings(app: &AppHandle, patch: serde_json::Value) -> Result<AppSettings, String> {
    let mut merged_out: Option<AppSettings> = None;
    update(app, |current| {
        let mut target = serde_json::to_value(&*current).map_err(|e| e.to_string())?;
        merge_json(&mut target, patch.clone());
        let merged: AppSettings =
            serde_json::from_value(target).map_err(|e| format!("invalid settings patch: {}", e))?;
        *current = merged.clone();
        merged_out = Some(merged);
        Ok(())
    })?;
    merged_out.ok_or_else(|| "settings patch produced no result".to_string())
}

/// Recursively merge `patch` into `base`: objects merge key by
/// key, every other JSON value replaces wholesale. This mirrors
/// the per-field `Object.assign` semantics the frontend bridge
/// used, so a nested object in a patch only replaces its own
/// subtree — e.g. `{ "alarmHalfHour": { "enabled": true } }`
/// keeps the existing `sound` and `customPath`.
fn merge_json(base: &mut serde_json::Value, patch: serde_json::Value) {
    match (base, patch) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(patch_map)) => {
            for (k, v) in patch_map {
                match base_map.get_mut(&k) {
                    Some(slot) => merge_json(slot, v),
                    None => {
                        base_map.insert(k, v);
                    }
                }
            }
        }
        (base, patch) => *base = patch,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_updates_nested_objects_only_in_their_subtree() {
        let mut base = serde_json::json!({
            "alarmHalfHour": { "enabled": false, "sound": "chime-digital", "customPath": null },
            "theme": "cyber-blue"
        });
        merge_json(
            &mut base,
            serde_json::json!({ "alarmHalfHour": { "enabled": true } }),
        );
        assert_eq!(base["alarmHalfHour"]["enabled"], true);
        assert_eq!(base["alarmHalfHour"]["sound"], "chime-digital");
        assert_eq!(base["theme"], "cyber-blue");
    }

    #[test]
    fn merge_replaces_scalars_and_arrays() {
        let mut base = serde_json::json!({
            "theme": "a",
            "customAlarms": [{ "enabled": false }],
            "showSeconds": true
        });
        merge_json(
            &mut base,
            serde_json::json!({
                "theme": "b",
                "customAlarms": [{ "enabled": true }],
                "showSeconds": false
            }),
        );
        assert_eq!(base["theme"], "b");
        assert_eq!(base["customAlarms"][0]["enabled"], true);
        assert_eq!(base["showSeconds"], false);
    }

    #[test]
    fn merge_inserts_new_keys() {
        let mut base = serde_json::json!({ "a": 1 });
        merge_json(&mut base, serde_json::json!({ "b": 2 }));
        assert_eq!(base["b"], 2);
        assert_eq!(base["a"], 1);
    }
}
