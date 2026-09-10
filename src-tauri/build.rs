use std::path::PathBuf;
use std::process::Command;

// Compile the OpenTaskbarSettings.cs helper (adapted from CyberLauncher —
// opens ms-settings:taskbar and, on Win10, navigates to the nested
// "Select which icons appear on the taskbar" page via UI Automation).
// The .exe lands in OUT_DIR; a `cargo:rustc-env` points lib.rs at it so
// the command can copy it next to the app binary at runtime.
fn build_open_taskbar_helper() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let cs_path = manifest_dir.join("OpenTaskbarSettings.cs");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let target_exe = out_dir.join("open-taskbar-settings.exe");

    let csc = PathBuf::from(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe");
    let framework = csc.parent().unwrap().to_path_buf();

    if !csc.exists() {
        // No .NET Framework compiler (e.g. non-Windows CI): build without
        // the helper — the Rust command falls back to ms-settings:taskbar.
        println!("cargo:warning=csc.exe not found; open-taskbar-settings helper will not be built (runtime falls back to ms-settings:taskbar)");
        return;
    }

    let status = Command::new(&csc)
        .arg("/nologo")
        .arg("/target:winexe")
        .arg(format!("/out:{}", target_exe.to_str().unwrap()))
        .arg(format!(
            "/r:{}",
            framework.join(r"WPF\UIAutomationClient.dll").to_str().unwrap()
        ))
        .arg(format!(
            "/r:{}",
            framework.join(r"WPF\UIAutomationTypes.dll").to_str().unwrap()
        ))
        .arg(cs_path.to_str().unwrap())
        .status()
        .expect("failed to spawn csc.exe");

    if !status.success() {
        panic!("csc.exe failed to compile OpenTaskbarSettings.cs");
    }

    // Also copy to a stable location so tauri.conf.json's `resources` can
    // bundle it next to the installed exe for the NSIS installer.
    let bin_dir = manifest_dir.join("bin");
    let _ = std::fs::create_dir_all(&bin_dir);
    let bundle_copy = bin_dir.join("open-taskbar-settings.exe");
    if std::fs::copy(&target_exe, &bundle_copy).is_err() {
        println!("cargo:warning=failed to copy open-taskbar-settings.exe to bin/");
    }

    println!(
        "cargo:rustc-env=CC_OPEN_TASKBAR_HELPER={}",
        target_exe.to_str().unwrap()
    );
    // Rebuild when the source changes.
    println!("cargo:rerun-if-changed=OpenTaskbarSettings.cs");
}

fn main() {
    build_open_taskbar_helper();
    tauri_build::build()
}
