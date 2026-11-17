<p align="center">
  <img src="https://raw.githubusercontent.com/CyberGems/CyberClock/master/src-tauri/icons/icon.png" width="120" alt="CyberClock">
</p>

## 📋 CyberClock {{VERSION}}: Release Notes

### 🚀 What's new in this release

<!-- IMPORTANT FOR AGENTS & MAINTAINERS: Always rewrite this entire section and highlights with the ACTUAL release notes for this specific new version before tagging. NEVER leave or copy previous version notes! Use 25-45 words for the summary, lead with user-facing changes, and do not repeat the app name or version. Keep the Spanish mirror inside the details block in sync: translate the summary and rewrite the highlights. -->
<!-- changelog-summary:start -->
Every release now ships validated winget manifests for the Windows Package Manager, with an automated submission workflow that keeps the catalog current. This maintenance release carries no application changes; dependencies and documentation stay current.
<!-- changelog-summary:end -->

> **New to CyberClock?** A cyber-neon Windows clock with analog and digital views, calendar notes, alarms, timers, relaxation tools, and compact floating modes.

---

### ✨ Key Features & Highlights

- 📦 **Windows Package Manager ready**: Every release ships validated winget manifests alongside the installer and portable archive, and an automated workflow submits them once the submission pipeline is armed.
- 🧰 **Maintenance only**: No application changes in this release; it packages the winget submission kit and refreshed Rust dependencies.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades de esta versión

Cada release publica ahora manifiestos winget validados para el Windows Package Manager, con un flujo de envío automatizado que mantiene el catálogo al día. Esta versión de mantenimiento no cambia la aplicación; las dependencias y la documentación siguen al día.

> **¿Nuevo en CyberClock?** Un reloj Windows cyber-neón con vistas analógica y digital, notas de calendario, alarmas, temporizadores, herramientas de relax y modos flotantes compactos.

---

### ✨ Novedades destacadas

- 📦 **Listo para el Windows Package Manager**: Cada release publica manifiestos winget validados junto al instalador y el archivo portable, y un workflow automatizado los envía cuando el pipeline se arme.
- 🧰 **Solo mantenimiento**: Sin cambios en la aplicación en esta versión; incorpora el kit de envío winget y dependencias de Rust renovadas.

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

> 🛡️ The report opens on VirusTotal and does not download anything.

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
