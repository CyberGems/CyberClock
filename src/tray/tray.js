    let currentMenuState = null;
    const rootEl = document.getElementById("tray-root");
    let appVersion = "";

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
        window.CCTint.apply(theme || "ice");
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

        // Relax quick toggle: reflects live playback (track id comes from
        // the main window's reports). Hidden when nothing is loaded.
        const relaxTgBtn = document.getElementById("btn-relax-toggle");
        const relaxTgIco = document.getElementById("ico-relax-toggle");
        const relaxTgLbl = document.getElementById("lbl-relax-toggle");
        const playingTrack = state.relax_playing || null;
        if (relaxTgBtn) relaxTgBtn.hidden = !playingTrack;
        if (relaxTgIco) {
            relaxTgIco.setAttribute("data-ico", playingTrack ? "pause" : "play");
        }
        if (relaxTgLbl) {
            relaxTgLbl.textContent = playingTrack
                ? (window.ccI18n ? window.ccI18n.t("tray.pauseRelax", { track: window.ccI18n.t("relax.track." + playingTrack) }) : "Pause relax")
                : (window.ccI18n ? window.ccI18n.t("tray.playRelax") : "Play relax");
        }

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

        // Help section labels
        const T = (k, fb) => (window.ccI18n ? window.ccI18n.t(k) : fb);
        const setLbl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        // Master audio toggle
        const audioBtn = document.getElementById("btn-audio");
        const audioIco = document.getElementById("ico-audio");
        const audioLbl = document.getElementById("lbl-audio");
        if (audioBtn) {
            const muted = state.audio_muted === true;
            audioBtn.classList.toggle("muted", muted);
            audioBtn.setAttribute("aria-pressed", String(muted));
        }
        if (audioIco) audioIco.setAttribute("data-ico", state.audio_muted === true ? "volume-x" : "volume-high");
        if (audioLbl) audioLbl.textContent = state.audio_muted === true
            ? T("tray.soundOff", "Sound off")
            : T("tray.soundOn", "Sound on");

        // Click-through toggle (mini window ignores the mouse while on)
        const ctpBtn = document.getElementById("btn-clickthrough");
        const ctpIco = document.getElementById("ico-clickthrough");
        const ctpLbl = document.getElementById("lbl-clickthrough");
        const ctpOn = state.mini_click_through === true;
        if (ctpBtn) {
            ctpBtn.classList.toggle("on", ctpOn);
            ctpBtn.setAttribute("aria-pressed", String(ctpOn));
        }
        if (ctpIco) ctpIco.setAttribute("data-ico", ctpOn ? "eye-off" : "eye");
        if (ctpLbl) ctpLbl.textContent = ctpOn
            ? T("tray.clickThroughOff", "Click-through off")
            : T("tray.clickThrough", "Click-through");

        setLbl("lbl-help", T("tray.help", "Help"));
        setLbl("lbl-pin-tray", T("tray.pinTrayIcon", "Pin icon to taskbar..."));
        setLbl("lbl-faq", T("tray.faq", "FAQ"));
        setLbl("lbl-changelog", T("tray.changelog", "Changelog"));
        setLbl("lbl-website", T("tray.homepage", "Website"));
        setLbl("lbl-donate", T("tray.donate", "Donate"));
        setLbl("lbl-about", T("tray.about", "About..."));
        setLbl("lbl-check-updates", T("tray.checkUpdates", "Check for Update..."));

        // Header version label
        if (state.version) {
            appVersion = state.version;
            const verEl = document.getElementById("app-ver");
            if (verEl) verEl.textContent = "v" + appVersion;
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

    // CyberClock repo links for the Help section and About modal.
    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const HELP_URLS = {
        faq: `${REPO_URL}/wiki#faq`,
        changelog: `${REPO_URL}/releases`,
        website: "https://cybergems.org",
        donate: "https://ko-fi.com/cybergems",
        github: REPO_URL,
        issues: `${REPO_URL}/issues`,
    };

    function openUrl(url) {
        if (window.cc && window.cc.openExternalUrl) {
            window.cc.openExternalUrl(url);
            return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
    }

    // Master audio mute toggle: persists audioMuted (broadcast reaches the
    // main/mini audio engines) and reflects immediately without closing.
    const audioBtn = document.getElementById("btn-audio");
    if (audioBtn) {
        audioBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = !audioBtn.classList.contains("muted");
            if (currentMenuState) currentMenuState.audio_muted = next;
            renderState(currentMenuState);
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ audioMuted: next });
            }
        });
    }

    // Click-through toggle: backend applies set_ignore_cursor_events in
    // the same patch; the tray is one of the two places that can turn it
    // OFF (the mini window itself ignores the mouse while ON).
    const ctpBtn = document.getElementById("btn-clickthrough");
    if (ctpBtn) {
        ctpBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = !ctpBtn.classList.contains("on");
            if (currentMenuState) currentMenuState.mini_click_through = next;
            renderState(currentMenuState);
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniClickThrough: next });
            }
        });
    }

    // Relax quick toggle: fires the backend action that asks the main
    // window to play/pause; the menu closes just like other actions.
    const relaxTgBtn = document.getElementById("btn-relax-toggle");
    if (relaxTgBtn) {
        relaxTgBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            runAction("relax_toggle");
        });
    }

    // ── Help section ────────────────────────────────────────────
    const helpToggle = document.getElementById("btn-help-toggle");
    const helpSub = document.getElementById("tray-help-sub");

    function reportSizeSoon() {
        requestAnimationFrame(() => {
            requestAnimationFrame(reportSize);
        });
    }

    function setHelpOpen(open) {
        helpSub.hidden = !open;
        helpToggle.setAttribute("aria-expanded", String(open));
        helpToggle.classList.toggle("open", open);
        reportSizeSoon();
    }

    if (helpToggle) {
        helpToggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHelpOpen(helpSub.hidden);
        });
    }

    // Help sub-item handlers: URLs open in the browser, the pin opens
    // Windows settings, about/check-updates open the dedicated About
    // window (backend "about" action) — none close the menu.
    document.querySelectorAll(".tray-sub-item[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === "pin-tray-icon") {
                if (window.cc && window.cc.openTaskbarSettings) {
                    window.cc.openTaskbarSettings();
                }
                setTimeout(() => hideMenu(), 250);
            } else if (action === "about-modal" || action === "check-updates") {
                runAction("about");
            } else if (HELP_URLS[action]) {
                openUrl(HELP_URLS[action]);
                setTimeout(() => hideMenu(), 250);
            }
        });
    });

    function hideMenu() {
        if (window.cc && window.cc.hideTrayMenu) {
            window.cc.hideTrayMenu();
        }
    }

    // The About dialog lives in its own window now (see src/about/) —
    // no in-menu modal.

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

    // Click handlers for tray items & header. Help sub-items are excluded —
    // they own their handlers (URLs / pin / About window) and must not fall
    // through to runAction, which hides the tray menu window.
    document.querySelectorAll(".tray-item:not(.tray-sub-item), .tray-header").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (!action) return;
            if (action === "about-modal") {
                // Suite branding: the header opens the dedicated About
                // window (same as CyberViewer's header opening its About).
                runAction("about");
                return;
            }
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
            hideMenu();
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
                // The tray window is persistent (hidden, not destroyed), so
                // an expanded Help section would survive a close/reopen —
                // every show starts with the submenu collapsed.
                if (typeof setHelpOpen === "function") setHelpOpen(false);
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