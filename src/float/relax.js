/**
 * CyberClock — Floating Relax widget.
 * Owns its own audio session so sound continues when full mode is hidden.
 */
(function () {
    const TRACKS = ["night", "forest", "space", "ocean", "rain", "fireplace"];
    const BOX = [
        { name: "inhale", dur: 4000, from: 1, to: 1.42 },
        { name: "hold", dur: 4000, from: 1.42, to: 1.42 },
        { name: "exhale", dur: 4000, from: 1.42, to: 1 },
        { name: "hold", dur: 4000, from: 1, to: 1 },
    ];
    const P478 = [
        { name: "inhale", dur: 4000, from: 1, to: 1.42 },
        { name: "hold", dur: 7000, from: 1.42, to: 1.42 },
        { name: "exhale", dur: 8000, from: 1.42, to: 1 },
    ];

    const shell = document.getElementById("relax-shell");
    const trackEl = document.getElementById("track-name");
    const phaseEl = document.getElementById("phase");
    const elapsedEl = document.getElementById("elapsed");
    const btnPlay = document.getElementById("btn-play");
    const btnNext = document.getElementById("btn-next");
    const btnBreathe = document.getElementById("btn-breathe");
    const ring = document.getElementById("breathe-ring");
    const btnMenu = document.getElementById("btn-menu");
    const btnClose = document.getElementById("btn-close");
    const bars = Array.from(document.querySelectorAll(".bar"));
    const levels = bars.map(() => 0.14);

    let cfg = {};
    let trackIndex = 0;
    let playing = false;
    let paused = false;
    let sessionStart = 0;
    let sessionShown = 0;
    let guideOn = false;
    let guidePaused = false;
    let guideStart = 0;
    let guideElapsed = 0;
    let phaseName = "";
    let showBreathe = true;

    const engine = window.audioEngine;

    function t(key) {
        return window.ccI18n ? window.ccI18n.t(key) : key;
    }

    function phases() {
        return cfg.breathePattern === "478" ? P478 : BOX;
    }

    function sampleGuide(elapsed) {
        const list = phases();
        const total = list.reduce((sum, p) => sum + p.dur, 0);
        let at = elapsed % total;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (at <= p.dur) {
                const k = p.dur ? at / p.dur : 1;
                return { name: p.name, scale: p.from + (p.to - p.from) * k };
            }
            at -= p.dur;
        }
        return { name: "inhale", scale: 1 };
    }

    function fmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(s / 60);
        return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }

    function refreshLabels() {
        const id = TRACKS[trackIndex];
        trackEl.textContent = t("relax.track." + id);
        if (!guideOn) {
            phaseEl.textContent = t("relax.breathe.start");
            phaseName = "";
        }
        const key = !playing ? "relax.play" : paused ? "relax.resume" : "relax.pause";
        const label = t(key);
        btnPlay.setAttribute("data-tooltip", label);
        btnPlay.setAttribute("aria-label", label);
        btnPlay.classList.toggle("is-playing", playing && !paused);
        btnBreathe.classList.toggle("is-paused", guideOn && guidePaused);
    }

    function applyAudioPrefs() {
        if (!engine) return;
        const vol = typeof cfg.relaxVolume === "number" ? cfg.relaxVolume : 0.8;
        engine.setVolume(vol);
        engine.setMuted(!!cfg.audioMuted);
    }

    function applySettings(s) {
        if (!s) return;
        const patternChanged = cfg.breathePattern && s.breathePattern !== cfg.breathePattern;
        cfg = s;
        if (s.theme && window.CCTint) window.CCTint.apply(s.theme);
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
        const op = typeof s.floatRelaxOpacity === "number" ? s.floatRelaxOpacity : 1;
        if (shell) shell.style.opacity = String(op);
        showBreathe = s.floatRelaxShowBreathe !== false;
        document.body.classList.toggle("breathe-off", !showBreathe);
        if (patternChanged && guideOn) {
            guideStart = performance.now();
            phaseName = "";
        }
        applyAudioPrefs();
        refreshLabels();
    }

    function startTrack(index) {
        trackIndex = (index + TRACKS.length) % TRACKS.length;
        if (!engine) return;
        engine.resume();
        applyAudioPrefs();
        engine.playTrack(TRACKS[trackIndex]);
        playing = true;
        paused = false;
        if (!sessionStart) sessionStart = performance.now();
        refreshLabels();
    }

    function togglePlay() {
        if (!engine) return;
        if (!playing) {
            startTrack(trackIndex);
            return;
        }
        if (!paused) {
            sessionShown = performance.now() - sessionStart;
            paused = true;
            engine.suspend();
        } else {
            sessionStart = performance.now() - sessionShown;
            paused = false;
            engine.resume();
            applyAudioPrefs();
        }
        refreshLabels();
    }

    function toggleGuide() {
        if (!guideOn) {
            guideOn = true;
            guidePaused = false;
            guideElapsed = 0;
            guideStart = performance.now();
            phaseName = "";
        } else if (!guidePaused) {
            guideElapsed = performance.now() - guideStart;
            guidePaused = true;
        } else {
            guidePaused = false;
            guideStart = performance.now() - guideElapsed;
        }
        refreshLabels();
    }

    function frame(now) {
        if (guideOn && !guidePaused && showBreathe && ring) {
            const sample = sampleGuide(now - guideStart);
            ring.style.setProperty("--breath", sample.scale.toFixed(3));
            if (sample.name !== phaseName) {
                phaseName = sample.name;
                phaseEl.textContent = t("relax.breathe." + sample.name);
            }
        } else if (ring && !guideOn) {
            ring.style.setProperty("--breath", "1");
        }

        const live = playing && !paused && !cfg.audioMuted;
        const data = live && engine ? engine.getAnalyserData() : null;
        const bins = data ? data.length : 0;
        for (let i = 0; i < bars.length; i++) {
            let target = 0.14;
            if (data) {
                const pos = bars.length === 1 ? 0 : i / (bars.length - 1);
                const idx = Math.min(bins - 1, Math.floor(Math.pow(pos, 1.55) * bins * 0.7));
                target = 0.12 + (data[idx] / 255) * 0.88;
            } else {
                target = 0.12 + 0.06 * (0.5 + 0.5 * Math.sin(now / 700 + i * 0.55));
            }
            levels[i] += (target - levels[i]) * (data ? 0.32 : 0.08);
            bars[i].style.transform = "scaleY(" + levels[i].toFixed(3) + ")";
            bars[i].style.opacity = String(0.45 + Math.min(1, levels[i]) * 0.55);
        }

        if (playing && !paused && sessionStart) {
            elapsedEl.textContent = fmt(now - sessionStart);
        } else if (playing && paused) {
            elapsedEl.textContent = fmt(sessionShown);
        }
        requestAnimationFrame(frame);
    }

    btnPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
    });
    btnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        startTrack(trackIndex + 1);
    });
    btnBreathe.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleGuide();
    });
    if (btnClose) {
        btnClose.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
            else window.close();
        });
    }

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

    function menuPointFromClient(clientX, clientY, winPos) {
        const origin = winPos || [0, 0];
        return {
            x: clientX,
            y: clientY,
            screenX: origin[0] + clientX,
            screenY: origin[1] + clientY,
        };
    }

    async function openOrToggleMenu(point) {
        if (!window.cc) return;
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
        if (!popupMenuOpen) menuClosedAt = Date.now();
    }

    function openMenuAt(clientX, clientY) {
        const go = (winPos) => openOrToggleMenu(menuPointFromClient(clientX, clientY, winPos));
        if (window.cc && window.cc.getWindowPosition) {
            window.cc.getWindowPosition().then(go).catch(() => go());
        } else {
            go();
        }
    }

    if (btnMenu) {
        btnMenu.addEventListener("pointerdown", () => armMenuToggle());
        btnMenu.addEventListener("click", (e) => {
            e.stopPropagation();
            btnMenu.blur();
            const rect = btnMenu.getBoundingClientRect();
            openMenuAt(Math.round(rect.left + rect.width / 2), Math.round(rect.bottom + 4));
        });
    }

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        armMenuToggle();
        openMenuAt(e.clientX, e.clientY);
    });

    if (shell) {
        shell.addEventListener("mousedown", (e) => {
            if (e.target.closest("#btn-menu")) return;
            if (window.cc && window.cc.closeMenuPopup) window.cc.closeMenuPopup().catch(() => {});
            if (e.target.closest("button")) return;
            if (e.button !== 0) return;
            if (cfg.relaxPositionLocked === true) return;
            e.preventDefault();
            document.body.classList.add("is-dragging");
            if (window.cc && window.cc.startDragging) {
                window.cc.startDragging()
                    .then(() => document.body.classList.remove("is-dragging"))
                    .catch(() => document.body.classList.remove("is-dragging"));
            }
        });
    }

    window.addEventListener("mouseup", () => {
        document.body.classList.remove("is-dragging");
    });

    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && !e.repeat && e.target === document.body) {
            e.preventDefault();
            togglePlay();
        } else if (e.key === "Escape") {
            if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
        }
    });

    if (window.cc && window.cc.getSettings) {
        window.cc.getSettings().then((s) => applySettings(s));
    }
    if (window.cc && window.cc.onSettingsUpdated) {
        window.cc.onSettingsUpdated((s) => applySettings(s));
    }
    if (window.cc && window.cc.onInit) {
        window.cc.onInit((s) => applySettings(s));
    }

    refreshLabels();
    requestAnimationFrame(frame);
})();
