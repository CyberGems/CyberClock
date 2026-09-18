## 📋 CyberClock {{VERSION}} — Release Notes

Welcome to the official **CyberClock {{VERSION}}** release! CyberClock is a premium cyber-neon clock for Windows — analog canvas, digital display, calendar with day notes, alarms, timer, stopwatch, and a relax module with a desktop mini-bar in 12 unique skins.

---

### ✨ Key Features & Highlights

- 💎 **Gem Crown analog dial**:
  - A new multicolor, faceted dial design with prismatic accents, gemstone hour markers, and an animated sparkle sweep.

- ⏱️ **Floating timer and stopwatch tools**:
  - Open independent windows from the tray or Mini Mode, with local state, skin inheritance, and quick-add timer presets from 30 seconds to 15 minutes.

- 👋 **Personal welcome greeting**:
  - Add an optional name in Settings to receive a time-aware greeting beside the CyberClock brand in Full Mode.

- 🕐 **Windows date and time, one click away**:
  - New entries in the tray menu (Help) and in Settings open the classic Windows "Date and Time" dialog, right where you need them.

- 🎯 **Clock accuracy monitor with wrong-time alerts**:
  - CyberClock now measures its drift against network time servers at startup and every 6 hours, and shows the result under Settings › Windows Integration with a "Check now" button.
  - If the system clock is off by more than a minute (dead CMOS battery, timezone mishap), a Windows notification warns you immediately — before your alarms and chimes fire at the wrong time.
  - Read-only and privilege-free: SNTP first, automatic HTTP fallback on networks that block NTP.

- ⌨️ **Global hotkey to show / hide the clock (optional)**:
  - Alt+Shift+C by default. Click the field in Settings › General and press your own combination; the X button disables it and the restore button brings the default back.
  - Invalid or already-taken combinations are rejected and the previous one stays.

- 🖥️ **Automatic monitor + full mode locked to the work area**:
  - Full mode now opens on the monitor where the mouse is (CyberLauncher style), with a toggle in the Display tab to use a fixed preferred display instead.
  - Full mode fills the selected display's work area and stays locked there: taskbars docked on any edge are respected, dragging and double-click maximize/restore are disabled, and the phantom taskbar button after a Windows boot start is gone.

- 🎨 **Settings polish**:
  - The General tab leads the list, so the language selector comes first.
  - Every control got an accent-tinted icon tile, helper texts are larger and brighter, and toggles now read clearly in the ON state with every accent tint.
  - The Display tab matches the rest of the settings: whole display cards are clickable (no more tiny "Move here" button), and the active monitor is unmistakable.

--- 

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberClock_{{VERSION_NUM}}_x64-setup.exe`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-setup.exe)** | 🚀 **Recommended Installer** (NSIS Setup with Start Menu & Desktop options) | Windows 10 / 11 (x64) |
| **[`CyberClock_{{VERSION_NUM}}_x64-portable.zip`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-portable.zip)** | 💼 **Portable package** (run from any folder, with settings and imported sounds stored beside it) | Windows 10 / 11 (x64) |

---

### 🔐 Checksums

- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe`** — SHA256: `{{INSTALLER_HASH}}`
- **`CyberClock_{{VERSION_NUM}}_x64-portable.zip`** — SHA256: `{{PORTABLE_HASH}}`
- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe.sig`** — Updater signature (minisign)

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
