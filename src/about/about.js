/**
 * CyberClock — Dedicated About Window
 * The tray menu's About was cramped inside a 250px popup window; this
 * window gives the same design a real dialog canvas with proper
 * accessibility (focus trap, Esc, visible focus, aria-modal).
 * CyberGems © 2026
 */
(() => {
    "use strict";

    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const LINKS = {
        website: "https://cybergems.org",
        github: REPO_URL,
        issues: `${REPO_URL}/issues`,
        changelog: `${REPO_URL}/releases`,
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

    let appVersion = "";
    let updateStatus = { state: "idle" };
    let diagTimer = null;

    // ── Theme / language ─────────────────────────────────────
    function applySettings(s) {
        document.body.dataset.theme = s.theme || "arctic-ice";
        if (window.ccI18n) {
            window.ccI18n.setLang(s.language || "auto");
            window.ccI18n.apply(document);
        }
        const autoEl = document.getElementById("ab-autoup");
        if (autoEl) autoEl.checked = s.autoUpdate !== false;
        renderUpdateStatus();
    }

    if (window.cc) {
        window.cc.onInit((s) => applySettings(s));
        window.cc.onSettingsUpdated((s) => applySettings(s));
    }

    // ── Version ───────────────────────────────────────────────
    if (window.cc && window.cc.getAppVersion) {
        window.cc.getAppVersion().then((v) => {
            appVersion = v || "dev";
            const el = document.getElementById("ab-version");
            if (el) el.textContent = "v" + appVersion;
        }).catch(() => {});
    }

    // ── Update flow (mirrors the tray About logic) ────────────
    function renderUpdateStatus() {
        const stEl = document.getElementById("ab-update-status");
        const btn = document.getElementById("ab-update-btn");
        const btnLbl = document.getElementById("ab-update-btn-lbl");
        if (!stEl || !btn) return;

        stEl.className = "ab-update-status";
        btn.disabled = false;
        btn.classList.remove("spin");

        const s = updateStatus;
        if (s.state === "idle") {
            stEl.textContent = "";
            btnLbl.textContent = T("about.checkUpdates", "Check Updates");
        } else if (s.state === "checking") {
            stEl.className += " warn";
            stEl.textContent = T("about.statuses.checking", "Checking for updates…");
            btn.disabled = true;
            btn.classList.add("spin");
        } else if (s.state === "not-available") {
            stEl.className += " ok";
            stEl.textContent = T("about.statuses.latest", "You are on the latest version.");
        } else if (s.state === "available") {
            stEl.className += " info";
            stEl.textContent = T("about.statuses.available", "Update available — click Download.");
            btnLbl.textContent = T("about.downloadBtn", "Download");
        } else if (s.state === "downloading") {
            stEl.className += " warn";
            stEl.textContent = T("about.statuses.downloading", "Downloading… {percent}%").replace(
                "{percent}",
                String(s.percent ?? 0),
            );
            btn.disabled = true;
        } else if (s.state === "downloaded") {
            stEl.className += " ok";
            stEl.textContent = T("about.statuses.downloaded", "Update ready — click Install & Restart.");
            btnLbl.textContent = T("about.installBtn", "Install & Restart");
        } else if (s.state === "error") {
            stEl.className += " err";
            stEl.textContent = T("about.statuses.error", "Update check failed");
            btnLbl.textContent = T("about.checkUpdates", "Check Updates");
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
        renderUpdateStatus();
        try {
            const res = await window.cc.checkForUpdates();
            if (!res?.ok) {
                updateStatus = { state: "error", message: res?.error || "Update check failed" };
            } else {
                updateStatus = { state: "not-available", version: res.version || appVersion };
            }
        } catch (e) {
            updateStatus = { state: "error", message: String(e?.message || e) };
        }
        renderUpdateStatus();
    }

    const updateBtn = document.getElementById("ab-update-btn");
    if (updateBtn) updateBtn.addEventListener("click", handleUpdateAction);

    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus((payload) => {
            updateStatus = payload || { state: "idle" };
            renderUpdateStatus();
        });
    }

    // ── Copy diagnostics ──────────────────────────────────────
    const diagBtn = document.getElementById("ab-diag-btn");
    if (diagBtn) {
        diagBtn.addEventListener("click", async () => {
            const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "en";
            const lines = [
                `CyberClock ${appVersion}`,
                `Platform: Windows (${navigator.userAgentData?.platform || "Win32"})`,
                `Locale: ${lang}`,
            ];
            try {
                await navigator.clipboard.writeText(lines.join("\n"));
                const lbl = document.getElementById("ab-diag-lbl");
                if (lbl) lbl.textContent = T("about.diagCopied", "Copied ✓");
                clearTimeout(diagTimer);
                diagTimer = setTimeout(() => {
                    lbl.textContent = T("about.copyDiag", "Copy diagnostics");
                }, 1800);
            } catch { /* clipboard unavailable */ }
        });
    }

    // ── Auto-update toggle ───────────────────────────────────
    const autoUp = document.getElementById("ab-autoup");
    if (autoUp) {
        autoUp.addEventListener("change", (e) => {
            if (window.cc && window.cc.saveSettings) {
                window.cc.saveSettings({ autoUpdate: e.target.checked });
            }
        });
    }

    // ── Links ────────────────────────────────────────────────
    const linkMap = {
        "ab-link-website": LINKS.website,
        "ab-link-github": LINKS.github,
        "ab-link-issues": LINKS.issues,
        "ab-link-releases": LINKS.changelog,
        "ab-link-donate": LINKS.donate,
        "ab-foot-link": LINKS.website,
    };
    for (const [id, url] of Object.entries(linkMap)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", () => openUrl(url));
    }

    // ── Close ─────────────────────────────────────────────────
    const closeBtn = document.getElementById("ab-close");
    if (closeBtn) closeBtn.addEventListener("click", closeAbout);

    // ── Accessibility: focus trap + Esc ──────────────────────
    // The dialog is the whole window; Tab cycles inside it so focus
    // never leaks to a window that is not visible behind it.
    function focusables() {
        return [...document.querySelectorAll(
            "button, input, [tabindex]:not([tabindex='-1'])",
        )].filter((el) => !el.disabled && el.offsetParent !== null);
    }

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            closeAbout();
            return;
        }
        if (e.key === "Tab") {
            const list = focusables();
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // Hide instead of closing when the window loses focus (matches the
    // tray popup behavior — clicking outside dismisses the dialog).
    if (window.cc && window.cc.isTauri && window.cc.isTauri()) {
        window.addEventListener("blur", () => {
            setTimeout(closeAbout, 120);
        });
    }

    // Initial focus goes to the close button: an immediate, reversible
    // action is the safest entry point for keyboard and screen readers.
    requestAnimationFrame(() => {
        const closeEl = document.getElementById("ab-close");
        if (closeEl) closeEl.focus();
    });
})();
