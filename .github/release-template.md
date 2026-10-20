<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberClock/master/src-tauri/icons/icon.png" width="120" alt="CyberClock">
</p>

## 📋 CyberClock {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- Maintainer: Rewrite the marked paragraph for every release. Use 25-45 words, lead with user-facing changes, and do not repeat the app name or version. -->
<!-- changelog-summary:start -->
Custom alarms gain a 24-icon catalog picker, sound repeat controls with pause presets, and a duplicate action. The mini mode popover is now a native window with inline note editing. Floating widgets feature individual zoom, centralized menus, and multi-monitor auto-hide.
<!-- changelog-summary:end -->

> **New to CyberClock?** A cyber-neon Windows clock with analog and digital views, calendar notes, alarms, timers, relaxation tools, and compact floating modes.

---

### ✨ Key Features & Highlights

- 🔔 **Custom Alarms**:
  - **24-Icon Catalog**: Choose visual icons for custom alarms, displayed directly on alarm cards, full-screen alert notices, and the mini popover tip.
  - **Sound Repeat & Pause Presets**: Redesigned single-row repeat controls with cyber LED radio indicators and themed dropdown pause presets (30s, 1m, 2m, etc.).
  - **Duplicate Workflow**: Quickly duplicate existing alarms; editor layout is compacted with aligned footer actions.
  - **Alarm Window Restoration**: Full mode restores automatically when an alarm fires.

- 📌 **Mini Mode & Native Popover Tip**:
  - **Native Popover Window**: Decoupled hover popover into an independent native window with work-area clamping, multi-monitor alignment, and non-activating display.
  - **Inline Note Editing**: Create, edit, and delete day notes directly inside the popover without switching to full mode.
  - **Show Seconds Toggle**: Added in the Mini Mode menu for compact second-by-second tracking.

- 🎛️ **Floating Widgets & Centralized Menus**:
  - **Centralized Widget Menus**: Unified context menu popup with dedicated Actions tab for quick switching.
  - **Individual Zoom**: Per-widget zoom controls allow tailoring each floating tool size independently.
  - **Multi-Monitor Fullscreen Auto-Hide**: Mini clock and floating widgets intelligently hide during fullscreen games or apps across multiple displays.
  - **Audio & Click-Through Toggles**: Toggle master audio and click-through directly from widget context menus.

- 🎨 **Gallery & Visual Themes**:
  - **Dual Layout Gallery**: Switch between 1-row and 2-row preview modes with auto-fitting window height and draggable titlebar.
  - **Deep Space Skin**: New default skin #1, Titanium Mech re-indexed to #16, plus 4 new widget designs (now 20 unique skins).
  - **Full Mode Minimize**: Added titlebar minimize button and refined 3-state tray status labels.
  - **Installer Graphics**: Custom themed header and sidebar graphics for the NSIS installer.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Las alarmas personalizadas reciben un catálogo de 24 iconos, control de repetición de sonido con preajustes de pausa y acción de duplicar. La nota emergente del Modo Mini es ahora una ventana nativa con edición en línea. Los widgets flotantes incorporan zoom individual, menús centralizados y ocultación multi-monitor.

---

### ✨ Novedades destacadas

- 🔔 **Alarmas personalizadas**:
  - **Catálogo de 24 iconos**: Asigna iconos visuales a las alarmas, visibles en sus tarjetas, en los avisos en pantalla completa y en la nota emergente mini.
  - **Repetición de sonido y pausas**: Controles de repetición en una fila con indicadores LED cyber y menú desplegable de pausas predefinidas (30s, 1m, 2m, etc.).
  - **Acción Duplicar**: Duplica alarmas existentes con un clic; diseño del editor más compacto y acciones de pie alineadas.
  - **Restauración de ventana**: El modo completo se restaura automáticamente cuando suena una alarma.

- 📌 **Modo Mini y nota emergente nativa**:
  - **Ventana emergente nativa**: La nota al pasar el cursor es ahora una ventana nativa independiente, adaptada al área de trabajo y compatible con múltiples monitores.
  - **Edición de notas en línea**: Crea, edita y elimina notas del día directamente en la ventana emergente sin abrir el modo completo.
  - **Interruptor Mostrar Segundos**: Añadido en el menú del Modo Mini para seguimiento segundo a segundo.

- 🎛️ **Widgets flotantes y menús centralizados**:
  - **Menús centralizados**: Menú contextual unificado con pestaña de Acciones para cambios rápidos.
  - **Zoom individual**: Controles de escala independientes para ajustar el tamaño de cada widget flotante por separado.
  - **Ocultación automática en pantalla completa**: El reloj mini y los widgets flotantes se ocultan solos ante aplicaciones o juegos en pantalla completa en cualquier monitor.
  - **Interruptores de audio y clic a través**: Alterna el audio general y el clic a través directamente desde los menús de los widgets.

- 🎨 **Galería y temas visuales**:
  - **Galería de doble vista**: Alterna entre vistas de 1 fila y 2 filas con altura adaptable y barra de título arrastrable.
  - **Skin Deep Space**: Nuevo diseño predeterminado #1, Titanium Mech reubicado en el puesto #16, más 4 skins nuevos para widgets (20 skins en total).
  - **Minimizar en Modo Completo**: Botón de minimizar en la barra de título y etiquetas neutrales de 3 estados en la bandeja.
  - **Gráficos del instalador**: Cabecera y barra lateral con estética cyber-neon en el instalador NSIS.

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

- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe`** — SHA256: `{{INSTALLER_HASH}}`
- **`CyberClock_{{VERSION_NUM}}_x64-portable.zip`** — SHA256: `{{PORTABLE_HASH}}`
- **`CyberClock_{{VERSION_NUM}}_x64-setup.exe.sig`** — Updater signature (minisign)

---

*Crafted with precision by [CyberGems](https://cybergems.org)*
