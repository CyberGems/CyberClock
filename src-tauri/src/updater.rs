use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
#[cfg(not(feature = "msstore"))]
use tauri_plugin_updater::UpdaterExt;
#[cfg(all(not(feature = "msstore"), not(debug_assertions)))]
use tokio::time::sleep;
use tokio::time::timeout;

use log::{error, info};

pub struct UpdaterState {
    pending: Mutex<Option<PendingUpdate>>,
}

struct PendingUpdate {
    update: tauri_plugin_updater::Update,
    bytes: Option<Vec<u8>>,
}

impl Default for UpdaterState {
    fn default() -> Self {
        Self {
            pending: Mutex::new(None),
        }
    }
}

static AUTO_UPDATE_ENABLED: AtomicBool = AtomicBool::new(true);

/// Version of the pending update, if any has been found. Read by
/// the tray menu state so it can show the real "update available"
/// badge instead of a hardcoded value.
static PENDING_VERSION: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateStatusPayload {
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

fn emit_status(app: &AppHandle, payload: UpdateStatusPayload) {
    let _ = app.emit("update:status", payload);
}

/// Lock a mutex without panicking on poison: if another thread
/// panicked while holding it, we recover the inner value and keep
/// working instead of killing this thread too.
fn lock_or_recover<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn set_auto_update(enabled: bool) {
    AUTO_UPDATE_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn pending_update_version() -> Option<String> {
    lock_or_recover(&PENDING_VERSION).clone()
}

pub fn init_updater(app: &AppHandle, auto_update: bool) {
    #[cfg(feature = "msstore")]
    {
        // Microsoft Store build: updates are distributed by the Store,
        // so no self-update checks are ever scheduled (Store policy).
        let _ = (app, auto_update);
        info!("Updater: disabled (Microsoft Store build)");
        return;
    }

    #[cfg(not(feature = "msstore"))]
    {
        set_auto_update(auto_update);

        #[cfg(debug_assertions)]
        {
            let _ = (app, auto_update);
            info!("Updater: background auto-check disabled in debug mode");
        }

        #[cfg(not(debug_assertions))]
        if auto_update {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                sleep(Duration::from_secs(8)).await;
                if AUTO_UPDATE_ENABLED.load(Ordering::SeqCst) {
                    perform_background_check(&app).await;
                }
            });
        }
    }
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn is_portable() -> bool {
    crate::settings::is_portable()
}

#[tauri::command]
pub fn is_msstore() -> bool {
    // Compile-time flag: true only in Microsoft Store builds. The About
    // window uses it to hide the self-update UI (the Store distributes
    // updates in that channel).
    cfg!(feature = "msstore")
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_clone = app.clone();
    match timeout(Duration::from_secs(20), perform_check(&app_clone)).await {
        Ok(result) => result,
        Err(_) => {
            emit_status(
                &app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some("Update check timed out".into()),
                },
            );
            Err("Update check timed out".into())
        }
    }
}

#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<serde_json::Value, String> {
    if cfg!(feature = "msstore") {
        // Store build: updates come from the Store, never from GitHub.
        return Err("Updates are handled by the Microsoft Store.".into());
    }
    if crate::settings::is_portable() {
        // A portable executable cannot be replaced safely while it is
        // running. The UI sends the user to the release page instead.
        return Ok(serde_json::json!({ "ok": true, "isPortable": true }));
    }
    perform_download(&app)
        .await
        .map(|_| serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<serde_json::Value, String> {
    if cfg!(feature = "msstore") {
        return Err("Updates are handled by the Microsoft Store.".into());
    }
    if crate::settings::is_portable() {
        return Ok(serde_json::json!({ "ok": true, "isPortable": true }));
    }
    perform_install(&app).map(|_| serde_json::json!({ "ok": true }))
}

#[cfg(feature = "msstore")]
async fn perform_check(_app: &AppHandle) -> Result<serde_json::Value, String> {
    // Microsoft Store build: never contact the GitHub endpoint; updates
    // are distributed through the Store itself (Store policy).
    Err("Updates are handled by the Microsoft Store.".into())
}

#[cfg(not(feature = "msstore"))]
async fn perform_check(app: &AppHandle) -> Result<serde_json::Value, String> {
    emit_status(
        app,
        UpdateStatusPayload {
            state: "checking".into(),
            version: None,
            percent: None,
            message: None,
        },
    );

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            let msg = e.to_string();
            error!("Updater: {}", msg);
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(msg.clone()),
                },
            );
            return Err(msg);
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            {
                let state = app.state::<UpdaterState>();
                *lock_or_recover(&state.pending) = Some(PendingUpdate {
                    update,
                    bytes: None,
                });
            }
            *lock_or_recover(&PENDING_VERSION) = Some(version.clone());

            emit_status(
                app,
                UpdateStatusPayload {
                    state: "available".into(),
                    version: Some(version.clone()),
                    percent: None,
                    message: None,
                },
            );

            info!("Updater: update available -> v{}", version);
            Ok(serde_json::json!({
                "ok": true,
                "version": version,
                "isPortable": crate::settings::is_portable()
            }))
        }
        Ok(None) => {
            let version = app.package_info().version.to_string();
            *lock_or_recover(&PENDING_VERSION) = None;
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "not-available".into(),
                    version: Some(version.clone()),
                    percent: None,
                    message: None,
                },
            );
            Ok(serde_json::json!({
                "ok": true,
                "version": version,
                "isPortable": crate::settings::is_portable()
            }))
        }
        Err(e) => {
            let msg = e.to_string();
            error!("Updater: check failed: {}", msg);
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(msg.clone()),
                },
            );
            Err(msg)
        }
    }
}

#[cfg(all(not(feature = "msstore"), not(debug_assertions)))]
async fn perform_background_check(app: &AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            info!("Updater: background check unavailable: {}", e);
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            {
                let state = app.state::<UpdaterState>();
                *lock_or_recover(&state.pending) = Some(PendingUpdate {
                    update,
                    bytes: None,
                });
            }
            *lock_or_recover(&PENDING_VERSION) = Some(version.clone());

            emit_status(
                app,
                UpdateStatusPayload {
                    state: "available".into(),
                    version: Some(version.clone()),
                    percent: None,
                    message: None,
                },
            );

            info!("Updater: background update available -> v{}", version);
        }
        Ok(None) => {
            *lock_or_recover(&PENDING_VERSION) = None;
            info!("Updater: background check finished (up to date)");
        }
        Err(e) => {
            // Background check failures (offline, rate limit, timeout, etc.)
            // must NOT emit error status or display error popups to the user.
            info!("Updater: background check skipped/failed: {}", e);
        }
    }
}

async fn perform_download(app: &AppHandle) -> Result<(), String> {
    let pending = {
        let state = app.state::<UpdaterState>();
        let taken = lock_or_recover(&state.pending).take();
        taken
    };

    let Some(mut pending) = pending else {
        return Err("No update pending".into());
    };

    let version = pending.update.version.clone();
    let version_for_progress = version.clone();
    let app_progress = app.clone();
    let mut downloaded: u64 = 0;

    let download_result = pending
        .update
        .download(
            move |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                let percent = content_length
                    .and_then(|total| (downloaded * 100).checked_div(total).map(|p| p as u32));
                emit_status(
                    &app_progress,
                    UpdateStatusPayload {
                        state: "downloading".into(),
                        version: Some(version_for_progress.clone()),
                        percent,
                        message: None,
                    },
                );
            },
            || {},
        )
        .await;

    match download_result {
        Ok(bytes) => {
            pending.bytes = Some(bytes);
            let state = app.state::<UpdaterState>();
            *lock_or_recover(&state.pending) = Some(pending);
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "downloaded".into(),
                    version: Some(version),
                    percent: None,
                    message: None,
                },
            );
            Ok(())
        }
        Err(e) => {
            pending.bytes = None;
            let state = app.state::<UpdaterState>();
            *lock_or_recover(&state.pending) = Some(pending);
            let msg = e.to_string();
            error!("Updater: download failed: {}", msg);
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(msg.clone()),
                },
            );
            Err(msg)
        }
    }
}

fn perform_install(app: &AppHandle) -> Result<(), String> {
    let pending = {
        let state = app.state::<UpdaterState>();
        let taken = lock_or_recover(&state.pending).take();
        taken
    };

    let Some(pending) = pending else {
        return Err("No downloaded update".into());
    };

    let bytes = pending
        .bytes
        .ok_or_else(|| "Update has not been downloaded yet".to_string())?;

    pending.update.install(&bytes).map_err(|e| e.to_string())?;
    app.request_restart();
    Ok(())
}
