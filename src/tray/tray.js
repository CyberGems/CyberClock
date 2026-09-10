    let currentMenuState = null;
    const rootEl = document.getElementById("tray-root");

    // Discrete zoom stops for the mini clock (slider index → factor).
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    // Debounced settings save for slider drags: each save broadcasts the
    // full settings object to every window, so coalesce the burst of
    // `input` events into one trailing save.
    let zoomSaveTimer = null;
    function saveZoomDebounced(factor) {
        clearTimeout(zoomSaveTimer);
        zoomSaveTimer = setTimeout(() => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniZoom: factor });
            }
        }, 120);
    }

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

        // Mini zoom (discrete steps, 100% default)
        const lblZoom = document.getElementById("lbl-zoom");
        if (lblZoom) lblZoom.textContent = window.ccI18n ? window.ccI18n.t("settings.mini.zoom") : "Zoom";
        const zoomSlider = document.getElementById("tray-zoom");
        const zoomVal = document.getElementById("tray-zoom-val");
        if (zoomSlider) {
            const idx = ZOOM_STEPS.indexOf(state.mini_zoom ?? 1);
            zoomSlider.value = String(idx >= 0 ? idx : 1);
        }
        if (zoomVal) {
            zoomVal.textContent = Math.round((state.mini_zoom ?? 1) * 100) + "%";
        }

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

    // Zoom slider input (live label, debounced save)
    const trayZoom = document.getElementById("tray-zoom");
    if (trayZoom) {
        trayZoom.addEventListener("input", (e) => {
            const idx = parseInt(e.target.value);
            const factor = ZOOM_STEPS[idx] ?? 1;
            const zoomVal = document.getElementById("tray-zoom-val");
            if (zoomVal) zoomVal.textContent = Math.round(factor * 100) + "%";
            saveZoomDebounced(factor);
        });
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