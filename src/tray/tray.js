    let currentMenuState = null;
    const rootEl = document.getElementById("tray-root");

    // Discrete zoom stops for the mini clock (slider index → factor).
    const ZOOM_STEPS = [0.5, 1, 2, 4];

    // Debounced settings save for slider drags: each save broadcasts the
    // full settings object to every window, so coalesce the burst of
    // `input` events into one trailing save.
    let zoomSaveTimer = null;
    function saveZoomDebounced(factor) {
        clearTimeout(zoomSaveTimer);
        zoomSaveTimer = setTimeout(() => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ miniZoom: factor });
            }
        }, 120);
    }

    function reportSize() {
        if (!rootEl) return;
        const r = rootEl.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        if (window.cc && window.cc.trayMenuReady) {
            window.cc.trayMenuReady({ width: r.width, height: r.height });
        }
    }

    function applyTheme(theme) {
        document.body.dataset.theme = theme || "arctic-ice";
    }

    function renderState(state) {
        if (!state) return;
        currentMenuState = state;

        // Theme
        if (state.theme) applyTheme(state.theme);

        // Language
        if (window.ccI18n) {
            window.ccI18n.setLang(state.language || "auto");
        }

        // Version
        const verEl = document.getElementById("app-ver");
        if (verEl && state.version) {
            verEl.textContent = "v" + state.version;
        }

        // Update badge
        const badgeEl = document.getElementById("update-badge");
        if (badgeEl) {
            badgeEl.style.display = state.update_available ? "inline-block" : "none";
        }

        // Visibility Item
        const lblVis = document.getElementById("lbl-visibility");
        const icoVis = document.getElementById("ico-visibility");
        const isVis = state.is_visible;
        if (lblVis) {
            lblVis.textContent = window.ccI18n ? window.ccI18n.t(isVis ? "tray.hide" : "tray.show") : (isVis ? "Hide Clock" : "Show Clock");
        }
        if (icoVis) {
            icoVis.setAttribute("data-ico", isVis ? "eye-off" : "eye");
        }

        // Mode Item
        const isFull = state.window_mode === "full";
        const lblMode = document.getElementById("lbl-mode");
        const icoMode = document.getElementById("ico-mode");
        if (lblMode) {
            lblMode.textContent = window.ccI18n ? window.ccI18n.t(isFull ? "tray.miniMode" : "tray.fullMode") : (isFull ? "Mini Mode" : "Full Mode");
        }
        if (icoMode) {
            icoMode.setAttribute("data-ico", isFull ? "compact" : "expand");
        }

        // Features
        const lblTimer = document.getElementById("lbl-timer");
        if (lblTimer) lblTimer.textContent = window.ccI18n ? window.ccI18n.t("tray.timer") : "Timer";
        const lblSw = document.getElementById("lbl-stopwatch");
        if (lblSw) lblSw.textContent = window.ccI18n ? window.ccI18n.t("tray.stopwatch") : "Stopwatch";
        const lblRelax = document.getElementById("lbl-relax");
        if (lblRelax) lblRelax.textContent = window.ccI18n ? window.ccI18n.t("tray.relax") : "Relax";
        const lblSettings = document.getElementById("lbl-settings");
        if (lblSettings) lblSettings.textContent = window.ccI18n ? window.ccI18n.t("tray.settings") : "Settings...";
        const lblQuit = document.getElementById("lbl-quit");
        if (lblQuit) lblQuit.textContent = window.ccI18n ? window.ccI18n.t("tray.quit") : "Exit";

        // Mini zoom (discrete steps, 100% default)
        const lblZoom = document.getElementById("lbl-zoom");
        if (lblZoom) lblZoom.textContent = window.ccI18n ? window.ccI18n.t("settings.mini.zoom") : "Zoom";
        const zoomSlider = document.getElementById("tray-zoom");
        const zoomVal = document.getElementById("tray-zoom-val");
        if (zoomSlider) {
            const idx = ZOOM_STEPS.indexOf(state.mini_zoom ?? 1);
            zoomSlider.value = String(idx >= 0 ? idx : 1);
        }
        if (zoomVal) {
            zoomVal.textContent = Math.round((state.mini_zoom ?? 1) * 100) + "%";
        }

        // Help section labels
        const T = (k, fb) => (window.ccI18n ? window.ccI18n.t(k) : fb);
        const setLbl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setLbl("lbl-help", T("tray.help", "Help"));
        setLbl("lbl-pin-tray", T("tray.pinTrayIcon", "Pin icon to taskbar..."));
        setLbl("lbl-faq", T("tray.faq", "FAQ"));
        setLbl("lbl-changelog", T("tray.changelog", "Changelog"));
        setLbl("lbl-website", T("tray.homepage", "Website"));
        setLbl("lbl-donate", T("tray.donate", "Donate"));
        setLbl("lbl-about", T("tray.about", "About..."));
        setLbl("lbl-check-updates", T("tray.checkUpdates", "Check for Update..."));

        // About modal labels + state
        setLbl("about-sub", T("settings.general.aboutSub", "CyberGems © 2026 · Premium Cyber-Neon Clock for Windows"));
        setLbl("about-maint-lbl", T("about.maintenance", "Maintenance"));
        setLbl("ta-diag-lbl", T("about.copyDiag", "Copy diagnostics"));
        setLbl("ta-auto-lbl", T("about.autoUpdates", "Auto-updates"));
        setLbl("ta-auto-desc", T("about.autoUpdatesDesc", "Check automatically at startup"));
        const taAutoEl = document.getElementById("ta-autoup");
        if (taAutoEl) taAutoEl.checked = state.auto_update !== false;
        if (state.version) {
            appVersion = state.version;
            renderAboutModal();
        }

        // Re-render icons if data-ico changed
        if (window.ccIcons) {
            window.ccIcons.replaceIcons();
        }
    }

    function runAction(action) {
        if (window.cc && window.cc.trayMenuAction) {
            window.cc.trayMenuAction(action);
        }
    }

    // CyberClock repo links for the Help section and About modal.
    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const HELP_URLS = {
        faq: `${REPO_URL}/wiki#faq`,
        changelog: `${REPO_URL}/releases`,
        website: "https://cybergems.org",
        donate: "https://ko-fi.com/cybergems",
        github: REPO_URL,
        issues: `${REPO_URL}/issues`,
    };

    function openUrl(url) {
        if (window.cc && window.cc.openExternalUrl) {
            window.cc.openExternalUrl(url);
            return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
    }

    // ── Help section ────────────────────────────────────────────
    const helpToggle = document.getElementById("btn-help-toggle");
    const helpSub = document.getElementById("tray-help-sub");

    function reportSizeSoon() {
        requestAnimationFrame(() => {
            requestAnimationFrame(reportSize);
        });
    }

    function setHelpOpen(open) {
        helpSub.hidden = !open;
        helpToggle.setAttribute("aria-expanded", String(open));
        helpToggle.classList.toggle("open", open);
        reportSizeSoon();
    }

    if (helpToggle) {
        helpToggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHelpOpen(helpSub.hidden);
        });
    }

    // Help sub-item handlers: URLs open in the browser, the pin opens
    // Windows settings, about opens the modal — none close the menu.
    document.querySelectorAll(".tray-sub-item[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === "pin-tray-icon") {
                if (window.cc && window.cc.openTaskbarSettings) {
                    window.cc.openTaskbarSettings();
                }
                setTimeout(() => hideMenu(), 250);
            } else if (action === "about-modal") {
                openAboutModal();
            } else if (action === "check-updates") {
                openAboutModal(true);
            } else if (HELP_URLS[action]) {
                openUrl(HELP_URLS[action]);
                setTimeout(() => hideMenu(), 250);
            }
        });
    });

    function hideMenu() {
        if (window.cc && window.cc.hideTrayMenu) {
            window.cc.hideTrayMenu();
        }
    }

    // ── About modal (adapted from CyberLauncher's AboutModal) ──
    const aboutOverlay = document.getElementById("about-overlay");
    let updateStatus = { state: "idle" };
    let appVersion = "";
    let diagTimer = null;

    function openAboutModal(autoCheck = false) {
        aboutOverlay.hidden = false;
        reportSizeSoon();
        if (autoCheck) handleUpdateAction();
    }

    function closeAboutModal() {
        aboutOverlay.hidden = true;
        reportSizeSoon();
    }

    const aboutClose = document.getElementById("about-close");
    if (aboutClose) {
        aboutClose.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAboutModal();
        });
    }

    function renderAboutModal() {
        const verEl = document.getElementById("about-version");
        if (verEl && appVersion) {
            verEl.textContent = "v" + appVersion;
        }

        const stEl = document.getElementById("ta-update-status");
        const btn = document.getElementById("ta-update-btn");
        const btnLbl = document.getElementById("ta-update-btn-lbl");
        if (!stEl || !btn) return;

        stEl.className = "ta-update-status";
        btn.disabled = false;
        btn.classList.remove("spin");

        const t = (k) => (window.ccI18n ? window.ccI18n.t(k) : k);
        const s = updateStatus;

        if (s.state === "idle") {
            stEl.textContent = "";
            btnLbl.textContent = t("about.checkUpdates");
        } else if (s.state === "checking") {
            stEl.className += " warn";
            stEl.textContent = t("about.statuses.checking");
            btn.disabled = true;
            btn.classList.add("spin");
            btnLbl.textContent = t("about.checkUpdates");
        } else if (s.state === "not-available") {
            stEl.className += " ok";
            stEl.textContent = t("about.statuses.latest");
            btnLbl.textContent = t("about.checkUpdates");
        } else if (s.state === "available") {
            stEl.className += " info";
            stEl.textContent = t("about.statuses.available");
            btnLbl.textContent = t("about.downloadBtn");
        } else if (s.state === "downloading") {
            stEl.className += " warn";
            stEl.textContent = t("about.statuses.downloading").replace(
                "{percent}",
                String(s.percent ?? 0),
            );
            btn.disabled = true;
            btnLbl.textContent = t("about.checkUpdates");
        } else if (s.state === "downloaded") {
            stEl.className += " ok";
            stEl.textContent = t("about.statuses.downloaded");
            btnLbl.textContent = t("about.installBtn");
        } else if (s.state === "error") {
            stEl.className += " err";
            stEl.textContent = t("about.statuses.error");
            btnLbl.textContent = t("about.checkUpdates");
        }
    }

    async function handleUpdateAction() {
        if (updateStatus.state === "available") {
            await window.cc.downloadUpdate();
            return;
        }
        if (updateStatus.state === "downloaded") {
            await window.cc.installUpdate();
            return;
        }
        if (updateStatus.state === "checking" || updateStatus.state === "downloading") {
            return;
        }

        updateStatus = { state: "checking" };
        renderAboutModal();
        try {
            const res = await window.cc.checkForUpdates();
            if (!res?.ok) {
                updateStatus = {
                    state: "error",
                    message: res?.error || "Update check failed",
                };
            } else if (updateStatus.state === "checking") {
                updateStatus = {
                    state: "not-available",
                    version: res.version || appVersion,
                };
            }
        } catch (e) {
            updateStatus = {
                state: "error",
                message: String(e?.message || e),
            };
        }
        renderAboutModal();
    }

    const taUpdateBtn = document.getElementById("ta-update-btn");
    if (taUpdateBtn) {
        taUpdateBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUpdateAction();
        });
    }

    // Update status events from the backend (shared updater flow).
    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus((payload) => {
            updateStatus = payload || { state: "idle" };
            renderAboutModal();
        });
    }

    // Copy diagnostics: version + platform to the clipboard.
    const taDiagBtn = document.getElementById("ta-diag-btn");
    if (taDiagBtn) {
        taDiagBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const t = (k) => (window.ccI18n ? window.ccI18n.t(k) : k);
            const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
            const lines = [
                `CyberClock ${appVersion}`,
                `Platform: Windows (${navigator.userAgentData?.platform || "Win32"})`,
                `Locale: ${lang}`,
            ];
            try {
                await navigator.clipboard.writeText(lines.join("\n"));
                const lbl = document.getElementById("ta-diag-lbl");
                if (lbl) lbl.textContent = t("about.diagCopied");
                clearTimeout(diagTimer);
                diagTimer = setTimeout(() => {
                    lbl.textContent = t("about.copyDiag");
                }, 1800);
            } catch { /* clipboard unavailable */ }
        });
    }

    // Auto-update toggle inside the modal.
    const taAutoUp = document.getElementById("ta-autoup");
    if (taAutoUp) {
        taAutoUp.addEventListener("change", (e) => {
            e.stopPropagation();
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ autoUpdate: e.target.checked });
            }
        });
    }

    // Footer links.
    const footerLinks = {
        "ta-link-website": HELP_URLS.website,
        "ta-link-github": HELP_URLS.github,
        "ta-link-issues": HELP_URLS.issues,
        "ta-link-releases": HELP_URLS.changelog,
        "ta-link-donate": HELP_URLS.donate,
    };
    for (const [id, url] of Object.entries(footerLinks)) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                openUrl(url);
            });
        }
    }
    const footTxt = document.querySelector(".ta-foot-txt");
    if (footTxt) {
        footTxt.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openUrl(HELP_URLS.website);
        });
    }

    // Version for the About modal (renderState also sets it via the tray
    // state; this covers the browser/dev fallback).
    if (window.cc && window.cc.getAppVersion) {
        window.cc.getAppVersion().then((v) => {
            if (v && !appVersion) {
                appVersion = v;
                renderAboutModal();
            }
        }).catch(() => {});
    }

    // Zoom slider input (live label, debounced save)
    const trayZoom = document.getElementById("tray-zoom");
    if (trayZoom) {
        trayZoom.addEventListener("input", (e) => {
            const idx = parseInt(e.target.value);
            const factor = ZOOM_STEPS[idx] ?? 1;
            const zoomVal = document.getElementById("tray-zoom-val");
            if (zoomVal) zoomVal.textContent = Math.round(factor * 100) + "%";
            saveZoomDebounced(factor);
        });
    }

    // Click handlers for tray items & header. Help sub-items are excluded —
    // they own their handlers (URLs / pin / about modal) and must not fall
    // through to runAction, which hides the tray menu window.
    document.querySelectorAll(".tray-item:not(.tray-sub-item), .tray-header").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = btn.dataset.action;
            if (!action) return;
            if (action === "toggle_mode") {
                const targetMode = currentMenuState && currentMenuState.window_mode === "full" ? "mini" : "full";
                runAction(targetMode);
            } else {
                runAction(action);
            }
        });
    });

    // Prevent context menu
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // Dismiss on Escape (About modal first, then the whole menu)
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (aboutOverlay && !aboutOverlay.hidden) {
                closeAboutModal();
                return;
            }
            hideMenu();
        }
    });

    // Dismiss on blur
    window.addEventListener("blur", () => {
        setTimeout(() => {
            if (window.cc && window.cc.hideTrayMenu) {
                window.cc.hideTrayMenu();
            }
        }, 100);
    });

    // Tauri event subscriptions
    if (window.cc) {
        if (window.cc.onTrayMenuState) {
            window.cc.onTrayMenuState((state) => {
                renderState(state);
            });
        }

        if (window.cc.onTrayMenuShow) {
            window.cc.onTrayMenuShow(() => {
                if (window.cc.getTrayMenuState) {
                    window.cc.getTrayMenuState().then(renderState).catch(console.error);
                }
                requestAnimationFrame(() => {
                    requestAnimationFrame(reportSize);
                });
            });
        }

        if (window.cc.getTrayMenuState) {
            window.cc.getTrayMenuState().then((state) => {
                renderState(state);
                requestAnimationFrame(() => {
                    requestAnimationFrame(reportSize);
                });
            }).catch(console.error);
        }
    }