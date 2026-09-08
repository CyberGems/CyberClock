    let currentMenuState = null;
    const rootEl = document.getElementById("tray-root");

    function reportSize() {
        if (!rootEl) return;
        const r = rootEl.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        if (window.cc && window.cc.trayMenuReady) {
            window.cc.trayMenuReady({ width: r.width, height: r.height });
        }
    }

    function applyTheme(theme) {
        document.body.dataset.theme = theme || "arctic-ice";
    }

    function renderState(state) {
        if (!state) return;
        currentMenuState = state;

        // Theme
        if (state.theme) applyTheme(state.theme);

        // Language
        if (window.ccI18n) {
            window.ccI18n.setLang(state.language || "auto");
        }

        // Version
        const verEl = document.getElementById("app-ver");
        if (verEl && state.version) {
            verEl.textContent = "v" + state.version;
        }

        // Update badge
        const badgeEl = document.getElementById("update-badge");
        if (badgeEl) {
            badgeEl.style.display = state.update_available ? "inline-block" : "none";
        }

        // Visibility Item
        const lblVis = document.getElementById("lbl-visibility");
        const icoVis = document.getElementById("ico-visibility");
        const isVis = state.is_visible;
        if (lblVis) {
            lblVis.textContent = window.ccI18n ? window.ccI18n.t(isVis ? "tray.hide" : "tray.show") : (isVis ? "Hide Clock" : "Show Clock");
        }
        if (icoVis) {
            icoVis.setAttribute("data-ico", isVis ? "eye-off" : "eye");
        }

        // Mode Item
        const isFull = state.window_mode === "full";
        const lblMode = document.getElementById("lbl-mode");
        const icoMode = document.getElementById("ico-mode");
        if (lblMode) {
            lblMode.textContent = window.ccI18n ? window.ccI18n.t(isFull ? "tray.miniMode" : "tray.fullMode") : (isFull ? "Mini Mode" : "Full Mode");
        }
        if (icoMode) {
            icoMode.setAttribute("data-ico", isFull ? "compact" : "expand");
        }

        // Features
        const lblTimer = document.getElementById("lbl-timer");
        if (lblTimer) lblTimer.textContent = window.ccI18n ? window.ccI18n.t("tray.timer") : "Timer";
        const lblSw = document.getElementById("lbl-stopwatch");
        if (lblSw) lblSw.textContent = window.ccI18n ? window.ccI18n.t("tray.stopwatch") : "Stopwatch";
        const lblRelax = document.getElementById("lbl-relax");
        if (lblRelax) lblRelax.textContent = window.ccI18n ? window.ccI18n.t("tray.relax") : "Relax";
        const lblSettings = document.getElementById("lbl-settings");
        if (lblSettings) lblSettings.textContent = window.ccI18n ? window.ccI18n.t("tray.settings") : "Settings...";
        const lblQuit = document.getElementById("lbl-quit");
        if (lblQuit) lblQuit.textContent = window.ccI18n ? window.ccI18n.t("tray.quit") : "Exit";

        // Re-render icons if data-ico changed
        if (window.ccIcons) {
            window.ccIcons.replaceIcons();
        }
    }

    function runAction(action) {
        if (window.cc && window.cc.trayMenuAction) {
            window.cc.trayMenuAction(action);
        }
    }

    // Click handlers for tray items & header
    document.querySelectorAll(".tray-item, .tray-header").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (!action) return;
            if (action === "toggle_mode") {
                const targetMode = currentMenuState && currentMenuState.window_mode === "full" ? "mini" : "full";
                runAction(targetMode);
            } else {
                runAction(action);
            }
        });
    });

    // Prevent context menu
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // Dismiss on Escape
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (window.cc && window.cc.hideTrayMenu) {
                window.cc.hideTrayMenu();
            }
        }
    });

    // Dismiss on blur
    window.addEventListener("blur", () => {
        setTimeout(() => {
            if (window.cc && window.cc.hideTrayMenu) {
                window.cc.hideTrayMenu();
            }
        }, 100);
    });

    // Tauri event subscriptions
    if (window.cc) {
        if (window.cc.onTrayMenuState) {
            window.cc.onTrayMenuState((state) => {
                renderState(state);
            });
        }

        if (window.cc.onTrayMenuShow) {
            window.cc.onTrayMenuShow(() => {
                if (window.cc.getTrayMenuState) {
                    window.cc.getTrayMenuState().then(renderState).catch(console.error);
                }
                requestAnimationFrame(() => {
                    requestAnimationFrame(reportSize);
                });
            });
        }

        if (window.cc.getTrayMenuState) {
            window.cc.getTrayMenuState().then((state) => {
                renderState(state);
                requestAnimationFrame(() => {
                    requestAnimationFrame(reportSize);
                });
            }).catch(console.error);
        }
    }