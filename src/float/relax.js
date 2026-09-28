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
    const btnShuffle = document.getElementById("btn-shuffle");
    const btnBreathe = document.getElementById("btn-breathe");
    const ring = document.getElementById("breathe-ring");
    const btnMenu = document.getElementById("btn-menu");
    const btnClose = document.getElementById("btn-close");
    const spectrum = document.getElementById("spectrum");
    const SPECTRUM_BARS = 48;
    const levels = new Array(SPECTRUM_BARS).fill(0);
    let spectrumCtx = null;

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
    let shuffleOn = false;
    let shuffleTimer = null;
    let shuffleQueue = [];
    const SHUFFLE_MS = 15 * 60 * 1000;

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
        if (btnShuffle) btnShuffle.classList.toggle("is-on", shuffleOn);
        btnBreathe.classList.toggle("is-paused", guideOn && guidePaused);
        phaseEl.classList.toggle("is-paused", guideOn && guidePaused);
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
        const skin = parseInt(s.floatRelaxDesign, 10);
        if (shell) shell.dataset.skin = String(skin >= 1 && skin <= 10 ? skin : 1);
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
        scheduleShuffle();
    }

    function nextShuffleIndex() {
        if (shuffleQueue.length === 0) {
            shuffleQueue = TRACKS.slice().sort(function () { return Math.random() - 0.5; });
            const current = TRACKS[trackIndex];
            if (current && shuffleQueue[0] === current && shuffleQueue.length > 1) {
                const tmp = shuffleQueue[0];
                shuffleQueue[0] = shuffleQueue[1];
                shuffleQueue[1] = tmp;
            }
        }
        const idx = TRACKS.indexOf(shuffleQueue.shift());
        return idx < 0 ? 0 : idx;
    }

    function scheduleShuffle() {
        clearTimeout(shuffleTimer);
        shuffleTimer = null;
        if (!shuffleOn || !playing || paused) return;
        shuffleTimer = setTimeout(function () {
            if (!shuffleOn || !playing || paused) return;
            startTrack(nextShuffleIndex());
        }, SHUFFLE_MS);
    }

    function toggleShuffle() {
        shuffleOn = !shuffleOn;
        shuffleQueue = [];
        if (shuffleOn && !playing) startTrack(nextShuffleIndex());
        else scheduleShuffle();
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
        scheduleShuffle();
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

        drawSpectrum(now, playing && !cfg.audioMuted);

        if (playing && !paused && sessionStart) {
            elapsedEl.textContent = fmt(now - sessionStart);
        } else if (playing && paused) {
            elapsedEl.textContent = fmt(sessionShown);
        }
        requestAnimationFrame(frame);
    }

    function drawSpectrum(now, active) {
        if (!spectrum) return;
        const dpr = window.devicePixelRatio || 1;
        const w = spectrum.clientWidth;
        const h = spectrum.clientHeight;
        if (w < 2 || h < 2) return;
        const bw = Math.floor(w * dpr);
        const bh = Math.floor(h * dpr);
        if (spectrum.width !== bw || spectrum.height !== bh) {
            spectrum.width = bw;
            spectrum.height = bh;
            spectrumCtx = null;
        }
        if (!spectrumCtx) spectrumCtx = spectrum.getContext("2d");
        const ctx = spectrumCtx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const shellStyle = shell ? getComputedStyle(shell) : null;
        const bodyStyle = getComputedStyle(document.body);
        let acc = (shellStyle && shellStyle.getPropertyValue("--skin-accent").trim()) || "";
        let rgb = (shellStyle && shellStyle.getPropertyValue("--skin-rgb").trim()) || "";
        if (!acc || acc.indexOf("var(") >= 0) {
            acc = bodyStyle.getPropertyValue("--accent-a").trim() || "#c8dce8";
        }
        if (!rgb || rgb.indexOf("var(") >= 0) {
            rgb = bodyStyle.getPropertyValue("--rgb-accent").trim() || "200,220,232";
        }
        const data = active && engine ? engine.getAnalyserData() : null;

        if (data && data.length) {
            const gap = w / SPECTRUM_BARS;
            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, acc);
            gradient.addColorStop(1, "rgba(" + rgb + ",.18)");
            const maxBin = Math.floor(data.length * 0.32);
            for (let i = 0; i < SPECTRUM_BARS; i++) {
                const percent = i / (SPECTRUM_BARS - 1);
                const idx = Math.min(data.length - 1, Math.floor(Math.pow(percent, 1.8) * maxBin));
                let v = (data[idx] || 0) / 255;
                v = Math.min(1, v * (1 + percent * 0.8));
                levels[i] += (v - levels[i]) * 0.34;
                const barH = Math.max(1.5, levels[i] * h * 0.9);
                const x = Math.floor(i * gap);
                const nextX = Math.floor((i + 1) * gap);
                const barW = Math.max(1, nextX - x - 1);
                const y = h - barH;
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barW, barH);
                ctx.fillStyle = acc;
                ctx.fillRect(x, Math.max(0, y - 1.5), barW, 1.5);
            }
            return;
        }

        const time = now * 0.001;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(" + rgb + ",0.1)";
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        for (let wIdx = 0; wIdx < 3; wIdx++) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(" + rgb + "," + (0.12 + wIdx * 0.08) + ")";
            const freq = 0.02 + wIdx * 0.008;
            const amp = 2.2 + wIdx * 1.6;
            const speed = 1.2 + wIdx * 0.5;
            for (let x = 0; x < w; x += 2) {
                const y = h / 2 + Math.sin(x * freq + time * speed) * amp * Math.cos(x * 0.004);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    btnPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
    });
    btnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        startTrack(shuffleOn ? nextShuffleIndex() : trackIndex + 1);
    });
    if (btnShuffle) {
        btnShuffle.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleShuffle();
        });
    }
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

    function setMenuButtonOpen(open) {
        if (btnMenu) btnMenu.classList.toggle("is-open", open);
    }

    if (window.cc && window.cc.onMenuClosed) {
        window.cc.onMenuClosed(() => {
            popupMenuOpen = false;
            setMenuButtonOpen(false);
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
            setMenuButtonOpen(false);
            ignoreNextMenuClosed = true;
            setTimeout(() => { ignoreNextMenuClosed = false; }, 450);
            if (window.cc.closeMenuPopup) window.cc.closeMenuPopup().catch(() => {});
            return;
        }
        if (!window.cc.openMiniContextMenu) return;
        const opened = await window.cc.openMiniContextMenu(point);
        popupMenuOpen = opened !== false;
        setMenuButtonOpen(popupMenuOpen);
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
        btnMenu.addEventListener("pointerdown", () => {
            armMenuToggle();
            setMenuButtonOpen(true);
        });
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
