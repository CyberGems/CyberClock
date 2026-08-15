/**
 * CyberClock — Tauri Frontend Bridge Adapter
 * Replaces Electron contextBridge exposing safe window.cc commands.
 */

(function () {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;
    const { getCurrentWindow } = window.__TAURI__.window;

    let eventListeners = {};

    window.cc = {
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
            await invoke("set_window_size", { width: Math.round(size.width), height: Math.round(size.height) });
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
            try {
                const currentWindow = getCurrentWindow();
                await currentWindow.startDragging();
            } catch (err) {
                console.warn('startDragging failed:', err);
            }
        },

        // ── Settings ──────────────────────────────────────────────
        getSettings: async () => {
            return await invoke("get_settings");
        },
        saveSettings: async (patch) => {
            const current = await invoke("get_settings");
            const updated = Object.assign({}, current, patch);
            const res = await invoke("save_settings", { settings: updated });
            // Notify other windows via Tauri event emit
            const { emit } = window.__TAURI__.event;
            await emit("settings:updated", res);
            return res;
        },
        resetSettings: async () => {
            const res = await invoke("reset_settings");
            const { emit } = window.__TAURI__.event;
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
            return await invoke("get_screens");
        },

        // ── App info & updates ────────────────────────────────────
        getAppVersion: async () => {
            return await invoke("get_app_version");
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
            return listen("update:status", (event) => cb(event.payload));
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

        // ── Events (renderer ← main) ──────────────────────────────
        onInit: (cb) => {
            invoke("get_settings").then(s => cb(s));
        },
        onSettingsUpdated: (cb) => {
            listen("settings:updated", (event) => cb(event.payload));
        },
        onThemeChanged: (cb) => {
            listen("theme:changed", (event) => cb(event.payload));
        },
        onAlarmChime: (cb) => {
            listen("alarm:chime", (event) => cb(event.payload));
        },
        onRelaxTrigger: (cb) => {
            listen("relax:trigger", (event) => cb(event.payload));
        },
        onMiniContextMenu: (cb) => {
            listen("mini:context-menu", (event) => cb(event.payload));
        },
        onMiniContextMenuClosed: (cb) => {
            listen("mini:context-menu-closed", () => cb());
        },
        onMenuState: (cb) => {
            listen("menu:state", (event) => cb(event.payload));
        },
        onMiniMenuAction: (cb) => {
            listen("mini:menu-action", (event) => cb(event.payload));
        },
        onActiveWindow: (cb) => {
            listen("cc:active-window", (event) => cb(event.payload));
        },
        onTrayMenuState: (cb) => {
            listen("tray-menu-state", (event) => cb(event.payload));
        },
        onTrayMenuShow: (cb) => {
            listen("tray-menu-show", () => cb());
        },
        onTrayMenuHide: (cb) => {
            listen("tray-menu-hide", () => cb());
        },

        // ── Cleanup ───────────────────────────────────────────────
        off: (channel) => {
            // Unlisten handles in Tauri
        }
    };
})();