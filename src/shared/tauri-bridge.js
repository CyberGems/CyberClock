/**
 * CyberClock — Tauri Frontend Bridge Adapter
 * Exposes safe window.cc commands to every window.
 *
 * In a browser (no Tauri runtime, e.g. local development), falls back
 * to an in-memory settings store so windows can still be worked on
 * outside the app; invoke/listen become no-ops.
 */

(function () {
    const HAS_TAURI =
        typeof window !== "undefined" &&
        window.__TAURI__ &&
        window.__TAURI__.core &&
        window.__TAURI__.event;

    const invoke = HAS_TAURI ? window.__TAURI__.core.invoke : async () => undefined;
    const listen = HAS_TAURI
        ? window.__TAURI__.event.listen
        : async () => () => { /* unlisten no-op in browser */ };
    const emit = HAS_TAURI ? window.__TAURI__.event.emit : async () => undefined;

    // Browser fallback store (dev only — never used inside the app).
    let browserSettings = null;

    const invokeOrFallback = async (cmd, args, fallback) => {
        if (!HAS_TAURI) return fallback;
        return invoke(cmd, args);
    };

    // Keep unlisten handles so cc.off(channel, cb) can actually detach.
    const listenerRegistry = new Map(); // channel -> Set<unlisten>

    async function subscribe(channel, cb) {
        const unlisten = await listen(channel, (event) => cb(event.payload));
        if (!listenerRegistry.has(channel)) listenerRegistry.set(channel, new Set());
        listenerRegistry.get(channel).add(unlisten);
        return unlisten;
    }

    window.cc = {
        // ── Environment ───────────────────────────────────────────
        isTauri: () => HAS_TAURI,

        // ── Floating stopwatch / timer windows ────────────────────
        spawnFloat: async (kind) => {
            return await invoke("spawn_float", { kind });
        },
        centerOpenWidgets: async () => {
            await invoke("center_open_widgets");
        },
        // ── Window management ─────────────────────────────────────
        openWindow: async (name) => {
            await invoke("open_window", { name });
        },
        hideWindow: async (name) => {
            await invoke("hide_window", { name });
        },
        closeWindow: async () => {
            await invoke("close_window");
        },
        minimizeWindow: async () => {
            await invoke("minimize_window");
        },
        goFull: async () => {
            await invoke("switch_to_full_mode");
        },
        goMini: async () => {
            await invoke("switch_to_mini_mode");
        },
        toggleAlwaysOnTop: async () => {
            return await invoke("toggle_always_on_top");
        },
        getWindowPosition: async () => {
            return await invoke("get_window_position");
        },
        moveWindow: async (pos) => {
            await invoke("move_window", { x: Math.round(pos.x), y: Math.round(pos.y) });
        },
        setWindowSize: async (size) => {
            const args = {
                width: Math.round(size.width),
                height: Math.round(size.height)
            };
            // recenter: zoom-style resizes grow the window around its
            // visual center instead of the top-left anchor (see
            // set_window_size in lib.rs).
            if (size.recenter) args.recenter = true;
            await invoke("set_window_size", args);
        },
        openMiniContextMenu: async (point) => {
            // Use client coordinates which are more reliable across DPI scaling.
            // Returns false when the same caller toggled an open menu closed.
            return await invoke("open_mini_context_menu", {
                x: Math.round(point.x || 0),
                y: Math.round(point.y || 0),
                screenX: Math.round(point.screenX),
                screenY: Math.round(point.screenY)
            });
        },
        onMenuClosed: (cb) => {
            return subscribe("menu:closed", cb);
        },
        closeMiniContextMenu: async () => {
            await invoke("close_mini_context_menu");
        },
        getMenuCaller: async () => {
            return await invoke("get_menu_caller");
        },
        miniMenuReady: async (width, height) => {
            await invoke("mini_menu_ready", {
                width: Number(width) || 270,
                height: Number(height) || 315
            });
        },
        showAboutWindow: async () => {
            await invoke("tray_menu_action", { action: "about" });
        },
        openSettings: async () => {
            await invoke("tray_menu_action", { action: "settings" });
        },
        startDragging: async () => {
            if (!HAS_TAURI) return;
            try {
                const currentWindow = window.__TAURI__.window.getCurrentWindow();
                await currentWindow.startDragging();
                await invoke("clamp_current_window_to_monitors");
            } catch (err) {
                console.warn('startDragging failed:', err);
            }
        },
        clampToMonitors: async () => {
            if (!HAS_TAURI) return;
            try {
                await invoke("clamp_current_window_to_monitors");
            } catch (err) {
                console.warn('clampToMonitors failed:', err);
            }
        },

        // ── Settings ──────────────────────────────────────────────
        getSettings: async () => {
            return await invokeOrFallback("get_settings", undefined, browserSettings || (browserSettings = {}));
        },
        saveSettings: async (patch) => {
            // Server-side partial merge: closes the cross-window
            // read-modify-write race of the old get→assign→save flow.
            const res = await invokeOrFallback("patch_settings", { patch }, null);
            if (res === null) {
                // Browser fallback: local shallow merge per top-level key.
                browserSettings = Object.assign({}, browserSettings, patch);
                return browserSettings;
            }
            // Notify other windows via Tauri event emit
            await emit("settings:updated", res);
            return res;
        },
        snoozeAlarm: async (alarmId, minutes) => {
            if (!HAS_TAURI) return true;
            return await invoke("snooze_alarm", {
                alarmId: String(alarmId || ""),
                minutes: Number(minutes) || 10,
            });
        },
        resetSettings: async () => {
            const res = await invokeOrFallback("reset_settings", undefined, (browserSettings = {}));
            await emit("settings:updated", res);
            return res;
        },

        // ── Backup & Data ─────────────────────────────────────────
        exportBackup: async () => {
            // Opens a save dialog and writes the full settings JSON.
            return await invoke("export_backup");
        },
        importBackup: async () => {
            // Opens a file picker and replaces settings with the backup.
            return await invoke("import_backup");
        },
        openDataFolder: async () => {
            // Opens the app's local storage directory in the file manager.
            if (!HAS_TAURI) return false;
            return await invoke("open_data_folder");
        },

        // ── System ────────────────────────────────────────────────
        setStartup: async (on) => {
            await invoke("set_startup", { on });
        },
        openFileDialog: async (extensions) => {
            return await invoke("open_file_dialog", {
                extensions: Array.isArray(extensions) ? extensions : null,
            });
        },
        getScreens: async () => {
            return await invokeOrFallback("get_screens", undefined, []);
        },

        // ── App info & updates ───────────────────────────────────
        getAppVersion: async () => {
            return await invokeOrFallback("get_app_version", undefined, "dev");
        },
        isPortable: async () => {
            return await invokeOrFallback("is_portable", undefined, false);
        },
        isMsStore: async () => {
            // Compile-time flag from the backend: true only in builds
            // packaged for the Microsoft Store.
            return await invokeOrFallback("is_msstore", undefined, false);
        },
        openTaskbarSettings: async () => {
            // Opens Windows taskbar settings on the tray-icon page
            // (Win10: also navigates to the nested icon-list page).
            if (!HAS_TAURI) return;
            await invoke("open_taskbar_settings");
        },
        openDatetimeProperties: async () => {
            // Opens the classic Windows "Date and Time" dialog
            // (timedate.cpl), like the taskbar clock's context menu.
            if (!HAS_TAURI) return;
            await invoke("open_datetime_properties");
        },
        checkClockAccuracy: async () => {
            // Measures the local clock against a network time server
            // (read-only). Returns the persisted measurement or null
            // when no server was reachable.
            return await invokeOrFallback("check_clock_accuracy", undefined, null);
        },
        getTimeSyncTaskStatus: async () => {
            // Checks if the privileged Windows Scheduled Task is registered.
            return await invokeOrFallback("get_time_sync_task_status", undefined, false);
        },
        setupTimeSyncTask: async () => {
            // Prompts UAC once to register the background time sync scheduled task.
            return await invoke("setup_time_sync_task");
        },
        removeTimeSyncTask: async () => {
            // Prompts UAC once to delete the scheduled task.
            return await invoke("remove_time_sync_task");
        },
        syncSystemClock: async () => {
            // Triggers Windows Time sync and returns the refreshed ClockAccuracy.
            return await invoke("sync_system_clock");
        },
        setHotkey: async (hotkey) => {
            // Registers the global show/hide shortcut. Empty string
            // disables it. Rejects with an error when the combination
            // is invalid or taken by another app.
            return await invoke("set_hotkey", { hotkey });
        },
        onClockAccuracy: (cb) => {
            // Pushed after every automatic or manual check.
            return subscribe("clock:accuracy", cb);
        },
        openExternalUrl: async (url) => {
            // Opens an https/ms-settings URL with the OS default handler.
            if (!HAS_TAURI) {
                window.open(url, "_blank", "noopener,noreferrer");
                return;
            }
            return await invoke("open_external_url", { url });
        },
        checkForUpdates: async () => {
            return await invoke("check_for_updates");
        },
        downloadUpdate: async () => {
            return await invoke("download_update");
        },
        installUpdate: async () => {
            return await invoke("install_update");
        },
        getPendingUpdate: async () => {
            return await invoke("get_pending_update");
        },
        onUpdateStatus: (cb) => {
            return subscribe("update:status", cb);
        },
        onAboutOpened: (cb) => {
            return subscribe("about:opened", cb);
        },

        selectDisplay: async (id) => {
            return await invoke("select_display", { id });
        },
        resetMiniPosition: async () => {
            await invoke("reset_mini_position");
        },
        saveMiniPosition: async () => {
            return await invoke("save_mini_position");
        },
        // Live mini preview while the settings "Modo Mini" tab is open
        setMiniPreview: async (on) => {
            if (!HAS_TAURI) return;
            await invoke("set_mini_preview", { on });
        },

        // ── Menu popup ────────────────────────────────────────────
        menuAction: async (action) => {
            return await invoke("menu_action", { action });
        },
        closeMenuPopup: async () => {
            await invoke("close_mini_context_menu");
        },
        getOpenFloatLabels: async () => {
            return (await invoke("get_open_float_labels")) || [];
        },

        // ── Tray Menu popup (CyberPaste style) ────────────────────
        getTrayMenuState: async () => {
            return await invoke("get_tray_menu_state");
        },
        hideTrayMenu: async () => {
            await invoke("hide_tray_menu");
        },
        trayMenuReady: async (size) => {
            await invoke("tray_menu_ready", { width: size.width, height: size.height });
        },
        trayMenuAction: async (action) => {
            await invoke("tray_menu_action", { action });
        },
        reportRelaxPlaying: async (track) => {
            if (!HAS_TAURI) return;
            await invoke("report_relax_playing", { track });
        },

        // ── Events (renderer ← main) ──────────────────────────────
        onInit: (cb) => {
            if (!HAS_TAURI) {
                // Browser fallback: run with whatever the store has.
                Promise.resolve()
                    .then(() => cb(browserSettings || (browserSettings = {})))
                    .catch((e) => console.error("onInit fallback failed:", e));
                return;
            }
            invoke("get_settings")
                .then((s) => cb(s))
                .catch((e) => console.error("onInit: get_settings failed:", e));
        },
        onSettingsUpdated: (cb) => {
            return subscribe("settings:updated", cb);
        },
        onThemeChanged: (cb) => {
            return subscribe("theme:changed", cb);
        },
        onAlarmChime: (cb) => {
            return subscribe("alarm:chime", cb);
        },
        onAlarmSnoozed: (cb) => {
            return subscribe("alarm:snoozed", cb);
        },
        onVoiceAnnounceTime: (cb) => {
            return subscribe("voice:announce-time", cb);
        },
        // Windows voice. Returns false when the native synthesizer is
        // unavailable so the page can fall back without selecting a
        // WebView2 voice (that path speaks twice).
        speakAnnouncement: async ({ text, voiceName, volume }) => {
            if (!HAS_TAURI) return false;
            try {
                return await invoke("speak_announcement", {
                    text,
                    voiceName: voiceName || "",
                    volume: volume ?? 0.85,
                }) === true;
            } catch (e) {
                console.error("speak_announcement failed:", e);
                return false;
            }
        },
        onRelaxTrigger: (cb) => {
            return subscribe("relax:trigger", cb);
        },
        onMiniContextMenu: (cb) => {
            return subscribe("mini:context-menu", cb);
        },
        onMiniContextMenuClosed: (cb) => {
            return subscribe("mini:context-menu-closed", cb);
        },
        onMenuState: (cb) => {
            return subscribe("menu:state", cb);
        },
        onMiniMenuAction: (cb) => {
            return subscribe("mini:menu-action", cb);
        },
        onTrayRelaxToggle: (cb) => {
            return subscribe("tray:relax-toggle", cb);
        },
        onActiveWindow: (cb) => {
            return subscribe("cc:active-window", cb);
        },
        onMiniLocate: (cb) => {
            return subscribe("mini:locate", cb);
        },
        onTrayMenuState: (cb) => {
            return subscribe("tray-menu-state", cb);
        },
        onTrayMenuShow: (cb) => {
            return subscribe("tray-menu-show", cb);
        },
        onTrayMenuHide: (cb) => {
            return subscribe("tray-menu-hide", cb);
        },
        onCheckUpdatesTrigger: (cb) => {
            return subscribe("about:trigger-check", cb);
        },
        onCloseRequested: (cb) => {
            return subscribe("main:close-requested", cb);
        },

        // ── Cleanup ───────────────────────────────────────────────
        off: async (channel) => {
            const set = listenerRegistry.get(channel);
            if (!set) return;
            for (const unlisten of set) {
                try { await unlisten(); } catch (e) { /* already gone */ }
            }
            listenerRegistry.delete(channel);
        }
    };

    // Ensure edge clamping and drag subclass are active for this window
    if (HAS_TAURI) {
        invoke("clamp_current_window_to_monitors").catch(() => {});
    }

    function applyTooltipPref(cfg) {
        const off = !!(cfg && cfg.showTooltips === false);
        document.documentElement.classList.toggle("cc-tooltips-off", off);
    }
    if (HAS_TAURI) {
        invoke("get_settings").then(applyTooltipPref).catch(() => {});
        subscribe("settings:updated", applyTooltipPref);
    }

    // Suppress native browser / WebView2 context menus across all windows
    if (typeof window !== "undefined") {
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
    }
})();
