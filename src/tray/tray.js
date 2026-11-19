    let currentMenuState = null;
    const rootEl = document.getElementById("tray-root");
    const stageEl = document.getElementById("tray-stage");
    const mainCardEl = document.getElementById("card-main");
    let appVersion = "";
    let activeFlyout = null;
    let flyoutOpenTimer = null;
    let flyoutCloseTimer = null;

    function measureCardHeight(card) {
        if (!card) return 0;
        const borderY = card.offsetHeight - card.clientHeight;
        return Math.ceil(card.scrollHeight + borderY + 40);
    }

    function reportSize() {
        if (!rootEl || !mainCardEl) return;
        const borderY = mainCardEl.offsetHeight - mainCardEl.clientHeight;
        const h = Math.ceil(mainCardEl.scrollHeight + borderY + 40);
        const w = Math.ceil(mainCardEl.offsetWidth + 40);
        const flyouts = Array.from(document.querySelectorAll(".tray-flyout")).filter((el) => {
            if (el.id === "flyout-suite" && currentMenuState && currentMenuState.show_suite_recommendations === false) {
                return false;
            }
            return true;
        });
        let canvasH = h;
        for (const f of flyouts) {
            canvasH = Math.max(canvasH, measureCardHeight(f));
        }
        if (w < 10 || h < 10) return;
        if (window.cc && window.cc.trayMenuReady) {
            window.cc.trayMenuReady({ width: w, height: h, canvasHeight: canvasH });
        }
    }

    function resetToMainView() {
        cancelFlyoutTimers();
        setActiveFlyout(null);
        if (mainCardEl) mainCardEl.scrollTop = 0;
        const sList = document.getElementById("tray-suite-list");
        if (sList) sList.scrollTop = 0;
    }

    function collapseAllSubmenus() {
        resetToMainView();
    }

    function applyTheme(theme) {
        window.CCTint.apply(theme || "azure");
    }

    function renderState(state) {
        if (!state) return;
        currentMenuState = state;

        // Theme and flyout orientation
        if (state.theme) applyTheme(state.theme);
        if (stageEl) {
            stageEl.dataset.flyoutSide = state.flyout_side === "right" ? "right" : "left";
            stageEl.dataset.verticalAlign = state.vertical_align === "top" ? "top" : "bottom";
        }

        // Language
        if (window.ccI18n) {
            window.ccI18n.setLang(state.language || "auto");
        }

        // Version
        const verEl = document.getElementById("app-ver");
        if (verEl && state.version) {
            verEl.textContent = "v" + state.version;
        }

        // Status is information. The two mode rows stay visible, and
        // the marked one is the mode the clock is actually in.
        const T = (k, fb) => (window.ccI18n ? window.ccI18n.t(k) : fb);
        const winState = state.window_state || (state.is_visible ? "visible" : "hidden");
        const isVis = winState === "visible";
        const isMin = winState === "minimized";
        const isFull = state.window_mode === "full";
        const modeName = T(isFull ? "tray.fullMode" : "tray.miniMode", isFull ? "Full Mode" : "Mini Mode");
        const statusEl = document.getElementById("tray-clock-status");
        const statusLbl = document.getElementById("lbl-clock-status");
        if (statusEl) {
            statusEl.classList.toggle("is-hidden", winState === "hidden");
            statusEl.classList.toggle("is-minimized", isMin);
        }
        if (statusLbl) {
            let key = "tray.statusVisible";
            let fallback = "Visible · " + modeName;
            if (isMin) {
                key = "tray.statusMinimized";
                fallback = "Minimized · " + modeName;
            } else if (winState === "hidden") {
                key = "tray.statusHidden";
                fallback = "Hidden";
            }
            statusLbl.textContent = window.ccI18n ? window.ccI18n.t(key, { mode: modeName }) : fallback;
        }
        const markMode = (id, on) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle("is-current", on);
            btn.setAttribute("aria-checked", on ? "true" : "false");
            const mark = btn.querySelector(".mode-mark");
            if (mark) mark.hidden = !on;
        };
        markMode("btn-mode-full", isFull);
        markMode("btn-mode-mini", !isFull);
        const lblFull = document.getElementById("lbl-mode-full");
        if (lblFull) lblFull.textContent = T("tray.fullMode", "Full Mode");
        const lblMini = document.getElementById("lbl-mode-mini");
        if (lblMini) lblMini.textContent = T("tray.miniMode", "Mini Mode");

        const lblVis = document.getElementById("lbl-visibility");
        const icoVis = document.getElementById("ico-visibility");
        const hintVis = document.getElementById("hint-visibility");
        const btnVis = document.getElementById("btn-visibility");
        if (btnVis) btnVis.dataset.action = isVis ? "hide" : "show";
        if (lblVis) {
            if (isVis) {
                lblVis.textContent = T("tray.hide", "Hide");
            } else if (isMin) {
                lblVis.textContent = T("tray.restore", "Restore");
            } else {
                lblVis.textContent = T("tray.show", "Show");
            }
        }
        if (icoVis) {
            icoVis.setAttribute("data-ico", isVis ? "eye-off" : (isMin ? "maximize" : "eye"));
        }
        if (hintVis) {
            const hotkey = state.hotkey || "";
            hintVis.textContent = hotkey;
            hintVis.hidden = !hotkey;
        }

        // Features
        const lblTimer = document.getElementById("lbl-timer");
        if (lblTimer) lblTimer.textContent = window.ccI18n ? window.ccI18n.t("float.newTimer") : "New Timer";
        const lblSw = document.getElementById("lbl-stopwatch");
        if (lblSw) lblSw.textContent = window.ccI18n ? window.ccI18n.t("float.newStopwatch") : "New Stopwatch";
        const lblCal = document.getElementById("lbl-calendar");
        if (lblCal) lblCal.textContent = window.ccI18n ? window.ccI18n.t("float.newCalendar") : "New Calendar";
        const lblAnalog = document.getElementById("lbl-analog");
        if (lblAnalog) lblAnalog.textContent = window.ccI18n ? window.ccI18n.t("float.newAnalog") : "New Analog Clock";
        const lblRelaxFloat = document.getElementById("lbl-relax-float");
        const relaxWidgetOpen = state.relax_widget_open === true;
        if (lblRelaxFloat) {
            lblRelaxFloat.textContent = relaxWidgetOpen ? T("relax.widgetOpen", "Relax widget open")
                : T("float.newRelax", "Open Relax widget");
            lblRelaxFloat.closest("button").disabled = relaxWidgetOpen;
        }
        const lblAlarm = document.getElementById("lbl-alarm");
        if (lblAlarm) lblAlarm.textContent = window.ccI18n ? window.ccI18n.t("tray.newAlarm") : "New Alarm";

        // Relax quick toggle: reflects live playback (track id comes from
        // the main window's reports). Hidden when nothing is loaded.
        const relaxTgBtn = document.getElementById("btn-relax-toggle");
        const relaxTgIco = document.getElementById("ico-relax-toggle");
        const relaxTgLbl = document.getElementById("lbl-relax-toggle");
        const playingTrack = state.relax_playing || null;
        const relaxPaused = playingTrack && state.relax_paused === true;
        if (relaxTgBtn) relaxTgBtn.hidden = !playingTrack;
        if (relaxTgIco) {
            relaxTgIco.setAttribute("data-ico", playingTrack && !relaxPaused ? "pause" : "play");
        }
        if (relaxTgLbl) {
            const trackName = playingTrack
                && window.ccI18n ? window.ccI18n.t("relax.track." + playingTrack) : "";
            relaxTgLbl.textContent = !playingTrack
                ? (window.ccI18n ? window.ccI18n.t("tray.playRelax") : "Play relax")
                : relaxPaused
                    ? (window.ccI18n ? window.ccI18n.t("tray.resumeRelax", { track: trackName }) : "Resume relax")
                    : (window.ccI18n ? window.ccI18n.t("tray.pauseRelax", { track: trackName }) : "Pause relax");
        }

        const lblSettings = document.getElementById("lbl-settings");
        if (lblSettings) lblSettings.textContent = window.ccI18n ? window.ccI18n.t("tray.settings") : "Settings...";
        const lblQuit = document.getElementById("lbl-quit");
        if (lblQuit) lblQuit.textContent = window.ccI18n ? window.ccI18n.t("tray.quit") : "Exit";


        // Help section labels
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

        // Click-through submenu (one toggle per window; rows for kinds
        // with no open instance render disabled).
        renderClickThrough(state);

        setLbl("lbl-clickthrough", T("tray.clickThrough", "Click-through"));
        setLbl("lbl-clickthrough-title", T("tray.clickThrough", "Click-through"));
        setLbl("lbl-new", T("tray.newMenu", "New..."));
        setLbl("lbl-new-title", T("tray.newMenu", "New..."));
        setLbl("lbl-suite-title", T("tray.suite", "More from CyberGems"));
        setLbl("lbl-back-new", T("tray.back", "Back"));
        setLbl("lbl-help", T("tray.help", "Help"));
        setLbl("lbl-center-widgets", T("tray.centerWidgets", "Center widgets on screen"));
        setLbl("lbl-pin-tray", T("tray.pinTrayIcon", "Pin icon to taskbar..."));
        setLbl("lbl-datetime", T("tray.datetimeProperties", "Date and time properties..."));
        setLbl("lbl-docs", T("tray.docs", "Online Documentation"));
        setLbl("lbl-faq", T("tray.faq", "FAQ"));
        setLbl("lbl-changelog", T("tray.changelog", "Changelog"));
        setLbl("lbl-website", T("tray.homepage", "Website"));
        setLbl("lbl-donate", T("tray.donate", "Donate"));
        setLbl("lbl-about", T("tray.about", "About..."));
        setLbl("lbl-check-updates", T("tray.checkUpdates", "Check for Update..."));
        setLbl("lbl-suite", T("tray.suite", "More from CyberGems"));
        setLbl("lbl-back-help", T("tray.back", "Back"));
        setLbl("lbl-back-suite", T("tray.back", "Back"));
        setLbl("lbl-back-clickthrough", T("tray.back", "Back"));
        setLbl("lbl-ctp-all-on", T("tray.ctpAllOn", "Enable all"));
        setLbl("lbl-ctp-all-off", T("tray.ctpAllOff", "Disable all"));
        setLbl("lbl-help-title", T("tray.help", "Help"));
        setLbl("lbl-suite-all", T("tray.suiteAll", "More details online..."));
        setLbl("lbl-pin-tip-title", T("tray.pinTip.title", "Keep CyberClock visible in the tray"));
        setLbl("lbl-pin-tip-got-it", T("tray.pinTip.gotIt", "Got it"));
        setLbl("lbl-pin-tip-open-settings", T("tray.pinTip.openSettings", "Open Windows Settings"));
        setLbl("lbl-back-pin-tip", T("tray.back", "Back"));
        renderTrayPinTipBody(T(
            "tray.pinTip.body",
            "Windows may hide new tray icons behind the overflow (^). Drag CyberClock onto the taskbar, or pin it in Windows Settings."
        ));

        // Suite section visibility
        const showSuite = state.show_suite_recommendations !== false;
        const btnNavSuite = document.getElementById("btn-nav-suite");
        if (btnNavSuite) btnNavSuite.hidden = !showSuite;
        if (suiteAppsCache) renderTraySuiteApps(suiteAppsCache);

        // Header version label and update LED
        if (state.version) {
            appVersion = state.version;
            const verEl = document.getElementById("app-ver");
            if (verEl) verEl.textContent = "v" + appVersion;
        }

        const updateLed = document.getElementById("tray-update-led");
        const hasUpdate = Boolean(state.update_available);
        if (updateLed) {
            updateLed.hidden = !hasUpdate;
        }
        const btnAbout = document.getElementById("btn-about");
        if (btnAbout) {
            if (hasUpdate) {
                btnAbout.setAttribute("data-tooltip", T("tray.updateBadgeTooltip", "New update available — click to view"));
                btnAbout.setAttribute("data-tooltip-dir", "bottom");
            } else {
                btnAbout.setAttribute("data-tooltip", T("tray.brandAboutTooltip", "About CyberClock..."));
                btnAbout.setAttribute("data-tooltip-dir", "bottom");
            }
        }

        // Re-render icons if data-ico changed
        if (window.ccIcons) {
            window.ccIcons.replaceIcons();
        }
    }

    function runAction(action) {
        collapseAllSubmenus();
        if (window.cc && window.cc.trayMenuAction) {
            window.cc.trayMenuAction(action).catch((e) => {
                console.error("trayMenuAction failed:", e);
            });
        }
    }

    // CyberClock repo links for the Help section and About modal.
    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const HELP_URLS = {
        docs: `${REPO_URL}/wiki`,
        faq: `${REPO_URL}/wiki#faq`,
        changelog: `${REPO_URL}/releases`,
        website: "https://cybergems.org",
        donate: "https://github.com/CyberGems/CyberClock#%EF%B8%8F-donate",
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

    // Click-through submenu: one independent toggle per window. The mini
    // clock and every open floating widget can pass clicks through on
    // their own; kinds with no open instance render as disabled rows.
    // The backend broadcasts a fresh state after each change, which
    // re-renders this list authoritatively.
    const CTP_KIND_META = [
        { kind: "mini", ico: "clock", nameKey: "tray.ctpMini", nameFallback: "Mini clock" },
        { kind: "timer", ico: "timer", nameKey: "menu.timer", nameFallback: "Timer" },
        { kind: "sw", ico: "stopwatch", nameKey: "menu.stopwatch", nameFallback: "Stopwatch" },
        { kind: "cal", ico: "calendar", nameKey: "menu.calendar", nameFallback: "Calendar" },
        { kind: "analog", ico: "planet", nameKey: "menu.analog", nameFallback: "Analog clock" },
        { kind: "relax", ico: "lotus", nameKey: "menu.relax", nameFallback: "Relax" },
    ];

    function ctpT(key, fallback) {
        return window.ccI18n ? window.ccI18n.t(key) : fallback;
    }

    function rowLabel(meta, seq) {
        const name = ctpT(meta.nameKey, meta.nameFallback);
        return meta.kind === "mini" || seq === 1 ? name : `${name} ${seq}`;
    }

    function renderClickThrough(state) {
        const list = document.getElementById("tray-ctp-list");
        if (!list) return;
        const byKind = {};
        (state.click_through_windows || []).forEach((w) => {
            (byKind[w.kind] = byKind[w.kind] || []).push(w);
        });
        // Multi-instance kinds keep every instance; single-instance
        // kinds (cal/analog/relax) only ever have one window open.
        Object.keys(byKind).forEach((k) => byKind[k].sort((a, b) => a.seq - b.seq));

        list.innerHTML = "";
        CTP_KIND_META.forEach((meta) => {
            const wins = meta.kind === "mini"
                ? [{ label: "mini", seq: 1, on: state.mini_click_through === true }]
                : byKind[meta.kind];
            if (wins && wins.length) {
                wins.forEach((w) => {
                    list.appendChild(buildCtpRow(meta, w.label, rowLabel(meta, w.seq), w.on, false));
                });
            } else {
                const name = ctpT(meta.nameKey, meta.nameFallback);
                list.appendChild(buildCtpRow(meta, "", name, false, true));
            }
        });
        if (window.ccIcons) window.ccIcons.replaceIcons();

        // "Enable/Disable all" only apply while something can actually
        // change; open widgets and the mini clock are the targets, not
        // the disabled not-open rows.
        const targets = [{ on: state.mini_click_through === true }]
            .concat(state.click_through_windows || []);
        const allOnBtn = document.getElementById("btn-ctp-all-on");
        const allOffBtn = document.getElementById("btn-ctp-all-off");
        if (allOnBtn) allOnBtn.disabled = !targets.some((w) => w.on !== true);
        if (allOffBtn) allOffBtn.disabled = !targets.some((w) => w.on === true);
    }

    function buildCtpRow(meta, label, text, on, disabled) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = disabled ? "tray-item" : "tray-item ctp-row" + (on ? " on" : "");
        btn.disabled = disabled;
        if (label) btn.dataset.ctpLabel = label;
        const ico = document.createElement("span");
        ico.className = "ico";
        ico.setAttribute("data-ico", meta.ico);
        const lbl = document.createElement("span");
        lbl.className = "label";
        lbl.textContent = disabled
            ? `${text} (${ctpT("tray.ctpInactive", "not open")})`
            : text;
        btn.setAttribute("aria-pressed", String(on));
        btn.setAttribute("aria-disabled", String(disabled));
        btn.appendChild(ico);
        btn.appendChild(lbl);
        if (!disabled) {
            const dot = document.createElement("span");
            dot.className = "audio-dot";
            btn.appendChild(dot);
        }
        return btn;
    }

    function cancelFlyoutTimers() {
        if (flyoutOpenTimer) {
            clearTimeout(flyoutOpenTimer);
            flyoutOpenTimer = null;
        }
        if (flyoutCloseTimer) {
            clearTimeout(flyoutCloseTimer);
            flyoutCloseTimer = null;
        }
    }

    function getFlyoutPanel(name) {
        if (!name) return null;
        return document.querySelector(`.tray-flyout[data-flyout-panel="${name}"]`);
    }

    function setActiveFlyout(name) {
        activeFlyout = name || null;
        document.querySelectorAll(".tray-flyout[data-flyout-panel]").forEach((panel) => {
            const isOpen = panel.dataset.flyoutPanel === activeFlyout;
            panel.classList.toggle("is-open", isOpen);
            panel.setAttribute("aria-hidden", isOpen ? "false" : "true");
        });
        const activeTrigger = activeFlyout === "pin-tip" ? "help" : activeFlyout;
        document.querySelectorAll(".tray-nav-item[data-flyout]").forEach((trigger) => {
            const isOpen = trigger.dataset.flyout === activeTrigger;
            trigger.classList.toggle("is-flyout-open", isOpen);
            trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });
        if (window.ccIcons) {
            window.ccIcons.replaceIcons();
        }
    }

    function scheduleFlyoutOpen(name) {
        cancelFlyoutTimers();
        if (activeFlyout === name) return;
        const delay = activeFlyout !== null ? 60 : 120;
        flyoutOpenTimer = setTimeout(() => {
            flyoutOpenTimer = null;
            setActiveFlyout(name);
        }, delay);
    }

    function scheduleFlyoutClose() {
        cancelFlyoutTimers();
        if (activeFlyout === null) return;
        flyoutCloseTimer = setTimeout(() => {
            flyoutCloseTimer = null;
            setActiveFlyout(null);
        }, 220);
    }

    function openFlyoutAndFocusFirst(name) {
        cancelFlyoutTimers();
        setActiveFlyout(name);
        requestAnimationFrame(() => {
            const panel = getFlyoutPanel(name);
            const firstBtn = panel && panel.querySelector("button:not(:disabled)");
            if (firstBtn) firstBtn.focus();
        });
    }

    function closeFlyoutAndReturnFocus() {
        const prev = activeFlyout === "pin-tip" ? "help" : activeFlyout;
        cancelFlyoutTimers();
        setActiveFlyout(null);
        if (prev) {
            const trigger = document.querySelector(`.tray-nav-item[data-flyout="${prev}"]`);
            if (trigger) trigger.focus();
        }
    }

    function wireClickThrough() {
        const list = document.getElementById("tray-ctp-list");
        if (list) {
            list.addEventListener("click", (e) => {
                const row = e.target.closest("button[data-ctp-label]");
                if (!row || row.disabled) return;
                e.preventDefault();
                e.stopPropagation();
                const label = row.dataset.ctpLabel;
                const isMini = label === "mini";
                const win = isMini
                    ? { on: currentMenuState && currentMenuState.mini_click_through === true }
                    : (currentMenuState.click_through_windows || []).find((w) => w.label === label);
                const next = !(win && win.on === true);
                // Optimistic flip; the backend broadcast re-renders.
                if (isMini) {
                    if (currentMenuState) currentMenuState.mini_click_through = next;
                } else if (win) {
                    win.on = next;
                }
                renderState(currentMenuState);
                if (window.cc && window.cc.setWidgetClickThrough) {
                    window.cc.setWidgetClickThrough(label, next).catch(console.error);
                }
            });
        }
        const allOn = document.getElementById("btn-ctp-all-on");
        if (allOn) {
            allOn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentMenuState) {
                    currentMenuState.mini_click_through = true;
                    (currentMenuState.click_through_windows || []).forEach((w) => { w.on = true; });
                    renderState(currentMenuState);
                }
                if (window.cc && window.cc.setAllClickThrough) {
                    window.cc.setAllClickThrough(true).catch(console.error);
                }
            });
        }
        const allOff = document.getElementById("btn-ctp-all-off");
        if (allOff) {
            allOff.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (currentMenuState) {
                    currentMenuState.mini_click_through = false;
                    (currentMenuState.click_through_windows || []).forEach((w) => { w.on = false; });
                    renderState(currentMenuState);
                }
                if (window.cc && window.cc.setAllClickThrough) {
                    window.cc.setAllClickThrough(false).catch(console.error);
                }
            });
        }
    }
    wireClickThrough();

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

    function setCardOffscreen(off) {
        if (stageEl) stageEl.classList.toggle("is-offscreen", off);
        if (mainCardEl) mainCardEl.classList.toggle("is-offscreen", off);
    }

    function renderTrayPinTipBody(text) {
        const body = document.getElementById("tray-pin-tip-body");
        if (!body) return;

        body.replaceChildren();
        const marker = "(^)";
        const markerIndex = text.indexOf(marker);
        if (markerIndex < 0) {
            body.textContent = text;
            return;
        }

        const beforeMarker = text.slice(0, markerIndex);
        const afterMarker = text.slice(markerIndex + marker.length);
        const match = beforeMarker.match(/^(.*\s)(\S+\s+\S+\s*)$/s);
        const prefix = match ? match[1] : beforeMarker;
        const overflowLead = match ? match[2].trimEnd() : "";

        body.appendChild(document.createTextNode(prefix));

        const noWrapGroup = document.createElement("span");
        noWrapGroup.className = "tray-pin-tip-overflow-group";
        noWrapGroup.appendChild(document.createTextNode(overflowLead));

        const indicator = document.createElement("span");
        indicator.className = "tray-overflow-indicator";
        indicator.setAttribute("aria-hidden", "true");
        noWrapGroup.appendChild(indicator);

        body.appendChild(noWrapGroup);
        body.appendChild(document.createTextNode(afterMarker));
    }

    function openTrayPinTip() {
        cancelFlyoutTimers();
        setActiveFlyout("pin-tip");
    }

    function closeTrayPinTip() {
        cancelFlyoutTimers();
        setActiveFlyout("help");
    }

    function openTrayPinTipSettings() {
        if (window.cc && window.cc.openTaskbarSettings) {
            window.cc.openTaskbarSettings().catch((e) => {
                console.error("openTaskbarSettings failed:", e);
            });
        }
        setTimeout(() => hideMenu(), 250);
    }

    document.querySelectorAll(".tray-nav-item[data-flyout]").forEach((btn) => {
        const target = btn.dataset.flyout;
        btn.addEventListener("mouseenter", () => scheduleFlyoutOpen(target));
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelFlyoutTimers();
            const isSame = activeFlyout === target || (target === "help" && activeFlyout === "pin-tip");
            setActiveFlyout(isSame ? null : target);
        });
    });

    if (mainCardEl) {
        mainCardEl.querySelectorAll(":scope > .tray-header, :scope > .tray-group > .tray-item:not([data-flyout]), :scope > .tray-group > .tray-status").forEach((el) => {
            el.addEventListener("mouseenter", () => scheduleFlyoutClose());
        });
        mainCardEl.addEventListener("mouseleave", () => scheduleFlyoutClose());
    }

    document.querySelectorAll(".tray-flyout").forEach((panel) => {
        panel.addEventListener("mouseenter", () => cancelFlyoutTimers());
        panel.addEventListener("mouseleave", () => scheduleFlyoutClose());
    });

    const btnBackPinTip = document.getElementById("btn-back-pin-tip");
    if (btnBackPinTip) {
        btnBackPinTip.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeTrayPinTip();
        });
    }

    const btnPinTipGotIt = document.getElementById("btn-pin-tip-got-it");
    if (btnPinTipGotIt) {
        btnPinTipGotIt.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeTrayPinTip();
        });
    }

    const btnPinTipSettings = document.getElementById("btn-pin-tip-settings");
    if (btnPinTipSettings) {
        btnPinTipSettings.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openTrayPinTipSettings();
        });
    }

    const btnSuiteMore = document.getElementById("btn-suite-more");
    if (btnSuiteMore) {
        btnSuiteMore.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUrl("https://cybergems.org/#apps");
            setTimeout(() => hideMenu(), 250);
        });
    }

    const btnSuiteBrand = document.getElementById("btn-suite-brand");
    if (btnSuiteBrand) {
        btnSuiteBrand.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUrl("https://cybergems.org");
            setTimeout(() => hideMenu(), 250);
        });
    }

    let suiteAppsCache = null;

    function suiteLocale() {
        if (!window.ccI18n) return "en";
        const raw = window.ccI18n.getLang();
        const lang = raw === "auto" ? window.ccI18n.detectDefault() : raw;
        return lang === "es" ? "es" : "en";
    }

    function loadSuiteTrayItems() {
        try {
            let apps = window.CC_SUITE_DATA ? window.CC_SUITE_DATA.apps : null;
            if (!Array.isArray(apps) || !apps.length) {
                fetch("../assets/suite/suite.json")
                    .then((r) => r.json())
                    .then((data) => {
                        if (Array.isArray(data?.apps)) renderTraySuiteApps(data.apps);
                    })
                    .catch(() => {});
                return;
            }
            renderTraySuiteApps(apps);
        } catch (e) {
            console.warn("loadSuiteTrayItems error:", e);
        }
    }

    function renderTraySuiteApps(apps) {
        suiteAppsCache = apps;
        const suiteList = document.getElementById("tray-suite-list");
        if (!suiteList) return;
        const lang = suiteLocale();
        const sisters = apps.filter((a) => a && a.slug !== "cyberclock");
        suiteList.innerHTML = "";

        for (const app of sisters) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "tray-item tray-suite-item";
            const ico = document.createElement("span");
            ico.className = "tray-suite-ico";
            const img = document.createElement("img");
            img.src = `../assets/suite/${app.slug}.png`;
            img.alt = "";
            ico.appendChild(img);
            const copy = document.createElement("span");
            copy.className = "tray-suite-copy";
            const name = document.createElement("span");
            name.className = "tray-suite-name";
            name.textContent = app.name;
            const short = document.createElement("span");
            short.className = "tray-suite-short";
            const desc = app.short && (app.short[lang] || app.short.en);
            short.textContent = desc || "";
            short.hidden = !desc;
            copy.appendChild(name);
            copy.appendChild(short);
            btn.appendChild(ico);
            btn.appendChild(copy);
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUrl(app.site || `https://cybergems.org/apps/${app.slug}/`);
                setTimeout(() => hideMenu(), 250);
            });
            suiteList.appendChild(btn);
        }
    }
    loadSuiteTrayItems();

    // Help sub-item handlers: URLs open in the browser, the pin opens
    // Windows settings, about/check-updates open the dedicated About
    // window (backend "about" action) — none close the menu.
    document.querySelectorAll(".tray-sub-item[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === "center-widgets") {
                runAction("center_widgets");
            } else if (action === "pin-tray-icon") {
                openTrayPinTip();
            } else if (action === "datetime-properties") {
                if (window.cc && window.cc.openDatetimeProperties) {
                    window.cc.openDatetimeProperties();
                }
                setTimeout(() => hideMenu(), 250);
            } else if (action === "about-modal") {
                runAction("about");
            } else if (action === "check-updates") {
                runAction("check-updates");
            } else if (HELP_URLS[action]) {
                openUrl(HELP_URLS[action]);
                setTimeout(() => hideMenu(), 250);
            }
        });
    });

    function hideMenu() {
        collapseAllSubmenus();
        if (window.cc && window.cc.hideTrayMenu) {
            window.cc.hideTrayMenu();
        }
    }

    // The About dialog lives in its own window now (see src/about/) —
    // no in-menu modal.


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
            if (action === "mode-full" || action === "mode-mini") {
                const want = action === "mode-full" ? "full" : "mini";
                const current = currentMenuState && currentMenuState.window_mode === "full" ? "full" : "mini";
                runAction(want === current ? "reveal" : want);
            } else {
                runAction(action);
            }
        });
    });

    // Prevent context menu
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // Click on transparent canvas outside cards dismisses the menu
    document.addEventListener("mousedown", (e) => {
        const target = e.target;
        if (!(target instanceof Node)) return;
        if (mainCardEl && mainCardEl.contains(target)) return;
        const openPanel = getFlyoutPanel(activeFlyout);
        if (openPanel && openPanel.contains(target)) return;
        hideMenu();
    });

    // Keyboard navigation and Escape dismissal
    window.addEventListener("keydown", (e) => {
        const openPanel = getFlyoutPanel(activeFlyout);
        const activeEl = document.activeElement;
        const inFlyout = Boolean(openPanel && activeEl && openPanel.contains(activeEl));
        const flyoutSide = stageEl?.dataset.flyoutSide === "right" ? "right" : "left";
        const openKey = flyoutSide === "left" ? "ArrowLeft" : "ArrowRight";
        const closeKey = flyoutSide === "left" ? "ArrowRight" : "ArrowLeft";

        if (e.key === "Escape") {
            e.preventDefault();
            if (activeFlyout === "pin-tip") {
                closeTrayPinTip();
            } else if (activeFlyout !== null) {
                closeFlyoutAndReturnFocus();
            } else {
                hideMenu();
            }
            return;
        }

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const scope = (inFlyout && openPanel) ? openPanel : mainCardEl;
            if (!scope) return;
            const buttons = Array.from(scope.querySelectorAll("button.tray-item:not(:disabled), button.tray-pin-tip-btn:not(:disabled), button.tray-back-btn:not(:disabled)"));
            if (!buttons.length) return;
            e.preventDefault();
            const idx = buttons.indexOf(activeEl);
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const nextIdx = idx === -1 ? (delta > 0 ? 0 : buttons.length - 1) : (idx + delta + buttons.length) % buttons.length;
            buttons[nextIdx]?.focus();
            return;
        }

        if (e.key === openKey || (!inFlyout && e.key === closeKey)) {
            const triggerTarget = activeEl && activeEl.dataset ? activeEl.dataset.flyout : null;
            if (!inFlyout && triggerTarget) {
                e.preventDefault();
                openFlyoutAndFocusFirst(triggerTarget);
                return;
            }
        }

        if (e.key === closeKey && activeFlyout !== null) {
            e.preventDefault();
            if (activeFlyout === "pin-tip") closeTrayPinTip();
            else closeFlyoutAndReturnFocus();
        }
    });

    // Dismiss on blur
    window.addEventListener("blur", () => {
        collapseAllSubmenus();
        setTimeout(() => {
            if (window.cc && window.cc.hideTrayMenu) {
                window.cc.hideTrayMenu();
            }
        }, 100);
    });

    // Tauri event subscriptions
    if (window.cc) {
        let stateVersion = 0;
        async function refreshTrayState() {
            if (!window.cc.getTrayMenuState) return;
            const version = stateVersion;
            const state = await window.cc.getTrayMenuState();
            if (version === stateVersion) renderState(state);
        }
        const stateSubscription = window.cc.onTrayMenuState
            ? window.cc.onTrayMenuState((state) => {
                stateVersion++;
                renderState(state);
            }) : Promise.resolve();
        window.cc.onRelaxWidgetOpen?.(open => {
            stateVersion++;
            if (currentMenuState) currentMenuState.relax_widget_open = open;
            const button = document.querySelector('.tray-item[data-action="new_relax"]');
            button.disabled = open;
            refreshTrayState().catch(console.error);
        }).catch(console.error);

        let prepareSeq = 0;
        let reportRaf1 = null;
        let reportRaf2 = null;
        let reportFallbackTimer = null;
        function cancelPendingReport() {
            if (reportRaf1 !== null) {
                cancelAnimationFrame(reportRaf1);
                reportRaf1 = null;
            }
            if (reportRaf2 !== null) {
                cancelAnimationFrame(reportRaf2);
                reportRaf2 = null;
            }
            if (reportFallbackTimer !== null) {
                clearTimeout(reportFallbackTimer);
                reportFallbackTimer = null;
            }
        }
        function schedulePaintedReport(seq) {
            cancelPendingReport();
            let sent = false;
            const fire = () => {
                if (sent || seq !== prepareSeq) return;
                sent = true;
                cancelPendingReport();
                reportSize();
            };
            // Flush layout with the new data-flyout-side / DPI before scheduling paint.
            if (stageEl) void stageEl.offsetWidth;
            // Wait two animation frames so Chromium paints the updated side before win.show(),
            // with a short timeout guard in case WebView2 throttles rAF while hidden.
            reportFallbackTimer = setTimeout(fire, 60);
            reportRaf1 = requestAnimationFrame(() => {
                reportRaf1 = null;
                reportRaf2 = requestAnimationFrame(() => {
                    reportRaf2 = null;
                    fire();
                });
            });
        }

        async function prepareTrayMenu() {
            const seq = ++prepareSeq;
            cancelPendingReport();
            await refreshTrayState();
            if (seq !== prepareSeq) return;
            collapseAllSubmenus();
            setCardOffscreen(false);
            schedulePaintedReport(seq);
        }

        let dprMedia = null;
        function watchDevicePixelRatio() {
            if (dprMedia) dprMedia.removeEventListener("change", onDprChange);
            dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            dprMedia.addEventListener("change", onDprChange, { once: true });
        }
        function onDprChange() {
            if (mainCardEl && !mainCardEl.classList.contains("is-offscreen")) {
                schedulePaintedReport(prepareSeq);
            }
            watchDevicePixelRatio();
        }
        watchDevicePixelRatio();

        const showSubscription = window.cc.onTrayMenuShow
            ? window.cc.onTrayMenuShow(() => prepareTrayMenu().catch(console.error))
            : Promise.resolve();
        if (window.cc.onTrayMenuHide) {
            window.cc.onTrayMenuHide(() => {
                prepareSeq++;
                cancelPendingReport();
                setCardOffscreen(true);
            });
        }

        Promise.all([stateSubscription, showSubscription]).then(prepareTrayMenu).catch(console.error);
    }
