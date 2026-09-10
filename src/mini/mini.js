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

    const DESIGN_HEIGHTS = { 1: 48, 2: 56, 3: 46, 4: 52, 5: 50, 6: 48, 7: 34, 8: 34, 9: 34, 10: 32, 11: 34, 12: 34 };
    const DESIGN_WIDTHS  = { 1: 260, 2: 320, 3: 260, 4: 260, 5: 260, 6: 260, 7: 300, 8: 300, 9: 300, 10: 260, 11: 300, 12: 300 };

    // Collapsed widths: single-row skins must fit the worst-case 12h+seconds
    // string ("12:34:56 PM") at their native font size — measured per skin
    // (see git history for the deficit audit that set these).
    const COLLAPSED_HEIGHTS = { 1: 34, 2: 38, 3: 34, 4: 36, 5: 34, 6: 34, 7: 34, 8: 34, 9: 34, 10: 32, 11: 34, 12: 34 };
    const COLLAPSED_WIDTHS  = { 1: 260, 2: 320, 3: 260, 4: 260, 5: 260, 6: 260, 7: 188, 8: 188, 9: 200, 10: 180, 11: 175, 12: 170 };

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
        const design = cfg.miniDesign || 1;
        const isCollapsible = cfg.miniCollapseDate === true;
        const zoom = zoomFactor();

        let baseWidth = DESIGN_WIDTHS[design] || 260;
        let baseHeight = DESIGN_HEIGHTS[design] || 48;

        if (isCollapsible && !isHovered) {
            baseWidth = COLLAPSED_WIDTHS[design] || baseWidth;
            baseHeight = COLLAPSED_HEIGHTS[design] || baseHeight;
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
    let lastCollapse = null;
    let lastZoom = null;
    function applySettings(s) {
        const designChanged = s.miniDesign !== lastDesign;
        const collapseChanged = s.miniCollapseDate !== lastCollapse;
        const zoomChanged = s.miniZoom !== lastZoom && s.miniZoom !== undefined;
        lastDesign = s.miniDesign;
        lastCollapse = s.miniCollapseDate;
        lastZoom = s.miniZoom;

        cfg = s;
        calNotes = s.calendarNotes || {};
        document.body.dataset.theme = s.theme || "arctic-ice";

        window.ccI18n.setLang(s.language || "auto");
        const btnAot = document.getElementById("btn-aot");
        if (btnAot) btnAot.title = window.ccI18n.t("mini.tooltip.aot");
        const btnFull = document.getElementById("btn-full");
        if (btnFull) btnFull.title = window.ccI18n.t("mini.tooltip.full");

        const shell = document.getElementById("shell");
        if (shell) {
            shell.dataset.design = s.miniDesign || "1";
            shell.classList.toggle("collapse-date", s.miniCollapseDate === true);
            shell.style.setProperty("--bg-op", s.miniBgOpacity ?? 1.0);
            shell.style.setProperty("--fg-op", s.miniOpacity ?? 1.0);
            shell.style.setProperty("--mini-zoom", String(zoomFactor()));
        }

        if (s.miniScanlines === false)
            document.body.classList.add("no-scanlines");
        else document.body.classList.remove("no-scanlines");

        const aotOn = s.alwaysOnTop || false;
        document.getElementById("btn-aot").classList.toggle("active", aotOn);

        // Master audio mute (tray toggle): gate chimes and ambient gain.
        if (window.audioEngine) window.audioEngine.setMuted(s.audioMuted === true);

        updateClock();

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

        // Resize window to match the skin height/width when design or collapse setting changes
        if (designChanged || collapseChanged || zoomChanged || lastAppliedWidth === 0) {
            // Zoom changes re-anchor the window to its visual center (see
            // set_window_size); design/collapse swaps keep the top-left anchor.
            syncWindowSize(true, zoomChanged);
        }
    }

    // ═══════════════════════════════════════════════════════
    // HOVER TOOLTIP — today's note + upcoming count
    // ═══════════════════════════════════════════════════════
    const timeBlock = document.querySelector(".time-block");
    const tipEl = document.getElementById("mini-tip");
    const shellEl = document.getElementById("shell");
    let tipTimer = null;

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
        expandDate();
        refreshTipContent();
        positionTip();
        
        tipTimer = setTimeout(() => {
            if (isDragging) return;
            positionTip();
            isTipVisible = true;
            tipEl.classList.add("show");
            syncWindowSize();
        }, 800);
    });

    timeBlock.addEventListener("mouseleave", (e) => {
        clearTimeout(tipTimer);
        tipTimer = null;
        isTipVisible = false;
        tipEl.classList.remove("show");
        if (e.relatedTarget && e.relatedTarget.closest(".controls")) {
            collapseDate();
        }
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
            clearTimeout(tipTimer);
            tipTimer = null;
            isTipVisible = false;
            tipEl.classList.remove("show");
            collapseDate();
        });
    }

    document.body.addEventListener("mouseleave", () => {
        clearTimeout(tipTimer);
        tipTimer = null;
        isTipVisible = false;
        tipEl.classList.remove("show");
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
        collapseDate();
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
    function syncMiniMotion() {
        const shouldPause =
            document.hidden || activeBackendLabel === "main";
        document.body.classList.toggle("mini-paused", shouldPause);
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

    // ═══════════════════════════════════════════════════════
    // BUTTON HANDLERS
    // ═══════════════════════════════════════════════════════
    document.getElementById("btn-full").addEventListener("click", () => window.cc.goFull());
    document.getElementById("btn-aot").addEventListener("click", async () => {
        const on = !document.getElementById("btn-aot").classList.contains("active");
        window.cc.saveSettings({ alwaysOnTop: on });
        document.getElementById("btn-aot").classList.toggle("active", on);
    });

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

        // Immediately cancel and dismiss hover popup if visible/pending
        clearTimeout(tipTimer);
        tipTimer = null;
        if (isTipVisible) {
            isTipVisible = false;
            tipEl.classList.remove("show");
            syncWindowSize();
        }

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