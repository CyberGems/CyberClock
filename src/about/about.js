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

    // ── Theme / language / auto-update toggle ───────────────
    function applySettings(s) {
        window.CCTint.apply(s.theme || "ice");
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
        const autoEl = document.getElementById("ab-autoup");
        if (autoEl) autoEl.checked = s.autoUpdate !== false;
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

        if (s.state === "idle" || s.state === "not-available") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.title = T("about.checkLatest", "Check for the latest version");
            desc.textContent = idleDesc;
        } else if (s.state === "checking") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.disabled = true;
            desc.textContent = T("about.statuses.checking", "Checking for updates…");
        } else if (s.state === "available") {
            btn.textContent = updatePortable
                ? T("updates.downloadPortable", "Open download page")
                : T("about.updateNow", "Update Now");
            btn.title = T(
                "about.viewDetails",
                "View update details and changelog",
            );
            desc.textContent =
                T("about.updateAvailable", "Update {0} available").replace(
                    "{0}",
                    s.version || "",
                );
        } else if (s.state === "downloading") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.disabled = true;
            const pct = Math.round(s.percent ?? 0);
            desc.textContent = T(
                "about.statuses.downloading",
                "Downloading update ({pct}%)…",
            ).replace("{pct}", String(pct));
            progressText.textContent = desc.textContent;
            progressFill.style.width = pct + "%";
        } else if (s.state === "downloaded") {
            btn.textContent = T("about.installBtn", "Install & Restart");
            btn.title = T("about.installTooltip", "Install the update and restart");
            desc.textContent = T(
                "about.statuses.downloaded",
                "Update ready — click Install & Restart.",
            );
        } else if (s.state === "error") {
            btn.textContent = T("about.checkUpdates", "Check Now");
            btn.title = T("about.checkLatest", "Check for the latest version");
            desc.textContent =
                s.message ||
                T("about.statuses.error", "Could not check for updates. Check your internet connection.");
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
                updateStatus = { state: "not-available", version: res.version };
            } else if (res.version && appVersion && res.version !== appVersion) {
                updateStatus = {
                    state: "available",
                    version: res.version,
                    releaseNotes: res.releaseNotes,
                    releaseUrl: res.releaseUrl,
                };
            } else {
                updateStatus = { state: "not-available", version: res.version };
            }
        } catch (e) {
            updateStatus = { state: "error", message: String(e?.message || e) };
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

    // ── Auto-update toggle ──────────────────────────────────
    const autoUp = document.getElementById("ab-autoup");
    if (autoUp) {
        autoUp.addEventListener("change", (e) => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ autoUpdate: e.target.checked });
            }
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
})();
