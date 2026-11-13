/**
 * CyberClock — Floating Relax widget.
 * Controls the audio session in the main window.
 */
(function () {
    const shell = document.getElementById("relax-shell");
    const trackEl = document.getElementById("track-name");
    const trackLabel = document.getElementById("track-label");
    const statusEl = document.getElementById("playback-status");
    const elapsedEl = document.getElementById("elapsed");
    const autoStopEl = document.getElementById("auto-stop");
    const autoStopTime = document.getElementById("auto-stop-time");
    const autoStopOptions = document.getElementById("auto-stop-options");
    const autoStopChoices = Array.from(autoStopOptions.querySelectorAll("button"));
    const volumeTrigger = document.getElementById("master-volume");
    const volumeOptions = document.getElementById("master-volume-options");
    const volumeSlider = document.getElementById("master-volume-slider");
    const volumeValue = document.getElementById("master-volume-value");
    const btnPlay = document.getElementById("btn-play");
    const btnNext = document.getElementById("btn-next");
    const btnShuffle = document.getElementById("btn-shuffle");
    const btnMute = document.getElementById("btn-mute");
    const btnMenu = document.getElementById("btn-menu");
    const btnClose = document.getElementById("btn-close");
    const spectrum = document.getElementById("spectrum");
    const SPECTRUM_BARS = 48;
    const levels = new Array(SPECTRUM_BARS).fill(0);
    let spectrumCtx = null;

    let cfg = {};
    let playback = {};
    let playbackStateRetry = null;
    let pendingVolume = null;
    let spectrumData = [];
    let lastSpectrumRequest = 0;
    let spectrumRequestPending = false;

    function sendControl(action) {
        window.cc.sendRelaxControl(action).catch(console.error);
    }

    function t(key) {
        return window.ccI18n ? window.ccI18n.t(key) : key;
    }

    function fmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const m = Math.floor(s / 60);
        return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }

    function refreshLabels() {
        const {track, layers, mixReady, playing, paused} = playback;
        const title = layers?.length
            ? layers.map(id => t("relax.track." + id)).join(" · ")
            : t(mixReady ? "relax.savedMix" : track ? "relax.track." + track : "relax.noTrack");
        if (trackLabel.textContent !== title) trackLabel.textContent = title;
        updateMarquee();
        updateAutoStop(Date.now());
        if (Number.isFinite(playback.volume)) {
            const percent = Math.round(playback.volume * 100);
            if (pendingVolume === percent) pendingVolume = null;
            const shown = String(pendingVolume ?? percent);
            if (volumeSlider.value !== shown) volumeSlider.value = shown;
            volumeValue.textContent = shown + "%";
        }
        const minutes = playback.autoStopMinutes ?? 0;
        autoStopEl.classList.toggle("is-armed", minutes > 0);
        autoStopChoices.forEach(button => {
            button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) === minutes));
        });
        const statusKey = !playing ? "relax.status.ready"
            : paused ? "relax.status.paused" : "relax.status.playing";
        statusEl.textContent = t(statusKey);
        statusEl.classList.toggle("is-playing", playing && !paused);
        const isMuted = cfg && cfg.audioMuted === true;
        btnPlay.disabled = isMuted;
        if (isMuted) {
            const muteLabel = t("relax.tooltip.unmute");
            btnPlay.setAttribute("data-tooltip", muteLabel);
            btnPlay.setAttribute("aria-label", muteLabel);
        } else {
            const key = paused || mixReady ? "relax.resume" : playing ? "relax.pause" : "relax.play";
            const label = t(key);
            btnPlay.setAttribute("data-tooltip", label);
            btnPlay.setAttribute("aria-label", label);
        }
        btnPlay.classList.toggle("is-playing", playing && !paused);
        if (btnShuffle) btnShuffle.classList.toggle("is-on", !!playback.shuffled);
        if (btnMute) {
            btnMute.style.display = isMuted ? "inline-flex" : "none";
            if (isMuted) {
                const label = t("relax.tooltip.unmute");
                btnMute.setAttribute("data-tooltip", label);
                btnMute.setAttribute("aria-label", label);
            }
        }
    }

    function updateMarquee() {
        const distance = Math.max(0, trackLabel.offsetWidth - trackEl.clientWidth + 10);
        const overflowing = trackLabel.offsetWidth > trackEl.clientWidth;
        trackEl.classList.toggle("is-overflowing", overflowing);
        trackEl.style.setProperty("--track-travel", `-${distance}px`);
        trackEl.style.setProperty("--track-duration", `${4 + distance / 15}s`);
    }

    function updateAutoStop(now) {
        const timer = playback.autoStop;
        if (autoStopTime.hidden !== !timer) autoStopTime.hidden = !timer;
        if (!timer) return;
        const remaining = timer.deadline === null
            ? timer.remaining : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
        const time = fmt(remaining * 1000);
        if (autoStopTime.textContent !== time) autoStopTime.textContent = time;
    }

    function applySettings(s) {
        if (!s) return;
        cfg = s;
        if (s.theme && window.CCTint) window.CCTint.apply(s.theme);
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
        const op = typeof s.floatRelaxOpacity === "number" ? s.floatRelaxOpacity : 1;
        const ownCtp = window.cc.ownClickThrough(s);
        document.body.classList.toggle("click-through", ownCtp);
        if (shell) shell.style.opacity = String(ownCtp ? op * 0.88 : op);
        const skin = parseInt(s.floatRelaxDesign, 10);
        if (shell) shell.dataset.skin = String(skin >= 1 && skin <= 10 ? skin : 1);
        refreshLabels();
        applyRelaxZoom(s.floatRelaxZoom);
    }

    const BASE_RELAX_W = 300;
    const BASE_RELAX_H = 176;

    function applyRelaxZoom(z) {
        const zoom = (typeof z === "number" && Number.isFinite(z) && z > 0) ? z : 1;
        if (shell) shell.style.zoom = String(zoom);
        const w = Math.round(BASE_RELAX_W * zoom);
        const h = Math.round(BASE_RELAX_H * zoom);
        if (window.cc && window.cc.setWindowSize) {
            window.cc.setWindowSize({ width: w, height: h, recenter: true });
        }
    }

    function frame(now) {
        const active = playback.playing && !playback.paused && !cfg.audioMuted;
        const sinceRequest = now - lastSpectrumRequest;
        // Pull frames only while the widget is drawing. Limit the request
        // rate and retry if a reply is lost during pause or a window change.
        if (active && sinceRequest >= (spectrumRequestPending ? 500 : 100)) {
            lastSpectrumRequest = now;
            spectrumRequestPending = true;
            sendControl("spectrum");
        }
        drawSpectrum(now, active);
        const wallTime = Date.now();
        const elapsed = playback.startedAt
            ? (playback.pausedAt ?? wallTime) - playback.startedAt
            : 0;
        const display = fmt(elapsed);
        if (elapsedEl.textContent !== display) elapsedEl.textContent = display;
        updateAutoStop(wallTime);
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
        const data = active ? spectrumData : null;

        if (data && data.length) {
            const gap = w / SPECTRUM_BARS;
            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, acc);
            gradient.addColorStop(1, "rgba(" + rgb + ",.18)");
            const maxBin = data.length - 1;
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

    shell.querySelectorAll("button[data-tooltip]").forEach(button => {
        const dismiss = () => button.classList.add("tooltip-dismissed");
        button.addEventListener("pointerdown", dismiss);
        button.addEventListener("click", dismiss);
        button.addEventListener("pointerleave", () => button.classList.remove("tooltip-dismissed"));
    });

    autoStopOptions.addEventListener("toggle", event => {
        const open = event.newState === "open";
        autoStopEl.setAttribute("aria-expanded", String(open));
        if (open) {
            const selected = autoStopChoices.find(button => button.getAttribute("aria-pressed") === "true");
            (selected ?? autoStopChoices[0]).focus();
        }
    });
    volumeOptions.addEventListener("toggle", event => {
        const open = event.newState === "open";
        volumeTrigger.setAttribute("aria-expanded", String(open));
        if (open) volumeSlider.focus();
    });
    for (const [popover, trigger] of [[autoStopOptions, autoStopEl], [volumeOptions, volumeTrigger]]) {
        popover.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            popover.hidePopover();
            trigger.focus();
        });
    }
    function sendMasterVolume(commit) {
        pendingVolume = volumeSlider.valueAsNumber;
        volumeValue.textContent = volumeSlider.value + "%";
        sendControl({ type: "volume", volume: pendingVolume / 100, commit });
    }
    volumeSlider.addEventListener("input", () => sendMasterVolume(false));
    volumeSlider.addEventListener("change", () => sendMasterVolume(true));
    autoStopChoices.forEach(button => {
        button.addEventListener("click", () => {
            sendControl({ type: "auto-stop", minutes: Number(button.dataset.minutes) });
            autoStopOptions.hidePopover();
            autoStopEl.focus();
        });
    });

    btnPlay.addEventListener("click", (e) => {
        e.stopPropagation();
        sendControl("toggle");
    });
    btnNext.addEventListener("click", (e) => {
        e.stopPropagation();
        sendControl("next");
    });
    if (btnShuffle) {
        btnShuffle.addEventListener("click", (e) => {
            e.stopPropagation();
            sendControl("shuffle");
        });
    }
    if (btnMute) {
        btnMute.addEventListener("click", (e) => {
            e.stopPropagation();
            cfg.audioMuted = false;
            refreshLabels();
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ audioMuted: false });
            }
        });
    }
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
            if (e.target.closest("button, .relax-popover")) return;
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
            sendControl("toggle");
        } else if (e.key === "Escape") {
            if (volumeOptions.matches(":popover-open")) {
                e.preventDefault();
                volumeOptions.hidePopover();
                volumeTrigger.focus();
                return;
            }
            if (autoStopOptions.matches(":popover-open")) {
                e.preventDefault();
                autoStopOptions.hidePopover();
                autoStopEl.focus();
                return;
            }
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

    Promise.all([
        window.cc.onRelaxPlayback(state => {
            playback = state;
            clearInterval(playbackStateRetry);
            autoStopEl.disabled = false;
            volumeTrigger.disabled = false;
            if (!state.playing || state.paused) {
                spectrumData = [];
                spectrumRequestPending = false;
            }
            refreshLabels();
        }),
        window.cc.onRelaxSpectrum(data => {
            spectrumData = data;
            spectrumRequestPending = false;
        })
    ]).then(() => {
        if (!autoStopEl.disabled) return;
        playbackStateRetry = setInterval(() => sendControl("state"), 500);
        sendControl("state");
    }).catch(console.error);

    refreshLabels();
    const trackObserver = new ResizeObserver(updateMarquee);
    trackObserver.observe(trackEl);
    trackObserver.observe(trackLabel);
    requestAnimationFrame(frame);
})();
