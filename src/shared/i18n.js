/**
 * CyberClock — Internationalization (i18n) Engine
 * Reusable singleton window.ccI18n
 */

(function () {
    const LOCALES = {
        en: {
            "relax.sessionTitle": "◈ Session",
            "relax.audioSpectrum": "◈ Audio Spectrum",
            "relax.tipLabel": "Mindfulness Tip",
            "relax.autoStop": "Auto Stop",
            "relax.sessionTime": "Session Time",
            "relax.breathePattern": "Breathing Pattern",
            "relax.nextTip": "Next Tip ➔",
            "relax.complete": "✓ Session Complete",
            "relax.box": "Box 4-4-4-4",
            "relax.relax478": "4-7-8 Pattern",
            "relax.breathe.inhale": "Inhale",
            "relax.breathe.hold": "Hold",
            "relax.breathe.exhale": "Exhale",
            "relax.breathe.start": "Ready",
            "relax.play": "Zen Flow",
            "relax.pause": "Pause",
            "relax.breathe.guide.ready": "Click circle or Zen Flow to start",
            "relax.breathe.guide.inhale": "Breathe in deeply through your nose",
            "relax.breathe.guide.hold": "Hold your breath, stay still",
            "relax.breathe.guide.exhale": "Exhale slowly through your mouth",
            "relax.startPrompt": "Start a track to begin your session.",
            "relax.pauseZenFlow": "Pause Zen Flow",
            "relax.pauseTrack": "Pause {track}",
            "relax.tooltip.pauseZenFlow": "Pause continuous playlist (Zen Flow)",
            "relax.tooltip.pauseTrack": "Pause {track}",
            "relax.track.night": "Night",
            "relax.track.night.desc": "Calm night ambience",
            "relax.track.forest": "Forest",
            "relax.track.forest.desc": "Birds & wind",
            "relax.track.space": "Outer Space",
            "relax.track.space.desc": "Cosmic drones",
            "relax.track.ocean": "Ocean",
            "relax.track.ocean.desc": "Rolling waves",
            "relax.track.rain": "Rain",
            "relax.track.rain.desc": "Steady rainfall",
            "relax.track.fireplace": "Fireplace",
            "relax.track.fireplace.desc": "Warm crackling hearth",
            "relax.tooltip.play": "Activate continuous playlist mode (Zen Flow)",
            "relax.tooltip.stop": "Stop playback and reset to Zen Flow",
            "relax.tooltip.breatheCircle": "Click to toggle playback and breathing guide",
            "relax.tooltip.nextTip": "Show next mindfulness tip",
            "relax.tooltip.tcard": "Play this track in loop",
            "relax.tooltip.vol": "Adjust relaxation volume",
            "relax.tooltip.ast.off": "Disable auto-stop timer",
            "relax.tooltip.ast.val": "Set auto-stop timer duration",
            "relax.tooltip.scheduler": "Schedule automatic playback times",

            "settings.langTitle": "Language",
            "settings.langAuto": "System default",
            "settings.langEn": "English",
            "settings.langEs": "Español",

            // Tips organized by phase and track
            "tips.opening.default": [
                "Close your eyes and focus on each breath.",
                "Allow your shoulders to drop and relax.",
                "Feel the contact between your body and the chair.",
                "Let go of any expectations for this session."
            ],
            "tips.opening.night": [
                "Watch the glowing stars in your mind. Calm your thoughts.",
                "Prepare to drift into a quiet, calm night."
            ],
            "tips.opening.forest": [
                "Imagine tree roots grounding you deep into the earth.",
                "Breathe in the fresh, clean forest air."
            ],
            "tips.opening.space": [
                "Float gently in the quiet expanse of the cosmos.",
                "Leave all weight behind as you enter weightlessness."
            ],
            "tips.opening.ocean": [
                "Let your breath rise and fall with the gentle tides.",
                "Listen to the water welcoming you to this moment."
            ],
            "tips.opening.rain": [
                "Listen to the steady rain washing away external noise.",
                "Let the rain clear your mind of today's clutter."
            ],
            "tips.opening.fireplace": [
                "Feel the comforting warmth of the crackling fire.",
                "Gather your thoughts around the peaceful hearth."
            ],

            "tips.deepening.default": [
                "Let thoughts pass like clouds — observe, don't engage.",
                "Scan your body from head to toe. Release tension.",
                "Count your exhales from 1 to 10, then start again.",
                "If your mind wanders, gently bring it back to your breath."
            ],
            "tips.deepening.night": [
                "Find absolute stillness in the deep quiet of the dark.",
                "Let the nocturnal peace envelop your consciousness."
            ],
            "tips.deepening.forest": [
                "Feel the ancient, calm energy of the woods surrounding you.",
                "Listen to the rustle of leaves. Sync your breath to it."
            ],
            "tips.deepening.space": [
                "Let go of gravity completely. Rest in the void.",
                "In the cosmic silence, let your internal chatter dissolve."
            ],
            "tips.deepening.ocean": [
                "Rest in the vast depth of the ocean's calm.",
                "Visualize the waves washing away your worries."
            ],
            "tips.deepening.rain": [
                "Sink deeper into relaxation with each sound of rain.",
                "Imagine tension draining away like water."
            ],
            "tips.deepening.fireplace": [
                "Watch the dancing flames. Let your thoughts melt away.",
                "Feel the cozy shelter keeping you safe from the cold."
            ],

            "tips.closing.default": [
                "Notice 5 things you can hear right now.",
                "Place a hand on your chest. Feel it rise and fall.",
                "Gently bring your awareness back to the room.",
                "Take this peaceful feeling with you as you move forward."
            ],
            "tips.closing.night": [
                "Prepare your mind for a deep, restful sleep.",
                "Rest now. The night is watching over you."
            ],
            "tips.closing.forest": [
                "Carry the grounding peace of the forest into your day.",
                "Slowly start to wiggle your toes and fingers."
            ],
            "tips.closing.space": [
                "Return gently from the stars, carrying the cosmic peace.",
                "Feel the physical weight of your body returning."
            ],
            "tips.closing.ocean": [
                "The tide has settled. Prepare to return to your day.",
                "Feel refreshed, like a gentle wave washing over you."
            ],
            "tips.closing.rain": [
                "The rain has stopped in your mind. Feel clean and renewed.",
                "Breathe deeply, feeling refreshed."
            ],
            "tips.closing.fireplace": [
                "The embers are warm and safe. Keep this comfort in your heart.",
                "Gently stretch your body as the fire rests."
            ],

            // Calendar
            "calendar.label": "◈ Calendar",
            "calendar.today": "Today",
            "calendar.upcoming": "◈ Upcoming",
            "calendar.todayPanel": "◈ Today",
            "calendar.noNotes": "No notes yet — click any day to add one.",
            "calendar.noNotesTip": "Click any day in the calendar to attach a note. The first line will appear as a preview in your agenda.",
            "calendar.notePlaceholder": "Write a note for this day…",
            "calendar.save": "Save",
            "calendar.delete": "Delete",
            "calendar.note": "Note",
            "calendar.stat.dayOfYear": "Day of year",
            "calendar.stat.week": "ISO week",
            "calendar.stat.daysLeftYear": "Days left in year",
            "calendar.stat.daysLeftMonth": "Left in month",
            "calendar.stat.moon": "Moon phase",
            "mini.tooltip.aot": "Toggle Always on Top",
            "mini.tooltip.full": "Full mode",
            "mini.tip.todaysNote": "Today's note",
            "mini.tip.upcoming": "upcoming",
            "calendar.confirmDeleteTitle": "Confirm Deletion",
            "calendar.confirmDeleteMsg": "Are you sure you want to delete this event?",
            "calendar.cancel": "Cancel",
            "menu.miniMode": "Mini Mode",
            "menu.home": "Home",
            "menu.timer": "Timer",
            "menu.stopwatch": "Stopwatch",
            "menu.relax": "Relax",
            "menu.alwaysOnTop": "Always on Top",
            "menu.settings": "Settings",
            "menu.close": "Close",

            // Settings modal - Tabs
            "settings.tab.appearance": "Appearance",
            "settings.tab.alarms": "Alarms",
            "settings.tab.general": "General",
            "settings.tab.about": "About",
            "settings.tab.display": "Display",
            "settings.tab.mini": "Mini Mode",

            // Settings modal - Appearance
            "settings.appearance.themeTitle": "Theme / Skin",
            "settings.appearance.theme.cyberBlue": "Cyber Blue",
            "settings.appearance.theme.forestMist": "Forest Mist",
            "settings.appearance.theme.twilightHaze": "Twilight Haze",
            "settings.appearance.theme.warmEmber": "Warm Ember",
            "settings.appearance.theme.arcticIce": "Arctic Ice",
            "settings.appearance.clockDisplay": "Clock Display",
            "settings.appearance.timeFormat": "Time Format",
            "settings.appearance.showSeconds": "Show Seconds",

            // Settings modal - Alarms
            "settings.alarms.volume": "Alarm Volume",
            "settings.alarms.playFrom": "Play sound from",
            "settings.alarms.playTo": "to",
            "settings.alarms.playOnly": "only",
            "settings.alarms.topOfHour": "Top of the hour",
            "settings.alarms.halfHour": "Half hour",
            "settings.alarms.quarterHour": "Quarter hour",
            "settings.alarms.enable": "Enable",
            "settings.alarms.sound": "Sound",
            "settings.alarms.test": "Test",
            "settings.alarms.custom": "Custom…",
            "settings.alarms.sound.crystal": "Crystal Bell",
            "settings.alarms.sound.digital": "Soft Chime",
            "settings.alarms.sound.neon": "Neon Arp",
            "settings.alarms.sound.zen": "Zen Gong",
            "settings.alarms.sound.cyber": "Aurora",
            "settings.alarms.sound.music": "Music Box",

            // Settings modal - General
            "settings.general.behavior": "Behavior",
            "settings.general.startWithWindows": "Start with Windows",
            "settings.general.launchAtLogin": "Launch at login",
            "settings.general.startInMini": "Start in Mini Mode",
            "settings.general.launchCompact": "Launch in compact view",
            "settings.general.relaxVolume": "Relaxation Volume",
            "settings.general.reset": "Factory Reset",
            "settings.general.resetDesc": "Restore all settings to default values",
            "settings.general.resetBtn": "Reset to Defaults",
            "settings.general.resetConfirmTitle": "Reset Settings?",
            "settings.general.resetConfirmMsg": "Are you sure you want to restore all settings to factory defaults? Your preferences will be reset.",
            "settings.general.about": "About",
            "settings.general.aboutSub": "CyberGems © 2026 · Premium Cyber-Neon Clock for Windows",

            "about.version": "Version {version}",
            "about.maintenance": "Maintenance",
            "about.autoUpdates": "Auto-updates",
            "about.checkUpdates": "Check Updates",
            "about.downloadBtn": "Download",
            "about.installBtn": "Install & Restart",
            "about.statuses.checking": "Checking for updates…",
            "about.statuses.latest": "You are on the latest version.",
            "about.statuses.available": "Update available — click Download.",
            "about.statuses.downloaded": "Update ready — click Install & Restart.",
            "about.statuses.downloading": "Downloading… {percent}%",
            "about.statuses.error": "Update check failed",

            // Settings modal - Display
            "settings.display.multiMonitor": "Multi-Monitor Support",
            "settings.display.desc1": "CyberClock fills your primary display's work area, respecting the taskbar at all times.",
            "settings.display.desc2": "Mini Mode — drag the bar to any monitor; position is remembered.",
            "settings.display.desc3": "Display changes are detected automatically and the window repositions itself.",
            "settings.display.primary": "PRIMARY",
            "settings.display.active": "ACTIVE",
            "settings.display.inUse": "✓ IN USE",
            "settings.display.moveHere": "⊞ Move Here",
            "settings.display.error": "✕ Error",

            // Settings modal - Mini Mode
            "settings.mini.designMode": "Design Mode",
            "settings.mini.transparency": "Transparency",
            "settings.mini.bg": "Background",
            "settings.mini.content": "Content",
            "settings.mini.posBehavior": "Position & Behavior",
            "settings.mini.aot": "Always on Top",
            "settings.mini.aotDesc": "Float above all windows",
            "settings.mini.lockPos": "Lock Position",
            "settings.mini.lockDesc": "Prevent dragging",
            "settings.mini.crtOverlay": "CRT Overlay",
            "settings.mini.scanlines": "Scanlines",
            "settings.mini.scanlinesDesc": "Mini mode only",
            "settings.mini.collapseDate": "Collapse Date",
            "settings.mini.collapseDateDesc": "Show date only on hover",
            "menu.collapseDate": "Collapse Date",
            "tray.show": "Show Clock",
            "tray.hide": "Hide Clock",
            "tray.fullMode": "Full Mode",
            "tray.miniMode": "Mini Mode",
            "tray.timer": "Timer",
            "tray.stopwatch": "Stopwatch",
            "tray.relax": "Relax",
            "tray.settings": "Settings...",
            "tray.quit": "Exit",
            "tray.updateAvailable": "Update available"
        },
        es: {
            "relax.sessionTitle": "◈ Sesión",
            "relax.audioSpectrum": "◈ Espectro de Audio",
            "relax.tipLabel": "Consejo de Mindfulness",
            "relax.autoStop": "Parada Automática",
            "relax.sessionTime": "Tiempo de Sesión",
            "relax.breathePattern": "Pauta de Respiración",
            "relax.nextTip": "Siguiente ➔",
            "relax.complete": "✓ Sesión Finalizada",
            "relax.box": "Caja 4-4-4-4",
            "relax.relax478": "Pauta 4-7-8",
            "relax.breathe.inhale": "Inhala",
            "relax.breathe.hold": "Sostén",
            "relax.breathe.exhale": "Exhala",
            "relax.breathe.start": "Listo",
            "relax.play": "Flujo Zen",
            "relax.pause": "Pausa",
            "relax.breathe.guide.ready": "Haz clic en el círculo o Flujo Zen para iniciar",
            "relax.breathe.guide.inhale": "Inhala profundamente por la nariz",
            "relax.breathe.guide.hold": "Mantén el aire, permanece inmóvil",
            "relax.breathe.guide.exhale": "Exhala lentamente por la boca",
            "relax.startPrompt": "Inicia una pista para comenzar tu sesión.",
            "relax.pauseZenFlow": "Pausar Flujo Zen",
            "relax.pauseTrack": "Pausar {track}",
            "relax.tooltip.pauseZenFlow": "Pausar lista de reproducción (Flujo Zen)",
            "relax.tooltip.pauseTrack": "Pausar {track}",
            "relax.track.night": "Noche",
            "relax.track.night.desc": "Ambiente de noche tranquila",
            "relax.track.forest": "Bosque",
            "relax.track.forest.desc": "Aves y viento",
            "relax.track.space": "Espacio Exterior",
            "relax.track.space.desc": "Drones cósmicos",
            "relax.track.ocean": "Océano",
            "relax.track.ocean.desc": "Olas constantes",
            "relax.track.rain": "Lluvia",
            "relax.track.rain.desc": "Lluvia constante",
            "relax.track.fireplace": "Chimenea",
            "relax.track.fireplace.desc": "Fuego acogedor",
            "relax.tooltip.play": "Activar modo lista de reproducción continua (Flujo Zen)",
            "relax.tooltip.stop": "Detener reproducción y restablecer a Flujo Zen",
            "relax.tooltip.breatheCircle": "Haz clic para alternar la reproducción y guía de respiración",
            "relax.tooltip.nextTip": "Mostrar siguiente consejo de mindfulness",
            "relax.tooltip.tcard": "Reproducir esta pista en bucle",
            "relax.tooltip.vol": "Ajustar el volumen de la relajación",
            "relax.tooltip.ast.off": "Desactivar temporizador de parada automática",
            "relax.tooltip.ast.val": "Configurar duración de parada automática",
            "relax.tooltip.scheduler": "Programar horarios de reproducción automática",

            "settings.langTitle": "Idioma",
            "settings.langAuto": "Predeterminado",
            "settings.langEn": "English",
            "settings.langEs": "Español",

            // Tips organized by phase and track
            "tips.opening.default": [
                "Cierra los ojos y concéntrate en cada respiración.",
                "Deja que tus hombros caigan y se relajen.",
                "Siente el contacto entre tu cuerpo y la silla.",
                "Suelta cualquier expectativa para esta sesión."
            ],
            "tips.opening.night": [
                "Observa las estrellas brillantes en tu mente. Calma tus pensamientos.",
                "Prepárate para sumergirte en una noche tranquila."
            ],
            "tips.opening.forest": [
                "Imagina raíces de árboles que te conectan a la tierra.",
                "Inhala el aire fresco y puro del bosque."
            ],
            "tips.opening.space": [
                "Flota suavemente en la tranquila inmensidad del cosmos.",
                "Deja atrás todo el peso al entrar en ingravidez."
            ],
            "tips.opening.ocean": [
                "Deja que tu respiración suba y baje con las olas.",
                "Escucha el agua dándote la bienvenida a este momento."
            ],
            "tips.opening.rain": [
                "Escucha la lluvia constante limpiando el ruido externo.",
                "Deja que la lluvia despeje el desorden mental del día."
            ],
            "tips.opening.fireplace": [
                "Siente el cálido resplandor del fuego crepitante.",
                "Reúne tus pensamientos en torno al hogar tranquilo."
            ],

            "tips.deepening.default": [
                "Deja pasar los pensamientos como nubes: observa, no te involucres.",
                "Recorre tu cuerpo de la cabeza a los pies. Libera tensión.",
                "Cuenta tus exhalaciones del 1 al 10, luego comienza de nuevo.",
                "Si tu mente se distrae, regresa suavemente a la respiración."
            ],
            "tips.deepening.night": [
                "Encuentra quietud absoluta en el silencio profundo de la noche.",
                "Deja que la paz nocturna envuelva tu conciencia."
            ],
            "tips.deepening.forest": [
                "Siente la energía tranquila y ancestral del bosque.",
                "Escucha el susurro de las hojas. Sincroniza tu respiración."
            ],
            "tips.deepening.space": [
                "Suelta la gravedad por completo. Descansa en el vacío.",
                "En el silencio cósmico, deja que tu charla interna se disuelva."
            ],
            "tips.deepening.ocean": [
                "Descansa en la vasta profundidad de la calma del océano.",
                "Visualiza las olas llevándose tus preocupaciones."
            ],
            "tips.deepening.rain": [
                "Sumérgete más en la relajación con cada sonido de lluvia.",
                "Imagina que la tensión se drena como el agua."
            ],
            "tips.deepening.fireplace": [
                "Observa las llamas danzantes. Deja que tus pensamientos se fundan.",
                "Siente el refugio acogedor manteniéndote a salvo del frío."
            ],

            "tips.closing.default": [
                "Nota 5 cosas que puedes escuchar ahora mismo.",
                "Coloca una mano en tu pecho. Siente cómo sube y baja.",
                "Lleva suavemente tu atención de regreso a la habitación.",
                "Lleva este sentimiento de paz contigo al continuar con tu día."
            ],
            "tips.closing.night": [
                "Prepara tu mente para un sueño profundo y reparador.",
                "Descansa ahora. La noche vela por ti."
            ],
            "tips.closing.forest": [
                "Lleva contigo la paz enraizadora del bosque a tu día.",
                "Comienza suavemente a mover los dedos de pies y manos."
            ],
            "tips.closing.space": [
                "Regresa de las estrellas, trayendo la paz cósmica.",
                "Siente cómo regresa el peso físico de tu cuerpo."
            ],
            "tips.closing.ocean": [
                "La marea se ha calmado. Prepárate para volver a tu día.",
                "Siéntete renovado, como una suave ola acariciándote."
            ],
            "tips.closing.rain": [
                "La lluvia ha parado en tu mente. Siéntete limpio y renovado.",
                "Respira hondo, sintiéndote renovado."
            ],
            "tips.closing.fireplace": [
                "Las brasas están cálidas y seguras. Guarda este confort en tu corazón.",
                "Estira suavemente tu cuerpo mientras el fuego descansa."
            ],

            // Calendar
            "calendar.label": "◈ Calendario",
            "calendar.today": "Hoy",
            "calendar.upcoming": "◈ Próximos",
            "calendar.todayPanel": "◈ Hoy",
            "calendar.noNotes": "Sin notas aún — haz clic en un día para añadir una.",
            "calendar.noNotesTip": "Haz clic en cualquier día del calendario para adjuntar una nota. La primera línea aparecerá como vista previa en tu agenda.",
            "calendar.notePlaceholder": "Escribe una nota para este día…",
            "calendar.save": "Guardar",
            "calendar.delete": "Eliminar",
            "calendar.note": "Nota",
            "calendar.stat.dayOfYear": "Día del año",
            "calendar.stat.week": "Semana ISO",
            "calendar.stat.daysLeftYear": "Días restantes del año",
            "calendar.stat.daysLeftMonth": "Restantes del mes",
            "calendar.stat.moon": "Fase lunar",
            "mini.tooltip.aot": "Alternar siempre visible",
            "mini.tooltip.full": "Modo completo",
            "mini.tip.todaysNote": "Nota de hoy",
            "mini.tip.upcoming": "próximos",
            "calendar.confirmDeleteTitle": "Confirmar eliminación",
            "calendar.confirmDeleteMsg": "¿Estás seguro de que deseas eliminar este evento?",
            "calendar.cancel": "Cancelar",
            "menu.miniMode": "Modo Mini",
            "menu.home": "Inicio",
            "menu.timer": "Temporizador",
            "menu.stopwatch": "Cronómetro",
            "menu.relax": "Relajación",
            "menu.alwaysOnTop": "Siempre visible",
            "menu.settings": "Configuración",
            "menu.close": "Cerrar",

            // Settings modal - Tabs
            "settings.tab.appearance": "Apariencia",
            "settings.tab.alarms": "Alarmas",
            "settings.tab.general": "General",
            "settings.tab.about": "Acerca de",
            "settings.tab.display": "Pantalla",
            "settings.tab.mini": "Modo Mini",

            // Settings modal - Appearance
            "settings.appearance.themeTitle": "Tema / Diseño",
            "settings.appearance.theme.cyberBlue": "Cyber Blue",
            "settings.appearance.theme.forestMist": "Forest Mist",
            "settings.appearance.theme.twilightHaze": "Twilight Haze",
            "settings.appearance.theme.warmEmber": "Warm Ember",
            "settings.appearance.theme.arcticIce": "Arctic Ice",
            "settings.appearance.clockDisplay": "Pantalla de Reloj",
            "settings.appearance.timeFormat": "Formato de Hora",
            "settings.appearance.showSeconds": "Mostrar Segundos",

            // Settings modal - Alarms
            "settings.alarms.volume": "Volumen de Alarma",
            "settings.alarms.playFrom": "Reproducir sonido de",
            "settings.alarms.playTo": "a",
            "settings.alarms.playOnly": "solamente",
            "settings.alarms.topOfHour": "En punto",
            "settings.alarms.halfHour": "Media hora",
            "settings.alarms.quarterHour": "Cuarto de hora",
            "settings.alarms.enable": "Habilitar",
            "settings.alarms.sound": "Sonido",
            "settings.alarms.test": "Probar",
            "settings.alarms.custom": "Personalizado…",
            "settings.alarms.sound.crystal": "Campana de Cristal",
            "settings.alarms.sound.digital": "Timbre Suave",
            "settings.alarms.sound.neon": "Arpegio Neón",
            "settings.alarms.sound.zen": "Gong Zen",
            "settings.alarms.sound.cyber": "Aurora",
            "settings.alarms.sound.music": "Caja de Música",

            // Settings modal - General
            "settings.general.behavior": "Comportamiento",
            "settings.general.startWithWindows": "Iniciar con Windows",
            "settings.general.launchAtLogin": "Iniciar al iniciar sesión",
            "settings.general.startInMini": "Iniciar en Modo Mini",
            "settings.general.launchCompact": "Iniciar en vista compacta",
            "settings.general.relaxVolume": "Volumen de Relajación",
            "settings.general.reset": "Ajustes de Fábrica",
            "settings.general.resetDesc": "Restablecer todas las opciones por defecto",
            "settings.general.resetBtn": "Restablecer Ajustes",
            "settings.general.resetConfirmTitle": "¿Restablecer Ajustes?",
            "settings.general.resetConfirmMsg": "¿Estás seguro de que deseas restablecer todos los ajustes de fábrica? Se reiniciarán todas tus preferencias.",
            "settings.general.about": "Acerca de",
            "settings.general.aboutSub": "CyberGems © 2026 · Reloj Cyber-Neón Premium para Windows",

            "about.version": "Versión {version}",
            "about.maintenance": "Mantenimiento",
            "about.autoUpdates": "Actualizaciones automáticas",
            "about.checkUpdates": "Buscar actualizaciones",
            "about.downloadBtn": "Descargar",
            "about.installBtn": "Instalar y reiniciar",
            "about.statuses.checking": "Buscando actualizaciones…",
            "about.statuses.latest": "Tienes la última versión.",
            "about.statuses.available": "Actualización disponible — pulsa Descargar.",
            "about.statuses.downloaded": "Actualización lista — pulsa Instalar y reiniciar.",
            "about.statuses.downloading": "Descargando… {percent}%",
            "about.statuses.error": "Error al buscar actualizaciones",

            // Settings modal - Display
            "settings.display.multiMonitor": "Soporte Multi-Monitor",
            "settings.display.desc1": "CyberClock llena el área de trabajo de tu pantalla principal, respetando la barra de tareas en todo momento.",
            "settings.display.desc2": "Modo Mini — arrastra la barra a cualquier pantalla; se recordará la posición.",
            "settings.display.desc3": "Los cambios de pantalla se detectan automáticamente y la ventana se reposiciona sola.",
            "settings.display.primary": "PRIMARIA",
            "settings.display.active": "ACTIVA",
            "settings.display.inUse": "✓ EN USO",
            "settings.display.moveHere": "⊞ Mover Aquí",
            "settings.display.error": "✕ Error",

            // Settings modal - Mini Mode
            "settings.mini.designMode": "Modo de Diseño",
            "settings.mini.transparency": "Transparencia",
            "settings.mini.bg": "Fondo",
            "settings.mini.content": "Contenido",
            "settings.mini.posBehavior": "Posición y Comportamiento",
            "settings.mini.aot": "Siempre Visible",
            "settings.mini.aotDesc": "Flotar sobre todas las ventanas",
            "settings.mini.lockPos": "Bloquear Posición",
            "settings.mini.lockDesc": "Evitar arrastre",
            "settings.mini.crtOverlay": "Superposición CRT",
            "settings.mini.scanlines": "Líneas de exploración",
            "settings.mini.scanlinesDesc": "Solo modo mini",
            "settings.mini.collapseDate": "Colapsar Fecha",
            "settings.mini.collapseDateDesc": "Mostrar fecha solo al pasar el cursor",
            "menu.collapseDate": "Colapsar Fecha",
            "tray.show": "Mostrar Reloj",
            "tray.hide": "Ocultar Reloj",
            "tray.fullMode": "Modo Completo",
            "tray.miniMode": "Modo Mini",
            "tray.timer": "Temporizador",
            "tray.stopwatch": "Cronómetro",
            "tray.relax": "Relajación",
            "tray.settings": "Configuración...",
            "tray.quit": "Salir",
            "tray.updateAvailable": "Actualización disponible"
        }
    };

    let currentLang = "auto";
    let listeners = [];

    function detectDefault() {
        const lang = navigator.language || "";
        return lang.startsWith("es") ? "es" : "en";
    }

    function getEffectiveLang() {
        return currentLang === "auto" ? detectDefault() : currentLang;
    }

    window.ccI18n = {
        LOCALES,
        
        detectDefault,
        
        setLang: (lang) => {
            if (lang !== "auto" && lang !== "en" && lang !== "es") {
                lang = "auto";
            }
            currentLang = lang;
            const effective = getEffectiveLang();
            
            // Notify listeners
            listeners.forEach(fn => {
                try { fn(effective, lang); } catch (e) { console.error(e); }
            });
        },
        
        getLang: () => currentLang,
        
        getEffectiveLang,
        
        t: (key, vars = {}) => {
            const lang = getEffectiveLang();
            
            // Lookup key, fallback to english dictionary, then to the key itself
            let value = LOCALES[lang]?.[key] ?? LOCALES["en"]?.[key] ?? key;
            
            if (Array.isArray(value)) {
                return value;
            }

            // String interpolation of {variable}
            if (typeof value === "string") {
                Object.keys(vars).forEach(vKey => {
                    value = value.replace(new RegExp(`{${vKey}}`, 'g'), vars[vKey]);
                });
            }
            return value;
        },
        
        apply: function (root = document) {
            // Translate textContent
            root.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                el.textContent = this.t(key);
            });
            
            // Translate attributes e.g. data-i18n-attr="placeholder:settings.searchPlaceholder"
            root.querySelectorAll('[data-i18n-attr]').forEach(el => {
                const spec = el.getAttribute('data-i18n-attr');
                spec.split(',').forEach(pair => {
                    const parts = pair.split(':');
                    const attr = parts[0]?.trim();
                    const key = parts.slice(1).join(':')?.trim();
                    if (attr && key) {
                        el.setAttribute(attr, this.t(key));
                    }
                });
            });
        },
        
        onChange: (fn) => {
            if (typeof fn === "function") {
                listeners.push(fn);
            }
        }
    };
})();
