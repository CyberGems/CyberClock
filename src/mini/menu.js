    let currentDesign = 1;
    let alwaysOnTop = false;

    // Discrete zoom stops (slider index → factor). 100% is the default.
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    function zoomIndexFor(z) {
        const i = ZOOM_STEPS.indexOf(z);
        return i >= 0 ? i : 1;
    }

    // 15 Skins Metadata with signature styling for the visual gallery cards
    const SKINS_META = [
        { id: 1, key: "settings.mini.skin.1", bg: "linear-gradient(135deg, #1e2229 0%, #15181e 100%)", border: "rgba(255, 183, 0, 0.45)", color: "#ffb700", font: "'Share Tech Mono', monospace", sample: "12:45:00" },
        { id: 2, key: "settings.mini.skin.2", bg: "rgba(0, 240, 255, 0.08)", border: "rgba(0, 240, 255, 0.4)", color: "#00f0ff", font: "'Orbitron', monospace", sample: "12:45:00" },
        { id: 3, key: "settings.mini.skin.3", bg: "rgba(0, 255, 65, 0.07)", border: "rgba(0, 255, 65, 0.35)", color: "#00ff41", font: "'JetBrains Mono', monospace", sample: "12:45:00" },
        { id: 4, key: "settings.mini.skin.4", bg: "rgba(255, 255, 255, 0.06)", border: "rgba(255, 255, 255, 0.3)", color: "#ffffff", font: "'Outfit', sans-serif", sample: "12:45:00" },
        { id: 5, key: "settings.mini.skin.5", bg: "rgba(255, 0, 128, 0.08)", border: "rgba(255, 0, 128, 0.4)", color: "#ff0080", font: "'Orbitron', sans-serif", sample: "12:45:00" },
        { id: 6, key: "settings.mini.skin.6", bg: "rgba(255, 255, 255, 0.04)", border: "rgba(255, 255, 255, 0.15)", color: "#e6e6e6", font: "'Space Grotesk', sans-serif", sample: "12:45:00" },
        { id: 7, key: "settings.mini.skin.7", bg: "linear-gradient(135deg, rgba(255, 80, 50, 0.15), rgba(150, 40, 200, 0.15))", border: "rgba(255, 100, 50, 0.4)", color: "#ff7e47", font: "'Outfit', sans-serif", sample: "12:45:00" },
        { id: 8, key: "settings.mini.skin.8", bg: "rgba(180, 230, 255, 0.08)", border: "rgba(180, 230, 255, 0.4)", color: "#aee4ff", font: "'Space Grotesk', sans-serif", sample: "12:45:00" },
        { id: 9, key: "settings.mini.skin.9", bg: "linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(255, 0, 120, 0.1))", border: "rgba(0, 240, 255, 0.4)", color: "#00f0ff", font: "'Orbitron', sans-serif", sample: "12:45:00" },
        { id: 10, key: "settings.mini.skin.10", bg: "#0c0d10", border: "rgba(255, 255, 255, 0.12)", color: "#f0f0f0", font: "'JetBrains Mono', monospace", sample: "12:45:00" },
        { id: 11, key: "settings.mini.skin.11", bg: "linear-gradient(135deg, rgba(255, 45, 120, 0.15), rgba(120, 40, 255, 0.15))", border: "rgba(255, 45, 120, 0.4)", color: "#ff4090", font: "'Orbitron', sans-serif", sample: "12:45:00" },
        { id: 12, key: "settings.mini.skin.12", bg: "rgba(138, 43, 226, 0.12)", border: "rgba(138, 43, 226, 0.45)", color: "#c084fc", font: "'Share Tech Mono', monospace", sample: "12:45:00" },
        { id: 13, key: "settings.mini.skin.13", bg: "linear-gradient(135deg, #121008, #1a1608)", border: "rgba(255, 153, 0, 0.4)", color: "#ff9d00", font: "'Share Tech Mono', monospace", sample: "12:45:00" },
        { id: 14, key: "settings.mini.skin.14", bg: "linear-gradient(135deg, #0e1117, #131720)", border: "rgba(0, 229, 255, 0.45)", color: "#00e5ff", font: "'Orbitron', sans-serif", sample: "12:45:00" },
        { id: 15, key: "settings.mini.skin.15", bg: "linear-gradient(135deg, #06121a, #0b1a24)", border: "rgba(0, 255, 200, 0.45)", color: "#00ffc8", font: "'Outfit', sans-serif", sample: "12:45:00" }
    ];

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
        const tgl = document.getElementById("toggle-aot");
        if (tgl) tgl.classList.toggle("on", on);
    }

    function reportMenuHeight() {
        requestAnimationFrame(() => {
            const el = document.getElementById("ctx-menu");
            if (!el) return;
            if (el.classList.contains("gallery-mode")) {
                if (window.cc && window.cc.miniMenuReady) {
                    window.cc.miniMenuReady(380, 480);
                }
                return;
            }
            const h = el.offsetHeight + 28;
            if (window.cc && window.cc.miniMenuReady) {
                window.cc.miniMenuReady(286, h);
            }
        });
    }

    function updateLayoutButtons(layout) {
        const stackedBtn = document.getElementById("btn-layout-stacked");
        const inlineBtn = document.getElementById("btn-layout-inline");
        if (stackedBtn) stackedBtn.classList.toggle("active", layout === "stacked");
        if (inlineBtn) inlineBtn.classList.toggle("active", layout === "inline");
    }

    function selectSkin(mode) {
        currentDesign = mode;
        document.querySelectorAll(".design-btn").forEach((b) => {
            b.classList.toggle("active", parseInt(b.dataset.mode) === mode);
        });
        document.querySelectorAll(".gallery-card").forEach((c) => {
            c.classList.toggle("active", parseInt(c.dataset.mode) === mode);
        });
        syncSolarVisibility(mode);

        if (window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ miniDesign: mode });
        }
    }

    function buildGalleryGrid(activeDesign) {
        const grid = document.getElementById("gallery-grid");
        if (!grid) return;
        grid.innerHTML = "";

        SKINS_META.forEach((skin) => {
            const card = document.createElement("div");
            card.className = `gallery-card${skin.id === activeDesign ? " active" : ""}`;
            card.dataset.mode = String(skin.id);
            const nameText = window.ccI18n ? window.ccI18n.t(skin.key) : `Skin ${skin.id}`;
            card.setAttribute("data-tooltip", nameText);
            card.setAttribute("data-tooltip-dir", "bottom");

            card.innerHTML = `
                <div class="gallery-card-top">
                    <span class="gallery-card-name" data-i18n="${skin.key}">${nameText}</span>
                    <span class="gallery-card-badge">#${skin.id < 10 ? "0" + skin.id : skin.id}</span>
                </div>
                <div class="gallery-card-preview" style="background: ${skin.bg}; border: 1px solid ${skin.border}; color: ${skin.color}; font-family: ${skin.font};">
                    ${skin.sample}
                </div>
            `;

            card.addEventListener("click", () => {
                selectSkin(skin.id);
            });

            grid.appendChild(card);
        });

        if (window.ccI18n && window.ccI18n.apply) {
            window.ccI18n.apply(grid);
        }
    }

    // Gallery Modal Open & Close logic
    const btnOpenGallery = document.getElementById("btn-open-gallery");
    const btnCloseGallery = document.getElementById("btn-close-gallery");
    const galleryView = document.getElementById("gallery-view");
    const ctxTabs = document.getElementById("ctx-tabs");
    const panelActions = document.getElementById("tab-panel-actions");
    const panelCustomize = document.getElementById("tab-panel-customize");
    const ctxMenu = document.getElementById("ctx-menu");

    function openGallery() {
        if (!galleryView) return;
        if (ctxTabs) ctxTabs.style.display = "none";
        if (panelActions) panelActions.style.display = "none";
        if (panelCustomize) panelCustomize.style.display = "none";
        galleryView.style.display = "flex";
        document.body.classList.add("gallery-open");
        if (ctxMenu) ctxMenu.classList.add("gallery-mode");

        if (window.cc && window.cc.miniMenuReady) {
            window.cc.miniMenuReady(380, 480);
        }
    }

    function closeGallery() {
        if (!galleryView) return;
        galleryView.style.display = "none";
        document.body.classList.remove("gallery-open");
        if (ctxMenu) ctxMenu.classList.remove("gallery-mode");
        if (ctxTabs) ctxTabs.style.display = "flex";
        if (panelCustomize) panelCustomize.style.display = "flex";
        if (panelActions) panelActions.style.display = "none";

        reportMenuHeight();
    }

    if (btnOpenGallery) btnOpenGallery.addEventListener("click", openGallery);
    if (btnCloseGallery) btnCloseGallery.addEventListener("click", closeGallery);

    // Sync menu options with saved configurations
    if (window.cc && window.cc.getSettings) {
        window.cc.getSettings().then((cfg) => {
            if (cfg) {
                // Accent tint
                if (cfg.theme) window.CCTint.apply(cfg.theme);

                if (window.ccI18n) {
                    window.ccI18n.setLang(cfg.language || "auto");
                    // Translate all data-i18n and data-i18n-attr elements
                    window.ccI18n.apply(document);

                    const collapseLbl = document.querySelector("#ctx-collapse .switch-lbl");
                    if (collapseLbl) collapseLbl.textContent = window.ccI18n.t("menu.collapseDate");
                    const lockLbl = document.querySelector("#ctx-lock .switch-lbl");
                    if (lockLbl) lockLbl.textContent = window.ccI18n.t("settings.mini.lockPos");
                    const aotLbl = document.querySelector("#ctx-aot .switch-lbl");
                    if (aotLbl) aotLbl.textContent = window.ccI18n.t("menu.alwaysOnTop");
                    const solarLbl = document.querySelector("#ctx-solar .switch-lbl");
                    if (solarLbl) solarLbl.textContent = window.ccI18n.t("settings.mini.solarReal");
                    const animLbl = document.querySelector("#ctx-anim .switch-lbl");
                    if (animLbl) animLbl.textContent = window.ccI18n.t("settings.mini.noAnimations");
                    const fullLbl = document.querySelector('.ctx-item[data-action="full"] .label');
                    if (fullLbl) fullLbl.textContent = window.ccI18n.t("tray.fullMode");
                    const timerLbl = document.querySelector('.ctx-item[data-action="new_timer"] .label');
                    if (timerLbl) timerLbl.textContent = window.ccI18n.t("float.newTimer");
                    const stopwatchLbl = document.querySelector('.ctx-item[data-action="new_stopwatch"] .label');
                    if (stopwatchLbl) stopwatchLbl.textContent = window.ccI18n.t("float.newStopwatch");
                    const calendarLbl = document.querySelector('.ctx-item[data-action="new_calendar"] .label');
                    if (calendarLbl) calendarLbl.textContent = window.ccI18n.t("float.newCalendar");
                    const analogLbl = document.querySelector('.ctx-item[data-action="new_analog"] .label');
                    if (analogLbl) analogLbl.textContent = window.ccI18n.t("float.newAnalog");
                    const relaxLbl = document.querySelector('.ctx-item[data-action="relax"] .label');
                    if (relaxLbl) relaxLbl.textContent = window.ccI18n.t("menu.relax");
                    const settingsLbl = document.querySelector('.ctx-item[data-action="settings"] .label');
                    if (settingsLbl) settingsLbl.textContent = window.ccI18n.t("menu.settings");
                    const aboutLbl = document.querySelector('.ctx-item[data-action="about"] .label');
                    if (aboutLbl) aboutLbl.textContent = window.ccI18n.t("about.title");
                    const closeLbl = document.querySelector('.ctx-item[data-action="close"] .label');
                    if (closeLbl) closeLbl.textContent = window.ccI18n.t("tray.quit");
                    const tabActions = document.getElementById("tab-btn-actions");
                    if (tabActions) tabActions.textContent = window.ccI18n.t("menu.tabActions");
                    const tabCustomize = document.getElementById("tab-btn-customize");
                    if (tabCustomize) tabCustomize.textContent = window.ccI18n.t("menu.tabCustomize");
                }
                
                // Active Layout Form Factor
                const activeLayout = cfg.miniLayout || "stacked";
                updateLayoutButtons(activeLayout);

                // Active Design (1 to 15)
                const activeDesign = cfg.miniDesign || 1;
                selectSkin(activeDesign);
                buildGalleryGrid(activeDesign);

                // Typography Studio
                const fontSelect = document.getElementById("font-family-select");
                if (fontSelect) {
                    fontSelect.value = cfg.miniCustomFont || "default";
                }
                const btnBold = document.getElementById("btn-font-bold");
                if (btnBold) {
                    btnBold.classList.toggle("active", Boolean(cfg.miniFontBold));
                }
                const btnItalic = document.getElementById("btn-font-italic");
                if (btnItalic) {
                    btnItalic.classList.toggle("active", Boolean(cfg.miniFontItalic));
                }

                // Real Sun Cycle (design 7 only)
                const toggleSolar = document.getElementById("toggle-solar");
                if (toggleSolar) toggleSolar.classList.toggle("on", cfg.miniSolarReal || false);
                
                // Active Opacity (Content)
                const activeOpacity = Math.round((cfg.miniOpacity ?? 1.0) * 100);
                const opSlider = document.getElementById("opacity-slider");
                if (opSlider) opSlider.value = activeOpacity;
                const opVal = document.getElementById("opacity-val");
                if (opVal) opVal.textContent = `${activeOpacity}%`;

                // Active Background Opacity
                const activeBgOpacity = Math.round((cfg.miniBgOpacity ?? 1.0) * 100);
                const bgSlider = document.getElementById("bg-opacity-slider");
                if (bgSlider) bgSlider.value = activeBgOpacity;
                const bgVal = document.getElementById("bg-opacity-val");
                if (bgVal) bgVal.textContent = `${activeBgOpacity}%`;

                // Active Zoom
                const activeZoomIdx = zoomIndexFor(cfg.miniZoom ?? 1);
                const zSlider = document.getElementById("zoom-slider");
                if (zSlider) zSlider.value = activeZoomIdx;
                const zVal = document.getElementById("zoom-val");
                if (zVal) zVal.textContent = `${Math.round(ZOOM_STEPS[activeZoomIdx] * 100)}%`;

                // Position Lock
                const toggleLock = document.getElementById("toggle-lock");
                if (toggleLock) toggleLock.classList.toggle("on", cfg.miniPositionLocked || false);

                // Collapse Date
                const toggleCollapse = document.getElementById("toggle-collapse");
                if (toggleCollapse) toggleCollapse.classList.toggle("on", cfg.miniCollapseDate || false);

                // Disable Animations
                const toggleAnim = document.getElementById("toggle-anim");
                if (toggleAnim) toggleAnim.classList.toggle("on", cfg.miniNoAnimations || false);

                // AOT
                updateAotState(cfg.alwaysOnTop || false);
            }
            reportMenuHeight();
        });
    } else {
        reportMenuHeight();
    }

    // Layout Form Factor switcher event listeners
    const btnLayoutStacked = document.getElementById("btn-layout-stacked");
    if (btnLayoutStacked) {
        btnLayoutStacked.addEventListener("click", () => {
            updateLayoutButtons("stacked");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniLayout: "stacked" });
            }
        });
    }

    const btnLayoutInline = document.getElementById("btn-layout-inline");
    if (btnLayoutInline) {
        btnLayoutInline.addEventListener("click", () => {
            updateLayoutButtons("inline");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniLayout: "inline" });
            }
        });
    }

    // Typography Studio event listeners
    const fontSelectEl = document.getElementById("font-family-select");
    if (fontSelectEl) {
        fontSelectEl.addEventListener("change", (e) => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniCustomFont: e.target.value });
            }
        });
    }

    const btnFontBoldEl = document.getElementById("btn-font-bold");
    if (btnFontBoldEl) {
        btnFontBoldEl.addEventListener("click", () => {
            const next = !btnFontBoldEl.classList.contains("active");
            btnFontBoldEl.classList.toggle("active", next);
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniFontBold: next });
            }
        });
    }

    const btnFontItalicEl = document.getElementById("btn-font-italic");
    if (btnFontItalicEl) {
        btnFontItalicEl.addEventListener("click", () => {
            const next = !btnFontItalicEl.classList.contains("active");
            btnFontItalicEl.classList.toggle("active", next);
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniFontItalic: next });
            }
        });
    }

    const btnFontResetEl = document.getElementById("btn-font-reset");
    if (btnFontResetEl) {
        btnFontResetEl.addEventListener("click", () => {
            if (fontSelectEl) fontSelectEl.value = "default";
            if (btnFontBoldEl) btnFontBoldEl.classList.remove("active");
            if (btnFontItalicEl) btnFontItalicEl.classList.remove("active");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({
                    miniCustomFont: "default",
                    miniFontBold: false,
                    miniFontItalic: false
                });
            }
        });
    }

    // Design Mode 1..15 quick buttons click handlers
    document.querySelectorAll(".design-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = parseInt(btn.dataset.mode);
            selectSkin(mode);
        });
    });

    // Real Sun Cycle toggle handler (design 7 only)
    const solarRow = document.getElementById("ctx-solar");
    if (solarRow) {
        solarRow.addEventListener("click", () => {
            const tgl = document.getElementById("toggle-solar");
            if (!tgl) return;
            const on = tgl.classList.toggle("on");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniSolarReal: on });
            }
            if (window.cc && window.cc.closeMenuPopup) {
                setTimeout(() => window.cc.closeMenuPopup(), 200);
            }
        });
    }

    // Opacity slider handler (Content)
    const slider = document.getElementById("opacity-slider");
    const sliderVal = document.getElementById("opacity-val");
    if (slider && sliderVal) {
        slider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value);
            sliderVal.textContent = `${val}%`;
            debouncedSave("miniOpacity", { miniOpacity: val / 100 });
        });
    }

    // Background opacity slider handler
    const bgSlider = document.getElementById("bg-opacity-slider");
    const bgSliderVal = document.getElementById("bg-opacity-val");
    if (bgSlider && bgSliderVal) {
        bgSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value);
            bgSliderVal.textContent = `${val}%`;
            debouncedSave("miniBgOpacity", { miniBgOpacity: val / 100 });
        });
    }

    // Zoom slider handler (discrete stops: 50/100/200/400%)
    const zoomSlider = document.getElementById("zoom-slider");
    const zoomVal = document.getElementById("zoom-val");
    if (zoomSlider && zoomVal) {
        zoomSlider.addEventListener("input", (e) => {
            const idx = parseInt(e.target.value);
            const factor = ZOOM_STEPS[idx] ?? 1;
            zoomVal.textContent = `${Math.round(factor * 100)}%`;
            debouncedSave("miniZoom", { miniZoom: factor });
        });
    }

    // Lock toggle handler
    const lockRow = document.getElementById("ctx-lock");
    if (lockRow) {
        lockRow.addEventListener("click", () => {
            const tgl = document.getElementById("toggle-lock");
            if (!tgl) return;
            const on = tgl.classList.toggle("on");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniPositionLocked: on });
            }
            if (window.cc && window.cc.closeMenuPopup) {
                setTimeout(() => window.cc.closeMenuPopup(), 200);
            }
        });
    }

    // Collapse Date toggle handler
    const collapseRow = document.getElementById("ctx-collapse");
    if (collapseRow) {
        collapseRow.addEventListener("click", () => {
            const tgl = document.getElementById("toggle-collapse");
            if (!tgl) return;
            const on = tgl.classList.toggle("on");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniCollapseDate: on });
            }
            if (window.cc && window.cc.closeMenuPopup) {
                setTimeout(() => window.cc.closeMenuPopup(), 200);
            }
        });
    }

    // Disable Animations toggle handler
    const animRow = document.getElementById("ctx-anim");
    if (animRow) {
        animRow.addEventListener("click", () => {
            const tgl = document.getElementById("toggle-anim");
            if (!tgl) return;
            const on = tgl.classList.toggle("on");
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniNoAnimations: on });
            }
            if (window.cc && window.cc.closeMenuPopup) {
                setTimeout(() => window.cc.closeMenuPopup(), 200);
            }
        });
    }

    // Always on Top toggle handler
    const aotRow = document.getElementById("ctx-aot");
    if (aotRow) {
        aotRow.addEventListener("click", () => {
            const tgl = document.getElementById("toggle-aot");
            if (!tgl) return;
            const on = tgl.classList.toggle("on");
            updateAotState(on);
            if (window.cc && window.cc.menuAction) {
                window.cc.menuAction("aot");
            }
            if (window.cc && window.cc.closeMenuPopup) {
                setTimeout(() => window.cc.closeMenuPopup(), 200);
            }
        });
    }

    // Tab switching (Actions vs Customize)
    document.querySelectorAll(".ctx-tab").forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
            const target = tabBtn.dataset.tab;
            document.querySelectorAll(".ctx-tab").forEach((b) => b.classList.toggle("on", b === tabBtn));
            document.querySelectorAll(".ctx-tab-panel").forEach((p) => {
                const isTarget = p.id === `tab-panel-${target}`;
                p.style.display = isTarget ? "flex" : "none";
                p.classList.toggle("on", isTarget);
            });
            reportMenuHeight();
        });
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
        if (!e.target.closest(".ctx-menu, input, button, label, span, select, option")) {
            if (window.cc && window.cc.closeMenuPopup) {
                window.cc.closeMenuPopup();
            }
        }
    });

    // Close on Escape key (or back to menu if gallery modal is open)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (galleryView && galleryView.style.display !== "none") {
                closeGallery();
                return;
            }
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

    window.addEventListener("DOMContentLoaded", reportMenuHeight);
    reportMenuHeight();
