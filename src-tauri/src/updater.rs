use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use log::{error, info};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::Mutex as AsyncMutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::Update;
#[cfg(not(feature = "msstore"))]
use tauri_plugin_updater::UpdaterExt;
use tokio::task::AbortHandle;
use tokio::time::timeout;

#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<PendingUpdate>>,
    check: AsyncMutex<()>,
}

struct PendingUpdate {
    update: Update,
    status: UpdateStatusPayload,
    abort: Option<AbortHandle>,
    bytes: Option<Vec<u8>>,
}

#[derive(Clone, Copy, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Available,
    Downloading,
    Downloaded,
    Installing,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatusPayload {
    state: Phase,
    version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_notes: Option<String>,
    is_portable: bool,
    transferred: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    total: Option<u64>,
    cancelling: bool,
    failed: bool,
    manual: bool,
    dismissed: bool,
}

static AUTO_UPDATE_ENABLED: AtomicBool = AtomicBool::new(true);

fn lock_or_recover<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn emit_status(app: &AppHandle, status: Option<&UpdateStatusPayload>) {
    let _ = app.emit("update:status", status);
}

#[tauri::command]
pub fn get_update_status(app: AppHandle) -> Option<UpdateStatusPayload> {
    let state = app.state::<UpdaterState>();
    let pending = lock_or_recover(&state.pending);
    pending.as_ref().map(|p| p.status.clone())
}

pub fn pending_update_version(app: &AppHandle) -> Option<String> {
    let state = app.state::<UpdaterState>();
    let pending = lock_or_recover(&state.pending);
    pending.as_ref().map(|p| p.status.version.clone())
}

pub fn reveal_update_notice(app: &AppHandle) -> bool {
    let state = app.state::<UpdaterState>();
    let mut pending = lock_or_recover(&state.pending);
    let Some(pending) = pending.as_mut() else {
        return false;
    };
    pending.status.manual = true;
    pending.status.dismissed = false;
    emit_status(app, Some(&pending.status));
    true
}

#[tauri::command]
pub fn dismiss_update_notice(app: AppHandle, version: String, phase: Phase) {
    let state = app.state::<UpdaterState>();
    let mut pending = lock_or_recover(&state.pending);
    if let Some(pending) = pending.as_mut().filter(|p| {
        p.status.version == version && p.status.state == phase && phase != Phase::Installing
    }) {
        pending.status.dismissed = true;
        emit_status(&app, Some(&pending.status));
    }
}

pub fn set_auto_update(enabled: bool) {
    AUTO_UPDATE_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn init_updater(app: &AppHandle, auto_update: bool) {
    #[cfg(feature = "msstore")]
    {
        let _ = (app, auto_update);
        info!("Updater: disabled (Microsoft Store build)");
    }

    #[cfg(all(not(feature = "msstore"), debug_assertions))]
    {
        let _ = (app, auto_update);
        info!("Updater: background auto-check disabled in debug mode");
    }

    #[cfg(all(not(feature = "msstore"), not(debug_assertions)))]
    {
        set_auto_update(auto_update);
        if auto_update {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(8)).await;
                if AUTO_UPDATE_ENABLED.load(Ordering::SeqCst) {
                    if let Err(error) = timed_check(&app, true).await {
                        info!("Updater: background check skipped/failed: {error}");
                    }
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
    cfg!(feature = "msstore")
}

#[derive(Serialize)]
pub struct CheckResult {
    available: bool,
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<CheckResult, String> {
    timed_check(&app, false).await.inspect_err(|message| {
        error!("Updater: check failed: {message}");
    })
}

async fn timed_check(app: &AppHandle, background: bool) -> Result<CheckResult, String> {
    timeout(Duration::from_secs(20), perform_check(app, background))
        .await
        .map_err(|_| "Update check timed out".to_string())?
}

#[cfg(feature = "msstore")]
async fn perform_check(_app: &AppHandle, _background: bool) -> Result<CheckResult, String> {
    Err("Updates are handled by the Microsoft Store.".into())
}

#[cfg(not(feature = "msstore"))]
async fn perform_check(app: &AppHandle, background: bool) -> Result<CheckResult, String> {
    let state = app.state::<UpdaterState>();
    let _check = state.check.lock().await;
    if lock_or_recover(&state.pending)
        .as_ref()
        .is_some_and(|p| p.status.state != Phase::Available)
    {
        return Ok(CheckResult { available: true });
    }

    let updater = app.updater().map_err(|error| error.to_string())?;
    let release = updater.check().await.map_err(|error| error.to_string())?;
    let mut pending = lock_or_recover(&state.pending);
    if background && !AUTO_UPDATE_ENABLED.load(Ordering::SeqCst) {
        return Ok(CheckResult {
            available: pending.is_some(),
        });
    }

    if let Some(update) = release {
        if pending
            .as_ref()
            .is_some_and(|p| p.status.version == update.version)
        {
            return Ok(CheckResult { available: true });
        }
        let status = UpdateStatusPayload {
            state: Phase::Available,
            version: update.version.clone(),
            release_notes: update.body.clone(),
            is_portable: is_portable(),
            transferred: 0,
            total: None,
            cancelling: false,
            failed: false,
            manual: false,
            dismissed: false,
        };
        emit_status(app, Some(&status));
        *pending = Some(PendingUpdate {
            update,
            status,
            abort: None,
            bytes: None,
        });
    } else if pending.take().is_some() {
        emit_status(app, None);
    }
    Ok(CheckResult {
        available: pending.is_some(),
    })
}

#[tauri::command]
pub async fn download_update(app: AppHandle, version: String) -> Result<(), String> {
    if is_msstore() || is_portable() {
        return Err("In-app downloads are unavailable for this edition.".into());
    }

    let state = app.state::<UpdaterState>();
    let _check = state.check.lock().await;
    let mut pending = lock_or_recover(&state.pending);
    let pending = pending
        .as_mut()
        .filter(|p| p.status.version == version && p.status.state == Phase::Available)
        .ok_or("This update is no longer available to download.")?;

    let update = pending.update.clone();
    let progress_app = app.clone();
    let progress_version = version.clone();
    let download = tauri::async_runtime::spawn(async move {
        let mut transferred = 0_u64;
        let mut last_tick = None::<Instant>;
        update
            .download(
                move |chunk, total| {
                    transferred = transferred.saturating_add(chunk as u64);
                    let now = Instant::now();
                    if last_tick
                        .is_some_and(|tick| now.duration_since(tick) < Duration::from_millis(120))
                        && total != Some(transferred)
                    {
                        return;
                    }
                    last_tick = Some(now);
                    let state = progress_app.state::<UpdaterState>();
                    let mut pending = lock_or_recover(&state.pending);
                    if let Some(p) = pending.as_mut().filter(|p| {
                        p.status.version == progress_version
                            && p.status.state == Phase::Downloading
                            && !p.status.cancelling
                    }) {
                        p.status.transferred = transferred;
                        p.status.total = total;
                        emit_status(&progress_app, Some(&p.status));
                    }
                },
                || {},
            )
            .await
            .map_err(|error| error.to_string())
    });

    pending.status.state = Phase::Downloading;
    pending.status.failed = false;
    pending.status.manual = true;
    pending.status.dismissed = false;
    pending.status.transferred = 0;
    pending.status.total = None;
    pending.abort = Some(download.inner().abort_handle());
    emit_status(&app, Some(&pending.status));

    // Keep the completion task independent of the webview. Full Mode can be
    // unloaded while the download continues in the background.
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = download
            .await
            .map_err(|error| error.to_string())
            .and_then(|result| result);
        finish_download(&app, &version, result);
    });
    Ok(())
}

fn finish_download(app: &AppHandle, version: &str, result: Result<Vec<u8>, String>) {
    let state = app.state::<UpdaterState>();
    let mut pending = lock_or_recover(&state.pending);
    let Some(pending) = pending
        .as_mut()
        .filter(|p| p.status.version == version && p.status.state == Phase::Downloading)
    else {
        return;
    };
    let cancelled = pending.status.cancelling;
    pending.abort = None;
    pending.status.cancelling = false;
    pending.status.state = Phase::Available;
    pending.status.dismissed = false;
    if !cancelled {
        match result {
            Ok(bytes) => {
                pending.bytes = Some(bytes);
                pending.status.state = Phase::Downloaded;
            }
            Err(message) => {
                pending.status.failed = true;
                error!("Updater: download failed: {message}");
            }
        }
    }
    emit_status(app, Some(&pending.status));
}

#[tauri::command]
pub fn cancel_update_download(app: AppHandle, version: String) -> Result<(), String> {
    let state = app.state::<UpdaterState>();
    let mut pending = lock_or_recover(&state.pending);
    let pending = pending
        .as_mut()
        .filter(|p| p.status.version == version)
        .ok_or("This update is no longer downloading.")?;
    let abort = pending
        .abort
        .as_ref()
        .ok_or("This update is no longer downloading.")?;
    pending.status.cancelling = true;
    emit_status(&app, Some(&pending.status));
    abort.abort();
    Ok(())
}

#[tauri::command]
pub async fn install_update(app: AppHandle, version: String) -> Result<(), String> {
    if is_msstore() || is_portable() {
        return Err("In-app installation is unavailable for this edition.".into());
    }

    let (update, bytes) = {
        let state = app.state::<UpdaterState>();
        let mut pending = lock_or_recover(&state.pending);
        let pending = pending
            .as_mut()
            .filter(|p| p.status.version == version && p.status.state == Phase::Downloaded)
            .ok_or("This update is not ready to install.")?;
        let bytes = pending
            .bytes
            .take()
            .ok_or("The verified package is missing.")?;
        pending.status.state = Phase::Installing;
        pending.status.failed = false;
        emit_status(&app, Some(&pending.status));
        (pending.update.clone(), bytes)
    };

    // On Windows the verified installer closes the app and handles relaunch.
    if let Err(error) = update.install(&bytes) {
        let state = app.state::<UpdaterState>();
        let mut pending = lock_or_recover(&state.pending);
        if let Some(pending) = pending.as_mut() {
            pending.bytes = Some(bytes);
            pending.status.state = Phase::Downloaded;
            pending.status.failed = true;
            emit_status(&app, Some(&pending.status));
        }
        let message = error.to_string();
        error!("Updater: installation failed: {message}");
        return Err(message);
    }

    app.request_restart();
    Ok(())
}
