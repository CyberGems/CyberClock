use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub fn try_star(repository: &str) -> Result<bool, String> {
    let mut command = Command::new("gh");
    command.args(["api", "--hostname", "github.com", "--method", "PUT", &format!("user/starred/{repository}")])
        .env("GH_PROMPT_DISABLED", "1")
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    match command.spawn() {
        Ok(child) => wait_for_cli(child, Duration::from_secs(12)),
        Err(_) => Ok(false),
    }
}

fn wait_for_cli(mut child: Child, timeout: Duration) -> Result<bool, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status.success()),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(25)),
            _ => {
                if let Err(error) = child.kill() {
                    // The child can exit between the last probe and kill.
                    if child.try_wait().map_err(|error| error.to_string())?.is_none() {
                        return Err(error.to_string());
                    }
                }
                child.wait().map_err(|error| error.to_string())?;
                return Ok(false);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_process(args: &[&str]) -> Child {
        let mut command = Command::new(std::env::current_exe().unwrap());
        command.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        command.spawn().unwrap()
    }

    #[test]
    fn successful_cli_is_confirmed() {
        assert!(wait_for_cli(test_process(&["--list"]), Duration::from_secs(5)).unwrap());
    }

    #[test]
    fn failed_cli_uses_fallback() {
        assert!(!wait_for_cli(test_process(&["--invalid-test-argument"]), Duration::from_secs(5)).unwrap());
    }

    #[test]
    fn timed_out_cli_is_terminated_and_reaped() {
        let module = module_path!().split_once("::").unwrap().1;
        let name = format!("{module}::delayed_cli");
        assert!(!wait_for_cli(test_process(&["--ignored", "--exact", &name]), Duration::from_millis(100)).unwrap());
    }

    #[test]
    #[ignore = "child process fixture for timeout test"]
    fn delayed_cli() { std::thread::sleep(Duration::from_secs(30)); }
}
