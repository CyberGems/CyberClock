<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberClock/master/src-tauri/icons/icon.png" width="120" alt="CyberClock">
</p>

## 📋 CyberClock {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- COVERAGE: list every commit since the previous tag before drafting. Give every user-facing change at least one highlight and group related commits into one. Skip internal refactors, CI, tests and dependency bumps with no visible effect; keep small visible fixes such as copy, tooltips, shortcuts, themes, icons, spacing, stability and perceptible performance. Review the draft if 15+ user-facing commits produce fewer than 6 highlights, or 40+ total commits fewer than 8. Patch releases may have 1-3 highlights or a plain maintenance-only note. -->
<!-- changelog-summary:start -->
Fixes system tray menu positioning, mixed-DPI scaling, and vertical taskbar anchoring across multi-monitor setups so menus and flyouts appear cleanly without initial position jumps or clipping, and tightens the flyout gap to 4px.
<!-- changelog-summary:end -->

> **New to CyberClock?** A cyber-neon Windows clock with analog and digital views, calendar notes, alarms, timers, relaxation tools, and compact floating modes.

---

### ✨ Key Features & Highlights

- 🪟 **Accurate multi-monitor and mixed-DPI tray placement**: Reworked tray positioning in physical coordinates with per-monitor DPI handling so menus open flush beside vertical or horizontal taskbars without jumping on first open or clipping flyouts at the screen bottom.
- 🎯 **Unified `4px` tray flyout gap**: Tightened the horizontal spacing between the main tray card and its side-by-side flyout panels to `4px` to match the rest of the suite.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Corrige el posicionamiento del menú de bandeja, el escalado en monitores con DPI mixto y el anclaje en barras de tareas verticales para abrir sin saltos ni recortes, y ajusta el espacio de los flyouts a 4px.

> **¿Nuevo en CyberClock?** Un reloj Windows cyber-neón con vistas analógica y digital, notas de calendario, alarmas, temporizadores, herramientas de relax y modos flotantes compactos.

---

### ✨ Novedades destacadas

- 🪟 **Posicionamiento preciso en multimonitor y DPI mixto**: Se rehizo el cálculo de la bandeja en píxeles físicos con soporte DPI por monitor para que el menú abra junto a barras verticales u horizontales sin saltos en la primera apertura ni recortes inferiores en los submenús.
- 🎯 **Espaciado unificado de `4px` en flyouts**: Se ajustó a `4px` la separación horizontal entre la tarjeta principal de la bandeja y los paneles laterales para igualar el resto de la suite.

### ℹ️ Antes de instalar

- **Windows:** esta versión aún no está firmada digitalmente. SmartScreen puede avisar antes de ejecutarla: **Más información › Ejecutar de todas formas**. Cuando Smart App Control está activado, Windows rechaza programas sin firmar; consulta la [política de firma de código](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Verifica la descarga con los checksums SHA256 que aparecen más abajo.

</details>

---

### ℹ️ Before you install

- **Windows:** this release is not code-signed yet. SmartScreen may ask before it runs: **More info › Run anyway**. Where Smart App Control is on, Windows refuses unsigned programs; see the [code signing policy](https://github.com/CyberGems/.github/blob/main/CODE_SIGNING.md). Verify the download with the SHA256 checksums below.

---

### 📦 Downloads & Packages

> ⬇️ **Direct download:** click a file name to download it now. Same files as in **Assets** at the bottom of this page.

| File | Description | Platform |
| :--- | :--- | :--- |
| **[`CyberClock_{{VERSION_NUM}}_x64-setup.exe`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-setup.exe)** | 🚀 **Recommended Installer** (NSIS Setup with Start Menu & Desktop options) | Windows 10 / 11 (x64) |
| **[`CyberClock_{{VERSION_NUM}}_x64-portable.zip`](https://github.com/CyberGems/CyberClock/releases/download/{{VERSION}}/CyberClock_{{VERSION_NUM}}_x64-portable.zip)** | 💼 **Portable package** (run from any folder, with settings and imported sounds stored beside it) | Windows 10 / 11 (x64) |

---

### 🔐 VirusTotal and SHA256

> 🛡️ The report opens on VirusTotal and does not download anything. Sometimes one or two antivirus providers flag a safe file while the rest clear it; that is usually a false alarm. Our software is threat-free and the source code is public, so anyone can check it. Compare the SHA-256 below with your download and use only the links on this page.
> 🛡️ El informe se abre en VirusTotal y no descarga nada. A veces uno o dos proveedores de antivirus marcan un archivo seguro mientras los demás lo dan por limpio; suele ser una falsa alarma. Nuestro software está libre de amenazas y el código es público, cualquiera puede comprobarlo. Compara el SHA-256 de abajo con tu descarga y usa solo los enlaces de esta página.

**Installer**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{INSTALLER_HASH}})

```text
{{INSTALLER_HASH}}
```

**Portable**: [View VirusTotal report](https://www.virustotal.com/gui/file/{{PORTABLE_HASH}})

```text
{{PORTABLE_HASH}}
```

---

📜 **Full changelog:** browse every version in [CHANGELOG.md](https://github.com/CyberGems/CyberClock/blob/master/CHANGELOG.md).

*Crafted with precision by [CyberGems](https://cybergems.org)*
