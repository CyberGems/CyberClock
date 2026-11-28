use std::sync::atomic::{AtomicBool, Ordering};


static IN_PROGRESS: AtomicBool = AtomicBool::new(false);
struct StarAttempt;
impl Drop for StarAttempt {
    fn drop(&mut self) { IN_PROGRESS.store(false, Ordering::Release); }
}

#[tauri::command]
pub async fn star_repository(app: tauri::AppHandle) -> Result<String, String> {
    if IN_PROGRESS.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
        return Err("GitHub star already in progress".into());
    }
    let attempt = StarAttempt;
    tauri::async_runtime::spawn_blocking(move || {
        let _attempt = attempt;
        if super::github_star_cli::try_star("CyberGems/CyberClock")? {
            return Ok("starred".into());
        }
        if !super::open_external_url("https://github.com/CyberGems/CyberClock".into()) {
            return Err("Could not open GitHub".into());
        }
        let _ = app;
        Ok("opened".into())
    }).await.map_err(|error| error.to_string())?
}
