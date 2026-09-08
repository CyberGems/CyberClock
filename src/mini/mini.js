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
        const designMode = cfg.miniDesign || 1;
        const noSeconds = false;

        let timeStr;
        if (cfg.clockFormat === "12h") {
            const ampm = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
            timeStr = `${pad(h)}:${pad(m)}${!noSeconds && cfg.showSeconds !== false ? ":" + pad(s) : ""} ${ampm}`;
        } else {
            timeStr = `${pad(h)}:${pad(m)}${!noSeconds && cfg.showSeconds !== false ? ":" + pad(s) : ""}`;
        }
        document.getElementById("mini-time").textContent = timeStr;

        const d = now;
        const days = getDays();
        const months = getMonths();
        document.getElementById("mini-date").textContent =
            `${days[d.getDay()]} · ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    // ═══════════════════════════════════════════════════════
    // WINDOW SIZING — Each skin has its own dimensions.
    // ═══════════════════════════════════════════════════════

    const DESIGN_HEIGHTS = { 1: 48, 2: 56, 3: 46, 4: 52, 5: 50, 6: 48, 7: 34, 8: 34, 9: 34, 10: 32, 11: 34, 12: 34 };
    const DESIGN_WIDTHS  = { 1: 260, 2: 320, 3: 260, 4: 260, 5: 260, 6: 260, 7: 300, 8: 300, 9: 300, 10: 260, 11: 300, 12: 300 };

    const COLLAPSED_HEIGHTS = { 1: 34, 2: 38, 3: 34, 4: 36, 5: 34, 6: 34, 7: 34, 8: 34, 9: 34, 10: 32, 11: 34, 12: 34 };
    const COLLAPSED_WIDTHS  = { 1: 260, 2: 320, 3: 260, 4: 260, 5: 260, 6: 260, 7: 165, 8: 165, 9: 175, 10: 155, 11: 175, 12: 170 };

    let isHovered = false;
    let isTipVisible = false;
    let lastAppliedWidth = 0;
    let lastAppliedHeight = 0;

    function getCurrentTargetSize() {
        const design = cfg.miniDesign || 1;
        const isCollapsible = cfg.miniCollapseDate === true;

        let baseWidth = DESIGN_WIDTHS[design] || 260;
        let baseHeight = DESIGN_HEIGHTS[design] || 48;

        if (isCollapsible && !isHovered) {
            baseWidth = COLLAPSED_WIDTHS[design] || baseWidth;
            baseHeight = COLLAPSED_HEIGHTS[design] || baseHeight;
        }

        if (isTipVisible) {
            const tipHeight = tipEl.offsetHeight || 80;
            baseHeight += tipHeight + 16;
        }

        return { width: baseWidth, height: baseHeight };
    }

    function syncWindowSize(force = false) {
        const target = getCurrentTargetSize();
        if (force || target.width !== lastAppliedWidth || target.height !== lastAppliedHeight) {
            lastAppliedWidth = target.width;
            lastAppliedHeight = target.height;
            window.cc.setWindowSize(target);
        }
    }

    let lastDesign = null;
    let lastCollapse = null;
    function applySettings(s) {
        const designChanged = s.miniDesign !== lastDesign;
        const collapseChanged = s.miniCollapseDate !== lastCollapse;
        lastDesign = s.miniDesign;
        lastCollapse = s.miniCollapseDate;

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
        }

        if (s.miniScanlines === false)
            document.body.classList.add("no-scanlines");
        else document.body.classList.remove("no-scanlines");

        const aotOn = s.alwaysOnTop || false;
        document.getElementById("btn-aot").classList.toggle("active", aotOn);
        updateClock();

        // Resize window to match the skin height/width when design or collapse setting changes
        if (designChanged || collapseChanged || lastAppliedWidth === 0) {
            syncWindowSize(true);
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
        
        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        
        const todayKey = isoNow();
        const note = (calNotes[todayKey] || "").trim();
        const upcoming = countUpcoming();
        
        let html = `<div class="mini-tip-date">${dateStr}</div>`;
        html += `<div class="mini-tip-divider"></div>`;
        
        if (note) {
            const firstLine = note.split("\n")[0].trim();
            html += `<div class="mini-tip-note">📝 ${firstLine}</div>`;
        } else {
            const noNotesText = lang === "es" ? "Sin notas para hoy" : "No notes for today";
            const createText = lang === "es" ? "＋ Crear nota" : "＋ Create note";
            html += `<div class="mini-tip-note empty">🌸 ${noNotesText}</div>`;
            html += `<div class="mini-tip-action-btn">${createText}</div>`;
        }
        
        let statText = "";
        if (upcoming === 0) {
            statText = lang === "es" ? "Tu agenda está despejada" : "Your schedule is clear";
        } else if (upcoming === 1) {
            statText = lang === "es" ? "1 evento próximo" : "1 upcoming event";
        } else {
            statText = lang === "es" ? `<b>${upcoming}</b> eventos próximos` : `<b>${upcoming}</b> upcoming events`;
        }
        
        html += `<div class="mini-tip-stat">${statText}</div>`;
        tipEl.innerHTML = html;
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
    // Decorative CSS animations keep the (transparent, always-on-top)
    // window recompositing every vsync, which is the main idle-CPU cost
    // of the mini view. Pause them whenever the window is hidden, or it
    // is unfocused and the cursor isn't over it. The clock text still
    // updates every second regardless, so the time is never stale.
    let miniHovered = false;
    function syncMiniMotion() {
        const shouldPause =
            document.hidden || (!document.hasFocus() && !miniHovered);
        document.body.classList.toggle("mini-paused", shouldPause);
    }

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