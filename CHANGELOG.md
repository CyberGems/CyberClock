# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
