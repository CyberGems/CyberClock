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

        if (s.state === "idle") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            desc.textContent = idleDesc;
        } else if (s.state === "not-available") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const ver = s.version || appVersion || "";
            desc.textContent = T("about.statuses.latest", "You're up to date on {version}").replace(
                "{version}",
                ver ? "v" + ver : "",
            );
        } else if (s.state === "checking") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.disabled = true;
            setTip("");
            desc.textContent = T("about.statuses.checking", "Checking for updates…");
        } else if (s.state === "available") {
            btn.textContent = updatePortable
                ? T("updates.downloadPortable", "Open download page")
                : T("about.updateNow", "Update Now");
            setTip(T("about.viewDetails", "View update details and changelog"));
            desc.textContent =
                T("about.updateAvailable", "Update {0} available").replace(
                    "{0}",
                    s.version || "",
                );
        } else if (s.state === "downloading") {
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
        } else if (s.state === "downloaded") {
            btn.textContent = T("about.installBtn", "Install & Restart");
            setTip(T("about.installTooltip", "Install the update and restart"));
            desc.textContent = T(
                "about.statuses.downloaded",
                "Update ready: click Install & Restart.",
            );
        } else if (s.state === "error") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            setTip(T("about.checkLatest", "Check for the latest version"));
            const rawMsg = s.message || "";
            const isRawUrl = rawMsg.includes("error sending request") || rawMsg.includes("http");
            desc.textContent = isRawUrl
                ? T("about.statuses.error", "Could not check for updates. Check your internet connection.")
                : (rawMsg || T("about.statuses.error", "Could not check for updates. Check your internet connection."));
        }
    }

    async function handleUpdateAction() {
        // Known update → download it. Progress arrives through the shared
        // update:status event, matching the popup in the main window.
        if (updateStatus.state === "available") {
            try {
                if (updatePortable) {
                    openUrl(
                        updateStatus.releaseUrl ||
                        (window.ccUpdates && window.ccUpdates.releaseUrl(updateStatus.version)),
                    );
                } else {
                    await window.cc.downloadUpdate();
                }
            } catch (e) {
                updateStatus = { state: "error", message: String(e?.message || e) };
                renderUpdateState();
            }
            return;
        }
        if (updateStatus.state === "downloaded") {
            try {
                await window.cc.installUpdate();
            } catch (e) {
                updateStatus = { state: "error", message: String(e?.message || e) };
                renderUpdateState();
            }
            return;
        }
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
            } else if (updateStatus.state === "available" || updateStatus.state === "downloading" || updateStatus.state === "downloaded") {
                // The backend broadcasts the authoritative state while the
                // command is still resolving. Never replace that event with
                // a stale default response from this window.
                updateStatus = {
                    ...updateStatus,
                    version: updateStatus.version || res.version,
                    releaseNotes: updateStatus.releaseNotes || res.releaseNotes,
                    releaseUrl: updateStatus.releaseUrl || res.releaseUrl,
                };
            } else if (updateStatus.state === "not-available") {
                // The event is authoritative when the current version is
                // already installed. This also avoids a false positive while
                // the About window is still loading its version label.
                updateStatus = { state: "not-available", version: res.version || appVersion };
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
    if (updateBtn) updateBtn.addEventListener("click", handleUpdateAction);

    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus((payload) => {
            updateStatus = payload || { state: "idle" };
            renderUpdateState();
        });
    }

    if (window.cc && window.cc.onCheckUpdatesTrigger) {
        window.cc.onCheckUpdatesTrigger(() => {
            handleUpdateAction();
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
