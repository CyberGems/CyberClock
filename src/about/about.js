/**
 * CyberClock — About Window (CyberSnap standard behavior)
 * Title-bar driven window: minimize + close (donate heart shortcut),
 * Update check and result, with the maintenance actions in Full Mode.
 * CyberGems © 2026
 */
(() => {
    "use strict";

    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const LINKS = {
        website: "https://cybergems.org",
        docs: `${REPO_URL}/wiki`,
        github: REPO_URL,
        issues: `${REPO_URL}/issues`,
        releases: `${REPO_URL}/releases`,
        donate: "https://github.com/CyberGems/CyberClock#%EF%B8%8F-donate",
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
    let updateStatus = "idle";
    let currentSettings = {};
    let updateMsStore = false;

    // ── Theme / language / suite showcase ──
    function applySettings(s) {
        currentSettings = s || {};
        window.CCTint.apply(s.theme || "azure");
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
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
            renderUpdateState();
        }).catch(() => {});
    }
    if (window.cc && window.cc.isMsStore) {
        window.cc.isMsStore().then((value) => {
            updateMsStore = !!value;
            renderUpdateState();
        }).catch(() => {});
    }

    function renderUpdateState() {
        const button = document.getElementById("ab-update-btn");
        const desc = document.getElementById("ab-update-desc");
        const state = updateMsStore ? "msStore" : updateStatus;
        button.hidden = updateMsStore;
        button.disabled = state === "checking";
        desc.dataset.status = state;
        desc.textContent = state === "idle"
            ? T("about.updateDesc")
            : T("about.statuses." + state).replace("{version}", "v" + appVersion);
    }

    async function checkForUpdatesOnly() {
        if (updateMsStore || updateStatus === "checking") return;
        updateStatus = "checking";
        renderUpdateState();
        try {
            const result = await window.cc.checkForUpdates();
            updateStatus = result.available ? "available" : "latest";
        } catch (error) {
            console.error("Update check failed:", error);
            updateStatus = "error";
        }
        renderUpdateState();
        if (updateStatus === "available") await window.cc.openUpdateNotice().catch(console.error);
    }

    document.getElementById("ab-update-btn").addEventListener("click", checkForUpdatesOnly);

    if (window.cc && window.cc.onCheckUpdatesTrigger) {
        const handleUpdateRequest = async () => {
            if (await window.cc.takeAboutUpdateCheck()) await checkForUpdatesOnly();
        };
        window.cc.onCheckUpdatesTrigger(() => handleUpdateRequest().catch(console.error))
            .then(handleUpdateRequest).catch(console.error);
    }

    // ── CyberGems Suite Showcase ──────────────────────────────
    let allSuiteApps = [];
    let currentSuiteApps = [];

    function pickRandomSisters(apps, count = 5) {
        const sisters = (apps || []).filter((a) => a && a.slug !== "cyberclock");
        const pool = [...sisters];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }
        return pool.slice(0, count);
    }

    function initSuiteShowcase(forceReshuffle = false) {
        const grid = document.getElementById("ab-suite-grid");
        const moreBtn = document.getElementById("ab-suite-more");
        if (moreBtn && !moreBtn._hasListener) {
            moreBtn._hasListener = true;
            moreBtn.addEventListener("click", () => openUrl("https://cybergems.org"));
        }
        if (!grid) return;

        const populate = () => {
            if (forceReshuffle || currentSuiteApps.length === 0) {
                currentSuiteApps = pickRandomSisters(allSuiteApps, 5);
            }
            renderSuiteButtons(grid, currentSuiteApps);
        };

        if (allSuiteApps.length > 0) {
            populate();
            return;
        }

        try {
            let apps = window.CC_SUITE_DATA ? window.CC_SUITE_DATA.apps : null;
            if (Array.isArray(apps) && apps.length) {
                allSuiteApps = apps;
                populate();
                return;
            }
            fetch("../assets/suite/suite.json")
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data?.apps) && data.apps.length) {
                        allSuiteApps = data.apps;
                        populate();
                    }
                })
                .catch(() => {});
        } catch (e) {
            console.warn("Could not load suite showcase:", e);
        }
    }

    function renderSuiteButtons(grid, apps) {
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
        const isEs = lang === "es";

        grid.innerHTML = "";

        for (const app of apps) {
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

    initSuiteShowcase(true);

    if (window.cc && window.cc.onAboutOpened) {
        window.cc.onAboutOpened(() => {
            initSuiteShowcase(true);
        });
    }

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

    // ── Diagnostic info copy ──────────────────────────────────
    async function copyDiagnosticInfo() {
        const diagBtn = document.getElementById("ab-link-diag");
        const effectiveLang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
        const theme = currentSettings.theme || "azure";
        const autoUp = currentSettings.autoUpdate !== false;
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const offset = -now.getTimezoneOffset() / 60;
        const offsetStr = `UTC${offset >= 0 ? "+" : ""}${offset}`;

        let installType = "Standard (Installer)";
        if (updatePortable) installType = "Portable";
        else if (updateMsStore) installType = "Microsoft Store";

        const lines = [
            "### CyberClock Diagnostic Information",
            `- **App Version:** v${appVersion || "unknown"}`,
            `- **Installation Type:** ${installType}`,
            `- **OS / Platform:** ${navigator.platform || "Windows"} (${navigator.userAgent})`,
            `- **Display:** ${window.screen.width}x${window.screen.height} (DPR: ${window.devicePixelRatio || 1})`,
            `- **Language:** ${currentSettings.language || "auto"} (Effective: ${effectiveLang})`,
            `- **Theme:** ${theme}`,
            `- **Startup Update Check:** ${autoUp ? "Enabled" : "Disabled"}`,
            `- **Chimes Enabled:** ${currentSettings.chimes_enabled !== false ? "Yes" : "No"}`,
            `- **Voice Announcer:** ${currentSettings.voice_enabled ? "Yes" : "No"}`,
            `- **Audio Muted:** ${currentSettings.mute_audio ? "Yes" : "No"}`,
            `- **Local Time:** ${now.toLocaleString()} (${tz}, ${offsetStr})`,
        ];

        const diagText = lines.join("\n");
        try {
            await navigator.clipboard.writeText(diagText);
            if (diagBtn) {
                const copiedTip = T("about.diagCopied", "Diagnostic info copied to clipboard!");
                diagBtn.setAttribute("data-tooltip", copiedTip);
                diagBtn.classList.add("ab-copied");
                setTimeout(() => {
                    diagBtn.classList.remove("ab-copied");
                    diagBtn.setAttribute("data-tooltip", T("about.linkDiag", "Copy diagnostic information"));
                }, 2200);
            }
        } catch (e) {
            console.warn("Could not copy diagnostic info to clipboard:", e);
        }
    }

    const diagBtn = document.getElementById("ab-link-diag");
    if (diagBtn) diagBtn.addEventListener("click", copyDiagnosticInfo);
})();
