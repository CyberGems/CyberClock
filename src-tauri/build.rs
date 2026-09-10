use std::path::PathBuf;
use std::process::Command;

// Compile the OpenTaskbarSettings.cs helper (adapted from CyberLauncher —
// opens ms-settings:taskbar and, on Win10, navigates to the nested
// "Select which icons appear on the taskbar" page via UI Automation).
// The .exe lands in OUT_DIR only; lib.rs picks it up from there for dev
// runs via the CC_OPEN_TASKBAR_HELPER env.
//
// NOTE: the bundled copy shipped in src-tauri/bin/ is committed to the
// repo and is NOT regenerated here on purpose. csc output is not
// byte-deterministic (MVID/timestamps), so recopying it on every build
// would touch the mtime under tauri dev's file watcher and cause an
// infinite rebuild loop. To refresh the committed helper after editing
// OpenTaskbarSettings.cs, compile it once manually:
//   csc /nologo /target:winexe /out:src-tauri/bin\open-taskbar-settings.exe ^
//      /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationClient.dll" ^
//      /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationTypes.dll" ^
//      src-tauri\OpenTaskbarSettings.cs
fn build_open_taskbar_helper() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let cs_path = manifest_dir.join("OpenTaskbarSettings.cs");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let target_exe = out_dir.join("open-taskbar-settings.exe");

    let csc = PathBuf::from(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe");
    let framework = csc.parent().unwrap().to_path_buf();

    if !csc.exists() {
        // No .NET Framework compiler (e.g. non-Windows CI): build without
        // the helper — the Rust command falls back to ms-settings:taskbar
        // (dev) and uses the committed copy in bin/ when packaged.
        println!("cargo:warning=csc.exe not found; open-taskbar-settings helper will not be built (runtime falls back to ms-settings:taskbar)");
        return;
    }

    let status = Command::new(&csc)
        .arg("/nologo")
        .arg("/target:winexe")
        .arg(format!("/out:{}", target_exe.to_str().unwrap()))
        .arg(format!(
            "/r:{}",
            framework
                .join(r"WPF\UIAutomationClient.dll")
                .to_str()
                .unwrap()
        ))
        .arg(format!(
            "/r:{}",
            framework
                .join(r"WPF\UIAutomationTypes.dll")
                .to_str()
                .unwrap()
        ))
        .arg(cs_path.to_str().unwrap())
        .status()
        .expect("failed to spawn csc.exe");

    if !status.success() {
        panic!("csc.exe failed to compile OpenTaskbarSettings.cs");
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
