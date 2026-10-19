    let cfg = {};
    let calNotes = {};
    let availableUpdateVersion = null; // declared early — used by hideTipNow guard
    let activeAlarmNotice = null;

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
        const dateStr = `${days[d.getDay()]} · ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
        const dateEl = document.getElementById("mini-date");
        if (dateEl && dateEl.textContent !== dateStr) {
            dateEl.textContent = dateStr;
        }

        paintDayProgress(now);

        // Keep the real-sun phase in sync across phase boundaries (the
        // dataset attribute is a no-op write when the phase hasn't changed).
        const shellForSolar = document.getElementById("shell");
        if ((cfg.miniDesign || 1) == 7 && cfg.miniSolarReal === true) {
            const phase = solarPhaseFor(now.getHours());
            if (shellForSolar.dataset.solar !== phase) {
                shellForSolar.dataset.solar = phase;
            }
        } else if (shellForSolar.dataset.solar) {
            delete shellForSolar.dataset.solar;
        }
    }

    // Fixed-width digit cells (same pattern as the main window's digital
    // clock — Orbitron and other display fonts have no tabular figures,
    // so "1" is much narrower than "0" and the layout wobbles each tick).
    // Each digit gets its own equal-width box (1ch = the advance width of
    // "0" in the active font), centered; the blinking colons sit in their
    // own cells. Skips DOM work entirely when the string is unchanged, and
    // mutates text in-place across second ticks to avoid tearing down DOM nodes.
    function setDigits(el, val) {
        if (!el || el.dataset.digitsValue === val) return;
        el.dataset.digitsValue = val;

        const children = el.childNodes;
        if (children.length === val.length) {
            let canReuse = true;
            for (let i = 0; i < val.length; i++) {
                const ch = val[i];
                const node = children[i];
                if (ch === ":" && node.className !== "t-colon") { canReuse = false; break; }
                if (/\d/.test(ch) && node.className !== "digit") { canReuse = false; break; }
            }
            if (canReuse) {
                for (let i = 0; i < val.length; i++) {
                    const ch = val[i];
                    const node = children[i];
                    if (node.textContent !== ch) {
                        node.textContent = ch;
                    }
                }
                return;
            }
        }

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
    function dayPercent(now) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const pct = Math.round(((now.getTime() - start) / 86400000) * 100);
        return Math.min(100, Math.max(0, pct));
    }

    function paintDayProgress(now) {
        const bar = document.getElementById("day-progress");
        if (!bar) return;
        if (cfg.miniDayProgress !== true) {
            if (!bar.hidden) bar.hidden = true;
            return;
        }
        const pct = dayPercent(now);
        if (bar.hidden) bar.hidden = false;
        if (bar.dataset.lastPct !== String(pct)) {
            bar.dataset.lastPct = String(pct);
            bar.style.setProperty("--day-pct", String(pct));
            bar.setAttribute("aria-valuenow", String(pct));
            const label = window.ccI18n
                ? window.ccI18n.t("mini.dayProgress.tip", { pct })
                : pct + "%";
            bar.setAttribute("aria-label", label);
            if (typeof isElementHovered === "function" && isElementHovered(bar)) {
                const tickerTextEl = document.getElementById("ticker-text");
                const shell = document.getElementById("shell");
                if (tickerTextEl && shell && shell.classList.contains("has-action-ticker")) {
                    tickerTextEl.textContent = label;
                }
            }
        }
    }

    function solarPhaseFor(hour) {
        if (hour >= 5 && hour < 8) return "dawn";
        if (hour >= 8 && hour < 16) return "day";
        if (hour >= 16 && hour < 19) return "sunset";
        return "night";
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW SIZING — The bar is as wide as its text. Zoom
    // scales that box; the window follows content × zoom.
    // Height stays on the layout (inline / stacked), so a
    // face change grows the width and leaves the silhouette.
    // ═══════════════════════════════════════════════════════

    function getEffectiveLayout() {
        if (cfg.miniLayout === "stacked" || cfg.miniLayout === "inline") {
            return cfg.miniLayout;
        }
        const d = parseInt(cfg.miniDesign, 10) || 1;
        return (d <= 6 || d === 16) ? "stacked" : "inline";
    }

    // Discrete zoom stops for the mini clock (slider index → factor).
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    function zoomFactor() {
        const z = cfg.miniZoom ?? 1;
        return Number.isFinite(z) && z > 0 ? z : 1;
    }

    // "default" / empty keeps the skin's curated face. An explicit bold
    // or italic forces that style; leaving them unset keeps the skin's.
    function applyFace(shell, slot, family, bold, italic) {
        const fontVar = slot === "date" ? "--mini-date-font" : "--mini-time-font";
        const weightVar = slot === "date" ? "--mini-date-weight" : "--mini-time-weight";
        const styleVar = slot === "date" ? "--mini-date-style" : "--mini-time-style";
        if (family && family !== "default") {
            shell.style.setProperty(fontVar, `"${family}", sans-serif`);
        } else {
            shell.style.removeProperty(fontVar);
        }
        if (bold === true) shell.style.setProperty(weightVar, "700");
        else if (bold === false) shell.style.setProperty(weightVar, "400");
        else shell.style.removeProperty(weightVar);
        if (italic === true) shell.style.setProperty(styleVar, "italic");
        else if (italic === false) shell.style.setProperty(styleVar, "normal");
        else shell.style.removeProperty(styleVar);
    }

    let isHovered = false;
    let isTipVisible = false;
    let lastAppliedWidth = 0;
    let lastAppliedHeight = 0;

    function measureBaseSize() {
        const shell = document.getElementById("shell");
        if (!shell) return { w: 280, h: 36 };
        const zoom = zoomFactor();
        const rect = shell.getBoundingClientRect();
        // rect is post-transform. scrollWidth is the unscaled content,
        // including a date the window is still too narrow to show.
        const borderX = shell.offsetWidth - shell.clientWidth;
        const borderY = shell.offsetHeight - shell.clientHeight;
        const w = Math.ceil(Math.max(shell.scrollWidth + borderX, rect.width / zoom));
        const h = Math.ceil(Math.max(shell.scrollHeight + borderY, rect.height / zoom));
        if (w < 40 || h < 20) return { w: 280, h: 36 };
        return { w, h };
    }

    function getCurrentTargetSize() {
        const zoom = zoomFactor();
        const base = measureBaseSize();
        return {
            width: Math.round(base.w * zoom),
            height: Math.round(base.h * zoom)
        };
    }

    function syncWindowSize(force = false, recenter = false) {
        const target = getCurrentTargetSize();
        const widthDelta = Math.abs(target.width - lastAppliedWidth);
        const heightDelta = Math.abs(target.height - lastAppliedHeight);
        if (force || recenter || widthDelta > 1 || heightDelta > 1) {
            lastAppliedWidth = target.width;
            lastAppliedHeight = target.height;
            target.recenter = recenter;
            if (window.cc && window.cc.setWindowSize) window.cc.setWindowSize(target);
        }
    }

    // Content width changes (face, seconds, AM/PM, collapsed date) without
    // a settings round-trip. Measuring after the frame avoids a 0px box.
    const shellForMeasure = document.getElementById("shell");
    if (shellForMeasure && typeof ResizeObserver !== "undefined") {
        let measureQueued = false;
        const observer = new ResizeObserver(() => {
            if (measureQueued) return;
            measureQueued = true;
            requestAnimationFrame(() => {
                measureQueued = false;
                syncWindowSize();
            });
        });
        observer.observe(shellForMeasure);
    }
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => syncWindowSize());
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
        if (s.showWidgetHints === false && typeof hideActionTicker === "function") hideActionTicker();
        calNotes = s.calendarNotes || {};
        window.CCTint.apply(s.theme || "ice");

        window.ccI18n.setLang(s.language || "auto");
        window.ccI18n.apply(document);

        const shell = document.getElementById("shell");
        if (shell) {
            const activeDesign = Math.min(20, Math.max(1, parseInt(s.miniDesign, 10) || 1));
            let activeLayout = s.miniLayout || ((activeDesign <= 6 || activeDesign === 16) ? "stacked" : "inline");
            // Collapse Date hides the second row, so 2 rows is not a real choice.
            if (s.miniCollapseDate === true && activeLayout === "stacked") {
                activeLayout = "inline";
                if (window.cc && window.cc.saveSettings && s.miniLayout !== "inline") {
                    window.cc.saveSettings({ miniLayout: "inline" });
                }
            }
            shell.dataset.design = String(activeDesign);
            shell.dataset.layout = activeLayout;
            shell.classList.toggle("collapse-date", s.miniCollapseDate === true);
            shell.style.setProperty("--bg-op", s.miniBgOpacity ?? 1.0);
            shell.style.setProperty("--fg-op", s.miniOpacity ?? 1.0);
            shell.style.setProperty("--mini-zoom", String(zoomFactor()));

            applyFace(shell, "time", s.miniCustomFont, s.miniFontBold, s.miniFontItalic);
            applyFace(shell, "date", s.miniDateFont, s.miniDateFontBold, s.miniDateFontItalic);
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
    // HOVER TOOLTIP — today's note + upcoming count (Separate Native Window)
    // ═══════════════════════════════════════════════════════
    const timeBlock = document.querySelector(".time-block");
    const shellEl = document.getElementById("shell");
    let tipTimer = null;
    let tipHideTimer = null;
    let isTimeBlockHovered = false;
    let isTipHovered = false;

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
                if (isTipVisible) openTip();
            }
        });
    }

    function buildTipPayload() {
        const now = new Date();
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        const todayKey = isoNow();
        const note = (calNotes[todayKey] || "").trim();
        const upcoming = countUpcoming();
        const drift = cfg ? cfg.clockDriftMs : null;

        let alarmData = null;
        if (activeAlarmNotice) {
            alarmData = {
                alarmId: activeAlarmNotice.alarmId,
                label: activeAlarmNotice.label,
                message: activeAlarmNotice.message,
                snoozeMinutes: activeAlarmNotice.snoozeMinutes || 10,
            };
        }

        let updateVer = null;
        if (availableUpdateVersion && !isUpdateSkipped(availableUpdateVersion)) {
            updateVer = availableUpdateVersion;
        }

        const isBottomHalf = (window.screenY || 0) > ((window.screen && window.screen.availHeight) || 1080) / 2;
        const initialPlacement = isBottomHalf ? "above" : "below";

        return {
            dateStr,
            note,
            upcoming,
            driftMs: drift,
            alarm: alarmData,
            updateVersion: updateVer,
            design: cfg ? (cfg.miniDesign || cfg.dialDesign || "1") : "1",
            theme: cfg ? cfg.theme : "ice",
            language: cfg ? cfg.language : "auto",
            placement: initialPlacement
        };
    }

    async function openTip() {
        if (isDragging || isPointerDown || popupMenuOpen) return;
        if (document.body.classList.contains("click-through")) return;
        const payload = buildTipPayload();
        isTipVisible = true;
        if (window.cc && window.cc.openMiniTip) {
            try {
                await window.cc.openMiniTip(payload);
            } catch (err) {
                console.error("Failed to open mini tip:", err);
            }
        }
    }

    function hideTipNow() {
        // Keep the tip visible while an alarm or an update notice is pending.
        if (activeAlarmNotice) return;
        if (availableUpdateVersion && !isUpdateSkipped(availableUpdateVersion)) return;
        clearTimeout(tipTimer);
        clearTimeout(tipHideTimer);
        tipTimer = null;
        tipHideTimer = null;
        isTipVisible = false;
        if (window.cc && window.cc.hideMiniTip) {
            window.cc.hideMiniTip().catch(() => {});
        }
    }

    function clearMiniAlarmNotice() {
        activeAlarmNotice = null;
        if (window.audioEngine && window.audioEngine.stopAlarmAlert) {
            window.audioEngine.stopAlarmAlert();
        }
        if (availableUpdateVersion && !isUpdateSkipped(availableUpdateVersion)) {
            openTip();
            return;
        }
        hideTipNow();
    }

    async function dismissMiniAlarm() {
        const id = activeAlarmNotice?.alarmId;
        clearMiniAlarmNotice();
        if (!id || !window.cc?.dismissAlarm) return;
        try {
            await window.cc.dismissAlarm(id);
        } catch (err) {
            console.error(err);
        }
    }

    async function showMiniAlarm(payload) {
        activeAlarmNotice = payload || {};
        openTip();
    }

    const controlsEl = document.querySelector(".controls");

    function isElementHovered(el) {
        if (!el || !(el instanceof Element)) return false;
        try {
            return el.matches(":hover");
        } catch (_) {
            return false;
        }
    }

    function isClockAreaElement(el) {
        if (!el || !(el instanceof Element)) return false;
        if (el.closest(".controls")) return false;
        return !!(el.closest(".time-block") || el.closest("#day-progress") || el.closest(".mini-shell"));
    }

    function scheduleTipHide(delay = 350) {
        clearTimeout(tipHideTimer);
        tipHideTimer = setTimeout(() => {
            tipHideTimer = null;
            if (!isTipVisible) return;
            if (isTimeBlockHovered || isTipHovered) return;
            hideTipNow();
            collapseDate();
        }, delay);
    }

    if (window.cc && window.cc.onTipHovered) {
        window.cc.onTipHovered((hovered) => {
            isTipHovered = !!hovered;
            if (isTipHovered) {
                clearTimeout(tipHideTimer);
                tipHideTimer = null;
            } else if (!isTimeBlockHovered) {
                scheduleTipHide(350);
            }
        });
    }

    function expandDate() {
        if (isHovered) return;
        isHovered = true;
        shellEl.classList.add("is-expanded");
        if (cfg && cfg.miniCollapseDate) {
            syncWindowSize();
        }
    }

    function collapseDate() {
        if (!isHovered) return;
        isHovered = false;
        shellEl.classList.remove("is-expanded");
        if (cfg && cfg.miniCollapseDate) {
            syncWindowSize();
        }
    }

    let isDragging = false;
    let isPointerDown = false;
    let lastDragEndTime = 0;

    window.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            isPointerDown = true;
            clearTimeout(tipTimer);
            tipTimer = null;
        }
    });

    window.addEventListener("mouseup", () => {
        isPointerDown = false;
        if (isDragging) {
            isDragging = false;
            lastDragEndTime = Date.now();
        }
    });

    function onClockAreaEnter(e) {
        if (isDragging || isPointerDown || popupMenuOpen || Date.now() - lastDragEndTime < 1000) return;
        // Click-through mode: the OS never delivers mouse events, so skip
        // the tooltip pipeline (no timers, no resize churn) entirely.
        if (document.body.classList.contains("click-through")) return;
        if (e && e.target && e.target.closest && e.target.closest(".controls")) return;
        isTimeBlockHovered = true;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        expandDate();

        clearTimeout(tipTimer);
        tipTimer = setTimeout(() => {
            if (isDragging || isPointerDown || popupMenuOpen || Date.now() - lastDragEndTime < 1000) return;
            openTip();
            const dp = document.getElementById("day-progress");
            if (dp && isElementHovered(dp)) {
                showDayProgressTicker();
            }
        }, 750);
    }

    function onClockAreaLeave(e) {
        if (e && e.relatedTarget && isClockAreaElement(e.relatedTarget)) {
            return;
        }
        isTimeBlockHovered = false;
        clearTimeout(tipTimer);
        tipTimer = null;
        if (!isTipVisible) {
            collapseDate();
        } else {
            scheduleTipHide(250);
        }
    }

    timeBlock.addEventListener("mouseenter", (e) => {
        hideActionTicker();
        onClockAreaEnter(e);
    });
    timeBlock.addEventListener("mouseleave", onClockAreaLeave);

    const dayProgressEl = document.getElementById("day-progress");
    if (dayProgressEl) {
        dayProgressEl.addEventListener("mouseenter", (e) => {
            onClockAreaEnter(e);
            showDayProgressTicker();
        });
        dayProgressEl.addEventListener("mouseleave", (e) => {
            if (isElementHovered(dayProgressEl)) return;
            hideActionTicker();
            onClockAreaLeave(e);
        });
    }

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
        });
        controlsEl.addEventListener("mouseleave", () => {
            hideActionTicker();
        });
    }

    function onPointerExitedWindow(e) {
        if (e && e.relatedTarget && document.contains(e.relatedTarget)) {
            return;
        }
        isTimeBlockHovered = false;
        clearTimeout(tipTimer);
        tipTimer = null;
        miniHovered = false;
        syncMiniMotion();
        if (!isTipVisible) {
            collapseDate();
        } else {
            scheduleTipHide(350);
        }
    }

    document.body.addEventListener("mouseleave", onPointerExitedWindow);
    document.addEventListener("mouseleave", onPointerExitedWindow);
    window.addEventListener("mouseout", (e) => {
        if (!e.relatedTarget && !e.toElement) {
            onPointerExitedWindow(e);
        }
    });
    window.addEventListener("blur", () => {
        miniHovered = false;
        syncMiniMotion();
        if (!isTimeBlockHovered && !isTipHovered) {
            clearTimeout(tipTimer);
            tipTimer = null;
            hideTipNow();
            hideActionTicker();
            collapseDate();
        }
    });

    shellEl.addEventListener("mouseenter", () => {
        miniHovered = true;
        syncMiniMotion();
    });

    shellEl.addEventListener("mouseleave", (e) => {
        miniHovered = false;
        syncMiniMotion();
        onClockAreaLeave(e);
    });

    document.addEventListener("click", (e) => {
        if (!isTipVisible) return;
        if (e.target && e.target.closest(".mini-shell")) return;
        hideTipNow();
        collapseDate();
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
            const cur = Math.min(20, Math.max(1, parseInt(cfg.miniDesign, 10) || 1));
            let next;
            if (cfg.miniAutoCycleMode === "random") {
                const others = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].filter((n) => n !== cur);
                next = others[Math.floor(Math.random() * others.length)];
            } else {
                next = (cur % 20) + 1;
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
    if (window.cc.onMiniLocate) {
        window.cc.onMiniLocate(() => {
            const shell = document.getElementById("shell");
            if (!shell) return;
            shell.classList.remove("locate-flash");
            void shell.offsetWidth;
            shell.classList.add("locate-flash");
            setTimeout(() => shell.classList.remove("locate-flash"), 1200);
        });
    }

    window.cc.onActiveWindow((label) => {
        activeBackendLabel = label;
        syncMiniMotion();
    });

    document.addEventListener("visibilitychange", syncMiniMotion);
    window.addEventListener("focus", syncMiniMotion);
    window.addEventListener("blur", syncMiniMotion);

    window.cc.onInit(async (s) => {
        applySettings(s);
        if (window.cc && window.cc.getActiveWindow) {
            try {
                const activeWin = await window.cc.getActiveWindow();
                if (activeWin && activeWin !== "none") {
                    activeBackendLabel = activeWin;
                }
            } catch (e) {
                console.error("getActiveWindow failed in mini:", e);
            }
        }
        syncMiniMotion();
        requestAnimationFrame(() => {
            setInterval(updateClock, 1000);
        });
    });

    window.cc.onSettingsUpdated((s) => applySettings(s));

    window.cc.onAlarmChime((p) => {
        if (cfg.windowMode && cfg.windowMode !== "mini") return;
        if (p.silent) return;
        if (p.type === "custom") {
            showMiniAlarm(p);
            if (window.audioEngine && window.audioEngine.playAlarmAlert) {
                window.audioEngine.playAlarmAlert(p);
            }
            return;
        }
        const vol = p.volume != null ? p.volume : (cfg.chimeVolume ?? cfg.alarmVolume ?? 0.75);
        if (window.audioEngine.muted || p.audioMuted) return;
        if (p.customPath) window.audioEngine.playFile(p.customPath, { loop: false, volume: vol });
        else window.audioEngine.chime(p.sound || "chime-digital", vol);
    });

    if (window.cc.onAlarmDismissed) {
        window.cc.onAlarmDismissed((p) => {
            if (p?.alarmId && activeAlarmNotice?.alarmId === p.alarmId) clearMiniAlarmNotice();
        });
    }
    if (window.cc.onAlarmSnoozed) {
        window.cc.onAlarmSnoozed((p) => {
            if (p?.alarmId && activeAlarmNotice?.alarmId === p.alarmId) clearMiniAlarmNotice();
        });
    }

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
        if (cfg.showWidgetHints === false) return;
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

    const dayIcoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

    function showDayProgressTicker() {
        if (cfg.showWidgetHints === false || cfg.miniDayProgress !== true) return;
        if (!shellEl || !tickerText) return;
        const pct = dayPercent(new Date());
        tickerText.textContent = window.ccI18n
            ? window.ccI18n.t("mini.dayProgress.tip", { pct })
            : pct + "%";
        if (tickerIco) tickerIco.innerHTML = dayIcoSvg;
        shellEl.classList.add("has-action-ticker");
        clearTimeout(tickerTimer);
        tickerTimer = null;
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
    let popupMenuOpen = false;
    let blockMenuOpen = false;
    let ignoreNextMenuClosed = false;
    let menuPointerAt = 0;
    let menuClosedAt = 0;

    if (window.cc && window.cc.onMenuClosed) {
        window.cc.onMenuClosed(() => {
            popupMenuOpen = false;
            menuClosedAt = Date.now();
            if (ignoreNextMenuClosed) {
                ignoreNextMenuClosed = false;
                return;
            }
            if (Date.now() - menuPointerAt < 400) blockMenuOpen = true;
        });
    }

    function armMenuToggle() {
        menuPointerAt = Date.now();
        if (popupMenuOpen || Date.now() - menuClosedAt < 80) blockMenuOpen = true;
    }

    async function openOrToggleMenu(point) {
        if (!window.cc) return;
        clearTimeout(tipTimer);
        tipTimer = null;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        isTipVisible = false;
        if (window.cc.hideMiniTip) {
            window.cc.hideMiniTip().catch(() => {});
        }
        if (blockMenuOpen) {
            blockMenuOpen = false;
            popupMenuOpen = false;
            ignoreNextMenuClosed = true;
            setTimeout(() => { ignoreNextMenuClosed = false; }, 450);
            if (window.cc.closeMenuPopup) window.cc.closeMenuPopup().catch(() => {});
            return;
        }
        if (!window.cc.openMiniContextMenu) return;
        const opened = await window.cc.openMiniContextMenu(point);
        popupMenuOpen = opened !== false;
        blockMenuOpen = false;
        if (popupMenuOpen && window.cc.hideMiniTip) {
            window.cc.hideMiniTip().catch(() => {});
        }
        if (!popupMenuOpen) menuClosedAt = Date.now();
    }

    shell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(tipTimer);
        tipTimer = null;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        isTipVisible = false;
        if (window.cc && window.cc.hideMiniTip) {
            window.cc.hideMiniTip().catch(() => {});
        }
        armMenuToggle();
        const point = (winPos) => ({
            x: e.clientX,
            y: e.clientY,
            screenX: (winPos ? winPos[0] : 0) + e.clientX,
            screenY: (winPos ? winPos[1] : 0) + e.clientY,
        });
        if (window.cc && window.cc.getWindowPosition) {
            window.cc.getWindowPosition().then((winPos) => openOrToggleMenu(point(winPos))).catch(() => {
                openOrToggleMenu({
                    x: e.clientX, y: e.clientY,
                    screenX: e.screenX, screenY: e.screenY,
                });
            });
        } else {
            openOrToggleMenu({
                x: e.clientX, y: e.clientY,
                screenX: e.screenX, screenY: e.screenY,
            });
        }
    });

    // ═══════════════════════════════════════════════════════
    // DRAG — native Tauri only
    // ═══════════════════════════════════════════════════════
    shell.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
            armMenuToggle();
            return;
        }
        window.cc.closeMenuPopup().catch(() => {});
        if (e.target.closest(".controls")) return;
        if (e.button !== 0) return;

        // Immediately cancel and dismiss the hover popup if visible/pending.
        isPointerDown = true;
        isDragging = true;
        clearTimeout(tipTimer);
        tipTimer = null;
        clearTimeout(tipHideTimer);
        tipHideTimer = null;
        isTimeBlockHovered = false;
        isTipVisible = false;
        if (window.cc && window.cc.hideMiniTip) {
            window.cc.hideMiniTip().catch(() => {});
        }
        hideActionTicker();
        collapseDate();
        syncWindowSize();

        if (cfg.miniPositionLocked === true) {
            isDragging = false;
            return;
        }
        e.preventDefault();
        document.body.classList.add("is-dragging");
        window.cc.startDragging()
            .then(() => {
                isDragging = false;
                isPointerDown = false;
                lastDragEndTime = Date.now();
                document.body.classList.remove("is-dragging");
                window.cc.saveMiniPosition().catch(() => {});
            })
            .catch(() => {
                isDragging = false;
                isPointerDown = false;
                lastDragEndTime = Date.now();
                document.body.classList.remove("is-dragging");
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

    // ═══════════════════════════════════════════════════════
    // UPDATE NOTIFICATIONS
    // ═══════════════════════════════════════════════════════

    function isUpdateSkipped(ver) {
        if (!ver) return true;
        try {
            return localStorage.getItem("cc_update_skip_version") === ver ||
                   localStorage.getItem("cyberclock_skip_update_version") === ver;
        } catch (_) {
            return false;
        }
    }

    function skipUpdate(ver) {
        if (!ver) return;
        try {
            localStorage.setItem("cc_update_skip_version", ver);
            localStorage.setItem("cyberclock_skip_update_version", ver);
        } catch (_) {}
    }

    function showUpdateTip() {
        // Automatically surface the tip panel when an update is available,
        // without waiting for a hover. The panel stays visible until the
        // user picks "Ver y actualizar" or "Descartar".
        if (!tipEl || !shellEl) return;
        refreshTipContent();
        positionTip();
        isTipVisible = true;
        tipEl.classList.add("show");
        syncWindowSize();
    }

    function setAvailableUpdate(ver) {
        if (!ver || isUpdateSkipped(ver)) return;
        availableUpdateVersion = ver;
        showUpdateTip();
    }

    if (window.cc && window.cc.getPendingUpdate) {
        window.cc.getPendingUpdate().then((ver) => {
            if (ver) setAvailableUpdate(ver);
        }).catch(() => {});
    }

    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus((payload) => {
            if (payload && payload.state === "available" && payload.version) {
                setAvailableUpdate(payload.version);
            } else if (payload && (payload.state === "idle" || payload.state === "not-found")) {
                availableUpdateVersion = null;
                refreshTipContent();
            }
        });
    }

    // Safety clamp: ensure mini window starts safely within monitor work area
    if (window.cc && window.cc.clampToMonitors) {
        window.cc.clampToMonitors().catch(() => {});
    }
