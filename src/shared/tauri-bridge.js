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
            // Use client coordinates which are more reliable across DPI scaling
            await invoke("open_mini_context_menu", {
                x: Math.round(point.x || 0),
                y: Math.round(point.y || 0),
                screenX: Math.round(point.screenX),
                screenY: Math.round(point.screenY)
            });
        },
        closeMiniContextMenu: async () => {
            await invoke("close_mini_context_menu");
        },
        startDragging: async () => {
            if (!HAS_TAURI) return;
            try {
                const currentWindow = window.__TAURI__.window.getCurrentWindow();
                await currentWindow.startDragging();
            } catch (err) {
                console.warn('startDragging failed:', err);
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
        resetSettings: async () => {
            const res = await invokeOrFallback("reset_settings", undefined, (browserSettings = {}));
            await emit("settings:updated", res);
            return res;
        },

        // ── System ────────────────────────────────────────────────
        setStartup: async (on) => {
            await invoke("set_startup", { on });
        },
        openFileDialog: async () => {
            return await invoke("open_file_dialog");
        },
        getScreens: async () => {
            return await invokeOrFallback("get_screens", undefined, []);
        },

        // ── App info & updates ───────────────────────────────────
        getAppVersion: async () => {
            return await invokeOrFallback("get_app_version", undefined, "dev");
        },
        openTaskbarSettings: async () => {
            // Opens Windows taskbar settings on the tray-icon page
            // (Win10: also navigates to the nested icon-list page).
            if (!HAS_TAURI) return;
            await invoke("open_taskbar_settings");
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
        onUpdateStatus: (cb) => {
            return subscribe("update:status", cb);
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
        onTrayMenuState: (cb) => {
            return subscribe("tray-menu-state", cb);
        },
        onTrayMenuShow: (cb) => {
            return subscribe("tray-menu-show", cb);
        },
        onTrayMenuHide: (cb) => {
            return subscribe("tray-menu-hide", cb);
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
})();
