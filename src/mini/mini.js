    let cfg = {};
    let calNotes = {};
    
    function getDays() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]
            : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    }

    function getMonths() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
            : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    }

    function isoNow() {
        const n = new Date();
        return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
    }
    function countUpcoming() {
        const todayKey = isoNow();
        let c = 0;
        for (const k in calNotes) {
            if ((calNotes[k]||"").trim() && k >= todayKey) c++;
        }
        return c;
    }

    function pad(n) { return String(n).padStart(2, "0"); }

    function updateClock() {
        const now = new Date();
        let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
        const noSeconds = false;

        let hh, mm, ss, ampm = "";
        if (cfg.clockFormat === "12h") {
            ampm = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
        }
        hh = pad(h); mm = pad(m); ss = pad(s);
        const withSeconds = !noSeconds && cfg.showSeconds !== false;
        const timeStr = ampm
            ? `${hh}:${mm}${withSeconds ? ":" + ss : ""} ${ampm}`
            : `${hh}:${mm}${withSeconds ? ":" + ss : ""}`;

        setDigits(document.getElementById("mini-time"), timeStr);

        const d = now;
        const days = getDays();
        const months = getMonths();
        document.getElementById("mini-date").textContent =
            `${days[d.getDay()]} · ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;

        // Keep the real-sun phase in sync across phase boundaries (the
        // dataset attribute is a no-op write when the phase hasn't changed).
        const shellForSolar = document.getElementById("shell");
        if ((cfg.miniDesign || 1) == 7 && cfg.miniSolarReal === true) {
            shellForSolar.dataset.solar = solarPhaseFor(now.getHours());
        } else if (shellForSolar.dataset.solar) {
            delete shellForSolar.dataset.solar;
        }
    }

    // Fixed-width digit cells (same pattern as the main window's digital
    // clock — Orbitron and other display fonts have no tabular figures,
    // so "1" is much narrower than "0" and the layout wobbles each tick).
    // Each digit gets its own equal-width box (1ch = the advance width of
    // "0" in the active font), centered; the blinking colons sit in their
    // own cells. Skips DOM work entirely when the string is unchanged.
    function setDigits(el, val) {
        if (el.dataset.digitsValue === val) return;
        el.dataset.digitsValue = val;
        el.replaceChildren();
        for (const ch of val) {
            if (ch === ":") {
                const c = document.createElement("span");
                c.className = "t-colon";
                c.textContent = ":";
                el.appendChild(c);
            } else if (/\d/.test(ch)) {
                const d = document.createElement("span");
                d.className = "digit";
                d.textContent = ch;
                el.appendChild(d);
            } else {
                el.appendChild(document.createTextNode(ch));
            }
        }
    }

    // Real-sun phase for the Sunset Pulse skin (design 7). Derived from the
    // local hour only (no geolocation), computed once per tick, and only
    // applied when the user enabled it — see applySettings. Phases:
    // dawn 5-8h, day 8-16h, sunset 16-19h, night 19-5h.
    function solarPhaseFor(hour) {
        if (hour >= 5 && hour < 8) return "dawn";
        if (hour >= 8 && hour < 16) return "day";
        if (hour >= 16 && hour < 19) return "sunset";
        return "night";
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW SIZING — Each skin has its own dimensions, then the
    // zoom factor (miniZoom) multiplies them. The shell renders at
    // the natural skin size and is scaled via CSS transform (see
    // mini.css), so these are the window dimensions, in logical px.
    // ═══════════════════════════════════════════════════════

    // Each skin defines base dimensions (w, h) and collapsed dimensions (cw, ch)
    // for both "stacked" (2-row compact) and "inline" (1-row slim bar) form factors.
    const DESIGN_SIZES = {
        1:  { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 310, h: 34, cw: 190, ch: 34 } },
        2:  { stacked: { w: 260, h: 48, cw: 260, ch: 38 }, inline: { w: 310, h: 34, cw: 195, ch: 34 } },
        3:  { stacked: { w: 260, h: 46, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 185, ch: 34 } },
        4:  { stacked: { w: 260, h: 52, cw: 260, ch: 36 }, inline: { w: 310, h: 36, cw: 190, ch: 36 } },
        5:  { stacked: { w: 260, h: 50, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 185, ch: 34 } },
        6:  { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 185, ch: 34 } },
        7:  { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 188, ch: 34 } },
        8:  { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 188, ch: 34 } },
        9:  { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 200, ch: 34 } },
        10: { stacked: { w: 260, h: 48, cw: 260, ch: 32 }, inline: { w: 300, h: 32, cw: 180, ch: 32 } },
        11: { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 175, ch: 34 } },
        12: { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 300, h: 34, cw: 170, ch: 34 } },
        13: { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 310, h: 34, cw: 190, ch: 34 } },
        14: { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 310, h: 34, cw: 190, ch: 34 } },
        15: { stacked: { w: 260, h: 48, cw: 260, ch: 34 }, inline: { w: 310, h: 34, cw: 190, ch: 34 } }
    };

    function getEffectiveLayout() {
        if (cfg.miniLayout === "stacked" || cfg.miniLayout === "inline") {
            return cfg.miniLayout;
        }
        const d = parseInt(cfg.miniDesign, 10) || 1;
        return d <= 6 ? "stacked" : "inline";
    }

    // Discrete zoom stops for the mini clock (slider index → factor).
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    function zoomFactor() {
        const z = cfg.miniZoom ?? 1;
        return Number.isFinite(z) && z > 0 ? z : 1;
    }

    let isHovered = false;
    let isTipVisible = false;
    let lastAppliedWidth = 0;
    let lastAppliedHeight = 0;

    function getCurrentTargetSize() {
        const design = Math.min(15, Math.max(1, parseInt(cfg.miniDesign, 10) || 1));
        const layout = getEffectiveLayout();
        const isCollapsible = cfg.miniCollapseDate === true;
        const zoom = zoomFactor();

        const skinSizes = DESIGN_SIZES[design] || DESIGN_SIZES[1];
        const layoutSizes = skinSizes[layout] || skinSizes.stacked;

        let baseWidth = layoutSizes.w;
        let baseHeight = layoutSizes.h;

        if (isCollapsible && !isHovered) {
            baseWidth = layoutSizes.cw || baseWidth;
            baseHeight = layoutSizes.ch || baseHeight;
        }

        if (isTipVisible) {
            const tipHeight = tipEl.offsetHeight || 80;
            baseHeight += (tipHeight + 16) / zoom;
        }

        return { width: Math.round(baseWidth * zoom), height: Math.round(baseHeight * zoom) };
    }

    function syncWindowSize(force = false, recenter = false) {
        const target = getCurrentTargetSize();
        if (force || recenter || target.width !== lastAppliedWidth || target.height !== lastAppliedHeight) {
            lastAppliedWidth = target.width;
            lastAppliedHeight = target.height;
            target.recenter = recenter;
            window.cc.setWindowSize(target);
        }
    }

    let lastDesign = null;
    let lastLayout = null;
    let lastCollapse = null;
    let lastZoom = null;
    function applySettings(s) {
        const designChanged = s.miniDesign !== lastDesign;
        const layoutChanged = s.miniLayout !== lastLayout;
        const collapseChanged = s.miniCollapseDate !== lastCollapse;
        const zoomChanged = s.miniZoom !== lastZoom && s.miniZoom !== undefined;
        lastDesign = s.miniDesign;
        lastLayout = s.miniLayout;
        lastCollapse = s.miniCollapseDate;
        lastZoom = s.miniZoom;

        cfg = s;
        calNotes = s.calendarNotes || {};
        window.CCTint.apply(s.theme || "ice");

        window.ccI18n.setLang(s.language || "auto");
        window.ccI18n.apply(document);

        const shell = document.getElementById("shell");
        if (shell) {
            const activeDesign = Math.min(15, Math.max(1, parseInt(s.miniDesign, 10) || 1));
            const activeLayout = s.miniLayout || (activeDesign <= 6 ? "stacked" : "inline");
            shell.dataset.design = String(activeDesign);
            shell.dataset.layout = activeLayout;
            shell.classList.toggle("collapse-date", s.miniCollapseDate === true);
            shell.style.setProperty("--bg-op", s.miniBgOpacity ?? 1.0);
            shell.style.setProperty("--fg-op", s.miniOpacity ?? 1.0);
            shell.style.setProperty("--mini-zoom", String(zoomFactor()));

            // Typography Studio: Custom font, weight & style
            if (s.miniCustomFont && s.miniCustomFont !== "default") {
                shell.style.setProperty("--mini-custom-font", `"${s.miniCustomFont}", sans-serif`);
            } else {
                shell.style.removeProperty("--mini-custom-font");
            }

            if (s.miniFontBold !== undefined && s.miniFontBold !== null) {
                shell.style.setProperty("--mini-custom-weight", s.miniFontBold ? "700" : "400");
            } else {
                shell.style.removeProperty("--mini-custom-weight");
            }

            if (s.miniFontItalic !== undefined && s.miniFontItalic !== null) {
                shell.style.setProperty("--mini-custom-style", s.miniFontItalic ? "italic" : "normal");
            } else {
                shell.style.removeProperty("--mini-custom-style");
            }
        }
        const tipEl = document.getElementById("mini-tip");
        if (tipEl) {
            tipEl.dataset.design = s.miniDesign || "1";
        }

        if (s.miniScanlines === false)
            document.body.classList.add("no-scanlines");
        else document.body.classList.remove("no-scanlines");

        // User motion toggle: zero ALL mini movement (animations AND
        // transitions) via CSS. Body class mirrors the no-scanlines pattern.
        document.body.classList.toggle("no-animations", s.miniNoAnimations === true);

        // Click-through: the backend sets the OS-level ignore-cursor flag;
        // the body class gives a subtle visual cue (slight dim) that the
        // clock no longer responds to the mouse.
        document.body.classList.toggle("click-through", s.miniClickThrough === true);

        const aotOn = s.alwaysOnTop || false;
        document.getElementById("btn-aot").classList.toggle("active", aotOn);

        // Master audio mute (tray toggle): gate chimes and ambient gain.
        if (window.audioEngine) window.audioEngine.setMuted(s.audioMuted === true);

        updateClock();
        updateDriftIndicator();
        resetAutoFadeTimer();

        // Real-sun cycle for the Sunset Pulse skin (design 7). Applied as a
        // data-solar phase attribute on the shell; CSS owns the palettes.
        const shellEl = document.getElementById("shell");
        if (shellEl) {
            if ((s.miniDesign || 1) == 7 && s.miniSolarReal === true) {
                shellEl.dataset.solar = solarPhaseFor(new Date().getHours());
            } else {
                delete shellEl.dataset.solar;
            }
        }

        // Resize window to match the skin height/width when design, layout or collapse setting changes
        if (designChanged || layoutChanged || collapseChanged || zoomChanged || lastAppliedWidth === 0) {
            // Zoom changes re-anchor the window to its visual center (see
            // set_window_size); design/collapse swaps keep the top-left anchor.
            syncWindowSize(true, zoomChanged);
        }
        setupMiniAutoCycle();
    }

    // ═══════════════════════════════════════════════════════
    // HOVER TOOLTIP — today's note + upcoming count
    // ═══════════════════════════════════════════════════════
    const timeBlock = document.querySelector(".time-block");
    const tipEl = document.getElementById("mini-tip");
    const shellEl = document.getElementById("shell");
    let tipTimer = null;

    function updateDriftIndicator() {
        const shell = document.getElementById("shell");
        if (!shell) return;
        const drift = cfg ? cfg.clockDriftMs : null;
        const hasDrift = drift != null && Math.abs(drift) > 60000;
        shell.classList.toggle("has-drift", hasDrift);
    }

    if (window.cc && window.cc.onClockAccuracy) {
        window.cc.onClockAccuracy((payload) => {
            if (!payload || !cfg) return;
            if (payload.driftMs !== undefined) {
                cfg.clockDriftMs = payload.driftMs;
                cfg.clockCheckedAt = payload.checkedAt;
                updateDriftIndicator();
                if (typeof isTipVisible !== "undefined" && isTipVisible) refreshTipContent();
            }
        });
    }

    function refreshTipContent() {
        const now = new Date();
        const lang = window.ccI18n.getEffectiveLang();
        const t = (key, vars) => window.ccI18n.t(key, vars);

        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        const todayKey = isoNow();
        const note = (calNotes[todayKey] || "").trim();
        const upcoming = countUpcoming();

        // Build with DOM nodes so user note text can never inject HTML.
        tipEl.replaceChildren();

        const dateDiv = document.createElement("div");
        dateDiv.className = "mini-tip-date";
        dateDiv.textContent = dateStr;
        tipEl.appendChild(dateDiv);
        tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";

        const drift = cfg ? cfg.clockDriftMs : null;
        if (drift != null && Math.abs(drift) > 60000) {
            const abs = Math.abs(drift);
            const driftTxt = abs < 60000 ? (abs / 1000).toFixed(1) + " s"
                : abs < 3600000 ? Math.round(abs / 60000) + " min"
                : abs < 86400000 ? Math.round(abs / 3600000) + " h"
                : Math.round(abs / 86400000) + " d";
            const sign = drift >= 0 ? "+" : "-";
            const driftStr = sign + driftTxt;

            const driftBlock = document.createElement("div");
            driftBlock.className = "mini-tip-drift-block";

            const driftHead = document.createElement("div");
            driftHead.className = "mini-tip-drift-head";
            driftHead.textContent = `⚠️ ${t("mini.tip.clockDriftTitle")}`;
            driftBlock.appendChild(driftHead);

            const driftMsg = document.createElement("div");
            driftMsg.className = "mini-tip-drift-msg";
            driftMsg.textContent = t("mini.tip.clockDriftMsg", { drift: driftStr });
            driftBlock.appendChild(driftMsg);

            const syncBtn = document.createElement("button");
            syncBtn.type = "button";
            syncBtn.className = "mini-tip-sync-btn";
            syncBtn.textContent = t("mini.tip.syncNow");
            syncBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                syncBtn.disabled = true;
                syncBtn.textContent = t("settings.general.timeSyncing");
                try {
                    const res = await window.cc.syncSystemClock();
                    if (res && res.drift_ms != null) {
                        cfg.clockDriftMs = res.drift_ms;
                        cfg.clockCheckedAt = res.checked_at;
                        updateDriftIndicator();
                        refreshTipContent();
                    }
                } catch (err) {
                    console.error("Sync error:", err);
                    syncBtn.textContent = t("settings.general.timeSyncError");
                }
            });
            driftBlock.appendChild(syncBtn);
            tipEl.appendChild(driftBlock);
            tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";
        }

        if (note) {
            const noteDiv = document.createElement("div");
            noteDiv.className = "mini-tip-note";
            noteDiv.textContent = `📝 ${note.split("\n")[0].trim()}`;
            tipEl.appendChild(noteDiv);
        } else {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "mini-tip-note empty";
            emptyDiv.textContent = `🌸 ${t("mini.tip.noNotes")}`;
            tipEl.appendChild(emptyDiv);

            const btnDiv = document.createElement("div");
            btnDiv.className = "mini-tip-action-btn";
            btnDiv.textContent = t("mini.tip.createNote");
            tipEl.appendChild(btnDiv);
        }

        let statText;
        if (upcoming === 0) {
            statText = t("mini.tip.scheduleClear");
        } else if (upcoming === 1) {
            statText = t("mini.tip.oneUpcoming");
        } else {
            statText = t("mini.tip.nUpcoming", { n: upcoming });
        }

        const statDiv = document.createElement("div");
        statDiv.className = "mini-tip-stat";
        if (upcoming > 1) {
            // "{n} upcoming events" with the count highlighted
            const parts = t("mini.tip.nUpcoming", { n: "\u0000" }).split("\u0000");
            statDiv.appendChild(document.createTextNode(parts[0] || ""));
            const countEl = document.createElement("b");
            countEl.textContent = String(upcoming);
            statDiv.appendChild(countEl);
            statDiv.appendChild(document.createTextNode(parts[1] || ""));
        } else {
            statDiv.textContent = statText;
        }
        tipEl.appendChild(statDiv);
    }

    function positionTip() {
        const r = shellEl.getBoundingClientRect();
        tipEl.style.left = r.left + r.width / 2 + "px";
        tipEl.style.top = r.bottom + 8 + "px";
    }

    const controlsEl = document.querySelector(".controls");
    let tipHideTimer = null;
    let isTimeBlockHovered = false;
    let isTipHovered = false;

    function hideTipNow() {
        clearTimeout(tipTimer);
        clearTimeout(tipHideTimer);
        tipTimer = null;
        tipHideTimer = null;
        isTipVisible = false;
        tipEl.classList.remove("show");
    }

    function scheduleTipHide(delay = 180) {
        clearTimeout(tipHideTimer);
        tipHideTimer = setTimeout(() => {
            tipHideTimer = null;
            if (isTimeBlockHovered || isTipHovered) return;
            hideTipNow();
            collapseDate();
            syncWindowSize();
        }, delay);
    }

    function expandDate() {
        if (isHovered) return;
        isHovered = true;
        shellEl.classList.add("is-expanded");
        if (cfg.miniCollapseDate) {
            syncWindowSize();
        }
    }

    function collapseDate() {
        if (!isHovered) return;
        isHovered = false;
        shellEl.classList.remove("is-expanded");
        if (cfg.miniCollapseDate) {
            syncWindowSize();
        }
    }

    let isDragging = false;

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    timeBlock.addEventListener("mouseenter", () => {
        if (isDragging) return;
        // Click-through mode: the OS never delivers mouse events, so skip
        // the tooltip pipeline (no timers, no resize churn) entirely.
        if (document.body.classList.contains("click-through")) return;
        isTimeBlockHovered = true;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        expandDate();
        refreshTipContent();
        positionTip();
        
        tipTimer = setTimeout(() => {
            if (isDragging) return;
            positionTip();
            isTipVisible = true;
            tipEl.classList.add("show");
            syncWindowSize();
        }, 1500);
    });

    timeBlock.addEventListener("mouseleave", () => {
        isTimeBlockHovered = false;
        clearTimeout(tipTimer);
        tipTimer = null;
        scheduleTipHide();
    });

    // The tooltip lives outside the shell, so keep it alive while the
    // pointer crosses the small gap between the clock and the card.
    tipEl.addEventListener("mouseenter", () => {
        isTipHovered = true;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        positionTip();
    });

    tipEl.addEventListener("mouseleave", () => {
        isTipHovered = false;
        scheduleTipHide();
    });

    // Status dot also triggers date expand
    const statusDot = document.querySelector(".status-dot");
    if (statusDot) {
        statusDot.addEventListener("mouseenter", () => {
            if (!isDragging) expandDate();
        });
    }

    // Controls (buttons): DO NOT expand date. If already expanded, collapse it so buttons stay rock solid!
    if (controlsEl) {
        controlsEl.addEventListener("mouseenter", () => {
            isTimeBlockHovered = false;
            isTipHovered = false;
            hideTipNow();
            collapseDate();
            syncWindowSize();
        });
        controlsEl.addEventListener("mouseleave", () => {
            hideActionTicker();
        });
    }

    document.body.addEventListener("mouseleave", () => {
        isTimeBlockHovered = false;
        isTipHovered = false;
        hideTipNow();
        hideActionTicker();
        miniHovered = false;
        collapseDate();
        syncMiniMotion();
        syncWindowSize();
    });

    shellEl.addEventListener("mouseenter", () => {
        miniHovered = true;
        syncMiniMotion();
    });

    shellEl.addEventListener("mouseleave", () => {
        miniHovered = false;
        syncMiniMotion();
        if (!isTimeBlockHovered && !isTipHovered) scheduleTipHide();
    });

    tipEl.addEventListener("click", () => {
        const todayKey = isoNow();
        window.cc.goFull();
        window.cc.menuAction("open-note:" + todayKey);
    });

    // ═══════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════
    // Decorative CSS animations are cheap thanks to the steps() LED
    // breathing (~5 frames/sec, composite-only), so they now run while
    // the mini clock is visible even without focus or hover — the
    // widget is the whole point of mini mode. They pause only when the
    // window is truly hidden (document.hidden) or when the backend
    // reports another window as the active one (full mode). The clock
    // text still updates every second regardless.
    let miniHovered = false;
    let miniAutoCycleTimer = null;
    function setupMiniAutoCycle() {
        if (miniAutoCycleTimer) {
            clearInterval(miniAutoCycleTimer);
            miniAutoCycleTimer = null;
        }
        if (!cfg || !cfg.miniAutoCycle) return;
        if (document.hidden || activeBackendLabel === "main") return;
        const mins = Math.max(1, parseInt(cfg.miniAutoCycleInterval, 10) || 15);
        const ms = mins * 60 * 1000;
        miniAutoCycleTimer = setInterval(() => {
            if (document.hidden || activeBackendLabel === "main") return;
            const cur = Math.min(15, Math.max(1, parseInt(cfg.miniDesign, 10) || 1));
            let next;
            if (cfg.miniAutoCycleMode === "random") {
                const others = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter((n) => n !== cur);
                next = others[Math.floor(Math.random() * others.length)];
            } else {
                next = (cur % 15) + 1;
            }
            cfg.miniDesign = next;
            window.cc.saveSettings({ miniDesign: next });
        }, ms);
    }

    function syncMiniMotion() {
        const shouldPause =
            document.hidden || activeBackendLabel === "main";
        document.body.classList.toggle("mini-paused", shouldPause);
        if (!shouldPause) {
            setupMiniAutoCycle();
        } else if (miniAutoCycleTimer) {
            clearInterval(miniAutoCycleTimer);
            miniAutoCycleTimer = null;
        }
    }
    // The Rust backend is the only reliable source of truth for which
    // window is on screen (WebView2 keeps reporting hidden windows as
    // focused — see the main window's cc:active-window notes).
    let activeBackendLabel = null;
    window.cc.onActiveWindow((label) => {
        activeBackendLabel = label;
        syncMiniMotion();
    });

    document.addEventListener("visibilitychange", syncMiniMotion);
    window.addEventListener("focus", syncMiniMotion);
    window.addEventListener("blur", syncMiniMotion);

    window.cc.onInit((s) => {
        applySettings(s);
        syncMiniMotion();
        requestAnimationFrame(() => {
            setInterval(updateClock, 1000);
        });
    });

    window.cc.onSettingsUpdated((s) => applySettings(s));

    window.cc.onAlarmChime((p) => {
        if (p.customPath) window.audioEngine.playFile(p.customPath, { loop: false });
        else window.audioEngine.chime(p.sound || "chime-digital", cfg.alarmVolume || 0.75);
    });

    if (window.cc && window.cc.onVoiceAnnounceTime) {
        window.cc.onVoiceAnnounceTime((p) => {
            if (window.VoiceAnnouncer) {
                window.VoiceAnnouncer.announce(cfg, p.hour, p.minute);
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION TICKER (Inline Button Tooltips)
    // ═══════════════════════════════════════════════════════
    const tickerIco = document.getElementById("ticker-ico");
    const tickerText = document.getElementById("ticker-text");
    let tickerTimer = null;
    const pinIcoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(45 12 12)"><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.58A2 2 0 0 1 15 9.18V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.18a2 2 0 0 1-.78 1.58l-2.78 3.58A2 2 0 0 0 5 15.24Z"/><path d="M12 17v5"/></g></svg>`;
    const fullIcoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`;

    function showActionTicker(actionKey, iconHtml) {
        if (!shellEl || !tickerText) return;
        tickerText.textContent = window.ccI18n ? window.ccI18n.t(actionKey) : actionKey;
        if (tickerIco) tickerIco.innerHTML = iconHtml || "";
        shellEl.classList.add("has-action-ticker");

        clearTimeout(tickerTimer);
        tickerTimer = setTimeout(() => {
            hideActionTicker();
        }, 1100);
    }

    function hideActionTicker() {
        clearTimeout(tickerTimer);
        if (!shellEl) return;
        shellEl.classList.remove("has-action-ticker");
    }

    // ═══════════════════════════════════════════════════════
    // BUTTON HANDLERS
    // ═══════════════════════════════════════════════════════
    const btnFull = document.getElementById("btn-full");
    const btnAot = document.getElementById("btn-aot");

    if (btnFull) {
        btnFull.addEventListener("click", () => window.cc.goFull());
        btnFull.addEventListener("mouseenter", () => {
            showActionTicker("mini.action.full", fullIcoSvg);
        });
        btnFull.addEventListener("mouseleave", hideActionTicker);
    }

    if (btnAot) {
        btnAot.addEventListener("click", async () => {
            const on = !btnAot.classList.contains("active");
            window.cc.saveSettings({ alwaysOnTop: on });
            btnAot.classList.toggle("active", on);
            showActionTicker(on ? "mini.action.aotActive" : "mini.action.aot", pinIcoSvg);
        });
        btnAot.addEventListener("mouseenter", () => {
            const isActive = btnAot.classList.contains("active");
            showActionTicker(isActive ? "mini.action.aotActive" : "mini.action.aot", pinIcoSvg);
        });
        btnAot.addEventListener("mouseleave", hideActionTicker);
    }

    // ═══════════════════════════════════════════════════════
    // CONTEXT MENU
    // ═══════════════════════════════════════════════════════
    const shell = document.getElementById("shell");
    shell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.cc.getWindowPosition().then(winPos => {
            window.cc.openMiniContextMenu({
                x: e.clientX, y: e.clientY,
                screenX: winPos[0] + e.clientX, screenY: winPos[1] + e.clientY,
            });
        }).catch(() => {
            window.cc.openMiniContextMenu({
                x: e.clientX, y: e.clientY,
                screenX: e.screenX, screenY: e.screenY,
            });
        });
    });

    // ═══════════════════════════════════════════════════════
    // DRAG — native Tauri only
    // ═══════════════════════════════════════════════════════
    shell.addEventListener("mousedown", (e) => {
        // Close context menu if open (it's a separate Tauri popup window)
        window.cc.closeMenuPopup().catch(() => {});
        if (e.target.closest(".controls")) return;
        if (e.button !== 0) return;

        // Immediately cancel and dismiss the hover popup if visible/pending.
        hideTipNow();
        hideActionTicker();
        collapseDate();
        syncWindowSize();

        if (cfg.miniPositionLocked === true) return;
        e.preventDefault();
        isDragging = true;
        window.cc.startDragging()
            .then(() => {
                isDragging = false;
                window.cc.saveMiniPosition().catch(() => {});
            })
            .catch(() => {
                isDragging = false;
            });
    });

    // ═══════════════════════════════════════════════════════
    // INACTIVITY AUTO-FADE
    // ═══════════════════════════════════════════════════════
    let autoFadeTimer = null;
    let isMouseOverMini = false;

    function resetAutoFadeTimer() {
        clearTimeout(autoFadeTimer);
        const sh = document.getElementById("shell");
        if (sh) sh.classList.remove("mini-auto-faded");

        const setting = cfg.miniAutoFade;
        if (!setting || setting === "off") return;

        const parts = setting.split("_");
        const targetOp = Math.max(0.1, Math.min(1.0, (parseInt(parts[0], 10) || 30) / 100));
        const delayMs = Math.max(1000, (parseInt(parts[1], 10) || 5) * 1000);

        if (sh) {
            sh.style.setProperty("--auto-fade-op", String(targetOp));
        }

        if (!isMouseOverMini) {
            autoFadeTimer = setTimeout(() => {
                if (!isMouseOverMini) {
                    const el = document.getElementById("shell");
                    if (el) el.classList.add("mini-auto-faded");
                }
            }, delayMs);
        }
    }

    document.addEventListener("mouseenter", () => {
        isMouseOverMini = true;
        clearTimeout(autoFadeTimer);
        const sh = document.getElementById("shell");
        if (sh) sh.classList.remove("mini-auto-faded");
    });

    document.addEventListener("mousemove", () => {
        if (!isMouseOverMini) {
            isMouseOverMini = true;
        }
        clearTimeout(autoFadeTimer);
        const sh = document.getElementById("shell");
        if (sh) sh.classList.remove("mini-auto-faded");
    });

    document.addEventListener("mouseleave", () => {
        isMouseOverMini = false;
        resetAutoFadeTimer();
    });

