<h1 align="center">CyberClock — Desktop Clock</h1>

<p align="center">
  <strong>A premium cyber-neon styled clock for Windows</strong> — analog & digital display, calendar, timer, stopwatch, and a relaxation module with ambient sound synthesis.
</p>

<p align="center">
  <a href="https://github.com/CyberGems/CyberClock/releases/latest">
    <img src="https://img.shields.io/badge/⚡_Download_Latest_Release-(Windows_64--bit)-0047B3?style=for-the-badge&logo=windows&logoColor=white" alt="Download Latest Release" />
  </a>
  <a href="https://github.com/CyberGems/CyberClock/releases">
    <img src="https://img.shields.io/badge/All_Releases-Changelog-18181B?style=for-the-badge&logo=github&logoColor=white" alt="All Releases" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-0078D4.svg?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/version-1.0.3-00F0FF.svg" alt="Version" />
  <img src="https://img.shields.io/badge/Tauri-2-512BD4.svg?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Rust-1.77+-512BD4.svg?logo=rust&logoColor=white" alt="Rust" />
  <a href="https://github.com/CyberGems/CyberClock/wiki"><img src="https://img.shields.io/badge/%F0%9F%93%96_Wiki-Documentation-222222?style=flat-square&logo=github&logoColor=white" alt="Wiki" /></a>
</p>

A feature-rich desktop clock application with a futuristic cyberpunk/neon aesthetic. Built with **Tauri v2** and **Rust**, CyberClock combines practical utilities — clock, calendar, timer, stopwatch — with a wellness module featuring procedural ambient sound synthesis for relaxation and mindfulness.

*Free and open source — no ads, no tracking, and no data collection. Just enjoy it.*

---

## 🕐 Why CyberClock?

Most clock apps show you the time and nothing more. CyberClock transforms your desktop into a **productivity and wellness hub** — beautiful timekeeping, precision tools for work and study, and a relaxation module to unwind. All wrapped in a lightweight, native-performance Tauri app.

| Need | Solution |
|---|---|
| Beautiful timekeeping | Canvas-rendered analog clock + digital display with Orbitron font |
| Stay organized | Full calendar with agenda, day notes, statistics, and moon phase |
| Time your work | Countdown timer with presets + precision stopwatch with lap tracking |
| Relax and focus | 6 ambient soundscapes with procedural audio synthesis |
| Save screen space | Mini mode — compact always-on-top clock bar with 12 skins |
| Make it yours | 5 theme skins, CRT scanlines, transparency controls, multi-monitor |

---

## ✨ Key Features

### 🕐 Clock & Calendar
- **Analog Clock** — Canvas-rendered with smooth animations and neon accents
- **Digital Display** — Orbitron font with fixed-width digit cells (12H / 24H)
- **Full Calendar** — Month view with agenda, day notes, and statistics
- **Date Intelligence** — Day of year, ISO week, days remaining, moon phase
- **Day Notes** — Attach notes to specific dates with an editor modal

### ⏱️ Timer & Stopwatch
- **Countdown Timer** — Large digital display with milliseconds, preset buttons, visual progress bar, and warning state
- **Stopwatch** — Precision timing with lap tracking, delta vs average, best/worst lap highlighting, and clipboard export

### 🧘 Relaxation Module
- **6 Ambient Soundscapes** — Night, Forest, Outer Space, Ocean, Rain, Fireplace
- **Procedural Audio Synthesis** — Web Audio API generated sounds with real audio file fallback
- **Equal-Power Crossfade** — Smooth transitions between tracks
- **Audio Spectrum Visualizer** — Real-time frequency visualization
- **Breathing Patterns** — Box breathing (4-4-4-4) and 4-7-8 technique
- **Session Timer** — With mindfulness tips and auto-stop (15m, 30m, 1h, 2h)
- **Auto Scheduler** — Schedule automatic playback times

### 📌 Mini Mode
- **12 Unique Skins** — Distinct designs for the compact clock bar
- **Transparency Controls** — Background and content opacity sliders
- **Always on Top** — Keep the clock visible over other windows
- **Position Lock** — Prevent accidental dragging
- **Collapse Date** — Show date only on hover
- **CRT Scanlines** — Retro overlay effect

### 🔔 Alarms & Chimes
- **Quarter-Hour Chimes** — :00, :15, :30, :45
- **Half-Hour Chimes** — :00, :30
- **Full-Hour Chimes** — :00
- **6 Built-In Sounds** — Crystal Bell, Soft Chime, Neon Arp, Zen Gong, Aurora, Music Box
- **Custom Sound Support** — Load your own audio file
- **Schedule Window** — Play alarms only during specific hours
- **3 Custom Alarms** — With day-of-week repetition

### 🖥️ Desktop Integration
- **System Tray** — Custom HTML popup menu with quick access to all features
- **Multi-Monitor Support** — Choose which display CyberClock appears on
- **Auto-Start with Windows** — Registry-based startup
- **Auto-Updates** — Built-in Tauri updater with GitHub Releases
- **Bilingual UI** — Full English and Spanish interface

---

## 🛠️ Tech Stack & Architecture

- **Platform:** Windows 10 / 11
- **Framework:** Tauri v2 (Rust backend + HTML/CSS/JS frontend)
- **Audio:** Web Audio API with procedural synthesis
- **Styling:** CSS custom properties for dynamic theming
- **Architecture:** Multi-window (main, mini, menu, tray_menu) with Tauri commands/events

```
CyberClock/
├── src/                    Frontend (HTML/CSS/JS)
│   ├── main/              Main window (clock, calendar, timer, stopwatch)
│   ├── mini/              Mini mode clock bar
│   ├── tray/              System tray menu
│   ├── relax/             Relaxation module
│   ├── stopwatch/         Stopwatch
│   └── shared/
│       ├── themes.css     Theme system (5 skins)
│       ├── base.css       Base styles
│       ├── i18n.js        Internationalization
│       ├── icons.js       SVG icon system
│       ├── audio-engine.js Web Audio synthesis
│       └── tauri-bridge.js Tauri API bridge
├── src-tauri/             Rust backend
│   ├── src/
│   │   ├── main.rs        Entry point
│   │   ├── lib.rs         Core logic
│   │   └── updater.rs     Update system
│   ├── capabilities/      Tauri permissions
│   └── icons/             App icons
└── assets/sounds/         Ambient audio files
```

### Multi-Window Architecture

The app uses **4 independent Tauri windows**:

| Window | Purpose | Size |
|---|---|---|
| `main` | Full application (clock, calendar, timer, stopwatch) | 1024×768 |
| `mini` | Compact clock bar | 260×48 |
| `menu` | Context menu for mini mode | 270×500 |
| `tray_menu` | System tray popup | 290×380 |

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

The installer will be in `src-tauri/target/release/`.

---

## 🎨 Themes & Customization

### 5 Theme Skins
- **Arctic Ice** — Cool cyan and white
- **Cyber Blue** — Deep blue with electric accents
- **Neon Green** — Vibrant emerald glow
- **Plasma Purple** — Rich violet and magenta
- **Solar Orange** — Warm amber and gold

### Display Options
- Time format: 12H / 24H
- Show/hide seconds
- CRT scanlines overlay
- Mini mode: background opacity, content opacity

---

## ❓ Frequently Asked Questions

### What is CyberClock?

CyberClock is a desktop clock application for Windows that goes beyond simple timekeeping. It includes a calendar, timer, stopwatch, and a relaxation module with ambient sound synthesis — all in a lightweight Tauri app with a cyberpunk aesthetic.

### How does the relaxation module work?

The relaxation module uses **Web Audio API** to procedurally synthesize 6 ambient soundscapes (Night, Forest, Outer Space, Ocean, Rain, Fireplace). It includes a breathing guide with Box and 4-7-8 patterns, session timer with mindfulness tips, and auto-stop functionality.

### What is Mini Mode?

Mini Mode transforms CyberClock into a compact, always-on-top clock bar (260×48) that sits on your desktop. It features 12 unique design skins, transparency controls, and can show date on hover. Perfect for saving screen space while keeping the time visible.

### How do alarms work?

CyberClock supports quarter-hour, half-hour, and full-hour chimes with 6 built-in sounds plus custom audio. You can also set 3 custom alarms with day-of-week repetition and configure a schedule window to only play alarms during specific hours.

### Does CyberClock support multiple monitors?

Yes. You can choose which display CyberClock appears on. The mini mode position can be reset and locked to prevent accidental movement.

### Is CyberClock available for macOS or Linux?

Currently, Windows is the primary target. Tauri v2 supports cross-platform builds, so macOS and Linux support may be added in the future.

---

## ❤️ Donate

**CyberClock** is a personal open-source project within the **CyberGems** suite. I've spent thousands of hours building and refining it — both for my own use and to share premium-quality software with the world for free.

If you'd like to support this work, a donation would mean a lot. Thank you! 🙏

<p align="center">
  <a href="https://www.paypal.com/donate/?hosted_button_id=M4PY3UPJA5Y6Q"><img src="https://img.shields.io/badge/Donate-PayPal-0070BA?style=for-the-badge&logo=paypal" alt="Donate via PayPal" /></a>
  <a href="https://ko-fi.com/cybergems"><img src="https://img.shields.io/badge/Support_me_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support me on Ko-fi" /></a>
  <a href="https://buymeacoffee.com/cybergems"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<div align="center">

<details>
<summary><b>Crypto donations (BTC, ETH, USDT, LTC) — click to view addresses</b></summary>

<div align="left">

| Asset | Network | Address | QR |
|---|---|---|---|
| <img src="docs/donate/btc.svg" width="18" height="18" valign="middle" alt="BTC" /> **BTC** | Bitcoin | `bc1q5mxzz05nmvsheqzx7970euswta3fksxzcfzag4` | ![BTC QR](docs/donate/qr-btc.png) |
| <img src="docs/donate/eth.svg" width="18" height="18" valign="middle" alt="ETH" /> **ETH** | Ethereum (ERC20) | `0x79b703Ec0f77493679Fcd280aF3b983E20c580B8` | ![ETH QR](docs/donate/qr-eth.png) |
| <img src="docs/donate/usdt.svg" width="18" height="18" valign="middle" alt="USDT" /> **USDT** | Ethereum (ERC20) | `0x79b703Ec0f77493679Fcd280aF3b983E20c580B8` | ![USDT ERC20 QR](docs/donate/qr-eth.png) |
| <img src="docs/donate/usdt.svg" width="18" height="18" valign="middle" alt="USDT" /> **USDT** | BNB Smart Chain (BEP20) | `0x79b703Ec0f77493679Fcd280aF3b983E20c580B8` | ![USDT BEP20 QR](docs/donate/qr-eth.png) |
| <img src="docs/donate/usdt.svg" width="18" height="18" valign="middle" alt="USDT" /> **USDT** | Tron (TRC20) | `TSVbSk1HSyZ1NprCnAYiw56ECwXgH887mD` | ![USDT TRC20 QR](docs/donate/qr-usdt-tron.png) |
| <img src="docs/donate/ltc.svg" width="18" height="18" valign="middle" alt="LTC" /> **LTC** | Litecoin | `LWGnEHgcFCE2BRkzLnsdPDD8Y8ZeDK577X` | ![LTC QR](docs/donate/qr-ltc.png) |

> ⚠️ Send only the selected asset on the indicated network. Using the wrong network will result in permanent loss of funds.

</div>

</details>

</div>

---

<div align="center" style="background:#0D0F17; border:1px solid rgba(0,255,255,0.12); border-radius:12px; padding:28px 20px; margin-top:32px;">

### Thanks for using CyberClock! 🎉

Made by [**CyberGems**](https://cybergems.org)

</div>
