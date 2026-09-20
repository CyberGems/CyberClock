<p align="center">
  <a href="https://cybergems.org/apps/cyberclock/">
    <img src="https://cybergems.org/banners/cyberclock.png" alt="CyberClock — clock, calendar, timer, stopwatch, relaxation and floating time tools for Windows" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/CyberGems/CyberClock/releases/latest"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FCyberGems%2FCyberClock%2Fmaster%2Fpackage.json&query=%24.version&prefix=%20Download%20CyberClock%20v&suffix=%20&style=for-the-badge&label=&labelColor=0891B2&color=0891B2" alt="Download Latest Release" /><img src="https://img.shields.io/badge/Windows_10%2F11_(64--bit)-2563EB?style=for-the-badge" alt="Windows 10/11 (64-bit)" /></a>
  &nbsp;<a href="https://github.com/CyberGems/CyberClock/releases"><img src="https://img.shields.io/badge/All_releases-30363D?style=for-the-badge&logo=github&logoColor=white" alt="All Releases" /><img src="https://img.shields.io/badge/Changelog-475569?style=for-the-badge" alt="Changelog" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL--3.0-1F2428.svg?style=flat-square&color=334155" alt="License" />&nbsp;
  <img src="https://img.shields.io/badge/Platform-Windows_10%2F11-1F2428.svg?style=flat-square&color=334155" alt="Platform" />&nbsp;
  <img src="https://img.shields.io/badge/Tauri-2-1F2428.svg?style=flat-square&logo=tauri&logoColor=white&color=334155" alt="Tauri" />&nbsp;
  <a href="https://github.com/CyberGems/CyberClock/wiki"><img src="https://img.shields.io/badge/Wiki-Documentation-1F2428?style=flat-square&logo=gitbook&logoColor=white&color=334155" alt="Wiki" /></a>
</p>

---

## What is CyberClock?

CyberClock is a feature-rich desktop clock for Windows that brings everyday timekeeping, productivity tools, and moments of relaxation into one polished interface. It combines analog and digital clocks, a full calendar, countdown timer, precision stopwatch, alarms, compact Mini Mode, and independent floating time tools. A wellness module adds procedurally generated ambient soundscapes and guided breathing, while local customization lets the experience adapt to your desktop. Built with **Tauri v2** and **Rust**.

*Free and open source: no ads, no tracking, and no data collection. Just enjoy it.*

---

## 🕐 Why CyberClock?

Most clock apps show you the time and nothing more. CyberClock transforms your desktop into a **productivity and wellness hub**: Sleek timekeeping, precision tools for work and study, and a relaxation module to unwind. All wrapped in a lightweight, native-performance Tauri app.

| Need | Solution |
|---|---|
| Sleek timekeeping | Canvas-rendered analog clock + digital display with 8 selectable dial designs |
| Stay organized | Full calendar with agenda, day notes, statistics, and moon phase |
| Time your work | Countdown timer and precision stopwatch, including independent floating windows |
| Relax and focus | 6 ambient soundscapes with procedural audio synthesis |
| Save screen space | Mini mode — compact always-on-top clock bar with 12 skins |
| Make it yours | 8 accent tints, text size scale, CRT scanlines, transparency controls, multi-monitor |

---

## ✨ Key Features

### 🕐 Clock & Calendar
- **Analog Clock** — Canvas-rendered with smooth animations and neon accents; can be hidden in full mode to give the calendar the whole width
- **Eight Dial Designs**: Classic, Minimal, Segments, HUD, Quantum, Chrono, Hex Matrix, and the multicolor Gem Crown dial
- **Digital Display** — Space Grotesk font with fixed-width digit cells (12H / 24H)
- **Full Calendar** — Month view with agenda, day notes, and statistics
- **Date Intelligence** — Day of year, ISO week, days remaining, moon phase
- **Day Notes** — Attach notes to specific dates with an editor modal

### ⏱️ Timer & Stopwatch
- **Countdown Timer** — Large digital display with milliseconds, preset buttons, visual progress bar, and warning state
- **Stopwatch** — Precision timing with lap tracking, delta vs average, best/worst lap highlighting, and clipboard export
- **Floating Timer and Stopwatch** — Open independent compact windows from the tray or Mini Mode menu; each window keeps its own state and inherits the active skin, tint, language, and zoom
- **Floating Timer Presets** — Add 30s, 1m, 5m, 10m, or 15m to the armed duration without starting the countdown
- **Resting Digits** — Untouched all-zero timer/stopwatch digits rest dimmed until a time is armed or the count starts

### 🧘 Relaxation Module
- **6 Ambient Soundscapes** — Night, Forest, Outer Space, Ocean, Rain, Fireplace
- **Procedural Audio Synthesis** — Web Audio API generated sounds with real audio file fallback
- **True Pause** — Pause freezes the audio, session timer, breathing pacer and tips cycle in place; resume continues exactly where you left off (Space toggles play/pause)
- **Ambient Blending** — Ctrl+Click any track card to layer it over the playing one (Rain + Fireplace, Ocean + Space…); layers fade in and out independently
- **Zen Flow Shuffle** — One-click shuffled playback through all tracks
- **Gentle Auto-Stop** — The auto-stop timer fades audio out smoothly over the final minute
- **Audio Spectrum Visualizer** — Real-time frequency visualization
- **Breathing Patterns** — Box breathing (4-4-4-4) and 4-7-8 technique
- **Session Timer** — With mindfulness tips and auto-stop (15m, 30m, 1h, 2h)
- **Auto Scheduler** — Schedule automatic playback times
- **Mute Awareness** — A quiet banner with a one-click Enable button if global audio is muted

### 📌 Mini Mode
- **12 Unique Skins** — Distinct designs for the compact clock bar, each with its own dimensions and optional zoom (0.5×–4×)
- **Skin-aware Floating Tools** — Floating timer and stopwatch windows reuse the selected Mini Mode design with layouts sized for their controls
- **Transparency Controls** — Background and content opacity sliders
- **Always on Top** — Keep the clock visible over other windows
- **Position Lock** — Prevent accidental dragging
- **Collapse Date** — Show date only on hover
- **CRT Scanlines** — Retro overlay effect
- **Click-Through** — Let mouse events pass through the mini clock (toggled from the tray menu or Settings)
- **Real Sun Cycle** — The Sunset Pulse skin follows the actual sun position

### 🔔 Alarms & Chimes
- **Quarter-Hour Chimes** — :00, :15, :30, :45
- **Half-Hour Chimes** — :00, :30
- **Full-Hour Chimes** — :00
- **6 Built-In Sounds** — Crystal Bell, Soft Chime, Neon Arp, Zen Gong, Aurora, Music Box
- **Custom Sound Support** — Load your own audio file
- **Schedule Window** — Play alarms only during specific hours
- **3 Custom Alarms** — With day-of-week repetition

### 🖥️ Desktop Integration
- **System Tray** — Custom HTML popup menu, anchored flush to the tray icon (with vertical-taskbar support) and carrying a full Help submenu, including a shortcut to the Windows date and time dialog
- **Global Hotkey** — Show/hide the clock from anywhere (Alt+Shift+C by default; record your own combination or disable it in Settings)
- **Automatic Monitor** — Full mode opens on the monitor where the mouse is (CyberLauncher style), or lock it to a preferred display
- **Work-Area Full Mode** — Full mode fills the selected display's work area and stays locked there: taskbars docked on any edge are respected, and dragging or double-click maximize/restore can't break the layout
- **Clock Accuracy Guard** — Periodic NTP drift check shown in Settings, with a Windows notification when the system time is off by more than a minute
- **Multi-Monitor Support** — Choose which display CyberClock appears on; display changes are detected and the window repositions itself
- **Auto-Start with Windows** — Registry-based startup, offered as an option right in the installer and kept in sync with the Settings toggle (the app reconciles the two at every boot)
- **Auto-Updates** — Built-in Tauri updater with GitHub Releases
- **Bilingual UI** — Full English and Spanish interface
- **Accessible About Window** — Suite-standard About with links, donate options and check-for-update
- **Personal Welcome** — Optional display name adds a time-aware greeting beside the CyberClock brand when Full Mode opens

---

## 🛠️ Tech Stack & Architecture

- **Platform:** Windows 10 / 11
- **Framework:** Tauri v2 (Rust backend + HTML/CSS/JS frontend)
- **Audio:** Web Audio API with procedural synthesis
- **Styling:** CSS custom properties for dynamic theming
- **Architecture:** Multi-window (main, mini, menu, tray_menu, about) plus dynamic floating timer/stopwatch windows, with Tauri commands/events

```
CyberClock/
├── src/                    Frontend (HTML/CSS/JS)
│   ├── main/              Main window (clock, calendar, timer, stopwatch, relax)
│   ├── mini/              Mini mode clock bar + its context menu
│   ├── tray/              System tray menu
│   ├── about/             About window
│   ├── shared/
│   │   ├── themes.css     Design tokens (single sober base + derived accent layer)
│   │   ├── tint.js        Accent tint engine (8 presets, normalized seeds)
│   │   ├── base.css       Base styles
│   │   ├── i18n.js        Internationalization
│   │   ├── icons.js       SVG icon system
│   │   ├── audio-engine.js Web Audio synthesis, layering & true pause
│   │   └── tauri-bridge.js Tauri API bridge
│   └── assets/
│       ├── images/        Icons & artwork
│       └── sounds/        Ambient audio files
└── src-tauri/             Rust backend
    ├── src/
    │   ├── main.rs        Entry point
    │   ├── lib.rs         Core logic (windows, tray, startup, scheduler)
    │   ├── settings.rs    Atomic settings store
    │   └── updater.rs     Update system
    ├── bin/               Bundled helper executables
    ├── capabilities/      Tauri permissions
    └── icons/             App icons
```

### Multi-Window Architecture

The app uses **5 fixed Tauri windows**, plus independently spawned floating timer and stopwatch windows:

| Window | Purpose | Size |
|---|---|---|
| `main` | Full application (clock, calendar, timer, stopwatch, relax) | 1024×768 |
| `mini` | Compact clock bar | Skin-specific dimensions |
| `menu` | Context menu for mini mode | 270×560 |
| `tray_menu` | System tray popup | 290×510 |
| `about` | About window | 740×590 |
| `float-*` | Independent timer or stopwatch | Responsive per skin |

Communication between frontend and backend uses Tauri commands (`invoke()`) and events (`emit()`). Settings updates broadcast via `settings:updated` event across all windows.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS)
- [Rust](https://www.rust-lang.org/) 1.77.2+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
npm install
npm run dev
```

### Build for Production

```bash
npm run build
```

The built executable is `CyberClock.exe` and the NSIS installer lands in `src-tauri/target/release/bundle/nsis/`.

Tagged releases also include `CyberClock_<version>_x64-portable.zip`. Extract it
to any folder and run `CyberClock.exe`; the portable build keeps its settings
and imported alarm sounds in a `data/` folder beside the executable. Portable
copies are updated by downloading the next ZIP from the release page.

### 🛡️ Windows SmartScreen

Windows may show a SmartScreen warning the first time you run the CyberClock installer: this is an unsigned hobby app, so Windows hasn't built reputation for the file yet. This is expected; the source is public so you can inspect exactly what it does.

To continue:

<details>
<summary><strong>See how to run the installer (step by step)</strong></summary>

Windows shows this warning for any installer without a paid code-signing certificate; it does not mean the file is unsafe. Do <strong>not</strong> click "Don't run":

1. Run the installer. Windows may show the blue "Windows protected your PC" dialog.

![Windows SmartScreen warning](https://cybergems.org/branding/smartscreen-warning.svg)

2. Click the small **More info** link.

![SmartScreen dialog after More info](https://cybergems.org/branding/smartscreen-runanyway.svg)

3. Click **Run anyway**. The installer starts normally.

You can verify the file independently: compare the SHA with the GitHub release, scan it on VirusTotal, or build from source. More details: [SmartScreen guide on the website](https://cybergems.org/download#smartscreen).

</details>

---

## 🎨 Themes & Customization

### 8 Accent Tints
One sober structural palette — deep navy surfaces, neutral text — with color
entering only through the accent: glows, borders, highlights and a subtle
ambient kiss on the panels. The interface never floods with color.

- **Ice** *(default)* — pale ice over deep navy
- **Cyan** — quiet tropical cyan
- **Azure** — muted cornflower blue
- **Mint** — soft spearmint green
- **Sage** — gentle sage green
- **Amber** — warm sandy amber
- **Rose** — dusty pink
- **Violet** — powdery lavender

Tints are derived from a single seed color (normalized to a shared
luminance/saturation band) by `src/shared/tint.js`, so every preset stays
readable and no accent can wash out the interface. Settings saved with the
old 5-skin themes migrate automatically to their heir tint.

### Display Options
- Time format: 12H / 24H
- Show/hide seconds
- CRT scanlines overlay
- Mini mode: background opacity, content opacity
- Welcome greeting: optional display name shown beside the brand in Full Mode

---

## ❤️ Donate

After countless hours building and refining **CyberClock** for my own use, I recently decided to share it with the world along with my other open-source tools in [CyberGems](https://github.com/CyberGems#-all-apps--repositories).

If you’d like to support future updates, I’d truly appreciate it. Your donation helps keep development going, roll out new features, speed up updates and bug resolution, and enhance documentation quality. You can also show your support by [starring the repo on GitHub](https://github.com/CyberGems/CyberClock). Thank you! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donate-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donate via PayPal" /></a>
</p>

<p align="center">
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Support_me_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support me on Ko-fi" /></a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<div align="center">

<details>
<summary><b>Crypto donations (BTC, ETH, USDT, LTC) — click to view addresses</b></summary>

| Asset | Address | QR |
|---|---|---|
| **BTC** | <pre><code>bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4</code></pre> | <img src="src/assets/donate/qr-btc.png" width="90" height="90" alt="BTC QR" /> |
| **ETH** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="src/assets/donate/qr-eth.png" width="90" height="90" alt="ETH QR" /> |
| **USDT (ERC20 / BEP20)** | <pre><code>0x79b703Ec0f77493679Fcd280aF3b983E20c580B8</code></pre> | <img src="src/assets/donate/qr-eth.png" width="90" height="90" alt="USDT QR" /> |
| **USDT (TRC20)** | <pre><code>TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD</code></pre> | <img src="src/assets/donate/qr-usdt-tron.png" width="90" height="90" alt="USDT TRC20 QR" /> |
| **LTC** | <pre><code>LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X</code></pre> | <img src="src/assets/donate/qr-ltc.png" width="90" height="90" alt="LTC QR" /> |

> ⚠️ Send only the selected asset on the indicated network. Using the wrong network will result in permanent loss of funds.

</details>

</div>

---

## 📄 License

CyberClock is distributed under the terms of the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full license text.

Copyright (C) 2026 CyberGems

---

## ❓ FAQ

For frequently asked questions, troubleshooting guides, and detailed configuration instructions, visit the [FAQ](https://github.com/CyberGems/CyberClock/wiki/FAQ) or the [online documentation](https://cybergems.org/docs/cyberclock/FAQ).

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### Thanks for using CyberClock! 🎉

Made by [**CyberGems**](https://cybergems.org)

</div>
<p align="center">
  <a href="https://www.reddit.com/submit?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F&title=CyberClock%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows"><img src="https://img.shields.io/badge/Share_on_Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Share on Reddit" /></a>
  &nbsp;<a href="https://twitter.com/intent/tweet?text=CyberClock%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows&url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F"><img src="https://img.shields.io/badge/Share_on_X-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="Share on X" /></a>
  &nbsp;<a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F"><img src="https://img.shields.io/badge/Share_on_Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Share on Facebook" /></a>
  &nbsp;<a href="mailto:?subject=CyberClock%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows&body=CyberClock%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows%20https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F"><img src="https://img.shields.io/badge/Share_by_Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Share by Email" /></a>
  &nbsp;<a href="https://t.me/share/url?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F&text=CyberClock%3A%20free%20%26%20open-source%20desktop%20tool%20for%20Windows"><img src="https://img.shields.io/badge/Share_on_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Share on Telegram" /></a>
  &nbsp;<a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcybergems.org%2Fapps%2Fcyberclock%2F"><img src="https://img.shields.io/badge/Share_on_LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="Share on LinkedIn" /></a>
</p>

---

## 🔗 See also

More free, open-source, privacy-first apps from [**CyberGems**](https://github.com/CyberGems):

| App | Description |
|:---:|---|
| 📢&nbsp;[**CyberFeeds**](https://github.com/CyberGems/CyberFeeds#readme) | High-performance, local-first RSS and Atom reader built for speed, privacy and clean reading. |
| 🚀&nbsp;[**CyberLauncher**](https://github.com/CyberGems/CyberLauncher#readme) | Windows application launcher with hot corners, scheduler, system monitor and integrated terminal. |
| 💻&nbsp;[**CyberManager**](https://github.com/CyberGems/CyberManager#readme) | Lightweight, high-performance task manager, virtualized and NT-native, a powerful Task Manager alternative. |
| 📝&nbsp;[**CyberNotes**](https://github.com/CyberGems/CyberNotes#readme) | Privacy-focused note-taking app with rich text, folders, tabs and bcrypt-protected local storage. |
| ⚡&nbsp;[**CyberPaste**](https://github.com/CyberGems/CyberPaste#readme) | Privacy-first clipboard manager for text, code, images, HTML and files. |
| 📸&nbsp;[**CyberSnap**](https://github.com/CyberGems/CyberSnap#readme) | Screen capture and annotation suite with vector tools, high-speed OCR, screen recording and color picker. |
| ⭐&nbsp;[**CyberTray**](https://github.com/CyberGems/CyberTray#readme) | High-performance tray launcher with hotspots, system monitoring, process manager and PIN-protected file vault. |
| 💫&nbsp;[**CyberViewer**](https://github.com/CyberGems/CyberViewer#readme) | Full-featured image viewer and editor engineered for casual and power users. |
| 🛡️&nbsp;[**CyberWall**](https://github.com/CyberGems/CyberWall#readme) | User-friendly Windows firewall with real-time per-app rules powered by the WFP kernel engine. |

➡️ **[Browse all apps at cybergems.org](https://cybergems.org)**
