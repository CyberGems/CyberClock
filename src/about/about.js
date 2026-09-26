/**
 * CyberClock — About Window (CyberSnap standard behavior)
 * Title-bar driven window: minimize + close (donate heart shortcut),
 * "Updates & Maintenance" card with the auto-check toggle and a
 * stateful check/download/install button, muted footer links.
 * CyberGems © 2026
 */
(() => {
    "use strict";

    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const LINKS = {
        website: "https://cybergems.org",
        docs: `${REPO_URL}/wiki/Home`,
        github: REPO_URL,
        issues: `${REPO_URL}/issues`,
        releases: `${REPO_URL}/releases`,
        donate: "https://ko-fi.com/cybergems",
    };

    const T = (key, fallback) =>
        window.ccI18n ? window.ccI18n.t(key) : fallback || key;

    function openUrl(url) {
        if (window.cc && window.cc.openExternalUrl) {
            window.cc.openExternalUrl(url);
            return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function closeAbout() {
        if (window.cc && window.cc.hideWindow) {
            window.cc.hideWindow("about");
            return;
        }
        if (window.cc && window.cc.closeWindow) {
            window.cc.closeWindow();
        }
    }

    function minimizeAbout() {
        if (window.cc && window.cc.minimizeWindow) {
            window.cc.minimizeWindow();
        }
    }

    let appVersion = "";
    let updateStatus = { state: "idle" };
    let updatePortable = false;
    let updateMsStore = false;

    // ── Theme / language / auto-update toggle / suite showcase ──
    function applySettings(s) {
        window.CCTint.apply(s.theme || "ice");
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
        const autoEl = document.getElementById("ab-autoup");
        if (autoEl) autoEl.checked = s.autoUpdate !== false;

        const showSuite = s.showSuiteRecommendations !== false;
        const suiteLabel = document.getElementById("ab-suite-label");
        const suiteCard = document.getElementById("ab-suite-card");
        if (suiteLabel) suiteLabel.style.display = showSuite ? "" : "none";
        if (suiteCard) suiteCard.style.display = showSuite ? "" : "none";
        if (showSuite) {
            initSuiteShowcase();
        }

        if (s.skippedUpdateVersion && updateStatus.version === s.skippedUpdateVersion && updateStatus.state === "available") {
            updateStatus = { state: "skipped", version: updateStatus.version };
        }

        renderUpdateState();
    }

    if (window.cc) {
        window.cc.onInit((s) => applySettings(s));
        window.cc.onSettingsUpdated((s) => applySettings(s));
    }

    // ── Version label ────────────────────────────────────────
    if (window.cc && window.cc.getAppVersion) {
        window.cc.getAppVersion().then((v) => {
            appVersion = v || "dev";
            const el = document.getElementById("ab-version");
            if (el) el.textContent = "Version v" + appVersion;
        }).catch(() => {});
    }
    if (window.cc && window.cc.isPortable) {
        window.cc.isPortable().then((value) => {
            updatePortable = !!value;
            renderUpdateState();
        }).catch(() => {});
    }
    if (window.cc && window.cc.isMsStore) {
        window.cc.isMsStore().then((value) => {
            updateMsStore = !!value;
            renderUpdateState();
        }).catch(() => {});
    }

    // ── Update flow (CyberSnap state matrix) ─────────────────
    // idle/up-to-date: "Check Now" — available: "Update Now" —
    // downloading: progress % + disabled — downloaded: "Install & Restart".
    function renderUpdateState() {
        const btn = document.getElementById("ab-update-btn");
        const desc = document.getElementById("ab-update-desc");
        const progress = document.getElementById("ab-progress");
        const progressText = document.getElementById("ab-progress-text");
        const progressFill = document.getElementById("ab-progress-fill");
        if (!btn || !desc) return;

        const s = updateStatus;

        if (updateMsStore) {
            // Microsoft Store build: updates are distributed by the Store,
            // so the self-update button and the startup-check toggle make
            // no sense here.
            btn.style.display = "none";
            progress.hidden = true;
            desc.textContent = T(
                "about.statuses.msStore",
                "Updates are handled by the Microsoft Store.",
            );
            const autoRow = document.getElementById("ab-autoup")?.closest(".ab-setting-row");
            if (autoRow) autoRow.style.display = "none";
            return;
        }

        btn.style.display = "";
        btn.disabled = false;
        progress.hidden = s.state !== "downloading";
        const idleDesc = T(
            "about.updateDesc",
            "Check for the latest version and download updates directly.",
        );

        function setTip(text) {
            btn.removeAttribute("title");
            if (text) {
                btn.setAttribute("data-tooltip", text);
            } else {
                btn.removeAttribute("data-tooltip");
            }
        }

        desc.classList.remove("is-up-to-date", "is-available", "is-error", "is-checking");

        const updatePanel = document.getElementById("ab-update-panel");
        const updateNewVer = document.getElementById("ab-update-new-ver");
        const downloadBtn = document.getElementById("ab-download-btn");

        if (s.state === "idle") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            desc.textContent = idleDesc;
            if (updatePanel) updatePanel.hidden = true;
        } else if (s.state === "not-available") {
            desc.classList.add("is-up-to-date");
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const ver = s.version || appVersion || "";
            desc.textContent = "✓ " + T("about.statuses.latest", "You're up to date on {version}").replace(
                "{version}",
                ver ? "v" + ver : "",
            );
            if (updatePanel) updatePanel.hidden = true;
        } else if (s.state === "checking") {
            desc.classList.add("is-checking");
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.disabled = true;
            setTip("");
            desc.textContent = "⏳ " + T("about.statuses.checking", "Checking for updates…");
        } else if (s.state === "available") {
            desc.classList.add("is-available");
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const ver = s.version || "";
            const cleanVer = ver ? (ver.startsWith("v") ? ver : "v" + ver) : "";
            desc.textContent =
                "★ " + T("about.updateAvailable", "Update {0} available").replace(
                    "{0}",
                    cleanVer,
                );
            if (updatePanel) {
                updatePanel.hidden = false;
                if (updateNewVer) updateNewVer.textContent = cleanVer || "v…";
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    const dText = updatePortable
                        ? T("updates.downloadPortable", "Open download page")
                        : T("updates.download", "Download update");
                    downloadBtn.textContent = dText;
                    downloadBtn.setAttribute("data-tooltip", dText);
                }
                loadChangelogBullets(ver, s.releaseNotes);
            }
        } else if (s.state === "downloading") {
            desc.classList.add("is-checking");
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.disabled = true;
            setTip("");
            const pct = Math.round(s.percent ?? 0);
            desc.textContent = T(
                "about.statuses.downloading",
                "Downloading update ({pct}%)…",
            ).replace("{pct}", String(pct));
            progressText.textContent = desc.textContent;
            progressFill.style.width = pct + "%";
            if (updatePanel) {
                updatePanel.hidden = false;
                if (downloadBtn) {
                    downloadBtn.disabled = true;
                    downloadBtn.textContent = T("about.statuses.downloading", "Downloading update ({pct}%)…").replace("{pct}", String(pct));
                }
            }
        } else if (s.state === "downloaded") {
            desc.classList.add("is-available");
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            desc.textContent = "✓ " + T(
                "about.statuses.downloaded",
                "Update ready: click Install & Restart.",
            );
            if (updatePanel) {
                updatePanel.hidden = false;
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                    const iText = T("about.installBtn", "Install & Restart");
                    downloadBtn.textContent = iText;
                    downloadBtn.setAttribute("data-tooltip", T("about.installTooltip", "Install the update and restart"));
                }
            }
        } else if (s.state === "skipped") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const cleanVer = s.version ? (s.version.startsWith("v") ? s.version : "v" + s.version) : "";
            desc.textContent = T("about.updateSkipped", "Update {version} skipped").replace("{version}", cleanVer);
            if (updatePanel) updatePanel.hidden = true;
        } else if (s.state === "error") {
            desc.classList.add("is-error");
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const rawMsg = s.message || "";
            const isRawUrl = rawMsg.includes("error sending request") || rawMsg.includes("http");
            const errText = isRawUrl
                ? T("about.statuses.error", "Could not check for updates. Check your internet connection.")
                : (rawMsg || T("about.statuses.error", "Could not check for updates. Check your internet connection."));
            desc.textContent = "✕ " + errText;
            if (updatePanel) updatePanel.hidden = true;
        }
    }

    let cachedChangelogVersion = null;
    async function loadChangelogBullets(version, fallbackNotes = "") {
        const listEl = document.getElementById("ab-changelog-list");
        if (!listEl) return;
        if (cachedChangelogVersion === version && listEl.children.length > 0) return;
        cachedChangelogVersion = version;

        listEl.replaceChildren();
        let bullets = [];
        if (window.ccUpdates && window.ccUpdates.fetchReleaseDetails) {
            try {
                const details = await window.ccUpdates.fetchReleaseDetails(version, fallbackNotes);
                bullets = details.bullets || [];
            } catch (_) {}
        }
        if (!bullets.length && fallbackNotes) {
            bullets = (window.ccUpdates && window.ccUpdates.parseChangelogPeek)
                ? window.ccUpdates.parseChangelogPeek(fallbackNotes)
                : [];
        }
        if (!bullets.length) {
            const empty = document.createElement("li");
            empty.textContent = T("updates.notesUnavailable", "Release notes are not available right now.");
            listEl.appendChild(empty);
            return;
        }
        for (const bullet of bullets) {
            const li = document.createElement("li");
            li.textContent = bullet;
            listEl.appendChild(li);
        }
    }

    function initUpdatePanelActions() {
        const downloadBtn = document.getElementById("ab-download-btn");
        const skipBtn = document.getElementById("ab-skip-btn");
        const releaseBtn = document.getElementById("ab-release-btn");

        if (downloadBtn && !downloadBtn._hasListener) {
            downloadBtn._hasListener = true;
            downloadBtn.addEventListener("click", async () => {
                if (updateStatus.state === "downloaded") {
                    try {
                        await window.cc.installUpdate();
                    } catch (e) {
                        updateStatus = { state: "error", message: String(e?.message || e) };
                        renderUpdateState();
                    }
                    return;
                }
                if (updatePortable) {
                    openUrl(
                        updateStatus.releaseUrl ||
                        (window.ccUpdates && window.ccUpdates.releaseUrl(updateStatus.version)),
                    );
                    return;
                }
                try {
                    downloadBtn.disabled = true;
                    await window.cc.downloadUpdate();
                } catch (e) {
                    updateStatus = { state: "error", message: String(e?.message || e) };
                    renderUpdateState();
                }
            });
        }

        if (skipBtn && !skipBtn._hasListener) {
            skipBtn._hasListener = true;
            skipBtn.addEventListener("click", () => {
                if (updateStatus.version && window.cc && window.cc.saveSettings) {
                    window.cc.saveSettings({ skippedUpdateVersion: updateStatus.version }).catch(console.error);
                }
                updateStatus = { state: "skipped", version: updateStatus.version };
                renderUpdateState();
            });
        }

        if (releaseBtn && !releaseBtn._hasListener) {
            releaseBtn._hasListener = true;
            releaseBtn.addEventListener("click", () => {
                const url = updateStatus.releaseUrl ||
                    (window.ccUpdates && window.ccUpdates.releaseUrl(updateStatus.version));
                if (url) openUrl(url);
            });
        }
    }

    async function checkForUpdatesOnly() {
        if (updateStatus.state === "checking" || updateStatus.state === "downloading") {
            return;
        }

        updateStatus = { state: "checking" };
        renderUpdateState();
        try {
            const res = await window.cc.checkForUpdates();
            if (typeof res?.isPortable === "boolean") updatePortable = res.isPortable;
            if (!res?.ok) {
                updateStatus = {
                    state: "error",
                    message: res?.error || T(
                        "about.statuses.error",
                        "Could not check for updates. Check your internet connection.",
                    ),
                };
            } else if (res.version && appVersion && res.version !== appVersion) {
                updateStatus = {
                    state: "available",
                    version: res.version,
                    releaseNotes: res.releaseNotes,
                    releaseUrl: res.releaseUrl,
                };
            } else {
                updateStatus = { state: "not-available", version: res.version || appVersion };
            }
        } catch (e) {
            const raw = String(e?.message || e || "");
            const isRawUrl = raw.includes("error sending request") || raw.includes("http");
            updateStatus = {
                state: "error",
                message: isRawUrl
                    ? T("about.statuses.error", "Could not check for updates. Check your internet connection.")
                    : raw,
            };
        }
        renderUpdateState();
    }

    const updateBtn = document.getElementById("ab-update-btn");
    if (updateBtn) updateBtn.addEventListener("click", checkForUpdatesOnly);
    initUpdatePanelActions();

    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus((payload) => {
            updateStatus = payload || { state: "idle" };
            renderUpdateState();
        });
    }

    if (window.cc && window.cc.onCheckUpdatesTrigger) {
        window.cc.onCheckUpdatesTrigger(() => {
            checkForUpdatesOnly();
        });
    }

    // ── Auto-update toggle ──────────────────────────────────
    const autoUp = document.getElementById("ab-autoup");
    if (autoUp) {
        autoUp.addEventListener("change", (e) => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ autoUpdate: e.target.checked });
            }
        });
    }

    // ── CyberGems Suite Showcase ──────────────────────────────
    function initSuiteShowcase() {
        const grid = document.getElementById("ab-suite-grid");
        const moreBtn = document.getElementById("ab-suite-more");
        if (moreBtn && !moreBtn._hasListener) {
            moreBtn._hasListener = true;
            moreBtn.addEventListener("click", () => openUrl("https://cybergems.org"));
        }
        if (!grid) return;

        try {
            let apps = window.CC_SUITE_DATA ? window.CC_SUITE_DATA.apps : null;
            if (!Array.isArray(apps) || !apps.length) {
                fetch("../assets/suite/suite.json")
                    .then((r) => r.json())
                    .then((data) => {
                        if (Array.isArray(data?.apps)) renderSuiteButtons(grid, data.apps);
                    })
                    .catch(() => {});
                return;
            }
            renderSuiteButtons(grid, apps);
        } catch (e) {
            console.warn("Could not load suite showcase:", e);
        }
    }

    function renderSuiteButtons(grid, apps) {
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
        const isEs = lang === "es";

        // Exclude CyberClock from its own showcase
        const sisters = apps.filter((a) => a && a.slug !== "cyberclock");
        grid.innerHTML = "";

        for (const app of sisters) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "ab-suite-btn";
            const pitch = (isEs ? app.tagline?.es : app.tagline?.en) || app.name;
            const fullTip = `${app.name}: ${pitch}`;
            btn.removeAttribute("title");
            btn.setAttribute("data-tooltip", fullTip);
            btn.setAttribute("aria-label", fullTip);

            const img = document.createElement("img");
            img.src = `../assets/suite/${app.slug}.png`;
            img.alt = app.name;
            img.onerror = () => {
                img.style.display = "none";
                const fallbackSpan = document.createElement("span");
                fallbackSpan.textContent = app.name.slice(5, 7) || "CG";
                fallbackSpan.style.fontSize = "11px";
                fallbackSpan.style.fontWeight = "bold";
                fallbackSpan.style.color = "var(--accent-a)";
                btn.appendChild(fallbackSpan);
            };
            btn.appendChild(img);

            btn.addEventListener("click", () => {
                const target = app.site || `https://cybergems.org/apps/${app.slug}/`;
                openUrl(target);
            });

            grid.appendChild(btn);
        }
    }
    initSuiteShowcase();

    // ── Title bar ─────────────────────────────────────────────
    const closeBtn = document.getElementById("ab-close");
    if (closeBtn) closeBtn.addEventListener("click", closeAbout);
    const minBtn = document.getElementById("ab-minimize");
    if (minBtn) minBtn.addEventListener("click", minimizeAbout);

    // ── Footer links (same set/order as CyberSnap) ───────────
    const linkMap = {
        "ab-footer-copy": LINKS.website,
        "ab-link-website": LINKS.website,
        "ab-link-docs": LINKS.docs,
        "ab-link-github": LINKS.github,
        "ab-link-issues": LINKS.issues,
        "ab-link-releases": LINKS.releases,
        "ab-link-donate": LINKS.donate,
    };
    for (const [id, url] of Object.entries(linkMap)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", () => openUrl(url));
    }
})();
