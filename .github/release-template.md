<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberClock/master/src-tauri/icons/icon.png" width="120" alt="CyberClock">
</p>

## 📋 CyberClock {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
Full mode gains an expanded digital clock that survives restarts, per-mode 12/24-hour formats, and a reorganized settings window. Automatic rotating backups with one-click restore arrive in Backup & Data, alarms can read their label aloud, and the Relax view hosts its scheduler.
<!-- changelog-summary:end -->

> **New to CyberClock?** A cyber-neon Windows clock with analog and digital views, calendar notes, alarms, timers, relaxation tools, and compact floating modes.

---

### ✨ Key Features & Highlights

- 🕐 **Expanded Digital Clock**:
  - **Fullscreen Digital Stage**: Click the titlebar clock or date for an expanded digital clock with greeting, seconds progress bar and next-alarm line.
  - **Remembered State**: The stage stays open across mini round-trips and app restarts; a Mini button shrinks to mini without leaving the clock.
  - **Editable Brand**: Clicking the wordmark on the stage opens its setting directly.

- 💾 **Automatic Backups**:
  - **Rotating Snapshots**: Every launch saves the previous session's settings; 3 copies are kept by default (choose 3, 5 or 10).
  - **Custom Destination**: Backups live in the app data folder or any folder you pick.
  - **One-Click Restore**: Restore any listed copy from Settings; a safety snapshot is taken before every restore or import, so nothing is ever lost.

- 🎛️ **Reorganized Settings**:
  - **No More Appearance Tab**: Accent Tint now sits under General next to Language; dial designs, brand text, text size, screen layout and digital clock format live in Full Mode.
  - **Per-Mode Clock Format**: Full Mode's digital clock and the mini bar keep independent 12H/24H and seconds settings.
  - **Voice Tab**: Voice announcer settings moved to their own tab.

- 🔔 **Alarms & Chimes**:
  - **Read-Aloud**: Alarms can speak their label when they ring, with a global toggle or a per-alarm choice.
  - **Snooze at Ring Time**: Pick the snooze duration right from the alert, with longer options and a cleaner dropdown.

- 🧘 **Relax Module**:
  - **Home for the Scheduler**: The Auto Scheduler and the volume control moved into the Relax view as a collapsible panel with a next-run summary.

- 🧹 **Polish**:
  - More-menu view controls can no longer empty the Home panel, the CRT scanlines overlay was removed, the Sunset Pulse skin was streamlined, and the tray menu no longer flickers.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

El modo completo gana un reloj digital ampliado que sobrevive a los reinicios, formatos 12/24 horas por modo y una configuración reorganizada. Llegan las copias de seguridad automáticas con restauración en un clic, la lectura de alarmas en voz alta y el programador en la vista Relajación.

---

### ✨ Novedades destacadas

- 🕐 **Reloj digital ampliado**:
  - **Escenario digital a pantalla completa**: Haz clic en el reloj o la fecha de la barra de título para obtener un reloj digital ampliado con saludo, barra de progreso de segundos y línea de próxima alarma.
  - **Estado recordado**: El escenario sigue abierto entre idas y vueltas del mini y entre reinicios de la app; un botón Mini encoge sin salir del reloj.
  - **Marca editable**: Al hacer clic en el texto de marca del escenario se abre directamente su ajuste.

- 💾 **Copias de seguridad automáticas**:
  - **Instantáneas rotatorias**: Cada inicio guarda los ajustes de la sesión anterior; se conservan 3 copias por defecto (elige 3, 5 o 10).
  - **Destino personalizado**: Las copias viven en la carpeta de datos de la app o en la carpeta que elijas.
  - **Restauración en un clic**: Restaura cualquier copia de la lista desde Configuración; antes de cada restauración o importación se toma una instantánea de seguridad.

- 🎛️ **Configuración reorganizada**:
  - **Adiós a la pestaña Apariencia**: El Tinte de Acento ahora está en General junto al Idioma; diseños de esfera, marca, tamaño de texto, distribución y formato de reloj digital viven en Modo Full.
  - **Formato por modo**: El reloj digital del Modo Full y la barra mini mantienen ajustes independientes de 12H/24H y segundos.
  - **Pestaña Voz**: Los ajustes del locutor por voz pasaron a su propia pestaña.

- 🔔 **Alarmas y campanadas**:
  - **Lectura en voz alta**: Las alarmas pueden decir su etiqueta al sonar, con interruptor global o elección por alarma.
  - **Posponer al sonar**: Elige la duración del aplazamiento directamente desde el aviso, con opciones más largas y un menú más limpio.

- 🧘 **Módulo de Relajación**:
  - **Hogar del programador**: El Programador automático y el volumen se mudaron a la vista Relajación como panel colapsable con resumen de próxima ejecución.

- 🧹 **Pulido**:
  - Los controles de vista del menú Más ya no pueden vaciar el panel Inicio, se eliminó la superposición CRT, la skin Sunset Pulse quedó más limpia y el menú de la bandeja ya no parpadea.

</details>

--- 

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberClock_{{VERSION_NUM}}_x64-setup.exe`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-setup.exe)** | 🚀 **Recommended Installer** (NSIS Setup with Start Menu & Desktop options) | Windows 10 / 11 (x64) |
| **[`CyberClock_{{VERSION_NUM}}_x64-portable.zip`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-portable.zip)** | 💼 **Portable package** (run from any folder, with settings and imported sounds stored beside it) | Windows 10 / 11 (x64) |

---

### 🔐 Checksums

- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe`** — SHA256 (use the copy button on the block):

  ```
  {{INSTALLER_HASH}}
  ```

- **`CyberClock_{{VERSION_NUM}}_x64-portable.zip`** — SHA256 (use the copy button on the block):

  ```
  {{PORTABLE_HASH}}
  ```

- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe.sig`** — Updater signature (minisign)

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
