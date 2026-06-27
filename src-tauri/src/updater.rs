use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use tokio::time::{sleep, timeout};

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

pub fn set_auto_update(enabled: bool) {
    AUTO_UPDATE_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn init_updater(app: &AppHandle, auto_update: bool) {
    set_auto_update(auto_update);
    if auto_update {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_secs(8)).await;
            let _ = perform_check(&app, false).await;
        });
    }
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_clone = app.clone();
    match timeout(Duration::from_secs(20), perform_check(&app_clone, true)).await {
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
            Ok(serde_json::json!({
                "ok": false,
                "error": "Update check timed out"
            }))
        }
    }
}

#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<serde_json::Value, String> {
    match perform_download(&app).await {
        Ok(()) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Ok(serde_json::json!({ "ok": false, "error": e })),
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<serde_json::Value, String> {
    match perform_install(&app) {
        Ok(()) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Ok(serde_json::json!({ "ok": false, "error": e })),
    }
}

async fn perform_check(app: &AppHandle, _is_manual: bool) -> Result<serde_json::Value, String> {
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
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(msg.clone()),
                },
            );
            return Ok(serde_json::json!({ "ok": false, "error": msg }));
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            {
                let state = app.state::<UpdaterState>();
                *state.pending.lock().unwrap() = Some(PendingUpdate {
                    update,
                    bytes: None,
                });
            }

            emit_status(
                app,
                UpdateStatusPayload {
                    state: "available".into(),
                    version: Some(version.clone()),
                    percent: None,
                    message: None,
                },
            );

            if AUTO_UPDATE_ENABLED.load(Ordering::SeqCst) {
                let _ = perform_download(app).await;
            }

            Ok(serde_json::json!({ "ok": true, "version": version }))
        }
        Ok(None) => {
            let version = app.package_info().version.to_string();
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "not-available".into(),
                    version: Some(version.clone()),
                    percent: None,
                    message: None,
                },
            );
            Ok(serde_json::json!({ "ok": true, "version": version }))
        }
        Err(e) => {
            let msg = e.to_string();
            emit_status(
                app,
                UpdateStatusPayload {
                    state: "error".into(),
                    version: None,
                    percent: None,
                    message: Some(msg.clone()),
                },
            );
            Ok(serde_json::json!({ "ok": false, "error": msg }))
        }
    }
}

async fn perform_download(app: &AppHandle) -> Result<(), String> {
    let pending = {
        let state = app.state::<UpdaterState>();
        let mut guard = state.pending.lock().unwrap();
        guard.take()
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
                let percent = content_length.map(|total| {
                    if total > 0 {
                        ((downloaded * 100) / total) as u32
                    } else {
                        0
                    }
                });
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
            *state.pending.lock().unwrap() = Some(pending);
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
            *state.pending.lock().unwrap() = Some(pending);
            let msg = e.to_string();
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
        let mut guard = state.pending.lock().unwrap();
        guard.take()
    };

    let Some(pending) = pending else {
        return Err("No downloaded update".into());
    };

    let bytes = pending
        .bytes
        .ok_or_else(|| "Update has not been downloaded yet".to_string())?;

    pending
        .update
        .install(&bytes)
        .map_err(|e| e.to_string())?;
    app.request_restart();
    Ok(())
}
