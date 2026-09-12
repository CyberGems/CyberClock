## 📋 CyberClock {{VERSION}} — Release Notes

Welcome to the official **CyberClock {{VERSION}}** release! CyberClock is a premium cyber-neon clock for Windows — analog canvas, digital display, calendar with day notes, alarms, timer, stopwatch, and a relax module with a desktop mini-bar in 12 unique skins.

---

### ✨ Key Features & Highlights

- 🪟 **Start with Windows — in the installer**:
  - The setup wizard now asks whether CyberClock should launch automatically at Windows startup, with the option pre-checked — no need to dig into Settings after installing.
  - Silent and passive installs register the startup entry automatically (the app default), and the uninstaller always removes it, leaving nothing behind.

- ⚙️ **Startup setting that reflects reality**:
  - The Start-with-Windows toggle in Settings now reconciles with the real registry entry at every boot: if the installer, msconfig or any system tool changed the actual startup state, the toggle updates to match it — what you see is what runs.
  - Installer and app manage the **same** single HKCU Run entry, so no duplicate startup commands ever pile up.

- 📦 **CyberClock.exe**:
  - The built executable is now named `CyberClock.exe` instead of `app.exe` — process lists, shortcuts and startup entries now read clean and identifiable.

- 🔧 **Suite & Maintenance**:
  - Release workflow hardened: releases always land as drafts, never auto-published by any action in the chain.
  - Missing "Status" translation label for the Relax scheduler added in both English and Spanish.
  - README wording polish.

---

### 📦 Downloads & Packages

| File | Description | Platform |
| :--- | :--- | :--- |
| **`CyberClock_{{VERSION_NUM}}_x64-setup.exe`** | 🚀 **Recommended Installer** (NSIS Setup with Start Menu & Desktop options) | Windows 10 / 11 (x64) |

---

### 🔐 Checksums

- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe`** — SHA256: `{{INSTALLER_HASH}}`
- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe.sig`** — Updater signature (minisign)

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
