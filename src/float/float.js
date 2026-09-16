/* CyberClock Float - independent stopwatch / timer windows.
   Each window runs its own clock locally; no shared state with the
   main views or with other float windows. Closing the window destroys
   its state. Skins, tint, i18n and zoom are inherited read-only. */
(function () {
    "use strict";

    const params = new URLSearchParams(location.search);
    // The kind is encoded in the window label ("float-timer-3" /
    // "float-sw-3"); the query string is only a best-effort hint.
    let KIND = params.get("kind") === "timer" ? "timer" : "sw";
    function kindFromLabel() {
        if (params.get("kind") === "timer" || params.get("kind") === "sw") {
            return params.get("kind");
        }
        try {
            if (window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
                const w = window.__TAURI__.window.getCurrentWindow();
                const lbl = typeof w.label === "string" ? w.label : "";
                if (lbl.indexOf("float-timer-") === 0) return "timer";
                if (lbl.indexOf("float-sw-") === 0) return "sw";
            }
        } catch (e) { /* keep default */ }
        return KIND;
    }
    KIND = kindFromLabel();

    let cfg = {};

    const DESIGN_HEIGHTS = { 1: 48, 2: 56, 3: 46, 4: 52, 5: 50, 6: 48, 7: 34, 8: 34, 9: 34, 10: 32, 11: 34, 12: 34 };
    const DESIGN_WIDTHS  = { 1: 260, 2: 320, 3: 260, 4: 260, 5: 260, 6: 260, 7: 300, 8: 300, 9: 300, 10: 260, 11: 300, 12: 300 };
    function zoomFactor() {
        const z = cfg.miniZoom ?? 1;
        return Number.isFinite(z) && z > 0 ? z : 1;
    }

    function pad(n, w) { return String(n).padStart(w || 2, "0"); }

    function setDigits(el, val) {
        if (!el || el.dataset.digitsValue === val) return;
        el.dataset.digitsValue = val;
        el.replaceChildren();
        for (const ch of val) {
            const s = document.createElement("span");
            if (ch === ":") s.className = "t-colon";
            else if (/\d/.test(ch)) s.className = "digit";
            s.textContent = ch;
            el.appendChild(s);
        }
    }

    const shellEl = () => document.getElementById("shell");
    const timeEl = () => document.getElementById("mini-time");
    const subEl = () => document.getElementById("mini-date");

    let lastW = 0, lastH = 0;
    function syncSize(force) {
        const design = cfg.miniDesign || 1;
        const zoom = zoomFactor();
        // Same compact size for sw and timer: the preset chooser swaps in
        // over the clock face instead of resizing the window (Opcion A).
        const bw = DESIGN_WIDTHS[design] || 280;
        const bh = DESIGN_HEIGHTS[design] || 48;
        const w = Math.round(bw * zoom), h = Math.round(bh * zoom);
        if (force || w !== lastW || h !== lastH) {
            lastW = w; lastH = h;
            if (window.cc && window.cc.setWindowSize) window.cc.setWindowSize({ width: w, height: h });
        }
    }
    const ICO_PLAY = '<svg class="ctl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5v15l13-7.5Z"/></svg>';
    const ICO_PAUSE = '<svg class="ctl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14M16 5v14"/></svg>';
    const ICO_TIMER = '<svg class="ctl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>';
    const ICO_BACK = '<svg class="ctl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

    /* Preset chooser state: an idle timer can swap its clock face for
       the quick-pick panel ("+" button). The window never resizes. */
    let choosing = false;

    function syncPresetBtn() {
        const b = document.getElementById("btn-presets");
        if (!b) return;
        b.hidden = !(KIND === "timer" && timerIdle());
        if (!b.hidden) {
            b.innerHTML = choosing ? ICO_BACK : ICO_TIMER;
            b.title = window.ccI18n.t(choosing ? "float.back" : "float.pickMinutes");
        }
    }

    function openPresets() {
        if (!timerIdle()) return;
        choosing = true;
        shellEl().classList.add("float-choosing");
        document.getElementById("float-presets").hidden = false;
        syncPresetBtn();
    }

    function closePresets() {
        choosing = false;
        shellEl().classList.remove("float-choosing");
        document.getElementById("float-presets").hidden = true;
        syncPresetBtn();
    }

    function setStartIcon(running) {
        const b = document.getElementById("btn-start");
        if (!b) return;
        b.innerHTML = running ? ICO_PAUSE : ICO_PLAY;
        b.title = running ? window.ccI18n.t("float.pause") : window.ccI18n.t("float.start");
    }

    let swRunning = false, swStart = 0, swPaused = 0, swElapsed = 0, swRaf = null, swTitleSec = -1;

    function swFmt(ms) {
        const t = Math.max(0, Math.floor(ms));
        const h = Math.floor(t / 3600000);
        const m = Math.floor((t % 3600000) / 60000);
        const s = Math.floor((t % 60000) / 1000);
        const d = Math.floor((t % 1000) / 100);
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return pad(m) + ":" + pad(s) + "." + d;
    }

    function swPaint() {
        if (swRunning) swElapsed = performance.now() - swStart + swPaused;
        const str = swFmt(swElapsed);
        setDigits(timeEl(), str);
        const sec = Math.floor(swElapsed / 1000);
        if (sec !== swTitleSec) { swTitleSec = sec; document.title = str + " · CyberClock"; }
    }

    function swLoop() { swPaint(); if (swRunning) swRaf = requestAnimationFrame(swLoop); }

    function swToggle() {
        if (swRunning) {
            swElapsed = performance.now() - swStart + swPaused;
            swRunning = false; swPaused = swElapsed;
            cancelAnimationFrame(swRaf); swRaf = null;
            swPaint();
        } else {
            swRunning = true; swStart = performance.now();
            swRaf = requestAnimationFrame(swLoop);
        }
        shellEl().classList.toggle("float-running", swRunning);
        setStartIcon(swRunning);
    }

    function swReset() {
        swRunning = false;
        cancelAnimationFrame(swRaf); swRaf = null;
        swPaused = 0; swElapsed = 0; swTitleSec = -1;
        shellEl().classList.remove("float-running");
        setStartIcon(false);
        swPaint();
        document.title = window.ccI18n.t("float.stopwatchTitle");
    }


    let tTotal = 0, tAcc = 0, tRunning = false, tLastTick = 0, tInt = null, tTitleSec = -1;

    function timerIdle() { return KIND === "timer" && !tRunning && tAcc <= 0; }

    function tFmt(sec) {
        sec = Math.max(0, Math.ceil(sec));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
        return pad(m) + ":" + pad(s);
    }

    function tPaint() {
        const str = tFmt(tAcc);
        setDigits(timeEl(), str);
        const fill = document.getElementById("float-prog-fill");
        if (fill) fill.style.width = tTotal > 0 ? Math.round((1 - tAcc / tTotal) * 100) + "%" : "0%";
        shellEl().classList.toggle("float-warn", tRunning && tAcc <= 10 && tAcc > 0);
        const c = Math.ceil(tAcc);
        if (c !== tTitleSec) {
            tTitleSec = c;
            document.title = tTotal > 0 ? str + " · CyberClock" : window.ccI18n.t("float.timerTitle");
        }
    }

    function tTick() {
        if (!tRunning) return;
        const now = Date.now();
        tAcc = Math.max(0, tAcc - (now - tLastTick) / 1000);
        tLastTick = now;
        tPaint();
        if (tAcc <= 0) tComplete();
    }

    function tHideDone() {
        const ov = document.getElementById("float-done");
        if (ov) ov.hidden = true;
        shellEl().classList.remove("float-done");
    }

    function tArm(secs) {
        const btns = document.querySelectorAll(".float-preset");
        for (const b of btns) b.classList.toggle("armed", Number(b.dataset.s) === secs);
        tTotal = secs; tAcc = secs;
        tHideDone();
        tGo();
    }

    function tGo() {
        if (tAcc <= 0) return;
        tRunning = true;
        tLastTick = Date.now();
        clearInterval(tInt);
        tInt = setInterval(tTick, 100);
        closePresets();
        document.getElementById("float-prog").hidden = false;
        shellEl().classList.add("float-running");
        setStartIcon(true);
        syncSize(true);
        tPaint();
    }

    function tPause() {
        if (!tRunning) return;
        const now = Date.now();
        tAcc = Math.max(0, tAcc - (now - tLastTick) / 1000);
        tLastTick = now;
        tRunning = false;
        clearInterval(tInt);
        if (tAcc <= 0) {
            tAcc = 0;
            tComplete();
            return;
        }
        shellEl().classList.remove("float-running");
        setStartIcon(false);
        tPaint();
    }

    function tToggle() {
        if (tRunning) { tPause(); return; }
        if (tAcc <= 0) {
            openPresets();
            return;
        }
        tGo();
    }

    function tReset() {
        tRunning = false;
        clearInterval(tInt);
        tTotal = 0; tAcc = 0; tTitleSec = -1;
        const btns = document.querySelectorAll(".float-preset");
        for (const b of btns) b.classList.remove("armed");
        closePresets();
        document.getElementById("float-prog").hidden = true;
        syncPresetBtn();
        shellEl().classList.remove("float-running", "float-warn", "float-done");
        tHideDone();
        setStartIcon(false);
        syncSize(true);
        tPaint();
        document.title = window.ccI18n.t("float.timerTitle");
    }

    function tComplete() {
        tRunning = false;
        clearInterval(tInt);
        tAcc = 0;
        shellEl().classList.remove("float-running", "float-warn");
        shellEl().classList.add("float-done");
        setStartIcon(false);
        syncPresetBtn();
        tPaint();
        const txt = document.getElementById("float-done-txt");
        if (txt) txt.textContent = window.ccI18n.t("float.timesUp");
        document.getElementById("float-done").hidden = false;
        try {
            if (cfg.audioMuted !== true && window.audioEngine) {
                window.audioEngine.resume();
                window.audioEngine.chime("chime-digital", cfg.alarmVolume ?? 0.75);
            }
        } catch (e) { /* audio must never break the widget */ }
        document.title = window.ccI18n.t("float.timesUp") + " · CyberClock";
    }
    function applyTexts() {
        subEl().textContent = KIND === "timer"
            ? window.ccI18n.t("float.timerSub")
            : window.ccI18n.t("float.stopwatchSub");
        document.getElementById("btn-min").title = window.ccI18n.t("float.minimize");
        document.getElementById("btn-close").title = window.ccI18n.t("float.close");
        document.getElementById("btn-reset").title = window.ccI18n.t("float.reset");
        document.getElementById("btn-dismiss").title = window.ccI18n.t("float.dismiss");
        syncPresetBtn();
        setStartIcon(KIND === "sw" ? swRunning : tRunning);
        if (KIND === "sw" && swElapsed === 0 && !swRunning) {
            document.title = window.ccI18n.t("float.stopwatchTitle");
        }
        if (KIND === "timer" && tTotal === 0) {
            document.title = window.ccI18n.t("float.timerTitle");
            if (!document.getElementById("float-done").hidden) {
                document.getElementById("float-done-txt").textContent = window.ccI18n.t("float.timesUp");
            }
        }
    }

    function applySettings(s) {
        cfg = s || {};
        window.CCTint.apply(cfg.theme || "ice");
        window.ccI18n.setLang(cfg.language || "auto");
        const sh = shellEl();
        sh.dataset.design = cfg.miniDesign || "1";
        sh.style.setProperty("--bg-op", cfg.miniBgOpacity ?? 1.0);
        sh.style.setProperty("--fg-op", cfg.miniOpacity ?? 1.0);
        sh.style.setProperty("--mini-zoom", String(zoomFactor()));
        document.body.classList.toggle("no-scanlines", cfg.miniScanlines === false);
        document.body.classList.toggle("no-animations", cfg.miniNoAnimations === true);
        if (window.audioEngine) window.audioEngine.setMuted(cfg.audioMuted === true);
        if (KIND === "timer") {
            document.getElementById("float-presets").hidden = !choosing;
            document.getElementById("float-prog").hidden = timerIdle();
            syncPresetBtn();
        }
        applyTexts();
        if (KIND === "sw") swPaint(); else tPaint();
        syncSize(true);
    }
    document.getElementById("btn-start").addEventListener("click", () => {
        if (KIND === "sw") swToggle(); else tToggle();
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
        if (KIND === "sw") swReset(); else tReset();
    });
    document.getElementById("btn-min").addEventListener("click", () => {
        if (window.cc && window.cc.minimizeWindow) window.cc.minimizeWindow();
    });
    document.getElementById("btn-close").addEventListener("click", () => {
        if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
    });
    document.getElementById("btn-dismiss").addEventListener("click", () => tReset());
    document.getElementById("btn-presets").addEventListener("click", () => {
        if (choosing) closePresets(); else openPresets();
    });
    const presets = document.querySelectorAll(".float-preset");
    for (const b of presets) b.addEventListener("click", () => tArm(Number(b.dataset.s)));
    document.getElementById("float-presets").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closePresets();
    });

    shellEl().addEventListener("mousedown", (e) => {
        if (e.target.closest(".controls, .float-preset, .float-done")) return;
        if (e.button !== 0) return;
        if (cfg.miniPositionLocked === true) return;
        e.preventDefault();
        if (window.cc && window.cc.startDragging) window.cc.startDragging().catch(() => {});
    });

    // Reuse the mini-style context menu. The backend anchors it to the
    // invoking window, so each float opens its menu beside itself.
    document.addEventListener("contextmenu", (e) => {
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

    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && !e.repeat && e.target === document.body) {
            e.preventDefault();
            if (KIND === "sw") swToggle(); else tToggle();
        } else if (e.key === "r" || e.key === "R") {
            if (KIND === "sw") swReset(); else tReset();
        } else if (e.key === "Escape") {
            if (choosing) { closePresets(); return; }
            if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
        }
    });

    if (KIND === "timer") {
        document.getElementById("float-presets").hidden = true;
        document.getElementById("float-prog").hidden = true;
    } else {
        document.getElementById("float-presets").hidden = true;
        document.getElementById("float-prog").hidden = true;
    }
    document.getElementById("float-done").hidden = true;
    syncPresetBtn();

    window.cc.onInit((s) => applySettings(s || {}));
    window.cc.onSettingsUpdated((s) => applySettings(s || {}));
})();


