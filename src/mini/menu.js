    let currentDesign = 1;
    let alwaysOnTop = false;

    // Discrete zoom stops (slider index → factor). 100% is the default.
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    function zoomIndexFor(z) {
        const i = ZOOM_STEPS.indexOf(z);
        return i >= 0 ? i : 1;
    }

    // The Real Sun Cycle toggle only applies to the Sunset Pulse skin
    // (design 7); show the row only when that design is active.
    function syncSolarVisibility(design) {
        currentDesign = design;
        const row = document.getElementById("ctx-solar");
        if (row) row.style.display = design === 7 ? "flex" : "none";
    }

    // Debounced settings save for slider drags: each save broadcasts
    // the full settings object to every window, so coalesce the burst
    // of `input` events into one trailing save.
    const saveDebounce = {};
    function debouncedSave(key, patch, delay = 120) {
        clearTimeout(saveDebounce[key]);
        saveDebounce[key] = setTimeout(() => {
            if (window.cc && window.cc.saveSettings) window.cc.saveSettings(patch);
        }, delay);
    }

    function updateAotState(on) {
        alwaysOnTop = on;
        document.getElementById("toggle-aot").classList.toggle("on", on);
    }

    // Sync menu options with saved configurations
    if (window.cc && window.cc.getSettings) {
        window.cc.getSettings().then((cfg) => {
            if (cfg) {
                // Theme
                if (cfg.theme) document.body.dataset.theme = cfg.theme;

                if (window.ccI18n) {
                    window.ccI18n.setLang(cfg.language || "auto");
                    // Translate all data-i18n elements (section titles, etc.)
                    window.ccI18n.apply(document);
                    const collapseLbl = document.querySelector("#ctx-collapse .switch-lbl");
                    if (collapseLbl) collapseLbl.textContent = window.ccI18n.t("menu.collapseDate");
                    const lockLbl = document.querySelector("#ctx-lock .switch-lbl");
                    if (lockLbl) lockLbl.textContent = window.ccI18n.t("settings.mini.lockPos");
                    const aotLbl = document.querySelector("#ctx-aot .switch-lbl");
                    if (aotLbl) aotLbl.textContent = window.ccI18n.t("menu.alwaysOnTop");
                    const solarLbl = document.querySelector("#ctx-solar .switch-lbl");
                    if (solarLbl) solarLbl.textContent = window.ccI18n.t("settings.mini.solarReal");
                    const fullLbl = document.querySelector('.ctx-item[data-action="full"] .label');
                    if (fullLbl) fullLbl.textContent = window.ccI18n.t("tray.fullMode");
                    const timerLbl = document.querySelector('.ctx-item[data-action="timer"] .label');
                    if (timerLbl) timerLbl.textContent = window.ccI18n.t("menu.timer");
                    const stopwatchLbl = document.querySelector('.ctx-item[data-action="stopwatch"] .label');
                    if (stopwatchLbl) stopwatchLbl.textContent = window.ccI18n.t("menu.stopwatch");
                    const relaxLbl = document.querySelector('.ctx-item[data-action="relax"] .label');
                    if (relaxLbl) relaxLbl.textContent = window.ccI18n.t("menu.relax");
                    const settingsLbl = document.querySelector('.ctx-item[data-action="settings"] .label');
                    if (settingsLbl) settingsLbl.textContent = window.ccI18n.t("menu.settings");
                    const closeLbl = document.querySelector('.ctx-item[data-action="close"] .label');
                    if (closeLbl) closeLbl.textContent = window.ccI18n.t("menu.close");
                }
                
                // Active Design
                const activeDesign = cfg.miniDesign || 1;
                document.querySelectorAll(".design-btn").forEach((btn) => {
                    btn.classList.toggle("active", parseInt(btn.dataset.mode) === activeDesign);
                });
                syncSolarVisibility(activeDesign);

                // Real Sun Cycle (design 7 only)
                document.getElementById("toggle-solar").classList.toggle("on", cfg.miniSolarReal || false);
                
                // Active Opacity (Content)
                const activeOpacity = Math.round((cfg.miniOpacity ?? 1.0) * 100);
                document.getElementById("opacity-slider").value = activeOpacity;
                document.getElementById("opacity-val").textContent = `${activeOpacity}%`;

                // Active Background Opacity
                const activeBgOpacity = Math.round((cfg.miniBgOpacity ?? 1.0) * 100);
                document.getElementById("bg-opacity-slider").value = activeBgOpacity;
                document.getElementById("bg-opacity-val").textContent = `${activeBgOpacity}%`;

                // Active Zoom
                const activeZoomIdx = zoomIndexFor(cfg.miniZoom ?? 1);
                document.getElementById("zoom-slider").value = activeZoomIdx;
                document.getElementById("zoom-val").textContent = `${Math.round(ZOOM_STEPS[activeZoomIdx] * 100)}%`;

                // Position Lock
                document.getElementById("toggle-lock").classList.toggle("on", cfg.miniPositionLocked || false);

                // Collapse Date
                document.getElementById("toggle-collapse").classList.toggle("on", cfg.miniCollapseDate || false);
                
                // AOT
                updateAotState(cfg.alwaysOnTop || false);
            }
        });
    }

    // Design Mode click handlers (allows previewing multiple layouts without closing)
    document.querySelectorAll(".design-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = parseInt(btn.dataset.mode);
            document.querySelectorAll(".design-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            syncSolarVisibility(mode);

            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniDesign: mode });
            }
        });
    });

    // Real Sun Cycle toggle handler (design 7 only)
    const solarRow = document.getElementById("ctx-solar");
    solarRow.addEventListener("click", () => {
        const tgl = document.getElementById("toggle-solar");
        const on = tgl.classList.toggle("on");
        if (window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ miniSolarReal: on });
        }
        if (window.cc && window.cc.closeMenuPopup) {
            setTimeout(() => window.cc.closeMenuPopup(), 200);
        }
    });

    // Opacity slider handler (Content)
    const slider = document.getElementById("opacity-slider");
    const sliderVal = document.getElementById("opacity-val");
    slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        sliderVal.textContent = `${val}%`;

        debouncedSave("miniOpacity", { miniOpacity: val / 100 });
    });

    // Background opacity slider handler
    const bgSlider = document.getElementById("bg-opacity-slider");
    const bgSliderVal = document.getElementById("bg-opacity-val");
    bgSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        bgSliderVal.textContent = `${val}%`;

        debouncedSave("miniBgOpacity", { miniBgOpacity: val / 100 });
    });

    // Zoom slider handler (discrete stops: 50/100/200/400%)
    const zoomSlider = document.getElementById("zoom-slider");
    const zoomVal = document.getElementById("zoom-val");
    zoomSlider.addEventListener("input", (e) => {
        const idx = parseInt(e.target.value);
        const factor = ZOOM_STEPS[idx] ?? 1;
        zoomVal.textContent = `${Math.round(factor * 100)}%`;

        debouncedSave("miniZoom", { miniZoom: factor });
    });

    // Lock toggle handler
    const lockRow = document.getElementById("ctx-lock");
    lockRow.addEventListener("click", () => {
        const tgl = document.getElementById("toggle-lock");
        const on = tgl.classList.toggle("on");
        if (window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ miniPositionLocked: on });
        }
        if (window.cc && window.cc.closeMenuPopup) {
            setTimeout(() => window.cc.closeMenuPopup(), 200);
        }
    });

    // Collapse Date toggle handler
    const collapseRow = document.getElementById("ctx-collapse");
    collapseRow.addEventListener("click", () => {
        const tgl = document.getElementById("toggle-collapse");
        const on = tgl.classList.toggle("on");
        if (window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ miniCollapseDate: on });
        }
        if (window.cc && window.cc.closeMenuPopup) {
            setTimeout(() => window.cc.closeMenuPopup(), 200);
        }
    });

    // Always on Top toggle handler
    const aotRow = document.getElementById("ctx-aot");
    aotRow.addEventListener("click", () => {
        const tgl = document.getElementById("toggle-aot");
        const on = tgl.classList.toggle("on");
        updateAotState(on);
        if (window.cc && window.cc.menuAction) {
            window.cc.menuAction("aot");
        }
        if (window.cc && window.cc.closeMenuPopup) {
            setTimeout(() => window.cc.closeMenuPopup(), 200);
        }
    });

    // Menu action click handlers (full, timer, settings, etc.)
    document.querySelectorAll(".ctx-item[data-action]").forEach((el) => {
        el.addEventListener("click", () => {
            const action = el.dataset.action;
            if (window.cc && window.cc.menuAction) {
                window.cc.menuAction(action);
            }
        });
    });

    // Close context menu on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".ctx-menu, input, button, label, span")) {
            if (window.cc && window.cc.closeMenuPopup) {
                window.cc.closeMenuPopup();
            }
        }
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (window.cc && window.cc.closeMenuPopup) {
                window.cc.closeMenuPopup();
            }
        }
    });

    // Close menu popup when it loses focus (click on other windows)
    window.addEventListener("blur", () => {
        if (window.cc && window.cc.closeMenuPopup) {
            window.cc.closeMenuPopup();
        }
    });