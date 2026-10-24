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
    const btnMenu = document.getElementById("btn-analog-menu");
    const btnClose = document.getElementById("btn-analog-close");
    const btnPrev = document.getElementById("btn-dial-prev");
    const btnNext = document.getElementById("btn-dial-next");

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
        const plate = document.getElementById("analog-plate");
        const target = plate || shell;
        if (target) target.style.setProperty("--analog-opacity", op);
    }

    const BASE_CANVAS_SZ = 266;
    const BASE_PLATE_SZ = 274;
    const BASE_WIN_SZ = 320;
    const MIN_WIN_SZ = 380;

    function currentZoom() {
        const z = cfg.floatAnalogZoom;
        if (typeof z === "number" && Number.isFinite(z) && z > 0) return z;
        return 1.0;
    }

    function applyZoom(zoom, persist = false) {
        if (!Number.isFinite(zoom) || zoom <= 0) return;
        const canvasSz = Math.round(BASE_CANVAS_SZ * zoom);
        const plateSz = Math.round(BASE_PLATE_SZ * zoom);
        const winSz = Math.max(MIN_WIN_SZ, Math.round(BASE_WIN_SZ * zoom));

        const plate = document.getElementById("analog-plate");
        const shell = document.getElementById("analog-shell");
        if (plate) {
            plate.style.width = plateSz + "px";
            plate.style.height = plateSz + "px";
        }
        if (shell) {
            shell.style.width = canvasSz + "px";
            shell.style.height = canvasSz + "px";
        }
        if (canvas) {
            canvas.width = canvasSz;
            canvas.height = canvasSz;
        }

        invalidateFaceCache();
        renderFrame();

        if (window.cc && window.cc.setWindowSize) {
            window.cc.setWindowSize({ width: winSz, height: winSz, recenter: true, zoom: zoom });
        }

        if (persist && window.cc && window.cc.saveSettings) {
            window.cc.saveSettings({ floatAnalogZoom: zoom });
        }
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
    }

    function applySettings(s) {
        if (!s) return;
        cfg = s;
        document.body.classList.toggle("click-through", window.cc.ownClickThrough(cfg));

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

        updateDesignUI();
        applyOpacity(currentOpacity());
        applyZoom(currentZoom(), false);

        if (window.ccIcons && window.ccIcons.replaceIcons) {
            window.ccIcons.replaceIcons(document);
        } else if (window.ccIcons && window.ccIcons.inject) {
            window.ccIcons.inject(document);
        }
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

    // ── Context Menu (Central Floating Popup) ────────────────────
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
        if (window.cc && window.cc.getWindowPosition) {
            window.cc.getWindowPosition().then((winPos) => {
                openOrToggleMenu(menuPointFromClient(clientX, clientY, winPos));
            }).catch(() => {
                openOrToggleMenu(menuPointFromClient(clientX, clientY));
            });
        } else {
            openOrToggleMenu(menuPointFromClient(clientX, clientY));
        }
    }

    if (btnMenu) {
        btnMenu.addEventListener("pointerdown", () => armMenuToggle());
        btnMenu.addEventListener("click", (e) => {
            e.stopPropagation();
            btnMenu.blur();
            const rect = btnMenu.getBoundingClientRect();
            const clientX = Math.round(rect.left + rect.width / 2);
            const clientY = Math.round(rect.bottom + 4);
            openMenuAt(clientX, clientY);
        });
    }

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        armMenuToggle();
        openMenuAt(e.clientX, e.clientY);
    });

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
            if (popupMenuOpen && window.cc && window.cc.closeMenuPopup) {
                window.cc.closeMenuPopup().catch(() => {});
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
        if (e.target.closest("button, .analog-ov-btn")) return;
        if (e.button !== 0) return;
        if (cfg.analogPositionLocked === true) return;

        if (popupMenuOpen && window.cc && window.cc.closeMenuPopup) {
            window.cc.closeMenuPopup().catch(() => {});
        }

        e.preventDefault();
        document.body.classList.add("is-dragging");
        if (window.cc && window.cc.startDragging) {
            window.cc.startDragging()
                .then(() => document.body.classList.remove("is-dragging"))
                .catch(() => document.body.classList.remove("is-dragging"));
        }
    }

    const plate = document.getElementById("analog-plate");
    if (plate) {
        plate.addEventListener("mousedown", handleDragStart);
    } else if (shell) {
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

    updateDesignUI();
    rafId = requestAnimationFrame(tick);
})();
