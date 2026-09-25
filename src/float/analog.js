/* ═══════════════════════════════════════════════════════════
   CyberClock — Floating Analog Clock Logic
   CyberGems © 2026
═══════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    let cfg = {};
    let currentDesign = 1;
    let isAot = false;
    let rafId = null;
    let lastRenderTime = 0;
    const FRAME_MS = 1000 / 30; // 30fps smooth render

    // Offscreen Face Cache
    let cachedFaceCanvas = null;
    let cachedFaceKey = null;

    const shell = document.getElementById("analog-shell");
    const canvas = document.getElementById("analog-canvas");
    const ctx = canvas.getContext("2d");

    const badgeText = document.getElementById("analog-badge-text");
    const dialBadge = document.getElementById("analog-dial-badge");
    const btnClose = document.getElementById("btn-analog-close");
    const btnPrev = document.getElementById("btn-dial-prev");
    const btnNext = document.getElementById("btn-dial-next");

    const ctxMenu = document.getElementById("analog-ctx-menu");
    const ctxCurrentSkin = document.getElementById("ctx-current-skin");
    const skinGrid = document.getElementById("analog-skin-grid");
    const ctxAot = document.getElementById("ctx-aot");
    const ctxAotCheck = document.getElementById("ctx-aot-check");
    const ctxFull = document.getElementById("ctx-full");
    const ctxNewTimer = document.getElementById("ctx-new-timer");
    const ctxNewSw = document.getElementById("ctx-new-sw");
    const ctxNewCal = document.getElementById("ctx-new-cal");
    const ctxCloseItem = document.getElementById("ctx-close");
    const opChips = document.querySelectorAll(".analog-op-chip");

    // Initialize Canvas Resolution
    function initCanvasResolution() {
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
        const cssSize = 266;
        const targetRes = Math.round(cssSize * dpr);
        if (canvas.width !== targetRes || canvas.height !== targetRes) {
            canvas.width = targetRes;
            canvas.height = targetRes;
            invalidateFaceCache();
        }
    }

    function invalidateFaceCache() {
        cachedFaceCanvas = null;
        cachedFaceKey = null;
    }

    function currentOpacity() {
        return cfg.floatAnalogOpacity ?? cfg.miniOpacity ?? 1.0;
    }

    function applyOpacity(op) {
        if (shell) shell.style.setProperty("--analog-opacity", op);
        syncOpacityChips(op);
    }

    function syncOpacityChips(op) {
        const target = Math.round(op * 100);
        opChips.forEach((chip) => {
            const chipVal = Math.round(parseFloat(chip.dataset.op) * 100);
            chip.classList.toggle("active", chipVal === target);
        });
    }

    function setDesign(d, persist = true) {
        const next = Math.min(10, Math.max(1, parseInt(d, 10) || 1));
        if (next === currentDesign && cachedFaceCanvas) return;
        currentDesign = next;
        invalidateFaceCache();
        updateDesignUI();

        if (persist && window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ floatAnalogDesign: currentDesign });
        }
    }

    function updateDesignUI() {
        const skinName = window.CCAnalog ? window.CCAnalog.getDialDesignName(currentDesign) : `Design ${currentDesign}`;
        if (badgeText) badgeText.textContent = `${currentDesign}/10`;
        if (dialBadge) dialBadge.setAttribute("data-tooltip", skinName);
        if (ctxCurrentSkin) ctxCurrentSkin.textContent = skinName;

        // Sync skin grid active state
        document.querySelectorAll(".analog-skin-btn").forEach((btn) => {
            const btnDesign = parseInt(btn.dataset.design, 10);
            btn.classList.toggle("active", btnDesign === currentDesign);
        });
    }

    function buildSkinGrid() {
        if (!skinGrid || !window.CCAnalog) return;
        skinGrid.innerHTML = "";
        window.CCAnalog.DIAL_DESIGNS.forEach((d) => {
            const btn = document.createElement("button");
            btn.className = "analog-skin-btn";
            btn.dataset.design = d.id;
            if (d.id === currentDesign) btn.classList.add("active");
            btn.textContent = window.ccI18n ? window.ccI18n.t(d.key) : d.name;
            btn.addEventListener("click", () => {
                setDesign(d.id, true);
                closeContextMenu();
            });
            skinGrid.appendChild(btn);
        });
    }

    function applySettings(s) {
        if (!s) return;
        cfg = s;

        if (cfg.theme && window.CCTint) {
            window.CCTint.apply(cfg.theme);
            invalidateFaceCache();
        }
        if (window.ccI18n) {
            window.ccI18n.setLang(cfg.language || "auto");
            window.ccI18n.apply(document);
        }

        if (cfg.floatAnalogDesign) {
            currentDesign = Math.min(10, Math.max(1, parseInt(cfg.floatAnalogDesign, 10) || 1));
            invalidateFaceCache();
        } else if (cfg.clockDesign) {
            currentDesign = Math.min(10, Math.max(1, parseInt(cfg.clockDesign, 10) || 1));
            invalidateFaceCache();
        }

        buildSkinGrid();
        updateDesignUI();
        applyOpacity(currentOpacity());
    }

    // ── Animation Loop ───────────────────────────────────────────
    function tick(timestamp) {
        rafId = requestAnimationFrame(tick);
        if (timestamp - lastRenderTime < FRAME_MS) return;
        lastRenderTime = timestamp;

        renderFrame();
    }

    function renderFrame() {
        if (!window.CCAnalog || !canvas) return;

        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const R = Math.min(W, H) * 0.46;
        const colors = window.CCAnalog.themeColors();

        const cacheKey = `${W}_${H}_${currentDesign}_${colors.accent}_${colors.rgb}`;
        if (!cachedFaceCanvas || cachedFaceKey !== cacheKey) {
            cachedFaceCanvas = window.CCAnalog.buildClockFace(W, H, cx, cy, R, colors, currentDesign);
            cachedFaceKey = cacheKey;
        }

        const showBrand = cfg.clockShowBrand !== false;
        const brandText = cfg.clockBrandText || "";

        window.CCAnalog.renderClock(ctx, W, H, {
            dialScale: 0.46,
            colors,
            design: currentDesign,
            faceCanvas: cachedFaceCanvas,
            showBrand,
            brandText,
            date: new Date(),
        });
    }

    // ── Context Menu (Top-Layer Inside Window) ───────────────────
    function openContextMenu(clientX, clientY) {
        ctxMenu.hidden = false;
        const menuWidth = ctxMenu.offsetWidth || 204;
        const menuHeight = ctxMenu.offsetHeight || 215;

        const margin = 20;
        const maxX = window.innerWidth - menuWidth - margin;
        const maxY = window.innerHeight - menuHeight - margin;

        const x = Math.max(margin, Math.min(clientX, maxX));
        const y = Math.max(margin, Math.min(clientY, maxY));

        ctxMenu.style.left = `${x}px`;
        ctxMenu.style.top = `${y}px`;

        if (window.__TAURI__ && window.__TAURI__.window) {
            window.__TAURI__.window.getCurrentWindow().isAlwaysOnTop().then((aot) => {
                isAot = !!aot;
                ctxAotCheck.classList.toggle("visible", isAot);
            }).catch(() => {});
        }

        syncOpacityChips(currentOpacity());
    }

    function closeContextMenu() {
        if (ctxMenu) ctxMenu.hidden = true;
    }

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener("click", (e) => {
        if (ctxMenu && !ctxMenu.hidden && !ctxMenu.contains(e.target)) {
            closeContextMenu();
        }
    });

    if (ctxAot) {
        ctxAot.addEventListener("click", async () => {
            closeContextMenu();
            if (window.cc && window.cc.toggleAlwaysOnTop) {
                const res = await window.cc.toggleAlwaysOnTop();
                isAot = !!res;
                ctxAotCheck.classList.toggle("visible", isAot);
            }
        });
    }

    opChips.forEach((chip) => {
        chip.addEventListener("click", (e) => {
            e.stopPropagation();
            const op = parseFloat(chip.dataset.op);
            if (Number.isFinite(op)) {
                applyOpacity(op);
                if (window.cc && window.cc.saveSettings) {
                    window.cc.saveSettings({ floatAnalogOpacity: op });
                }
            }
        });
    });

    if (ctxFull) {
        ctxFull.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.goFull) {
                window.cc.goFull();
            }
        });
    }

    if (ctxNewTimer) {
        ctxNewTimer.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("timer");
            }
        });
    }

    if (ctxNewSw) {
        ctxNewSw.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("sw");
            }
        });
    }

    if (ctxNewCal) {
        ctxNewCal.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("cal");
            }
        });
    }

    if (ctxCloseItem) {
        ctxCloseItem.addEventListener("click", () => {
            closeContextMenu();
            closeWindow();
        });
    }

    function closeWindow() {
        try {
            if (window.cc && window.cc.closeWindow) {
                window.cc.closeWindow();
            } else if (window.__TAURI__ && window.__TAURI__.window) {
                window.__TAURI__.window.getCurrentWindow().close();
            } else {
                window.close();
            }
        } catch (e) {
            window.close();
        }
    }

    // ── Quick Hover Controls ─────────────────────────────────────
    if (btnClose) {
        btnClose.addEventListener("click", (e) => {
            e.stopPropagation();
            closeWindow();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener("click", (e) => {
            e.stopPropagation();
            const prev = currentDesign <= 1 ? 10 : currentDesign - 1;
            setDesign(prev, true);
        });
    }

    if (btnNext) {
        btnNext.addEventListener("click", (e) => {
            e.stopPropagation();
            const next = currentDesign >= 10 ? 1 : currentDesign + 1;
            setDesign(next, true);
        });
    }

    // ── Keyboard Controls ────────────────────────────────────────
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (ctxMenu && !ctxMenu.hidden) {
                closeContextMenu();
                return;
            }
            closeWindow();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            const prev = currentDesign <= 1 ? 10 : currentDesign - 1;
            setDesign(prev, true);
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            const next = currentDesign >= 10 ? 1 : currentDesign + 1;
            setDesign(next, true);
        }
    });

    // ── Mouse Wheel Quick Design Switching ───────────────────────
    if (shell) {
        shell.addEventListener("wheel", (e) => {
            if (ctxMenu && !ctxMenu.hidden) return;
            if (e.deltaY < 0) {
                const prev = currentDesign <= 1 ? 10 : currentDesign - 1;
                setDesign(prev, true);
            } else if (e.deltaY > 0) {
                const next = currentDesign >= 10 ? 1 : currentDesign + 1;
                setDesign(next, true);
            }
        }, { passive: true });
    }

    // ── Window Dragging ──────────────────────────────────────────
    function handleDragStart(e) {
        if (e.target.closest("button, .analog-ov-btn, .analog-ctx-menu, .analog-op-chip, .analog-skin-btn")) return;
        if (e.button !== 0) return;
        if (cfg.miniPositionLocked === true) return;

        if (ctxMenu && !ctxMenu.hidden) {
            closeContextMenu();
            return;
        }

        e.preventDefault();
        document.body.classList.add("is-dragging");
        if (window.cc && window.cc.startDragging) {
            window.cc.startDragging()
                .then(() => document.body.classList.remove("is-dragging"))
                .catch(() => document.body.classList.remove("is-dragging"));
        }
    }

    if (shell) {
        shell.addEventListener("mousedown", handleDragStart);
    }
    document.body.addEventListener("mousedown", (e) => {
        if (e.target === document.body) handleDragStart(e);
    });

    window.addEventListener("mouseup", () => {
        document.body.classList.remove("is-dragging");
    });

    // Window Resize Handling
    window.addEventListener("resize", () => {
        initCanvasResolution();
    });

    // ── Initialization & Settings ────────────────────────────────
    initCanvasResolution();

    if (window.cc && window.cc.getSettings) {
        window.cc.getSettings().then((s) => applySettings(s));
    }
    if (window.cc && window.cc.onSettingsUpdated) {
        window.cc.onSettingsUpdated((s) => applySettings(s));
    }
    if (window.cc && window.cc.onInit) {
        window.cc.onInit((s) => applySettings(s));
    }

    buildSkinGrid();
    updateDesignUI();
    rafId = requestAnimationFrame(tick);
})();
