# Changelog

All notable changes to CyberClock are documented here.

## [1.16.4] - 2026-11-19

### 🇺🇸 English

- Fix tray menu positioning, DPI scaling, and vertical taskbar anchoring across mixed-DPI multi-monitor setups so menus open cleanly beside left, right, top, or bottom taskbars without initial jumps or bottom clipping.
- Tighten the horizontal spacing between the main tray card and its side-by-side flyout panels to `4px`.

### 🇪🇸 Español

- Corrige el posicionamiento, escalado DPI y anclaje con barras de tareas verticales del menú de la bandeja en configuraciones multimonitor con DPI mixto, evitando saltos iniciales y recortes inferiores.
- Ajusta la separación horizontal entre la tarjeta principal de la bandeja y los paneles flyout laterales a `4px`.

## [1.16.3] - 2026-11-18

### 🇺🇸 English

- Convert the tray submenus (`New...`, `Click-through`, `Help`, the tray pin tip, and `More from CyberGems`) into side-by-side flyout panels with dwell hover, click toggling, automatic left/right taskbar placement, and keyboard arrow navigation.

### 🇪🇸 Español

- Convierte los submenús de la bandeja (`Nuevo...`, `Click-through`, `Ayuda`, el aviso de fijar icono y `Más de CyberGems`) en paneles flyout laterales con apertura al pasar el cursor, alternancia por clic, colocación automática según la barra de tareas y navegación con flechas del teclado.

## [1.16.2] - 2026-11-17

### 🇺🇸 English

- Ship winget manifests with every release and automate Windows Package Manager submissions.
- Update 13 Rust dependencies and @tauri-apps/cli.

### 🇪🇸 Español

- Publica manifiestos winget con cada release y automatiza los envíos al Windows Package Manager.
- Actualiza 13 dependencias de Rust y @tauri-apps/cli.

## [1.16.1] - 2026-11-14

### 🇺🇸 English

- Mini Mode loads its agenda and alert panel, context menu, system tray menu, and About window on demand. Dismissing them releases their memory.
- Mini Mode releases the hidden Full Mode window when it is idle. Full Mode loads again for scheduled Relax sessions or the Relax widget. Alarms and spoken time announcements continue in Mini Mode.
- Update notice buttons use the selected language in Mini Mode. In Full Mode, the notice opens in the lower-right corner. In-app release notes omit the installation guidance shown on GitHub.

### 🇪🇸 Español

- El Modo Mini carga bajo demanda el panel de agenda y avisos, el menú contextual, el menú de la bandeja y la ventana Acerca de CyberClock. Al cerrarlos, libera su memoria.
- El Modo Mini libera la ventana oculta del Modo Completo cuando queda inactiva. Vuelve a cargarla para las sesiones programadas y el widget de Relax. Las alarmas y la locución de hora siguen funcionando en Modo Mini.
- Los botones del aviso de actualización en Modo Mini aparecen en el idioma elegido. En Modo Completo, el aviso se abre en la esquina inferior derecha. Las notas dentro de la app omiten las instrucciones de instalación de GitHub.

## [1.16.0] - 2026-11-13

### 🇺🇸 English

- Relax supports named soundscape mixes with independent layer volumes. Save, load, rename, update and delete mixes from Relax or its widget.
- The Relax widget controls the shared session, including playback, layer selection and volume, and Auto Stop. Its spectrum can be hidden.
- Mini Mode does less work in the background and uses lighter skin animations. A synchronized LED marks the seconds.
- Relax remembers the current mix, Auto Stop duration, panel states and widget spectrum preference. Pause and stop fade out smoothly.
- Settings now group voice selection and volume under Voice, scheduled announcements under Time, and alarm read-aloud under Alarms.
- Mini Mode better restores its saved monitor and position.
- The time announcer starts on schedule, avoids duplicate speech and leaves more space between the pre-chime and the voice. Hourly chimes and announcements are mutually exclusive.

### 🇪🇸 Español

- Relax admite mezclas de paisajes sonoros con nombre y volúmenes independientes por capa. Guarda, carga, renombra, actualiza y elimina mezclas desde Relax o su widget.
- El widget de Relax controla la sesión compartida, incluidos la reproducción, la selección de capas, el volumen y la Parada Automática. Su espectro se puede ocultar.
- El Modo Mini hace menos trabajo en segundo plano y usa animaciones de skins más ligeras. Un LED sincronizado marca los segundos.
- Relax recuerda la mezcla actual, la duración de la Parada Automática, los estados de los paneles y la preferencia del espectro del widget. Pausar y detener aplican un fundido suave.
- Los ajustes agrupan ahora la selección de voz y el volumen en Voz, los anuncios programados en Hora y la lectura en voz alta de las alarmas en Alarmas.
- El Modo Mini recupera mejor su monitor y su posición guardados.
- La locución de hora se activa a tiempo, evita la locución duplicada y deja más espacio entre el timbre previo y la voz. Las campanadas horarias y la locución son opciones excluyentes.

## [1.15.0] - 2026-10-26

### 🇺🇸 English

- Full Mode gains an expanded digital clock stage with greeting, seconds progress bar and next-alarm line, opened from the titlebar clock or date. It stays open across Mini round-trips and app restarts, and clicking its wordmark opens its setting directly.
- Automatic rotating backups: every launch saves the previous session's settings, keeping 3 copies by default (choose 3, 5 or 10), stored in the app data folder or a custom destination, with one-click restore from Settings and a safety snapshot before every restore or import.
- Settings are reorganized: the Appearance tab is gone and Accent Tint sits under General next to Language, dial designs, brand text, text size, screen layout and digital clock format live in Full Mode, and the voice announcer settings move to their own Voice tab.
- Full Mode's digital clock and the mini bar keep independent 12/24-hour and seconds formats.
- Alarms can read their label aloud when they ring, with a global toggle or a per-alarm choice, and the snooze duration is picked right from the alert with longer options and a cleaner dropdown.
- The Relax view hosts the Auto Scheduler and the volume control as a collapsible panel with a next-run summary.
- Polish: More-menu view controls can no longer empty the Home panel, the CRT scanlines overlay was removed, the Sunset Pulse skin was streamlined, and the tray menu no longer flickers.

### 🇪🇸 Español

- El Modo Completo estrena un escenario de reloj digital ampliado con saludo, barra de progreso de segundos y línea de próxima alarma, que se abre desde el reloj o la fecha de la barra de título. Sigue abierto entre idas y vueltas del mini y entre reinicios de la app, y al hacer clic en su marca se abre directamente su ajuste.
- Copias de seguridad automáticas rotatorias: cada inicio guarda los ajustes de la sesión anterior y se conservan 3 copias por defecto (elige 3, 5 o 10), en la carpeta de datos de la app o en un destino personalizado, con restauración en un clic desde Configuración y una instantánea de seguridad antes de cada restauración o importación.
- Configuración reorganizada: la pestaña Apariencia desaparece y el Tinte de Acento queda en General junto al Idioma, los diseños de esfera, la marca, el tamaño de texto, la distribución y el formato del reloj digital viven en el Modo Completo, y los ajustes del locutor de voz pasan a su propia pestaña Voz.
- El reloj digital del Modo Completo y la barra mini mantienen ajustes independientes de 12/24 horas y segundos.
- Las alarmas pueden decir su etiqueta en voz alta al sonar, con interruptor global o elección por alarma, y la duración del aplazamiento se elige directamente desde el aviso, con opciones más largas y un menú más limpio.
- La vista Relajación acoge el Programador automático y el control de volumen como panel colapsable con resumen de próxima ejecución.
- Pulido: los controles de vista del menú Más ya no pueden vaciar el panel Inicio, se eliminó la superposición CRT, la skin Sunset Pulse quedó más limpia y el menú de la bandeja ya no parpadea.

## [1.14.0] - 2026-10-20

### 🇺🇸 English

- Custom alarms gain a 24-icon catalog displayed on alarm cards, full-screen alert notices and the mini popover tip, plus redesigned single-row sound repeat controls with cyber LED indicators, themed pause presets (30s, 1m, 2m and more) and a duplicate action in a compacted editor with aligned footer actions.
- Full Mode restores automatically when an alarm fires.
- The Mini Mode hover popover is now an independent native window with work-area clamping, multi-monitor alignment and non-activating display, and day notes can be created, edited and deleted inline without switching to Full Mode.
- A Show Seconds toggle in the Mini Mode menu enables compact second-by-second tracking.
- Floating widgets get unified context menus with a dedicated Actions tab for quick switching, individual per-widget zoom, and master audio and click-through toggles.
- The Mini clock and floating widgets intelligently auto-hide during fullscreen games or apps across multiple monitors.
- The skin gallery switches between 1-row and 2-row layouts with auto-fitting window height and a draggable titlebar, adds Deep Space as the new default skin (Titanium Mech moves to #16) and 4 new widget designs for 20 unique skins in total.
- Full Mode adds a titlebar minimize button and refined 3-state tray status labels, and the NSIS installer gets custom themed header and sidebar graphics.

### 🇪🇸 Español

- Las alarmas personalizadas estrenan un catálogo de 24 iconos visible en sus tarjetas, en los avisos a pantalla completa y en la nota emergente mini, controles de repetición de sonido en una fila con indicadores LED cyber, pausas predefinidas (30s, 1m, 2m y más) y una acción Duplicar en un editor más compacto con acciones de pie alineadas.
- El Modo Completo se restaura automáticamente cuando suena una alarma.
- La nota emergente del Modo Mini es ahora una ventana nativa independiente adaptada al área de trabajo, alineada con varios monitores y sin robar el foco, y las notas del día se crean, editan y eliminan en línea sin abrir el Modo Completo.
- Un interruptor Mostrar Segundos en el menú del Modo Mini permite el seguimiento segundo a segundo.
- Los widgets flotantes suman menús contextuales unificados con pestaña de Acciones para cambios rápidos, zoom individual por widget e interruptores de audio general y clic a través.
- El reloj mini y los widgets flotantes se ocultan solos ante juegos o apps en pantalla completa en cualquier monitor.
- La galería de skins alterna entre vistas de 1 y 2 filas con altura de ventana adaptable y barra de título arrastrable, añade Deep Space como skin predeterminado (Titanium Mech pasa al puesto #16) y 4 diseños nuevos para widgets, 20 skins únicos en total.
- El Modo Completo añade un botón de minimizar en la barra de título y etiquetas de bandeja de 3 estados refinadas, y el instalador NSIS estrena gráficos propios en cabecera y barra lateral.

## [1.13.0] - 2026-09-30

### 🇺🇸 English

- The mini clock gains an optional Day Progress line on its bottom edge; hovering shows the percentage of the day that has passed.
- Turning Show Date off hides the date and shortens the bar, and both return on hover, while the note banner under the clock keeps its full shadow.
- Alarms gain templates that save a setup without scheduling it, a clone action, and a delete-after-ring option that removes the alarm when the notice is dismissed (snooze keeps it).
- New Alarm is available in the tray and in every widget menu, and old unnamed slots no longer ring after the list has hidden them.
- The analog clock only receives clicks and drags on the visible dial, its rim no longer shows a white arc along the top, and the system move cursor appears only while a widget is being moved.
- Each widget menu opens with that widget's name, the calendar and Relax menu buttons appear only while the pointer is over the widget, and a left click on the tray icon brings the clock forward without hiding it.
- On-screen hints for floating widget buttons take their color from the active skin, and widget frames that were clipped square now keep a soft inner edge.

### 🇪🇸 Español

- El reloj mini estrena una línea opcional de Avance del Día en su borde inferior; al pasar el cursor muestra el porcentaje del día que ha pasado.
- Con Mostrar Fecha apagado, la fecha se oculta y la barra se acorta, y ambas vuelven al pasar el cursor; el banner de notas bajo el reloj conserva la sombra completa.
- Las alarmas suman plantillas que guardan una configuración sin programarla, una acción de clonar y la opción Eliminar después de la alarma, que la quita al cerrar el aviso (posponer la conserva).
- Nueva Alarma está en la bandeja y en el menú de cada widget, y los huecos viejos sin nombre ya no suenan cuando la lista los ha ocultado.
- El reloj analógico solo recibe clics y arrastres dentro de la esfera visible, su borde ya no muestra un arco blanco en la parte superior y el cursor de mover del sistema aparece solo mientras se mueve un widget.
- Cada menú de widget se abre con el nombre de ese widget, el botón de menú del calendario y de Relajación aparece solo con el puntero sobre el widget, y un clic izquierdo en el icono de la bandeja trae el reloj al frente sin ocultarlo.
- Los avisos en pantalla de los botones de los widgets flotantes toman el color del diseño activo, y los marcos de widget que se recortaban en seco conservan un borde interior suave.

## [1.12.0] - 2026-09-30

### 🇺🇸 English

- The mini clock window sizes itself to the clock type, and time and date use separate faces.
- Compact (2 Rows) is unavailable while Collapse Date is on and its tooltip stays solid, and toggle switches keep the menu open while Settings, Full Mode and quit still close it.
- The Reactor Core dial replaces its coil shapes with an open ring of markers so the brand stays readable, and the Circuit PCB dial keeps its blinking lights while dropping the traces that crossed the brand.
- The suite tray uses the CyberGems mark with a short line under each app and a link for more details.
- Widget actions share one set of labels (New Timer, New Stopwatch, Open Relax), the full-mode Relax entry leaves the mini menu and the tray in favor of the Relax widget, and tray zoom sits in its own group apart from click-through.
- More options leads with Donate, adds Check for Update, and Exit uses the same close dialog as the window button.
- The voice announcer speaks the time once, through Windows speech.
- On-screen button hints take their color from the active mini skin, the Saved status in Settings becomes a status line, the info icon shows its dot, and the Glass Orb update card is restyled so Neon Circuit no longer clips it.

### 🇪🇸 Español

- La ventana del reloj mini se ajusta al tipo de reloj, y la hora y la fecha usan esferas distintas.
- Compacto (2 Filas) no está disponible con Colapsar Fecha activado y su tooltip se mantiene sólido; los interruptores dejan el menú abierto, mientras que Configuración, Modo Completo y salir sí lo cierran.
- La esfera Núcleo Reactor cambia sus formas de bobina por un anillo abierto de marcas para que la marca se lea bien, y Circuito PCB conserva sus luces parpadeantes y quita los trazos que cruzaban la marca.
- La bandeja de la suite usa el isotipo de CyberGems con una línea breve bajo cada app y un enlace para más detalles.
- Las acciones de los widgets comparten las mismas etiquetas (Nuevo Temporizador, Nuevo Cronómetro, Abrir Relajación), la entrada de Relajación en Modo Completo sale del menú mini y de la bandeja en favor del widget de Relajación, y el zoom de la bandeja queda en su propio grupo aparte del click-through.
- Más opciones empieza con Donar, suma Buscar actualizaciones y Salir usa el mismo diálogo de cierre que el botón de la ventana.
- El locutor dice la hora una sola vez, con la voz de Windows.
- Los avisos en pantalla de los botones toman el color del diseño mini activo, el estado Guardado en Configuración es una línea de estado, el icono de info muestra su punto y la tarjeta de actualización de Glass Orb se rediseña para que Neon Circuit ya no la recorte.

## [1.11.0] - 2026-09-29

### 🇺🇸 English

- A full alarm designer arrives with quick presets, alarm cards, the name edited in the title, time and date together, and repeat rules for once, every day, weekdays, weekends or selected days.
- New alarms start on No sound, with twenty synthesized tones available and the last choice remembered, and your own MP3 or WAV can play instead of the tone list.
- The sound repeats a set number of times or until the notice is dismissed, with a pause between plays, the snooze button shows its delay, the next-alarm card counts down to it, and a firing alarm takes over the full window while Mini Mode shows its own notice.
- A compact floating Relax session shows the track name, play and next, a breathing ring, a small spectrum and 10 designs, and audio keeps playing when Full Mode is hidden.
- Click-through covers the mini clock and every floating widget, including ones opened later, with a single switch in Settings and the tray menu; the tray and Settings stay reachable while the windows ignore the mouse.
- Gold and Coral accent tints join the theme options.
- Widget menus open Settings and the matching full-mode section, and optional on-screen button hints arrive with a global switch for tooltips.

### 🇪🇸 Español

- Llega un diseñador de alarmas completo con preajustes, tarjetas de alarma, el nombre editado en el título, hora y fecha juntas, y reglas de repetición: una vez, todos los días, entre semana, en fines de semana o en días seleccionados.
- Las alarmas nuevas empiezan en Sin sonido, con veinte tonos sintetizados disponibles y memoria de la última elección, y puedes usar tu propio MP3 o WAV en lugar de la lista de tonos.
- El sonido se repite un número de veces o hasta que se cierra el aviso, con una pausa entre reproducciones; el botón Posponer muestra su demora, la tarjeta de la próxima alarma cuenta hasta ese momento y la alarma que suena ocupa la ventana completa mientras el Modo Mini muestra su propio aviso.
- Una sesión de Relajación flotante y compacta muestra el nombre de la pista, reproducir y siguiente, un anillo de respiración, un espectro pequeño y 10 diseños, y el audio sigue cuando el modo completo está oculto.
- El click-through cubre el reloj mini y cada widget flotante, también los que se abran después, con un solo interruptor en Configuración y en el menú de la bandeja; la bandeja y Configuración siguen disponibles mientras las ventanas ignoran el ratón.
- Los tintes de acento Oro y Coral se suman a las opciones de tema.
- Los menús de los widgets abren Configuración y la sección correspondiente del modo completo, y los avisos opcionales en los botones llegan con un interruptor global para los tooltips.

## [1.10.0] - 2026-09-28

### 🇺🇸 English

- A new Backup & Data settings tab exports all alarms, notes, timers and preferences as a JSON file, imports backups from a previous JSON file to restore settings and notes, opens the app data folder directly to reach local settings, imported sounds and backups, and offers a factory reset to defaults.
- The close confirmation dialog is redesigned as vertical action cards with Switch to Mini Mode emphasized first, plus a direct X close button in the header, backdrop click dismissal and Esc keyboard shortcut hints.
- The About window shows 5 random CyberGems suite apps with an inline More badge linking to the full suite listing and a concise 3-line app description.
- An About CyberClock entry is available in all floating widget and Mini Mode context menus.
- The README ships with a complete Spanish translation and a language switcher.

### 🇪🇸 Español

- Una nueva pestaña de Configuración, Respaldo y Datos, exporta todas las alarmas, notas, temporizadores y preferencias como archivo JSON, importa copias de seguridad desde un archivo JSON previo para restaurar configuración y notas, abre directamente la carpeta de datos de la aplicación para acceder a ajustes locales, sonidos importados y respaldos, y ofrece el restablecimiento de fábrica.
- El diálogo de confirmación de cierre se rediseña como tarjetas verticales con Pasar a Modo Mini resaltada en primer lugar, además de un botón X directo en la cabecera, cierre al hacer clic fuera del modal y atajos de teclado Esc.
- La ventana Acerca de muestra 5 aplicaciones aleatorias de la suite CyberGems con una insignia Más en línea que enlaza al listado completo de la suite y una descripción concisa de 3 líneas.
- La entrada Acerca de CyberClock está disponible en todos los menús contextuales de widgets flotantes y Modo Mini.
- El README incluye una traducción completa al español con conmutador de idioma.

## [1.9.0] - 2026-09-27

### 🇺🇸 English

- Hourly chimes and interval alerts get an independent volume slider that preserves the master alarm volume, with dedicated sound preview buttons next to each chime selector (:00, :30, :15) for immediate verification.
- The Time settings tab reorganizes Hourly Chimes and the Voice Time Announcer into clean, unified function cards, the Alarms tab is decluttered and dedicated exclusively to scheduled alarms and timers, and quiet hours schedule labels are refined.
- The close confirmation dialog adds a Switch to Mini Mode option alongside minimize to tray and exit.
- A direct X close button in the dialog header, backdrop click dismissal and Esc keyboard shortcut hints arrive across all application modals.
- Update notifications in Mini Mode and Full Mode carry collapsible bilingual release notes, with full English and Spanish string parity across new controls, tooltips and settings.

### 🇪🇸 Español

- Las campanadas horarias y las alertas de intervalo tienen un deslizador de volumen independiente que preserva el volumen maestro de alarmas, con botones de prueba de sonido junto a cada selector de campanada (:00, :30, :15) para verificarlas al instante.
- La pestaña Hora reorganiza Campanadas Horarias y el Locutor de Hora por Voz en tarjetas de función limpias y unificadas, la pestaña Alarmas queda despejada y dedicada exclusivamente a alarmas y temporizadores programados, y las etiquetas del horario de silencio se refinan.
- El diálogo de confirmación de cierre añade la opción Pasar a Modo Mini junto a minimizar a la bandeja y salir.
- Llegan el botón X directo en la cabecera del diálogo, el cierre al hacer clic fuera del modal y atajos de teclado Esc en todos los modales de la aplicación.
- Las notificaciones de actualización en Modo Mini y Modo Completo incluyen notas de versión bilingües desplegables, con paridad total entre inglés y español en los nuevos controles, tooltips y opciones.

## [1.8.0] - 2026-09-26

### 🇺🇸 English

- A Voice Time Announcer (talking clock) speaks the time at intervals (:15, :30, :00) using native Windows speech synthesis, with a choice of system default, male, female or any installed Windows SAPI/OneCore voice plus a shortcut to install voice packs, and Natural, Cyber/Tactical or Concise styles.
- The announcer supports an optional soft pre-chime, a quiet hours silence window and intelligent chime deconfliction.
- Mini Mode auto-fades during desktop inactivity (70%, 50%, 30% or 15%) and brightens back to 100% on mouse hover.
- Mini Clock, Timers, Stopwatches, Analog Clock and Calendar each get their own position lock, right from their contextual menus.
- The floating calendar widget gains 10 cyberpunk skins, daily auto-rotation and a date picker popover, and the floating analog clock receives dial and control refinements.
- Timers and stopwatches get enlarged 26px counter digits, a dimmed resting state when zeroed and fixed chamfer alignment on Skin 1, and the floating timer's quick presets (+30s to +15m) can be shown or hidden on demand.

### 🇪🇸 Español

- Un Locutor de Hora por Voz (reloj parlante) anuncia la hora a intervalos (:15, :30, :00) mediante síntesis de voz nativa de Windows, con elección entre voz predeterminada, masculina, femenina o cualquier voz SAPI/OneCore instalada más un acceso directo para instalar paquetes de voces, y estilos Natural, Ciber-táctico o Conciso.
- El locutor admite un pre-timbre suave opcional, una ventana de horas de silencio y el de-conflicto inteligente con las campanadas horarias.
- El Modo Mini se atenúa automáticamente tras la inactividad en el escritorio (70%, 50%, 30% o 15%) y recupera el 100% de brillo al pasar el ratón.
- Mini Reloj, Temporizadores, Cronómetros, Reloj Analógico y Calendario cuentan con bloqueo de posición individual accesible desde sus menús contextuales.
- El widget flotante de calendario suma 10 skins futuristas, rotación diaria automática y un selector emergente de fecha, y el reloj analógico flotante recibe refinamientos de esfera y controles.
- Temporizadores y cronómetros estrenan dígitos de contador ampliados a 26px, estado en reposo atenuado en ceros y chaflanes corregidos en el Skin 1, y los presets rápidos del temporizador flotante (+30s a +15m) se muestran u ocultan a demanda.

## [1.7.0] - 2026-09-25

### 🇺🇸 English

- Floating calendar and analog clock widgets arrive as standalone desktop tools: the calendar offers quick note peeks, multi-month navigation and a dedicated context menu, and the analog clock brings modern cyber dials, skin picking and customizable taskbar visibility.
- Open timers, stopwatches, calendar and analog widgets are seamlessly remembered and restored upon application restart, with accurate multi-monitor coordinate restoration that prevents window jumps across displays.
- Timers, stopwatches, analog clocks or calendars can be spawned instantly from any active widget.
- Each widget gets a dedicated right-click menu with custom renaming, independent skins, audio alerts and taskbar toggles.
- Mini Clock, Timers and Stopwatches keep independent skin preferences, and tooltips become sleek auto-hiding overlays with smooth fades and refined obsidian aesthetics.

### 🇪🇸 Español

- Llegan los widgets flotantes de calendario y reloj analógico como herramientas de escritorio independientes: el calendario ofrece vistazos rápidos a las notas, navegación de varios meses y un menú contextual propio, y el reloj analógico trae esferas ciber modernas, elección de skin y visibilidad configurable en la barra de tareas.
- Los temporizadores, cronómetros, calendarios y relojes analógicos abiertos se recuerdan y se restauran sin problema al reiniciar la aplicación, con restauración precisa de coordenadas multi-monitor que evita saltos de ventana entre pantallas.
- Se pueden abrir temporizadores, cronómetros, relojes analógicos o calendarios al instante desde cualquier widget activo.
- Cada widget tiene su propio menú contextual con renombrado personalizado, skins independientes, alertas de audio e interruptores de barra de tareas.
- Mini Reloj, Temporizadores y Cronómetros mantienen preferencias de skin independientes, y los tooltips se convierten en superposiciones elegantes que se ocultan solos, con fundidos suaves y estética obsidiana refinada.

## [1.6.1] - 2026-09-21

### 🇺🇸 English

- Tray menu submenus (such as Help and More from CyberGems) transition via smooth horizontal sliding decks instead of expanding vertically, preventing scrollbars, jitter and clipped actions.
- Selecting Check for updates from the tray Help menu immediately opens the dedicated About window and starts an instant check.
- The About window is refined with perfectly balanced height free of default scrollbars and excess whitespace, restored crisp SVG icons for GitHub and issue reporting, and a dedicated button to explore sister apps online.
- Update status feedback is highly visible: a clear green checkmark when up to date, a radiant cyber-cyan glow for new releases, animated progress indicators and informative error diagnostics.
- An interactive showcase of sister CyberGems apps joins the About dialog and the tray menu, with configurable visibility toggles in Settings.

### 🇪🇸 Español

- Los submenús del menú de la bandeja (como Ayuda y Más de CyberGems) transicionan con suaves deslizamientos horizontales en lugar de expandirse en vertical, evitando barras de desplazamiento, tirones y acciones recortadas.
- Seleccionar Buscar actualizaciones en el menú Ayuda de la bandeja abre al instante la ventana Acerca de e inicia una comprobación inmediata.
- La ventana Acerca de se refina con una altura perfectamente equilibrada sin barras de desplazamiento ni espacios de sobra, iconos SVG nítidos restaurados para GitHub y reportar problemas, y un botón dedicado a explorar las apps hermanas en línea.
- El estado de la actualización es muy visible: una clara marca verde cuando todo está al día, un radiante brillo ciber-cian para versiones nuevas, indicadores de progreso animados y diagnósticos de error informativos.
- Una vitrina interactiva de las apps hermanas de CyberGems se suma al diálogo Acerca de y al menú de la bandeja, con interruptores de visibilidad configurables en Configuración.

## [1.6.0] - 2026-09-18

### 🇺🇸 English

- New Gem Crown analog dial: a multicolor, faceted design with prismatic accents, gemstone hour markers and an animated sparkle sweep.
- Three more analog clock skins join: Quantum Orbit, Cyber Chrono and Hex Matrix, switched from a discreet vertical cycler on the clock's right edge or a context menu action.
- The Today dashboard gains a permanent greeting card, and the calendar gets a collapse grip with a greeting edit shortcut and a note hover fix.
- Full Mode adopts a sober obsidian background and base theme, notes gain a cyber text context menu and an enhanced note modal, and mini tooltips adopt the active skin with a longer hover delay.
- Boot rendering is fixed: the clock draws correctly on startup, transitions no longer flicker, and the calendar rendering crash is gone.
- The update flow is repaired and a portable release package ships alongside the installer, with a Microsoft Store build mode that disables self-updates for Store distribution.

### 🇪🇸 Español

- Nueva esfera analógica Gem Crown: un diseño multicolor y facetado con acentos prismáticos, marcadores de hora en forma de gema y un barrido de destellos animado.
- Tres skins analógicas más se suman: Quantum Orbit, Cyber Chrono y Hex Matrix, que se cambian desde un selector vertical y discreto en el borde derecho del reloj o desde una acción del menú contextual.
- El panel Today estrena una tarjeta de saludo permanente, y el calendario recibe un asa de colapso con un atajo para editar el saludo y una corrección al pasar el cursor sobre las notas.
- El Modo Completo adopta un fondo y tema base de obsidiana sobria, las notas suman un menú contextual de texto cyber y un modal de notas mejorado, y los tooltips del mini adoptan el skin activo con más demora al pasar el cursor.
- El renderizado al arrancar queda corregido: el reloj se dibuja bien al inicio, las transiciones ya no parpadean y desaparece el crash del renderizado del calendario.
- El flujo de actualización se repara y llega un paquete portátil junto al instalador, con un modo de compilación para Microsoft Store que desactiva las auto-actualizaciones en la distribución de la Store.

## [1.5.0] - 2026-09-16

### 🇺🇸 English

- Independent floating stopwatch and timer windows arrive with 12 mini skins, spawnable from the tray or Mini Mode on the active monitor near the cursor, with local state, skin inheritance, a compact in-face preset chooser and quick presets from 30 seconds to 15 minutes.
- The full-mode analog clock gains four new dial designs (Minimal, Neon Segments, Cyber HUD and Aurora), plus a floating dial-design switcher on clock hover and a settings button in the titlebar.
- A personalized welcome greeting sits beside the brand in Full Mode.
- The full-mode titlebar is rebranded with the official logo, a two-tone Cyber/Clock wordmark, the pulse LED beside the clock time and a mica-black glass finish.
- A Text Size setting (small, normal, large) joins the Appearance tab.
- Typography is modernized across the main window and Settings, and the gear, clock, timer, stopwatch and lotus icons are redesigned as flat modern strokes.
- The Relax view stretches to fill the tab with 50/50 columns and flex-sized spectrum and session panels, floating windows gain responsive layouts without the default WebView2 context menu, and a tray menu freeze when spawning floating windows is fixed.

### 🇪🇸 Español

- Llegan ventanas flotantes independientes de cronómetro y temporizador con 12 mini skins, que se abren desde la bandeja o el Modo Mini en el monitor activo junto al cursor, con estado propio, herencia de skin, un selector de presets compacto en la propia esfera y presets rápidos de 30 segundos a 15 minutos.
- El reloj analógico del Modo Completo gana cuatro diseños de esfera nuevos (Minimal, Neon Segments, Cyber HUD y Aurora), además de un selector flotante de diseño al pasar el cursor sobre el reloj y un botón de ajustes en la barra de título.
- Un saludo de bienvenida personalizado acompaña a la marca en el Modo Completo.
- La barra de título del Modo Completo se renueva con el logo oficial, un wordmark bicolor Cyber/Clock, el LED de pulso junto a la hora y un acabado de vidrio mica negro.
- Un ajuste de Tamaño de texto (pequeño, normal, grande) se suma a la pestaña de Apariencia.
- La tipografía se moderniza en la ventana principal y en Configuración, y los iconos de engranaje, reloj, temporizador, cronómetro y loto se rediseñan como trazos planos modernos.
- La vista de Relajación se extiende para llenar la pestaña con columnas 50/50 y paneles de espectro y sesión flexibles, las ventanas flotantes ganan diseños responsivos sin el menú contextual por defecto de WebView2, y se corrige un congelamiento del menú de la bandeja al abrir ventanas flotantes.

## [1.4.1] - 2026-09-13

### 🇺🇸 English

- Windows date and time settings are one click away: new entries in the tray menu (Help) and in Settings open the classic Windows Date and Time dialog right where you need them.
- A clock accuracy monitor measures drift against network time servers at startup and every 6 hours, shows the result under Settings › Windows Integration with a Check now button, and a Windows notification warns immediately when the system clock is off by more than a minute, before alarms and chimes fire at the wrong time. It is read-only and privilege-free, using SNTP first with automatic HTTP fallback on networks that block NTP.
- An optional global hotkey shows and hides the clock: Alt+Shift+C by default, with a custom combination picker in Settings › General; invalid or already-taken combinations are rejected, the X button disables it and the restore button brings the default back.
- Full Mode now opens on the monitor where the mouse is, with a toggle in the Display tab to use a fixed preferred display instead.
- Full Mode fills the selected display's work area and stays locked there: taskbars docked on any edge are respected, dragging and double-click maximize/restore are disabled, and the phantom taskbar button after a Windows boot start is gone.
- Settings polish: the General tab leads the list so the language selector comes first, every control gets an accent-tinted icon tile, helper texts are larger and brighter, toggles read clearly in the ON state with every accent tint, and whole display cards are clickable with the active monitor unmistakable.

### 🇪🇸 Español

- La fecha y hora de Windows están a un clic: nuevas entradas en el menú de la bandeja (Ayuda) y en Configuración abren el diálogo clásico de Fecha y hora de Windows justo donde lo necesitas.
- Un monitor de precisión del reloj mide el desfase contra servidores de hora en red al iniciar y cada 6 horas, muestra el resultado en Configuración › Integración con Windows con un botón Comprobar ahora, y una notificación de Windows avisa de inmediato cuando el reloj del sistema va mal por más de un minuto, antes de que alarmas y campanadas suenen a deshora. Es de solo lectura y sin privilegios, usando primero SNTP con alternativa HTTP automática en redes que bloquean NTP.
- Un atajo de teclado global opcional muestra y oculta el reloj: Alt+Shift+C por defecto, con selector de combinación propia en Configuración › General; las combinaciones inválidas o ya en uso se rechazan, la X lo desactiva y el botón de restaurar devuelve el valor por defecto.
- El Modo Completo se abre ahora en el monitor donde está el ratón, con un interruptor en la pestaña Pantalla para usar en su lugar una pantalla preferida fija.
- El Modo Completo llena el área de trabajo de la pantalla elegida y queda bloqueado ahí: se respetan las barras de tareas ancladas en cualquier borde, se desactivan el arrastre y el maximizar/restaurar con doble clic, y desaparece el botón fantasma de la barra de tareas tras el inicio de Windows.
- Pulido de Configuración: la pestaña General encabeza la lista para que el selector de idioma sea lo primero, cada control recibe una tesela de icono con tinte de acento, los textos de ayuda son más grandes y brillantes, los interruptores se leen con claridad en ON con cualquier tinte de acento, y las tarjetas de pantalla completas son clicables con la pantalla activa inconfundible.

## [1.4.0] - 2026-09-16

### 🇺🇸 English

- The setup wizard asks whether CyberClock should launch automatically at Windows startup, with the option pre-checked; silent and passive installs register the startup entry automatically and the uninstaller always removes it, leaving nothing behind.
- The Start-with-Windows toggle reconciles with the real registry entry at every boot, so what you see is what runs, and installer and app manage the same single HKCU Run entry so no duplicate startup commands ever pile up.
- The built executable is now named CyberClock.exe instead of app.exe, so process lists, shortcuts and startup entries read clean and identifiable.
- Maintenance: the release workflow is hardened so releases always land as drafts, and the missing Status translation label for the Relax scheduler is added in both English and Spanish.

### 🇪🇸 Español

- El asistente de instalación pregunta si CyberClock debe iniciarse automáticamente con Windows, con la opción marcada de antemano; las instalaciones silenciosas y pasivas registran la entrada de inicio automáticamente y el desinstalador siempre la elimina, sin dejar nada atrás.
- El interruptor de inicio con Windows se concilia con la entrada real del registro en cada arranque, así que lo que ves es lo que se ejecuta, y el instalador y la app gestionan la misma única entrada HKCU Run para que nunca se acumulen comandos de inicio duplicados.
- El ejecutable generado se llama ahora CyberClock.exe en lugar de app.exe, así que las listas de procesos, los accesos directos y las entradas de inicio se leen limpias e identificables.
- Mantenimiento: el flujo de releases se refuerza para que las versiones queden siempre como borradores, y se añade la etiqueta de traducción Estado que faltaba en el programador de Relajación, en inglés y español.

## [1.3.0] - 2026-09-12

### 🇺🇸 English

- The Relax module is redesigned around calm, flat surfaces with readable typography and 1px borders, without neon glows or decorative wave bars, so the module feels as quiet as its purpose.
- Pause is now a true pause: audio, session timer, breathing pacer and tips freeze in place, resuming continues exactly where you left off, and the Space key toggles play/pause.
- Ctrl+Click any track card to layer it over the playing one (Rain + Fireplace, Ocean + Space), with layers fading in and out independently, a one-click Shuffle (Zen Flow) joins the transport, and the auto-stop timer fades the audio out gently over the final minute.
- Breathing phases use natural Spanish phrasing (Inhala, Mantén, Exhala) with bilingual polish, and the mindfulness tip rotation is phase-aware with opening, deepening and closing tips following the session's arc.
- If global audio is muted, the Relax view shows a quiet banner with a one-click Enable button, and resuming playback always restores the configured volume.
- Untouched all-zero timer and stopwatch digits rest dimmed until a time is armed or the count starts, and the Clock Name field gains an inline reset icon that restores the default wordmark.
- The tray menu anchors at the tray icon's center, opens beside the icon on vertical (left-edge) taskbars and stays fully inside the taskbar-free work area, and its expandable Help section adds Pin to taskbar, FAQ, Changelog, Website, Donate, About and Check for Update plus a master audio mute toggle with live feedback.

### 🇪🇸 Español

- El módulo de Relajación se rediseña en torno a superficies planas y serenas, con tipografía legible y bordes de 1px, sin brillos neón ni barras de onda decorativas, para que el módulo se sienta tan tranquilo como su propósito.
- La pausa es ahora pausa de verdad: el audio, el temporizador de sesión, el guía de respiración y los consejos se congelan en su sitio, al reanudar continúa exactamente donde lo dejaste y la tecla Espacio alterna reproducir/pausar.
- Ctrl+Clic en cualquier tarjeta de pista la superpone a la que suena (Lluvia + Chimenea, Océano + Espacio), con fundidos de entrada y salida independientes por capa, una acción de Aleatorio (Zen Flow) de un clic se suma al reproductor y el temporizador de auto-parada funde el audio suavemente en el último minuto.
- Las fases de respiración usan frases naturales en español (Inhala, Mantén, Exhala) con pulido bilingüe, y la rotación de consejos de atención plena sigue las fases, con consejos de apertura, profundización y cierre según el arco de la sesión.
- Si el audio global está silenciado, la vista Relajación muestra un aviso discreto con un botón Activar de un clic, y al reanudar la reproducción siempre se restaura el volumen configurado.
- Los dígitos de temporizador y cronómetro en ceros sin tocar descansan atenuados hasta que se arma un tiempo o empieza la cuenta, y el campo Nombre del Reloj gana un icono de restablecer en línea que devuelve la marca por defecto.
- El menú de la bandeja se ancla en el centro del icono de la bandeja, se abre junto a él en barras de tareas verticales (borde izquierdo) y queda dentro del área de trabajo libre de barras, y su sección de Ayuda desplegable suma Anclar a la barra de tareas, FAQ, Changelog, Sitio web, Donar, Acerca de y Buscar actualizaciones, junto a un silenciador maestro de audio con feedback en vivo.

## [1.2.0] - 2026-09-10

### 🇺🇸 English

- A discrete zoom control (50 / 100 / 200 / 400%) for the mini clock lives in the mini context menu, the main settings and the tray menu.
- The zoomed window grows around its visual center and stays fully on screen whatever edge it sits near, and the day-note tooltip stays at native size for readability at every zoom.
- A new expandable Help section in the tray menu gathers Pin icon to taskbar, FAQ, Changelog, Website, Donate, About and Check for Update, and pinning opens Windows taskbar settings straight on the tray-icons page.
- An About modal joins the tray menu with the version, the update flow (check, download, install), an auto-update toggle, copy diagnostics and quick links to the website, GitHub, issues, releases and donations.
- A master audio mute silences every sound source (alarms, chimes and Relax audio) from the tray menu and main settings with live icon and status feedback; alarms never fire while muted and ambient audio fades out smoothly, returning to its exact previous volume on unmute.
- Suite-standard branding: the tray header shows the app icon (colorizing on hover) with the centered name and version.

### 🇪🇸 Español

- Un control discreto de zoom (50 / 100 / 200 / 400%) para el reloj mini vive en el menú contextual del mini, en los ajustes principales y en el menú de la bandeja.
- La ventana ampliada crece alrededor de su centro visual y permanece totalmente en pantalla junto al borde en que esté, y el tooltip de notas del día se mantiene en su tamaño nativo para leerse bien a cualquier zoom.
- Una nueva sección de Ayuda desplegable en el menú de la bandeja reúne Anclar icono a la barra de tareas, FAQ, Changelog, Sitio web, Donar, Acerca de y Buscar actualizaciones, y al anclar se abren los ajustes de la barra de tareas de Windows directamente en la página de iconos de la bandeja.
- Un modal Acerca de se suma al menú de la bandeja con la versión, el flujo de actualización (comprobar, descargar, instalar), un interruptor de auto-actualización, copia de diagnósticos y enlaces rápidos al sitio web, GitHub, issues, releases y donaciones.
- Un silencio maestro de audio apaga toda fuente de sonido (alarmas, campanadas y audio de Relajación) desde el menú de la bandeja y los ajustes principales, con feedback en vivo de icono y estado; las alarmas nunca suenan en silencio y el audio ambiental se funde suavemente, recuperando su volumen exacto al reactivar el sonido.
- Marca estándar de la suite: la cabecera de la bandeja muestra el icono de la app (coloreado al pasar el cursor) con el nombre y la versión centrados.

## [1.1.0] - 2026-09-10

### 🇺🇸 English

- The mini clock comes alive again: every skin's status LED breathes, always visible at a third of the previous idle CPU cost, the time colons blink once per second, and digits render in fixed-width cells so the bar no longer wobbles as digits change.
- Holo Display (2) brings holographic cyan to violet digits with chromatic aberration and HUD corner brackets, and Glass Orb (4) uses real frosted glass tinted by your color theme.
- Neon Circuit (5) glows electric cyan with a visible circuit grid and glowing junction nodes, and Sunset Pulse (7) paints a true dusk gradient with a sun on the horizon plus an optional Real Sun Cycle that follows your local time of day (dawn, day, sunset, night).
- Collapsed single-row skins no longer clip the 12-hour time format, and Sunset Pulse's time font is now Space Grotesk.

### 🇪🇸 Español

- El reloj mini vuelve a vivir: el LED de estado de cada skin respira, siempre visible con un tercio del costo de CPU en reposo anterior, los dos puntos de la hora parpadean una vez por segundo y los dígitos se dibujan en celdas de ancho fijo para que la barra ya no tiemble al cambiar.
- Holo Display (2) trae dígitos holográficos de cian a violeta con aberración cromática y esquinas tipo HUD, y Glass Orb (4) usa cristal esmerilado real teñido por tu tema de color.
- Neon Circuit (5) brilla en cian eléctrico con una rejilla de circuito visible y nodos de unión luminosos, y Sunset Pulse (7) pinta un degradado de atardecer auténtico con un sol en el horizonte más un Ciclo de Sol Real opcional que sigue tu hora local del día (amanecer, día, atardecer, noche).
- Los skins de una fila colapsados ya no recortan el formato de 12 horas, y la fuente de la hora de Sunset Pulse es ahora Space Grotesk.

## [1.0.3] - 2026-06-27

### 🇺🇸 English

- First published CyberClock release: a cyber-neon Windows clock with analog and digital views, calendar day notes, alarms, timer, stopwatch and a Relax module with a desktop mini bar.
- The installer supports both per-user and per-machine installation modes, and installed copies with auto-updates enabled receive updates automatically.

### 🇪🇸 Español

- Primera versión publicada de CyberClock: un reloj Windows cyber-neón con vistas analógica y digital, notas de calendario, alarmas, temporizador, cronómetro y un módulo de Relajación con una mini barra de escritorio.
- El instalador admite los modos de instalación por usuario y por máquina, y las copias instaladas con auto-actualizaciones activadas reciben las actualizaciones automáticamente.
