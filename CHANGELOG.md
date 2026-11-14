# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.16.1]

### Changed

- Mini Mode loads its agenda and alert panel, context menu, system tray menu, and About window on demand. Dismissing them releases their memory.
- Mini Mode releases the hidden Full Mode window when it is idle. Full Mode loads again for scheduled Relax sessions or the Relax widget. Alarms and spoken time announcements continue in Mini Mode.

### Fixed

- Update notice buttons use the selected language in Mini Mode. In Full Mode, the notice opens in the lower-right corner. In-app release notes omit the installation guidance shown on GitHub.

### Español

- El Modo Mini carga bajo demanda el panel de agenda y avisos, el menú contextual, el menú de la bandeja y la ventana Acerca de CyberClock. Al cerrarlos, libera su memoria.
- El Modo Mini libera la ventana oculta del Modo Completo cuando queda inactiva. Vuelve a cargarla para las sesiones programadas y el widget de Relax. Las alarmas y la locución de hora siguen funcionando en Modo Mini.
- Los botones del aviso de actualización en Modo Mini aparecen en el idioma elegido. En Modo Completo, el aviso se abre en la esquina inferior derecha. Las notas dentro de la app omiten las instrucciones de instalación de GitHub.

## [1.16.0]

### Added

- Relax supports named soundscape mixes with independent layer volumes. Save, load, rename, update and delete mixes from Relax or its widget.
- The Relax widget controls the shared session, including playback, layer selection and volume, and Auto Stop. Its spectrum can be hidden.

### Changed

- Mini Mode does less work in the background and uses lighter skin animations. A synchronized LED marks the seconds.
- Relax remembers the current mix, Auto Stop duration, panel states and widget spectrum preference. Pause and stop fade out smoothly.
- Settings now group voice selection and volume under Voice, scheduled announcements under Time, and alarm read-aloud under Alarms.

### Fixed

- Mini Mode better restores its saved monitor and position.
- The time announcer starts on schedule, avoids duplicate speech and leaves more space between the pre-chime and the voice. Hourly chimes and announcements are mutually exclusive.

### Español

- **Relax** guarda mezclas con nombre y volúmenes por capa. Gestiona las mezclas y controla la reproducción y la Parada Automática desde Relax o su widget. El espectro del widget se puede ocultar.
- **Modo Mini** reduce el trabajo en segundo plano, simplifica las animaciones y recupera mejor el monitor y la posición. El LED marca los segundos de forma sincronizada.
- **Locución de hora** más puntual, con protección contra anuncios duplicados y una pausa algo mayor después del inicio del timbre previo. Las campanadas horarias y la locución son opciones excluyentes.
