    "use strict";
    // ══════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════
    let cfg = {};
    let curView = "home";
    let transitioning = false;
    const VIEW_ORDER = ["home", "timer", "stopwatch", "relax"];
    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MONTHS_L = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    const MONTHS_S = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
    ];
    // TIPS is now structured inside i18n.js
    function getDays() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]
            : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    }

    function getMonths() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
            : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    }

    function getCalDays() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["L", "M", "M", "J", "V", "S", "D"]
            : ["M", "T", "W", "T", "F", "S", "S"];
    }

    function getCalMonthsLong() {
        const lang = window.ccI18n.getEffectiveLang();
        return lang === "es"
            ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
            : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    }

    function pad(n, w = 2) {
        return String(n).padStart(w, "0");
    }

    // Render a time string into an element, wrapping each digit in a
    // fixed-width .digit cell so narrow glyphs (1) don't shift the
    // layout. Separators (: . space, AM/PM) are left untouched.
    // Skips the DOM rebuild when the value hasn't changed — the
    // timer/stopwatch loops call this many times per second and
    // most digits stay identical between ticks.
    function setDigits(el, val) {
        if (el.dataset.digitsValue === val) return;
        el.dataset.digitsValue = val;
        el.innerHTML = val.replace(
            /\d/g,
            (d) => `<span class="digit">${d}</span>`,
        );
    }

    // ══════════════════════════════════════════════════════════════
    // UPDATE NOTIFICATION
    // ══════════════════════════════════════════════════════════════
    const UPDATE_SKIP_KEY = "cyberclock_skipped_update_version";
    let updateStatus = { state: "idle" };
    let updateDetails = { version: "", bullets: [], url: "" };
    let updateDetailsToken = 0;
    let updateNoticeDismissed = false;
    let updateNoticeShownVersion = "";
    let updatePortable = false;

    function updateText(key, fallback, vars = {}) {
        let value = window.ccI18n ? window.ccI18n.t(key) : fallback;
        if (!value || value === key) value = fallback;
        Object.entries(vars).forEach(([name, replacement]) => {
            value = value.replace(`{${name}}`, String(replacement ?? ""));
        });
        return value;
    }

    function updateReleaseUrl() {
        return updateStatus.releaseUrl ||
            updateDetails.url ||
            (window.ccUpdates && window.ccUpdates.releaseUrl(updateStatus.version));
    }

    function hideUpdateNotice() {
        const notice = document.getElementById("update-notice");
        if (!notice) return;
        notice.classList.remove("open");
        window.setTimeout(() => {
            if (!notice.classList.contains("open")) notice.hidden = true;
        }, 260);
    }

    function renderUpdateNotice() {
        const notice = document.getElementById("update-notice");
        if (!notice) return;

        const state = updateStatus.state;
        if (
            updateNoticeDismissed ||
            state === "idle" ||
            state === "checking" ||
            state === "not-available"
        ) {
            hideUpdateNotice();
            return;
        }

        const versionEl = document.getElementById("update-notice-version");
        const summaryEl = document.getElementById("update-notice-summary");
        const listEl = document.getElementById("update-notice-changelog-list");
        const emptyEl = document.getElementById("update-notice-empty");
        const progressEl = document.getElementById("update-notice-progress");
        const progressLabel = document.getElementById("update-notice-progress-label");
        const progressFill = document.getElementById("update-notice-progress-fill");
        const actionBtn = document.getElementById("update-notice-action");
        const skipBtn = document.getElementById("update-notice-skip");
        const releaseBtn = document.getElementById("update-notice-release");
        if (!versionEl || !summaryEl || !listEl || !emptyEl || !progressEl || !actionBtn) return;

        const version = updateStatus.version || updateDetails.version || "";
        const isDownloaded = state === "downloaded";
        const isDownloading = state === "downloading";
        const isError = state === "error";
        const titleEl = document.getElementById("update-notice-title");
        versionEl.textContent = version ? `v${version}` : "";
        if (titleEl) {
            titleEl.textContent = isError
                ? updateText("updates.errorTitle", "Update failed")
                : isDownloaded
                    ? updateText("updates.readyTitle", "Update ready to install")
                    : isDownloading
                        ? updateText("updates.downloadingTitle", "Downloading CyberClock")
                        : updateText("updates.availableTitle", "A new version is ready");
        }
        listEl.replaceChildren();
        if (!isError) {
            for (const bullet of updateDetails.bullets || []) {
                const item = document.createElement("li");
                item.textContent = bullet;
                listEl.appendChild(item);
            }
        }
        emptyEl.hidden = isError || listEl.children.length > 0;

        const isAvailable = state === "available";
        let errorMessage = updateStatus.message || "";
        const isTechnicalOrUrl =
            errorMessage.includes("error sending request") ||
            errorMessage.includes("http") ||
            errorMessage.includes("tcp") ||
            errorMessage.includes("connection");
        if (!errorMessage || isTechnicalOrUrl) {
            errorMessage = updateText(
                "updates.networkError",
                "Could not connect to the update server. Check your internet connection."
            );
        }
        summaryEl.textContent = isError
            ? errorMessage
            : isDownloaded
                ? updateText("updates.downloaded", "Update downloaded and ready to install.")
                : isDownloading
                    ? updateText("updates.downloading", "Downloading update ({pct}%)…", {
                        pct: Math.round(updateStatus.percent ?? 0),
                    })
                    : updatePortable
                        ? updateText("updates.portableHint", "Portable builds are updated from the release page.")
                        : updateText("updates.availableSummary", "CyberClock {version} is available with fresh improvements.", { version });

        progressEl.hidden = !isDownloading;
        if (isDownloading) {
            const pct = Math.max(0, Math.min(100, Math.round(updateStatus.percent ?? 0)));
            progressLabel.textContent = updateText("updates.downloading", "Downloading update ({pct}%)…", { pct });
            progressFill.style.width = `${pct}%`;
        }

        actionBtn.textContent = isError
            ? updateText("updates.retry", "Retry")
            : isDownloaded
                ? updateText("updates.install", "Install & restart")
                : updatePortable
                    ? updateText("updates.downloadPortable", "Open download page")
                    : updateText("updates.download", "Download update");
        actionBtn.disabled = isDownloading;
        skipBtn.hidden = isError || !isAvailable;
        releaseBtn.hidden = !version;

        updateNoticeShownVersion = version;
        notice.hidden = false;
        requestAnimationFrame(() => notice.classList.add("open"));
    }

    async function loadUpdateDetails(payload) {
        const version = payload.version || "";
        const token = ++updateDetailsToken;
        updateDetails = {
            version,
            bullets: window.ccUpdates
                ? window.ccUpdates.parseChangelogPeek(payload.releaseNotes)
                : [],
            url: payload.releaseUrl || "",
        };
        renderUpdateNotice();
        if (!window.ccUpdates || !version) return;
        const details = await window.ccUpdates.fetchReleaseDetails(version, payload.releaseNotes || "");
        if (token !== updateDetailsToken || updateStatus.version !== version) return;
        updateDetails = { version, ...details };
        renderUpdateNotice();
    }

    function handleUpdateStatus(payload) {
        const next = payload || { state: "idle" };
        if (next.state === "available") {
            // Only reset the dismissed flag when a genuinely new version
            // is discovered. Re-checks that find the same version (e.g.
            // from the About window) must not resurface the popup.
            if (next.version && next.version !== updateNoticeShownVersion) {
                updateNoticeDismissed = false;
            }
            updateStatus = next;
            const skipped = !next.version || localStorage.getItem(UPDATE_SKIP_KEY) === next.version;
            if (skipped) {
                updateNoticeDismissed = true;
                hideUpdateNotice();
                return;
            }
            loadUpdateDetails(next);
            return;
        }

        updateStatus = next;
        if (next.state === "downloading" || next.state === "downloaded") {
            updateNoticeDismissed = false;
            renderUpdateNotice();
        } else if (next.state === "error") {
            // Only render an error if the notice is ALREADY open (e.g. active download failed).
            // Background checks must never pop up an error modal unprompted.
            const notice = document.getElementById("update-notice");
            if (notice && notice.classList.contains("open")) {
                renderUpdateNotice();
            }
        } else if (next.state !== "checking") {
            renderUpdateNotice();
        }
    }

    async function handleUpdateNoticeAction() {
        const actionBtn = document.getElementById("update-notice-action");
        if (actionBtn) actionBtn.disabled = true;
        try {
            // Retry from error: re-check then download if an update is found.
            if (updateStatus.state === "error") {
                const res = await window.cc.checkForUpdates();
                if (res?.ok && res.version) {
                    updateStatus = { state: "available", version: res.version };
                    await window.cc.downloadUpdate();
                }
                return;
            }
            if (updateStatus.state === "downloaded") {
                await window.cc.installUpdate();
                return;
            }
            if (updatePortable) {
                await window.cc.openExternalUrl(updateReleaseUrl());
                return;
            }
            await window.cc.downloadUpdate();
        } catch (error) {
            console.error("Update action failed:", error);
            // Preserve version so a subsequent re-check for the same
            // version does not resurface the popup (issue #2 fix).
            updateStatus = {
                state: "error",
                version: updateStatus.version,
                message: String(error?.message || error),
            };
            updateNoticeDismissed = false;
            renderUpdateNotice();
        } finally {
            if (actionBtn && updateStatus.state !== "downloading") actionBtn.disabled = false;
        }
    }

    function skipCurrentUpdate() {
        if (updateStatus.version) localStorage.setItem(UPDATE_SKIP_KEY, updateStatus.version);
        updateNoticeDismissed = true;
        hideUpdateNotice();
    }

    function openCurrentRelease() {
        const url = updateReleaseUrl();
        if (url && window.cc && window.cc.openExternalUrl) window.cc.openExternalUrl(url);
    }

    // ══════════════════════════════════════════════════════════════
    // NAVIGATION with cinematic transitions
    // ══════════════════════════════════════════════════════════════
    function navigate(to) {
        if (to === curView || transitioning) return;
        transitioning = true;

        const from = curView;
        const fromEl = document.getElementById("view-" + from);
        const toEl = document.getElementById("view-" + to);
        const dir =
            VIEW_ORDER.indexOf(to) > VIEW_ORDER.indexOf(from) ? 1 : -1;

        curView = to;
        document
            .querySelectorAll(".nav-item")
            .forEach((el) =>
                el.classList.toggle("active", el.dataset.view === to),
            );

        // Position incoming view off-screen
        toEl.style.transform = `translateX(${dir * 55}px) scale(0.96)`;
        toEl.style.opacity = "0";
        toEl.style.transition = "none";
        toEl.style.pointerEvents = "none";
        // Ensure it paints at off-screen position before animating
        toEl.getBoundingClientRect();

        const DUR = 400;
        toEl.style.transition = `opacity ${DUR}ms ease, transform ${DUR}ms cubic-bezier(0.4,0,0.2,1)`;
        toEl.style.transform = "none";
        toEl.style.opacity = "1";

        fromEl.style.transition = `opacity ${DUR * 0.88}ms ease, transform ${DUR * 0.88}ms ease`;
        fromEl.style.transform = `translateX(${-dir * 38}px) scale(0.97)`;
        fromEl.style.opacity = "0";
        fromEl.style.pointerEvents = "none";

        setTimeout(() => {
            // Commit CSS class state
            fromEl.classList.remove("active");
            toEl.classList.add("active");
            // Clear inline styles so CSS takes over cleanly
            [fromEl, toEl].forEach((el) => {
                el.style.transform = "";
                el.style.opacity = "";
                el.style.transition = "";
                el.style.pointerEvents = "";
            });
            transitioning = false;
            onEnter(to);
            onLeave(from);
        }, DUR + 20);

        // Immediate pre-transition effects
        if (from === "home") stopClockAnim();
        if (from === "relax") stopViz();
    }

    function onEnter(v) {
        if (v === "home") {
            setTimeout(syncHomeClock, 60);
        }
        if (v === "relax") startViz();
    }
    function onLeave(v) {
        if (v === "relax") stopViz();
    }

    // Sidebar nav
    document
        .querySelectorAll(".nav-item[data-view]")
        .forEach((el) =>
            el.addEventListener("click", () =>
                navigate(el.dataset.view),
            ),
        );

    // Accent tint — shared engine in shared/tint.js. The structural
    // palette never changes; only the accent family and the kissed
    // panels do.
    function applyTint(t) {
        const id = window.CCTint.apply(t);
        document
            .querySelectorAll(".tint-swatch")
            .forEach((d) =>
                d.classList.toggle("on", d.dataset.tint === id),
            );
    }

    // Build the tint swatch grid once at boot; applySettings keeps
    // the selection in sync and ccI18n translates the tooltips.
    (function buildTintSwatches() {
        const grid = document.getElementById("tint-grid");
        if (!grid) return;
        window.CCTint.PRESETS.forEach((p) => {
            const sw = document.createElement("button");
            sw.type = "button";
            sw.className = "tint-swatch";
            sw.dataset.tint = p.id;
            sw.style.background = window.CCTint.normalizeSeed(p.seed);
            sw.setAttribute(
                "data-i18n-attr",
                `data-tooltip:settings.appearance.tint.${p.id},aria-label:settings.appearance.tint.${p.id}`,
            );
            sw.setAttribute("data-tooltip-dir", "up");
            sw.setAttribute("data-tooltip", p.id);
            sw.addEventListener("click", () => {
                window.cc.saveSettings({ theme: p.id });
                applyTint(p.id);
            });
            grid.appendChild(sw);
        });
    })();

    // ══════════════════════════════════════════════════════════════
    // ALARM SCHEDULER TIME HELPERS
    // ══════════════════════════════════════════════════════════════
    function buildAlarmSchedTimeOptions() {
        const is12 = cfg.clockFormat === '12h';
        ['start', 'end'].forEach(prefix => {
            const hSel = document.getElementById(`s-alarm-sched-${prefix}-h`);
            const mSel = document.getElementById(`s-alarm-sched-${prefix}-m`);
            const apSel = document.getElementById(`s-alarm-sched-${prefix}-ap`);
            if (!hSel || !mSel || !apSel) return;
            hSel.innerHTML = '';
            const hStart = is12 ? 1 : 0, hEnd = is12 ? 12 : 23;
            for (let h = hStart; h <= hEnd; h++) {
                const o = document.createElement('option');
                o.value = String(h); o.textContent = pad(h);
                hSel.appendChild(o);
            }
            if (!mSel.options.length) {
                for (let m = 0; m <= 59; m++) {
                    const o = document.createElement('option');
                    o.value = String(m); o.textContent = pad(m);
                    mSel.appendChild(o);
                }
            }
            apSel.style.display = is12 ? '' : 'none';
        });
    }
    function setAlarmSchedTime(prefix, hhmm) {
        const [H, M] = (hhmm || '08:00').split(':').map(Number);
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById(`s-alarm-sched-${prefix}-h`);
        const mSel = document.getElementById(`s-alarm-sched-${prefix}-m`);
        const apSel = document.getElementById(`s-alarm-sched-${prefix}-ap`);
        if (!hSel) return;
        mSel.value = String(M);
        if (is12) {
            let h12 = H % 12; if (h12 === 0) h12 = 12;
            hSel.value = String(h12);
            apSel.value = H >= 12 ? 'PM' : 'AM';
        } else {
            hSel.value = String(H);
        }
    }
    function getAlarmSchedTime(prefix) {
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById(`s-alarm-sched-${prefix}-h`);
        const mSel = document.getElementById(`s-alarm-sched-${prefix}-m`);
        const apSel = document.getElementById(`s-alarm-sched-${prefix}-ap`);
        if (!hSel) return '08:00';
        let H = parseInt(hSel.value, 10);
        const M = parseInt(mSel.value, 10);
        if (is12) {
            if (apSel.value === 'AM') { if (H === 12) H = 0; }
            else { if (H !== 12) H += 12; }
        }
        return pad(H) + ':' + pad(M);
    }

    // ══════════════════════════════════════════════════════════════
    // SETTINGS APPLICATION
    // ══════════════════════════════════════════════════════════════

    function getDialDesignName(designNum) {
        const keys = {
            1: "settings.appearance.dialClassic",
            2: "settings.appearance.dialMinimal",
            3: "settings.appearance.dialSegments",
            4: "settings.appearance.dialHud",
            5: "settings.appearance.dialQuantum",
            6: "settings.appearance.dialChrono",
            7: "settings.appearance.dialMatrix",
            8: "settings.appearance.dialReactor",
            9: "settings.appearance.dialCircuit",
            10: "settings.appearance.dialGemCrown",
        };
        const key = keys[designNum] || keys[1];
        return window.ccI18n ? window.ccI18n.t(key) : "Classic";
    }

    function updateDialDesignUI(designNum) {
        const design = Math.min(10, Math.max(1, parseInt(designNum, 10) || 1));
        const val = String(design);
        document
            .querySelectorAll("[data-clock-design]")
            .forEach((b) =>
                b.classList.toggle("on", b.dataset.clockDesign === val),
            );
        const badgeNum = document.getElementById("dial-badge-num");
        const badgeEl = document.getElementById("dial-badge");
        if (badgeNum) badgeNum.textContent = `${design}/10`;
        if (badgeEl) badgeEl.setAttribute("data-tooltip", getDialDesignName(design));
        const ctxDialLbl = document.getElementById("ctx-dial-current-lbl");
        if (ctxDialLbl) ctxDialLbl.textContent = getDialDesignName(design);
    }

    let clockAutoCycleTimer = null;
    function setupClockAutoCycle() {
        if (clockAutoCycleTimer) {
            clearInterval(clockAutoCycleTimer);
            clockAutoCycleTimer = null;
        }
        if (!cfg.clockAutoCycle || (typeof isMainActive === "function" && !isMainActive())) return;
        const mins = Math.max(1, parseInt(cfg.clockAutoCycleInterval, 10) || 15);
        const ms = mins * 60 * 1000;
        clockAutoCycleTimer = setInterval(() => {
            if (document.hidden || (typeof isMainActive === "function" && !isMainActive())) return;
            const cur = Math.min(10, Math.max(1, parseInt(cfg.clockDesign, 10) || 1));
            let next;
            if (cfg.clockAutoCycleMode === "random") {
                const others = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n !== cur);
                next = others[Math.floor(Math.random() * others.length)];
            } else {
                next = (cur % 10) + 1;
            }
            cfg.clockDesign = next;
            window.cc.saveSettings({ clockDesign: next });
            updateDialDesignUI(next);
        }, ms);
    }

    function cycleDialDesign(delta) {
        const cur = Math.min(10, Math.max(1, parseInt(cfg.clockDesign, 10) || 1));
        let next = cur + delta;
        if (next > 10) next = 1;
        if (next < 1) next = 10;
        cfg.clockDesign = next;
        window.cc.saveSettings({ clockDesign: next });
        updateDialDesignUI(next);
    }

    function applySettings(s) {
        cfg = s;
        // Scanlines are mini-mode only — full mode never has them
        applyTint(s.theme || "ice");
        // Text size tier: labels, body copy and values. Display digits
        // and layout metrics stay fixed, so nothing reflows badly.
        const scale = Number(s.uiScale) >= 0 ? Number(s.uiScale) : 1;
        document.documentElement.style.setProperty(
            "--ui-scale",
            String(scale || 1),
        );
        updateDigital();

        // Settings modal controls
        document
            .querySelectorAll(".s-fmt")
            .forEach((b) =>
                b.classList.toggle(
                    "on",
                    b.dataset.fmt === (s.clockFormat || "24h"),
                ),
            );
        const secEl = document.getElementById("s-sec");
        if (secEl) secEl.checked = s.showSeconds !== false;
        // Text size buttons: mark the active tier (data-ui-scale strings
        // compare exactly with the persisted value).
        const uiScaleVal = String(scale || 1);
        document
            .querySelectorAll("#s-ui-scale .s-fmt")
            .forEach((b) =>
                b.classList.toggle("on", b.dataset.uiScale === uiScaleVal),
            );
        // Dial design buttons: mark the active design (1..5; anything
        // unknown falls back to Classic, same as currentClockDesign()).
        // Covers BOTH the Settings picker and the floating dial
        // switcher — they share the data-clock-design contract.
        updateDialDesignUI(s.clockDesign);

        const clockAutoCycleEl = document.getElementById("s-clock-auto-cycle");
        if (clockAutoCycleEl) clockAutoCycleEl.checked = s.clockAutoCycle === true;
        const clockAutoCycleSub = document.getElementById("s-clock-auto-cycle-sub");
        if (clockAutoCycleSub) clockAutoCycleSub.style.display = s.clockAutoCycle ? "flex" : "none";
        const clockAutoCycleIntervalEl = document.getElementById("s-clock-auto-cycle-interval");
        if (clockAutoCycleIntervalEl) clockAutoCycleIntervalEl.value = String(s.clockAutoCycleInterval || 15);
        const clockAutoCycleModeEl = document.getElementById("s-clock-auto-cycle-mode");
        if (clockAutoCycleModeEl) clockAutoCycleModeEl.value = s.clockAutoCycleMode || "sequential";
        setupClockAutoCycle();

        const clockNameEl = document.getElementById("s-clock-name");
        if (clockNameEl) {
            clockNameEl.value = s.clockBrand || "CYBERGEMS";
            // Keep the Reset button in sync with the loaded value.
            if (typeof refreshClockNameRestoreBtn === "function") {
                refreshClockNameRestoreBtn();
            }
        }
        // Hide analog clock / hide calendar (full-mode Home): collapse either
        // panel and let the other absorb the full width.
        const hideClock = s.fullHideClock === true;
        const hideCalendar = s.fullHideCalendar === true;
        const homeView = document.getElementById("view-home");
        if (homeView) {
            homeView.classList.toggle("no-clock", hideClock);
            homeView.classList.toggle("no-calendar", hideCalendar);
        }
        document.body.classList.toggle("home-no-calendar", hideCalendar);
        const stageEl = document.querySelector(".clock-stage");
        const panelEl = document.querySelector(".clock-panel");
        if (stageEl && panelEl) {
            const h = panelEl.clientHeight || (window.innerHeight - 120) || 450;
            const parentW = panelEl.parentElement?.clientWidth || window.innerWidth || 1024;
            const targetW = hideCalendar ? parentW : parentW * 0.44;
            const targetPadX = hideCalendar ? 64 : 72;
            const targetPadY = hideCalendar ? 48 : 36;
            const targetSize = Math.max(120, Math.min(targetW - targetPadX, h - targetPadY));
            stageEl.style.setProperty("--stage-size", `${targetSize}px`);
        }
        const hideClockEl = document.getElementById("s-hide-clock");
        if (hideClockEl) hideClockEl.checked = hideClock;
        const hideCalEl = document.getElementById("s-hide-cal");
        if (hideCalEl) hideCalEl.checked = hideCalendar;
        const gripEl = document.getElementById("clock-grip");
        if (gripEl) {
            gripEl.title = window.ccI18n.t(
                hideClock ? "tooltip.showClock" : "tooltip.hideClock",
            );
        }
        const calGripEl = document.getElementById("cal-grip");
        if (calGripEl) {
            calGripEl.title = window.ccI18n.t(
                hideCalendar ? "tooltip.showCalendar" : "tooltip.hideCalendar",
            );
        }
        syncHomeClock();
        const aotEl = document.getElementById("s-aot");
        if (aotEl) aotEl.checked = !!s.alwaysOnTop;
        const suEl = document.getElementById("s-startup");
        if (suEl) suEl.checked = s.startWithWindows !== false;
        const suMiniRow = document.getElementById("s-startup-mini-row");
        if (suMiniRow) suMiniRow.style.display = (s.startWithWindows !== false) ? "flex" : "none";
        const suMiniEl = document.getElementById("s-startup-mini");
        if (suMiniEl) suMiniEl.checked = s.startInMiniMode !== false;
        const audioMuteEl = document.getElementById("s-audio-mute");
        if (audioMuteEl) audioMuteEl.checked = s.audioMuted === true;
        const showSuiteEl = document.getElementById("s-show-suite");
        if (showSuiteEl) showSuiteEl.checked = s.showSuiteRecommendations !== false;

        const closeActionEl = document.getElementById("s-close-action");
        if (closeActionEl) {
            if (s.closeToTray === true) closeActionEl.value = "tray";
            else if (s.closeToTray === false) closeActionEl.value = "quit";
            else closeActionEl.value = "ask";
        }

        const clockAccEl = document.getElementById("s-clock-acc");
        if (clockAccEl) clockAccEl.checked = s.clockAccuracyEnabled !== false;
        const clockAutoSyncEl = document.getElementById("s-clock-auto-sync");
        if (clockAutoSyncEl) clockAutoSyncEl.checked = s.clockAutoSync === true;
        const displayAutoEl = document.getElementById("s-display-auto");
        if (displayAutoEl) displayAutoEl.checked = s.displayAuto !== false;
        if (typeof syncDisplayAutoUI === "function") syncDisplayAutoUI(s.displayAuto !== false);
        if (typeof renderHotkey === "function") renderHotkey();
        if (typeof renderClockAccuracy === "function") renderClockAccuracy(s);
        if (typeof updateClockDriftBanner === "function") updateClockDriftBanner(s);
        if (typeof renderTimeSyncSettings === "function") renderTimeSyncSettings();

        const langEl = document.getElementById("s-lang");
        if (langEl) langEl.value = s.language || "auto";
        const displayNameEl = document.getElementById("s-display-name");
        if (displayNameEl) displayNameEl.value = s.displayName || "";
        window.ccI18n.setLang(s.language || "auto");
        window.ccI18n.apply(document);
        updateGreeting();
        if (typeof renderBrandVersion === "function") renderBrandVersion();
        updateDigital();
        if (typeof renderCalendar === "function" && typeof calYear !== "undefined") {
            renderCalendar();
        }

        if (document.getElementById("s-overlay").classList.contains("open")) {
            loadScreensList();
        }

        // Update the Play/Pause button text and guide text for the new language
        if (typeof updatePlayButtonUI === "function") {
            updatePlayButtonUI(window.audioEngine.isPlaying);
        }
        if (!rPacerActive) {
            const guideLabel = document.getElementById("breathe-guide-text");
            if (guideLabel) guideLabel.textContent = window.ccI18n.t("relax.breathe.guide.ready");
        }

        // Apply breathing pattern active button class
        const breathePat = s.breathePattern || "box";
        document.querySelectorAll(".breathe-pat-btn").forEach((btn) => {
            btn.classList.toggle("on", btn.dataset.pat === breathePat);
        });

        const ah = s.alarmHalfHour || {};
        const af = s.alarmFullHour || {};
        const aq = s.alarmQuarterHour || {};
        const hEn = document.getElementById("s-half-en");
        if (hEn) hEn.checked = !!ah.enabled;
        const fEn = document.getElementById("s-full-en");
        if (fEn) fEn.checked = !!af.enabled;
        const qEn = document.getElementById("s-quart-en");
        if (qEn) qEn.checked = !!aq.enabled;
        const hSnd = document.getElementById("s-half-snd");
        if (hSnd) hSnd.value = ah.sound || "chime-crystal";
        const fSnd = document.getElementById("s-full-snd");
        if (fSnd) fSnd.value = af.sound || "chime-digital";
        const qSnd = document.getElementById("s-quart-snd");
        if (qSnd) qSnd.value = aq.sound || "chime-crystal";
        if (ah.customPath) showCustomFile("half", ah.customPath); else showCustomFile("half", null);
        if (af.customPath) showCustomFile("full", af.customPath); else showCustomFile("full", null);
        if (aq.customPath) showCustomFile("quart", aq.customPath); else showCustomFile("quart", null);

        // Custom alarms (3 slots with day-of-week repetition)
        buildCustomAlarmTimeOptions();
        (s.customAlarms || []).slice(0, 3).forEach((alarm, i) => {
            const base = `s-cust-${i}`;
            const enEl = document.getElementById(`${base}-en`);
            if (enEl) enEl.checked = !!alarm.enabled;
            setCustomAlarmTime(i, alarm.hour ?? 9, alarm.minute ?? 0);
            document.querySelectorAll(`#${base}-days .s-day-btn[data-day]`).forEach((btn) => {
                btn.classList.toggle("on", (alarm.daysMask & parseInt(btn.dataset.day)) !== 0);
            });
            const sndEl = document.getElementById(`${base}-snd`);
            if (sndEl) sndEl.value = alarm.sound || "chime-digital";
            showCustomFile(`cust-${i}`, alarm.customPath || null);
        });

        // Apply alarm time restriction schedule controls
        buildAlarmSchedTimeOptions();
        const alSchedEn = document.getElementById("s-alarm-sched-en");
        if (alSchedEn) alSchedEn.checked = !!s.alarmScheduleEnabled;
        setAlarmSchedTime("start", s.alarmScheduleStart || "08:00");
        setAlarmSchedTime("end", s.alarmScheduleEnd || "17:00");

        const avEl = document.getElementById("s-avol");
        if (avEl) {
            const v = Math.round((s.alarmVolume || 0.75) * 100);
            avEl.value = v;
            document.getElementById("s-avol-val").textContent = v + "%";
        }
        const rvEl = document.getElementById("s-rvol");
        if (rvEl) {
            const v = Math.round((s.relaxVolume || 0.8) * 100);
            rvEl.value = v;
            document.getElementById("s-rvol-val").textContent = v + "%";
        }
        const rvolEl = document.getElementById("r-vol");
        if (rvolEl) {
            const v = Math.round((s.relaxVolume || 0.8) * 100);
            rvolEl.value = v;
            document.getElementById("r-vol-val").textContent = v + "%";
        }

        window.audioEngine.setVolume(s.relaxVolume || 0.8);
        window.audioEngine.setMuted(s.audioMuted === true);
        // Quiet but unmissable hint while a global mute silences the
        // Relax engine (otherwise the module looks simply "broken").
        const muteBanner = document.getElementById("r-mute-banner");
        if (muteBanner) muteBanner.style.display = s.audioMuted === true ? "" : "none";
        if (s.lastRelaxTrack) preSelectRelaxTrack(s.lastRelaxTrack);
        if (typeof updatePlayingTrackCardClass === "function") {
            updatePlayingTrackCardClass(window.audioEngine.isPlaying);
        }
        if (typeof applySchedUI === "function") applySchedUI(s);

        // Mini mode controls
        const miniDesign = s.miniDesign || 1;
        document.querySelectorAll('[data-mini-design]').forEach((b) => {
            b.classList.toggle('on', parseInt(b.dataset.miniDesign) === miniDesign);
        });
        // Mini zoom — discrete stops, slider index → factor (100% default)
        const ZOOM_STEPS = [0.5, 1, 2, 4];
        const miniZoom = document.getElementById('s-mini-zoom');
        if (miniZoom) {
            const idx = ZOOM_STEPS.indexOf(s.miniZoom ?? 1);
            miniZoom.value = String(idx >= 0 ? idx : 1);
            document.getElementById('s-mini-zoom-val').textContent =
                Math.round((ZOOM_STEPS[idx >= 0 ? idx : 1]) * 100) + '%';
        }
        const miniBgOp = document.getElementById('s-minibg-op');
        if (miniBgOp) {
            const v = Math.round((s.miniBgOpacity ?? 1.0) * 100);
            miniBgOp.value = v;
            document.getElementById('s-minibg-op-val').textContent = v + '%';
        }
        const miniOp = document.getElementById('s-mini-op');
        if (miniOp) {
            const v = Math.round((s.miniOpacity ?? 1.0) * 100);
            miniOp.value = v;
            document.getElementById('s-mini-op-val').textContent = v + '%';
        }
        const miniLock = document.getElementById('s-mini-lock');
        if (miniLock) miniLock.checked = s.miniPositionLocked || false;
        const miniCollapse = document.getElementById('s-mini-collapse');
        if (miniCollapse) miniCollapse.checked = s.miniCollapseDate || false;
        const miniScan = document.getElementById('s-mini-scan');
        if (miniScan) miniScan.checked = s.miniScanlines !== false;
        // Real Sun Cycle row — visible only for the Sunset Pulse skin (7)
        const solarRow = document.getElementById('s-mini-solar-row');
        if (solarRow) solarRow.style.display = (s.miniDesign || 1) === 7 ? 'flex' : 'none';
        const miniSolar = document.getElementById('s-mini-solar');
        if (miniSolar) miniSolar.checked = s.miniSolarReal === true;
        const miniClickThrough = document.getElementById('s-mini-clickthrough');
        if (miniClickThrough) miniClickThrough.checked = s.miniClickThrough === true;
        const miniAnim = document.getElementById('s-mini-anim');
        if (miniAnim) miniAnim.checked = s.miniNoAnimations === true;

        const miniAutoCycleEl = document.getElementById("s-mini-auto-cycle");
        if (miniAutoCycleEl) miniAutoCycleEl.checked = s.miniAutoCycle === true;
        const miniAutoCycleSub = document.getElementById("s-mini-auto-cycle-sub");
        if (miniAutoCycleSub) miniAutoCycleSub.style.display = s.miniAutoCycle ? "flex" : "none";
        const miniAutoCycleIntervalEl = document.getElementById("s-mini-auto-cycle-interval");
        if (miniAutoCycleIntervalEl) miniAutoCycleIntervalEl.value = String(s.miniAutoCycleInterval || 15);
        const miniAutoCycleModeEl = document.getElementById("s-mini-auto-cycle-mode");
        if (miniAutoCycleModeEl) miniAutoCycleModeEl.value = s.miniAutoCycleMode || "sequential";
    }

    function showCustomFile(which, p) {
        const lbl = document.getElementById(`s-${which}-flbl`);
        if (!lbl) return;
        const name = document.getElementById(`s-${which}-fname`);
        if (p) {
            lbl.style.display = "flex";
            name.textContent = p.split(/[/\\]/).pop();
        } else {
            lbl.style.display = "none";
        }
    }

    // ── Custom alarms (3 slots, day-of-week repetition) ──────
    function buildCustomAlarmTimeOptions() {
        const is12 = cfg.clockFormat === '12h';
        for (let i = 0; i < 3; i++) {
            const hSel = document.getElementById(`s-cust-${i}-h`);
            const mSel = document.getElementById(`s-cust-${i}-m`);
            const apSel = document.getElementById(`s-cust-${i}-ap`);
            if (!hSel || !mSel || !apSel) continue;
            hSel.innerHTML = '';
            const hStart = is12 ? 1 : 0, hEnd = is12 ? 12 : 23;
            for (let h = hStart; h <= hEnd; h++) {
                const o = document.createElement('option');
                o.value = String(h); o.textContent = pad(h);
                hSel.appendChild(o);
            }
            if (!mSel.options.length) {
                for (let m = 0; m <= 59; m++) {
                    const o = document.createElement('option');
                    o.value = String(m); o.textContent = pad(m);
                    mSel.appendChild(o);
                }
            }
            apSel.style.display = is12 ? '' : 'none';
        }
    }
    function setCustomAlarmTime(i, H, M) {
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById(`s-cust-${i}-h`);
        const mSel = document.getElementById(`s-cust-${i}-m`);
        const apSel = document.getElementById(`s-cust-${i}-ap`);
        if (!hSel) return;
        mSel.value = String(M);
        if (is12) {
            let h12 = H % 12; if (h12 === 0) h12 = 12;
            hSel.value = String(h12);
            apSel.value = H >= 12 ? 'PM' : 'AM';
        } else {
            hSel.value = String(H);
        }
    }
    function getCustomAlarmTime(i) {
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById(`s-cust-${i}-h`);
        const mSel = document.getElementById(`s-cust-${i}-m`);
        const apSel = document.getElementById(`s-cust-${i}-ap`);
        if (!hSel) return { hour: 9, minute: 0 };
        let H = parseInt(hSel.value, 10);
        const M = parseInt(mSel.value, 10);
        if (is12) {
            if (apSel.value === 'AM') { if (H === 12) H = 0; }
            else { if (H !== 12) H += 12; }
        }
        return { hour: H, minute: M };
    }
    function getCustomAlarmDaysMask(i) {
        let mask = 0;
        document.querySelectorAll(`#s-cust-${i}-days .s-day-btn[data-day]`).forEach((btn) => {
            if (btn.classList.contains("on")) mask |= parseInt(btn.dataset.day);
        });
        return mask;
    }
    function saveCustomAlarmField(i, patch) {
        const current = cfg.customAlarms || [];
        const list = [...current];
        while (list.length < 3) list.push({ enabled: false, hour: 9, minute: 0, daysMask: 0, sound: "chime-digital", customPath: null });
        list[i] = { ...list[i], ...patch };
        window.cc.saveSettings({ customAlarms: list });
    }
    function wireCustomAlarms() {
        for (let i = 0; i < 3; i++) {
            const base = `s-cust-${i}`;
            document.getElementById(`${base}-en`)?.addEventListener("change", (e) => {
                const daysMask = getCustomAlarmDaysMask(i);
                if (e.target.checked && daysMask === 0) {
                    // No days picked: enable every day rather than a silent never-firing alarm
                    document.querySelectorAll(`#${base}-days .s-day-btn[data-day]`).forEach((b) => b.classList.add("on"));
                    saveCustomAlarmField(i, { enabled: true, daysMask: 127 });
                } else {
                    saveCustomAlarmField(i, { enabled: e.target.checked });
                }
            });
            [`${base}-h`, `${base}-m`, `${base}-ap`].forEach((id) => {
                document.getElementById(id)?.addEventListener("change", () => {
                    const { hour, minute } = getCustomAlarmTime(i);
                    saveCustomAlarmField(i, { hour, minute });
                });
            });
            document.querySelectorAll(`#${base}-days .s-day-btn[data-day]`).forEach((btn) => {
                btn.addEventListener("click", () => {
                    btn.classList.toggle("on");
                    saveCustomAlarmField(i, { daysMask: getCustomAlarmDaysMask(i) });
                });
            });
            document.querySelector(`#${base}-days .s-day-all`)?.addEventListener("click", () => {
                const allOn = document.querySelectorAll(`#${base}-days .s-day-btn[data-day].on`).length === 7;
                document.querySelectorAll(`#${base}-days .s-day-btn[data-day]`).forEach((b) => {
                    b.classList.toggle("on", !allOn);
                });
                saveCustomAlarmField(i, { daysMask: allOn ? 0 : 127 });
            });
            document.getElementById(`${base}-snd`)?.addEventListener("change", (e) => {
                saveCustomAlarmField(i, { sound: e.target.value, customPath: null });
            });
            document.getElementById(`${base}-test`)?.addEventListener("click", () => {
                const alarm = (cfg.customAlarms || [])[i] || {};
                if (alarm.customPath) window.audioEngine.playFile(alarm.customPath, { loop: false });
                else {
                    const sndEl = document.getElementById(`${base}-snd`);
                    window.audioEngine.chime(sndEl ? sndEl.value : "chime-digital", cfg.alarmVolume || 0.75);
                }
            });
            document.getElementById(`${base}-file`)?.addEventListener("click", async () => {
                const p = await window.cc.openFileDialog();
                if (p) {
                    saveCustomAlarmField(i, { customPath: p });
                    showCustomFile(`cust-${i}`, p);
                }
            });
            document.getElementById(`${base}-fclr`)?.addEventListener("click", () => {
                saveCustomAlarmField(i, { customPath: null });
                showCustomFile(`cust-${i}`, null);
            });
        }
    }
    wireCustomAlarms();

    // ══════════════════════════════════════════════════════════════
    // DIGITAL CLOCK
    // ══════════════════════════════════════════════════════════════
    let digInterval = null;

    function isMainWindowVisible() {
        return mainActive;
    }

    function syncDigitalClock() {
        if (digInterval) clearInterval(digInterval);
        digInterval = null;
        if (isMainWindowVisible()) {
            updateDigital();
            digInterval = setInterval(updateDigital, 1000);
        }
    }

    // WebView2 on Windows does not reliably expose visibility/focus to
    // the page: document.hidden, document.hasFocus() and even Tauri's
    // native isFocused() all keep reporting this window as visible+
    // focused after it is hidden via .hide() in mini mode. That left
    // the analog-clock rAF loop painting off-screen and the GPU process
    // compositing those wasted frames (~5% CPU while "idle" in mini).
    // The Rust backend is the only reliable source of truth for which
    // window is on screen, so it drives this flag via "cc:active-window"
    // (see broadcast_active_window). The heavy canvas loop runs only
    // while the main window is the active one and resumes instantly
    // (with the correct time) when it is shown again.
    let mainActive = true;
    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function welcomeGreetingKey() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "welcome.goodMorning";
        if (hour >= 12 && hour < 18) return "welcome.goodAfternoon";
        return "welcome.goodEvening";
    }

    function welcomeGreetingText() {
        const name = String(cfg.displayName || "").trim().replace(/\s+/g, " ").slice(0, 32);
        const suffix = name ? ", " + name : "";
        return window.ccI18n ? window.ccI18n.t(welcomeGreetingKey(), { name: suffix }) : (name ? `Hello, ${name}` : "Hello");
    }

    function updateGreeting() {
        const hour = new Date().getHours();
        const key = welcomeGreetingKey();
        const name = String(cfg.displayName || "").trim().replace(/\s+/g, " ").slice(0, 32);
        const suffix = name ? ", " + name : "";
        const text = window.ccI18n ? window.ccI18n.t(key, { name: suffix }) : (name ? `Hello, ${name}` : "Hello");
        const calEl = document.getElementById("cal-greeting-text");
        if (calEl) {
            if (name) {
                const baseGreeting = window.ccI18n ? window.ccI18n.t(key, { name: "" }) : "Hello";
                calEl.innerHTML = `${escapeHtml(baseGreeting)}, <span class="cal-greeting-name">${escapeHtml(name)}</span>`;
            } else {
                calEl.textContent = text;
            }
        }
        const icoEl = document.getElementById("cal-greeting-ico");
        if (icoEl) {
            let icoName = "moon";
            let timeClass = "time-evening";
            if (hour >= 5 && hour < 12) {
                icoName = "coffee";
                timeClass = "time-morning";
            } else if (hour >= 12 && hour < 18) {
                icoName = "sun";
                timeClass = "time-afternoon";
            }
            icoEl.className = `cal-greeting-ico ${timeClass}`;
            icoEl.setAttribute("data-ico", icoName);
            if (window.ccIcons && window.ccIcons.replaceIcons) {
                window.ccIcons.replaceIcons(icoEl.parentElement);
            }
        }
        const tbarEl = document.getElementById("tbar-welcome");
        if (tbarEl) tbarEl.textContent = text;
    }

    function isMainActive() {
        return mainActive;
    }
    function setMainActive(v) {
        const nv = !!v;
        const wasActive = mainActive;
        mainActive = nv;
        document.body.classList.toggle("cc-inactive", !nv);
        if (nv && !wasActive) updateGreeting();
        if (nv) {
            setupClock();
            setupClockAutoCycle();
        } else if (clockAutoCycleTimer) {
            clearInterval(clockAutoCycleTimer);
            clockAutoCycleTimer = null;
        }
        syncHomeClock();
        syncDigitalClock();
    }

    let stopClockTimer = null;
    function syncHomeClock() {
        const hidden = document
            .getElementById("view-home")
            ?.classList.contains("no-clock");
        if (!hidden && isMainActive() && curView === "home") {
            if (stopClockTimer) {
                clearTimeout(stopClockTimer);
                stopClockTimer = null;
            }
            startClockAnim();
        } else {
            // Keep drawing during the CSS collapse transition so the clock slides away fluidly
            if (stopClockTimer) clearTimeout(stopClockTimer);
            stopClockTimer = setTimeout(() => {
                if (document.getElementById("view-home")?.classList.contains("no-clock") || curView !== "home") {
                    stopClockAnim();
                }
            }, 460);
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) setupClock();
        syncHomeClock();
        syncDigitalClock();
    });

    window.cc.onActiveWindow((label) => {
        const isMain = label === "main";
        setMainActive(isMain);
        if (isMain) setupClock();
    });

    function updateDigital() {
        const now = new Date();
        let h = now.getHours(),
            m = now.getMinutes(),
            s = now.getSeconds(),
            t;
        if (cfg.clockFormat === "12h") {
            const ap = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
            t = `${pad(h)}:${pad(m)}${cfg.showSeconds !== false ? ":" + pad(s) : ""} ${ap}`;
        } else {
            t = `${pad(h)}:${pad(m)}${cfg.showSeconds !== false ? ":" + pad(s) : ""}`;
        }
        setDigits(document.getElementById("dig-time"), t);
        const days = getDays();
        const months = getMonths();
        document.getElementById("dig-date").textContent =
            `${days[now.getDay()]}·${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    // ══════════════════════════════════════════════════════════════
    // ANALOG CLOCK (Canvas)
    // ══════════════════════════════════════════════════════════════
    let clockRaf = null;
    // Cap the analog clock to ~30fps. The sweeping second hand and the
    // breathing rim look identical to the eye at 30fps, but on 60/120/144Hz
    // displays this avoids redrawing shadowBlur'd hands + glow every vsync.
    const CLOCK_FRAME_MS = 1000 / 30;
    let clockLastFrame = 0;
    let cybergemsCacheKey = null;
    let cybergemsWidths = null;
    let cybergemsTotal = 0;
    let cybergemsFontPx = 0;

    function setupClock() {
        const canvas = document.getElementById("clock-canvas");
        if (!canvas) return;
        const stage = document.querySelector(".clock-stage");
        const panel = document.querySelector(".clock-panel") || canvas.closest(".clock-panel");
        if (!panel) return;
        const homeView = document.getElementById("view-home");
        if (homeView && homeView.classList.contains("no-clock")) {
            return;
        }
        const isSolo = (typeof cfg !== "undefined" && cfg.fullHideCalendar === true) || (homeView && homeView.classList.contains("no-calendar"));
        const padX = isSolo ? 64 : 72;
        const padY = isSolo ? 48 : 36;

        const parentW = panel.parentElement?.clientWidth || window.innerWidth || 1024;
        const parentH = panel.parentElement?.clientHeight || (window.innerHeight - 120) || 450;
        let w = isSolo ? parentW : (panel.clientWidth || Math.round(parentW * 0.44));
        let h = panel.clientHeight || parentH;

        if (w < 50 || h < 50) {
            // Initial boot fallback: use window dimensions so the clock renders immediately
            const winW = window.innerWidth || 1024;
            const winH = window.innerHeight || 768;
            w = isSolo ? winW : Math.round(winW * 0.44);
            h = winH - (isSolo ? 96 : 144);
            requestAnimationFrame(setupClock);
        }

        const size = Math.max(120, Math.min(
            w - padX,
            h - padY,
        ));
        if (stage) {
            stage.style.setProperty("--stage-size", `${size}px`);
        }

        // Fixed high-DPI canvas buffer (900x900) so mode transitions scale the surface smoothly via GPU
        // without clearing the framebuffer, eliminating any end-of-transition blink!
        const targetRes = 900;
        if (canvas.width !== targetRes || canvas.height !== targetRes) {
            canvas.width = targetRes;
            canvas.height = targetRes;
            cybergemsCacheKey = null;
            clockFaceCanvas = null;
            clockFaceKey = null;
        }
        if (isMainActive() && curView === "home") {
            drawClock(performance.now(), true);
        }
    }

    if (document.fonts) {
        document.fonts.ready.then(() => {
            cybergemsCacheKey = null;
            clockFaceCanvas = null;
            clockFaceKey = null;
        });
    }

    function themeColors() {
        const cs = getComputedStyle(document.body);
        const g = (n) => cs.getPropertyValue(n).trim();
        return {
            accent: g("--accent-a") || "#00d4ff",
            handSec: g("--hand-sec") || "#ff4444",
            rgb: g("--rgb-accent") || "0,212,255",
        };
    }

    // ── Static face cache ──
    // The clock face (glow, dome, bezel, lip, 60 ticks, 12 hour markers,
    // 12/3/6/9 numerals) never changes between frames, but the original
    // drawClock() redrew all of it — including dozens of shadowBlur
    // strokes — 60 times per second. That continuous repaint was the main
    // idle CPU sink. We render it once to an offscreen canvas and only
    // rebuild when the canvas size or accent color changes.
    let clockFaceCanvas = null;
    let clockFaceKey = null;

    function buildClockFace(W, H, cx, cy, R, c) {
        const design = currentClockDesign();
        if (design === 2) return buildFaceMinimal(W, H, cx, cy, R, c);
        if (design === 3) return buildFaceSegments(W, H, cx, cy, R, c);
        if (design === 4) return buildFaceHud(W, H, cx, cy, R, c);
        if (design === 5) return buildFaceQuantum(W, H, cx, cy, R, c);
        if (design === 6) return buildFaceChrono(W, H, cx, cy, R, c);
        if (design === 7) return buildFaceMatrix(W, H, cx, cy, R, c);
        if (design === 8) return buildFaceReactor(W, H, cx, cy, R, c);
        if (design === 9) return buildFaceCircuit(W, H, cx, cy, R, c);
        if (design === 10) return buildFaceGemCrown(W, H, cx, cy, R, c);
        return buildFaceClassic(W, H, cx, cy, R, c);
    }

    // Settings id of the analog dial design (1..10). Unknown values and
    // missing keys fall back to the Classic face, matching the backend
    // default (clockDesign: 1).
    function currentClockDesign() {
        const d = parseInt(cfg.clockDesign, 10);
        return d >= 1 && d <= 10 ? d : 1;
    }

    // ── Design 1: Classic (bezel + domed glass + 12/3/6/9 numerals) ──
    function buildFaceClassic(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Face glow
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
        bg.addColorStop(0, `rgba(${c.rgb},.07)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.025)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // ── Recessed face shading (domed glass, lit from top) ──
        // Single virtual light source above the dial: the upper half
        // catches a faint lift, the lower half sinks into shadow, so the
        // face reads as a shallow concave well under glass.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.885, 0, Math.PI * 2);
        ctx.clip();
        const dome = ctx.createLinearGradient(
            cx,
            cy - R * 0.9,
            cx,
            cy + R * 0.9,
        );
        dome.addColorStop(0, `rgba(${c.rgb},.10)`);
        dome.addColorStop(0.5, "rgba(0,0,0,0)");
        dome.addColorStop(1, "rgba(0,0,0,.42)");
        ctx.fillStyle = dome;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();

        // ── Beveled bezel (raised rim, lit from top) ──
        // Top of the band catches white light, the hue band wraps the
        // middle, the bottom falls into shadow — the classic read of a
        // solid ring lit from above.
        const bezel = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
        // Highlight is carried by the accent hue itself (no white), so
        // the crown reads as a brighter band of the same cyan instead of
        // a desaturated metallic-grey sheen.
        bezel.addColorStop(0, `rgba(${c.rgb},.55)`);
        bezel.addColorStop(0.45, `rgba(${c.rgb},.12)`);
        bezel.addColorStop(1, "rgba(0,0,0,.5)");
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.lineWidth = R * 0.08;
        ctx.strokeStyle = bezel;
        ctx.stroke();
        ctx.restore();

        // ── Inner lip occlusion ring (recess shadow) ──
        // Inverse gradient to the bezel: the top inner edge sits in the
        // bezel's shadow, the bottom inner edge catches bounced light —
        // this inversion is what sells the "sunken face".
        const lip = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
        lip.addColorStop(0, "rgba(0,0,0,.5)");
        lip.addColorStop(1, `rgba(${c.rgb},.18)`);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.892, 0, Math.PI * 2);
        ctx.lineWidth = R * 0.018;
        ctx.strokeStyle = lip;
        ctx.stroke();
        ctx.restore();

        // Minute ticks
        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue;
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.32)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(
                cx + Math.cos(a) * R * 0.845,
                cy + Math.sin(a) * R * 0.845,
            );
            ctx.lineTo(
                cx + Math.cos(a) * R * 0.885,
                cy + Math.sin(a) * R * 0.885,
            );
            ctx.stroke();
            ctx.restore();
        }

        // Hour markers
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2,
                big = i % 3 === 0;
            ctx.save();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = big ? 3 : 1.5;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = big ? 14 : 5;
            ctx.beginPath();
            ctx.moveTo(
                cx + Math.cos(a) * R * (big ? 0.66 : 0.74),
                cy + Math.sin(a) * R * (big ? 0.66 : 0.74),
            );
            ctx.lineTo(
                cx + Math.cos(a) * R * 0.885,
                cy + Math.sin(a) * R * 0.885,
            );
            ctx.stroke();
            ctx.restore();
        }

        // Numbers 12/3/6/9
        ctx.save();
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${R * 0.098}px Orbitron,monospace`;
        [
            [0, "12"],
            [3, "3"],
            [6, "6"],
            [9, "9"],
        ].forEach(([i, lbl]) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.fillText(
                lbl,
                cx + Math.cos(a) * R * 0.6,
                cy + Math.sin(a) * R * 0.6,
            );
        });
        ctx.restore();

        return off;
    }

    // ── Design 2: Minimal (dot markers, no bezel, thin ring) ──
    function buildFaceMinimal(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Soft face glow, kept faint: the design reads by absence.
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
        bg.addColorStop(0, `rgba(${c.rgb},.05)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.02)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Hairline ring instead of a bezel
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.30)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Dot markers: quarters are larger and glow a little; the rest
        // stay tiny and quiet. No numerals at all.
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const big = i % 3 === 0;
            const r = big ? R * 0.013 : R * 0.006;
            ctx.save();
            ctx.beginPath();
            ctx.arc(
                cx + Math.cos(a) * R * 0.86,
                cy + Math.sin(a) * R * 0.86,
                r,
                0,
                Math.PI * 2,
            );
            ctx.fillStyle = big ? c.accent : `rgba(${c.rgb},.45)`;
            if (big) {
                ctx.shadowColor = c.accent;
                ctx.shadowBlur = 8;
            }
            ctx.fill();
            ctx.restore();
        }

        return off;
    }

    // ── Design 3: Neon Segments (baton markers, flat bezel; the
    //    60-segment progress ring is the DYNAMIC layer, see drawClock) ──
    function buildFaceSegments(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Face glow, a touch stronger: neon earns its light.
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.09)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.03)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Flat bezel: two clean concentric rings, no dome shading.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.45)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.80, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.16)`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();

        // Baton markers: fat quarters, slim hours, no minute ticks
        // (the segment ring already paces the perimeter).
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const big = i % 3 === 0;
            const len = big ? R * 0.10 : R * 0.045;
            const wid = big ? R * 0.018 : R * 0.009;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * R * 0.71, cy + Math.sin(a) * R * 0.71);
            ctx.rotate(a + Math.PI / 2);
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = wid;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = big ? 12 : 4;
            ctx.beginPath();
            ctx.moveTo(0, -len / 2);
            ctx.lineTo(0, len / 2);
            ctx.stroke();
            ctx.restore();
        }

        return off;
    }

    // ── Design 4: Cyber HUD (radial grid, degree ticks, quarter
    //    targeting brackets) ──
    function buildFaceHud(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Face glow, cool and technical
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.08)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.025)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Fine radial grid: 24 hairlines crossing the inner face
        ctx.save();
        ctx.strokeStyle = `rgba(${c.rgb},.10)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12);
            ctx.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84);
            ctx.stroke();
        }
        // Two faint concentric grid circles
        [0.34, 0.58].forEach((f) => {
            ctx.beginPath();
            ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();

        // Degree ticks on the outer ring: 60 minor + 12 major
        ctx.save();
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const big = i % 5 === 0;
            ctx.strokeStyle = big ? `rgba(${c.rgb},.55)` : `rgba(${c.rgb},.25)`;
            ctx.lineWidth = big ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R * 0.885, cy + Math.sin(a) * R * 0.885);
            ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
            ctx.stroke();
        }
        ctx.restore();

        // Targeting brackets at the quarters: open corner marks that
        // frame the dial like a visor readout.
        ctx.save();
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
            const bx = cx + Math.cos(a) * R * 0.98;
            const by = cy + Math.sin(a) * R * 0.98;
            // Bracket tangent direction and its normal
            const t = a + Math.PI / 2;
            const arm = R * 0.07;
            const inw = R * 0.035;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(t) * arm, by + Math.sin(t) * arm);
            ctx.lineTo(bx + Math.cos(t) * R * 0.02, by + Math.sin(t) * R * 0.02);
            ctx.lineTo(bx - Math.cos(a) * inw + Math.cos(t) * R * 0.02, by - Math.sin(a) * inw + Math.sin(t) * R * 0.02);
            ctx.lineTo(bx - Math.cos(a) * inw, by - Math.sin(a) * inw);
            ctx.stroke();
        }
        ctx.restore();

        return off;
    }

    // ── Design 5: Quantum Orbit (concentric particle rings, diamond
    //    reticle cardinal nodes, planetary orbital markers) ──
    function buildFaceQuantum(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Quantum core nebula glow
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.06);
        bg.addColorStop(0, `rgba(${c.rgb},.12)`);
        bg.addColorStop(0.45, `rgba(${c.rgb},.04)`);
        bg.addColorStop(0.85, `rgba(${c.rgb},.01)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Quantum containment boundary ring with technical hash marks
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.38)`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.stroke();

        // 36 Quantum containment ticks
        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            const isMajor = i % 9 === 0;
            const r0 = isMajor ? R * 0.895 : R * 0.92;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            ctx.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94);
            ctx.strokeStyle = isMajor ? c.accent : `rgba(${c.rgb},.28)`;
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.stroke();
        }
        ctx.restore();

        // Concentric broken orbital ring arcs
        ctx.save();
        // Outer orbit track (dashed)
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
        ctx.setLineDash([14, 8]);
        ctx.strokeStyle = `rgba(${c.rgb},.20)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Middle orbit track (fine dotted)
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.60, 0, Math.PI * 2);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = `rgba(${c.rgb},.16)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner particle accelerator ring with 24 fine radial hash lines
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.28)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R * 0.26, cy + Math.sin(a) * R * 0.26);
            ctx.lineTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28);
            ctx.strokeStyle = `rgba(${c.rgb},.24)`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();

        // 12 Orbital Hour Nodes (4 Cardinal Diamond Reticles + 8 Planetary Nodes)
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const isCardinal = i % 3 === 0;
            const nx = cx + Math.cos(a) * R * 0.82;
            const ny = cy + Math.sin(a) * R * 0.82;

            ctx.save();
            if (isCardinal) {
                // Diamond Reticle Node at 12, 3, 6, 9
                const dSize = R * 0.045;
                ctx.translate(nx, ny);
                ctx.rotate(a + Math.PI / 2);

                // Crosshair whiskers
                ctx.beginPath();
                ctx.moveTo(0, -dSize * 1.6);
                ctx.lineTo(0, dSize * 1.6);
                ctx.moveTo(-dSize * 1.2, 0);
                ctx.lineTo(dSize * 1.2, 0);
                ctx.strokeStyle = `rgba(${c.rgb},.40)`;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Diamond geometry
                ctx.beginPath();
                ctx.moveTo(0, -dSize);
                ctx.lineTo(dSize * 0.7, 0);
                ctx.lineTo(0, dSize);
                ctx.lineTo(-dSize * 0.7, 0);
                ctx.closePath();
                ctx.strokeStyle = c.accent;
                ctx.lineWidth = 2;
                ctx.fillStyle = `rgba(${c.rgb},.22)`;
                ctx.shadowColor = c.accent;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.stroke();

                // Glowing core pin
                ctx.beginPath();
                ctx.arc(0, 0, R * 0.012, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.shadowBlur = 8;
                ctx.fill();
            } else {
                // Planetary orbital nodes at 1, 2, 4, 5, 7, 8, 10, 11
                ctx.beginPath();
                ctx.arc(nx, ny, R * 0.018, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${c.rgb},.45)`;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(nx, ny, R * 0.008, 0, Math.PI * 2);
                ctx.fillStyle = c.accent;
                ctx.shadowColor = c.accent;
                ctx.shadowBlur = 6;
                ctx.fill();
            }
            ctx.restore();
        }

        return off;
    }

    // ── Design 6: Cyber Chrono (dual tactical subdials, tachymeter scale,
    //    faceted batons, telemetry instrumentation) ──
    function buildFaceChrono(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Precision matte face background
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.08)`);
        bg.addColorStop(0.7, `rgba(${c.rgb},.02)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // Outer Tachymeter / Telemetry Scale Bezel
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.32)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.20)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 120 Telemetry ticks
        for (let i = 0; i < 120; i++) {
            const a = (i / 120) * Math.PI * 2 - Math.PI / 2;
            const isMajor = i % 10 === 0;
            const isSemi = i % 5 === 0;
            const len = isMajor ? R * 0.065 : isSemi ? R * 0.045 : R * 0.025;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * (R * 0.945 - len), cy + Math.sin(a) * (R * 0.945 - len));
            ctx.lineTo(cx + Math.cos(a) * R * 0.945, cy + Math.sin(a) * R * 0.945);
            ctx.strokeStyle = isMajor ? c.accent : isSemi ? `rgba(${c.rgb},.50)` : `rgba(${c.rgb},.22)`;
            ctx.lineWidth = isMajor ? 1.8 : 1;
            ctx.stroke();
        }

        // Mini telemetry markings at key angles
        const telemarks = [
            { a: 0, t: "60" },
            { a: 1, t: "400" },
            { a: 2, t: "300" },
            { a: 3, t: "240" },
            { a: 4, t: "180" },
            { a: 5, t: "140" },
            { a: 6, t: "120" },
            { a: 7, t: "100" },
            { a: 8, t: "85" },
            { a: 9, t: "75" },
            { a: 10, t: "68" },
            { a: 11, t: "64" },
        ];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${R * 0.034}px "JetBrains Mono",monospace`;
        ctx.fillStyle = `rgba(${c.rgb},.55)`;
        telemarks.forEach((m) => {
            const a = (m.a / 12) * Math.PI * 2 - Math.PI / 2;
            const tx = cx + Math.cos(a) * R * 0.915;
            const ty = cy + Math.sin(a) * R * 0.915;
            ctx.fillText(m.t, tx, ty);
        });
        ctx.restore();

        // ── Subdial 1 (Left / 9 o'clock: 24-Hour Cycle) ──
        const subR = R * 0.20;
        const sub1X = cx - R * 0.38, sub1Y = cy;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sub1X, sub1Y, subR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.rgb},.04)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Subdial 1 ticks & labels (24, 6, 12, 18)
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
            const isMaj = i % 6 === 0;
            ctx.beginPath();
            ctx.moveTo(sub1X + Math.cos(a) * (subR - (isMaj ? subR * 0.22 : subR * 0.12)), sub1Y + Math.sin(a) * (subR - (isMaj ? subR * 0.22 : subR * 0.12)));
            ctx.lineTo(sub1X + Math.cos(a) * subR, sub1Y + Math.sin(a) * subR);
            ctx.strokeStyle = isMaj ? c.accent : `rgba(${c.rgb},.25)`;
            ctx.lineWidth = isMaj ? 1.5 : 0.8;
            ctx.stroke();
        }
        ctx.font = `700 ${R * 0.038}px "JetBrains Mono",monospace`;
        ctx.fillStyle = c.accent;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("24", sub1X, sub1Y - subR * 0.55);
        ctx.fillText("12", sub1X, sub1Y + subR * 0.55);
        ctx.fillText("6", sub1X + subR * 0.55, sub1Y);
        ctx.fillText("18", sub1X - subR * 0.55, sub1Y);
        ctx.restore();

        // ── Subdial 2 (Right / 3 o'clock: 60-Second Telemetry) ──
        const sub2X = cx + R * 0.38, sub2Y = cy;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sub2X, sub2Y, subR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.rgb},.04)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Subdial 2 ticks & labels (60, 15, 30, 45)
        for (let i = 0; i < 60; i++) {
            if (i % 5 !== 0 && i % 2 !== 0) continue;
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isMaj = i % 15 === 0;
            ctx.beginPath();
            ctx.moveTo(sub2X + Math.cos(a) * (subR - (isMaj ? subR * 0.22 : subR * 0.12)), sub2Y + Math.sin(a) * (subR - (isMaj ? subR * 0.22 : subR * 0.12)));
            ctx.lineTo(sub2X + Math.cos(a) * subR, sub2Y + Math.sin(a) * subR);
            ctx.strokeStyle = isMaj ? c.handSec : `rgba(${c.rgb},.25)`;
            ctx.lineWidth = isMaj ? 1.5 : 0.8;
            ctx.stroke();
        }
        ctx.font = `700 ${R * 0.038}px "JetBrains Mono",monospace`;
        ctx.fillStyle = `rgba(${c.rgb},.80)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("60", sub2X, sub2Y - subR * 0.55);
        ctx.fillText("30", sub2X, sub2Y + subR * 0.55);
        ctx.fillText("15", sub2X + subR * 0.55, sub2Y);
        ctx.fillText("45", sub2X - subR * 0.55, sub2Y);
        ctx.restore();

        // ── Faceted Chronograph Hour Batons ──
        for (let i = 0; i < 12; i++) {
            // Skip 3 and 9 indices to leave room for subdials
            if (i === 3 || i === 9) continue;
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const is12 = i === 0;
            const is6 = i === 6;
            const bLen = is12 ? R * 0.11 : is6 ? R * 0.09 : R * 0.075;
            const bWid = is12 ? R * 0.024 : R * 0.016;

            ctx.save();
            ctx.translate(cx + Math.cos(a) * (R * 0.865 - bLen / 2), cy + Math.sin(a) * (R * 0.865 - bLen / 2));
            ctx.rotate(a + Math.PI / 2);

            // Faceted index body
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = bWid;
            ctx.lineCap = "butt";
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = is12 ? 10 : 5;
            ctx.beginPath();
            ctx.moveTo(0, -bLen / 2);
            ctx.lineTo(0, bLen / 2);
            ctx.stroke();

            // Luminous tip block
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(-bWid * 0.4, bLen / 2 - R * 0.018, bWid * 0.8, R * 0.018);
            ctx.restore();
        }

        return off;
    }

    // ── Design 7: Hex Matrix (cybernetic honeycomb lattice, 12-sided bezel,
    //    chevron vector hour glyphs, illuminated neural vertices) ──
    function buildFaceMatrix(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // Background glow
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
        bg.addColorStop(0, `rgba(${c.rgb},.10)`);
        bg.addColorStop(0.5, `rgba(${c.rgb},.03)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // 12-Sided Faceted Hex Bezel
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * R * 0.94;
            const py = cy + Math.sin(a) * R * 0.94;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${c.rgb},.42)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Inner polygon frame
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * R * 0.87;
            const py = cy + Math.sin(a) * R * 0.87;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${c.rgb},.18)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Hexagonal Honeycomb Matrix (clipped to R * 0.85 circle)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2);
        ctx.clip();

        const hexR = R * 0.12;
        const hexW = Math.sqrt(3) * hexR;
        const hexH = 1.5 * hexR;
        const cols = Math.ceil((R * 2) / hexW) + 2;
        const rows = Math.ceil((R * 2) / hexH) + 2;

        ctx.strokeStyle = `rgba(${c.rgb},.08)`;
        ctx.lineWidth = 1;
        for (let row = -rows; row <= rows; row++) {
            for (let col = -cols; col <= cols; col++) {
                const hx = cx + col * hexW + (row % 2 !== 0 ? hexW / 2 : 0);
                const hy = cy + row * hexH;
                const dist = Math.hypot(hx - cx, hy - cy);
                if (dist > R * 0.86) continue;

                ctx.beginPath();
                for (let k = 0; k < 6; k++) {
                    const ang = (k / 6) * Math.PI * 2 + Math.PI / 6;
                    const vx = hx + Math.cos(ang) * hexR * 0.92;
                    const vy = hy + Math.sin(ang) * hexR * 0.92;
                    if (k === 0) ctx.moveTo(vx, vy);
                    else ctx.lineTo(vx, vy);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.restore();

        // 12 Chevron Vector Hour Glyphs
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const isCardinal = i % 3 === 0;
            const gx = cx + Math.cos(a) * R * 0.76;
            const gy = cy + Math.sin(a) * R * 0.76;

            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(a + Math.PI / 2);

            ctx.strokeStyle = c.accent;
            ctx.lineWidth = isCardinal ? 2.5 : 1.6;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = isCardinal ? 12 : 5;

            const cw = isCardinal ? R * 0.045 : R * 0.03;
            const ch = isCardinal ? R * 0.025 : R * 0.016;

            // Outer chevron
            ctx.beginPath();
            ctx.moveTo(-cw, -ch);
            ctx.lineTo(0, ch);
            ctx.lineTo(cw, -ch);
            ctx.stroke();

            // Double chevron for cardinals
            if (isCardinal) {
                ctx.beginPath();
                ctx.moveTo(-cw * 0.75, -ch - R * 0.02);
                ctx.lineTo(0, ch - R * 0.02);
                ctx.lineTo(cw * 0.75, -ch - R * 0.02);
                ctx.stroke();
            }

            // Circuit trace extending outward to the bezel
            ctx.beginPath();
            ctx.moveTo(0, ch + R * 0.01);
            ctx.lineTo(0, ch + R * 0.08);
            ctx.strokeStyle = `rgba(${c.rgb},.30)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }

        return off;
    }

    // ── Design 8: Reactor Core (Fusion Tokamak / Arc Reactor plasma core,
    //    magnetic containment rings, 12 radial injector coils, thermal slots) ──
    function buildFaceReactor(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // 1. Deep Vacuum Chamber Background
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.02);
        bgGrad.addColorStop(0, `rgba(${c.rgb},.16)`);
        bgGrad.addColorStop(0.35, `rgba(${c.rgb},.06)`);
        bgGrad.addColorStop(0.75, "rgba(10,12,18,.92)");
        bgGrad.addColorStop(1, "rgba(6,8,12,.98)");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = bgGrad;
        ctx.fill();

        // 2. Heavy Industrial Containment Ring (Bezel)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.50)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Inner containment rim
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.25)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 3. 60 Peripheral Thermal Exhaust Slots
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isHour = i % 5 === 0;
            const r1 = isHour ? R * 0.885 : R * 0.90;
            const r2 = R * 0.935;
            const x1 = cx + Math.cos(a) * r1;
            const y1 = cy + Math.sin(a) * r1;
            const x2 = cx + Math.cos(a) * r2;
            const y2 = cy + Math.sin(a) * r2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = isHour ? c.accent : `rgba(${c.rgb},.32)`;
            ctx.lineWidth = isHour ? 2.2 : 1;
            ctx.stroke();
        }

        // 4. Primary Magnetic Stabilizers / Clamps at 12, 3, 6, 9
        const cardAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
        for (let k = 0; k < 4; k++) {
            const ca = cardAngles[k];
            ctx.save();
            ctx.translate(cx + Math.cos(ca) * (R * 0.93), cy + Math.sin(ca) * (R * 0.93));
            ctx.rotate(ca + Math.PI / 2);
            ctx.beginPath();
            const bw = R * 0.045, bh = R * 0.055;
            ctx.rect(-bw, -bh / 2, bw * 2, bh);
            ctx.fillStyle = "#12151e";
            ctx.fill();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.8;
            ctx.shadowBlur = 8;
            ctx.stroke();
            // Warning status LED
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.012, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();
        }

        // 5. Magnetic Plasma Confinement Guide Rings
        [0.78, 0.62, 0.44].forEach((cr, idx) => {
            ctx.beginPath();
            ctx.arc(cx, cy, R * cr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c.rgb},${0.18 + idx * 0.08})`;
            ctx.lineWidth = 1.2;
            ctx.setLineDash(idx === 1 ? [4, 6] : [8, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        // 6. 12 Radial Tokamak Injector Coils / Stator Blocks
        for (let i = 0; i < 12; i++) {
            const hNum = i === 0 ? 12 : i;
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);

            // Magnetic Injector Coil Body (trapezoid from R*0.46 to R*0.76)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a + Math.PI / 2);

            const wInner = R * 0.024;
            const wOuter = R * 0.048;
            const yInner = -R * 0.46;
            const yOuter = -R * 0.76;

            ctx.beginPath();
            ctx.moveTo(-wInner, yInner);
            ctx.lineTo(-wOuter, yOuter);
            ctx.lineTo(wOuter, yOuter);
            ctx.lineTo(wInner, yInner);
            ctx.closePath();
            ctx.fillStyle = "rgba(18, 22, 32, 0.75)";
            ctx.fill();
            ctx.strokeStyle = `rgba(${c.rgb},.40)`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Magnetic coil winding ribs (3 cross lines)
            for (let rib = 1; rib <= 3; rib++) {
                const ry = yInner + (yOuter - yInner) * (rib / 4);
                const rw = wInner + (wOuter - wInner) * (rib / 4);
                ctx.beginPath();
                ctx.moveTo(-rw, ry);
                ctx.lineTo(rw, ry);
                ctx.strokeStyle = `rgba(${c.rgb},.28)`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // High-voltage node cap at outer end
            ctx.beginPath();
            ctx.arc(0, yOuter - R * 0.015, R * 0.016, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.shadowBlur = 10;
            ctx.fill();

            ctx.restore();

            // Hour Numeral inside outer track (at R * 0.82)
            const numR = R * 0.82;
            const nx = cx + cosA * numR;
            const ny = cy + sinA * numR;
            ctx.font = `bold ${Math.round(R * 0.09)}px Orbitron, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 6;
            ctx.fillText(hNum < 10 ? `0${hNum}` : `${hNum}`, nx, ny);
        }

        // 7. Central Core Tokamak Chamber
        const coreR = R * 0.30;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(12, 16, 24, 0.9)";
        ctx.fill();
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Technical Telemetry Silkscreen in Core Chamber
        ctx.font = `600 ${Math.round(R * 0.045)}px "Space Grotesk", monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${c.rgb},.65)`;
        ctx.shadowBlur = 0;
        ctx.fillText("TOKAMAK // MK-IV", cx, cy - coreR * 0.38);
        ctx.fillText("FLUX: 100%", cx, cy + coreR * 0.42);

        ctx.restore();
        return off;
    }

    // ── Design 9: Circuit PCB (Silicon microprocessor, 45-degree bus traces,
    //    SMD solder pads, micro-vias, ground plane matrix) ──
    function buildFaceCircuit(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // 1. Matte Dark Green / Obsidian PCB Ground Plane
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = "#0c1017";
        ctx.fill();

        // Subtle micro ground matrix (crosshairs / grid points)
        ctx.save();
        ctx.fillStyle = `rgba(${c.rgb},.06)`;
        const step = R * 0.12;
        for (let gx = cx - R * 0.9; gx <= cx + R * 0.9; gx += step) {
            for (let gy = cy - R * 0.9; gy <= cy + R * 0.9; gy += step) {
                const dist = Math.hypot(gx - cx, gy - cy);
                if (dist < R * 0.88 && dist > R * 0.32) {
                    ctx.fillRect(gx - 1, gy - 1, 2, 2);
                }
            }
        }
        ctx.restore();

        // 2. Outer PCB Circular Bus Ground Track
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.87, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.18)`;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // 60 Plated Through-Hole Vias (Minute ticks) along outer perimeter
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isHour = i % 5 === 0;
            const vr = R * 0.90;
            const vx = cx + Math.cos(a) * vr;
            const vy = cy + Math.sin(a) * vr;

            ctx.beginPath();
            ctx.arc(vx, vy, isHour ? R * 0.016 : R * 0.009, 0, Math.PI * 2);
            ctx.fillStyle = isHour ? c.accent : `rgba(${c.rgb},.40)`;
            ctx.fill();
            // Drill hole center
            ctx.beginPath();
            ctx.arc(vx, vy, isHour ? R * 0.007 : R * 0.004, 0, Math.PI * 2);
            ctx.fillStyle = "#0c1017";
            ctx.fill();
        }

        // 3. Central Microprocessor Package (QFP-32 Die)
        const chipSz = R * 0.24;
        ctx.save();
        ctx.translate(cx, cy);

        // Chip shadow & body
        ctx.beginPath();
        ctx.rect(-chipSz, -chipSz, chipSz * 2, chipSz * 2);
        ctx.fillStyle = "#141822";
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.rgb},.60)`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Chip Pin 1 Index Marker (corner dot)
        ctx.beginPath();
        ctx.arc(-chipSz + R * 0.035, -chipSz + R * 0.035, R * 0.014, 0, Math.PI * 2);
        ctx.fillStyle = c.accent;
        ctx.fill();

        // Micro Pin Leads (6 pins on each of 4 edges)
        const pins = 6;
        const pinSpan = (chipSz * 1.6) / (pins - 1);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(${c.rgb},.45)`;
        for (let p = 0; p < pins; p++) {
            const offset = -chipSz * 0.8 + p * pinSpan;
            ctx.beginPath(); ctx.moveTo(offset, -chipSz); ctx.lineTo(offset, -chipSz - R * 0.04); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(offset, chipSz); ctx.lineTo(offset, chipSz + R * 0.04); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-chipSz, offset); ctx.lineTo(-chipSz - R * 0.04, offset); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(chipSz, offset); ctx.lineTo(chipSz + R * 0.04, offset); ctx.stroke();
        }

        // Silkscreen Text on Chip
        ctx.font = `bold ${Math.round(R * 0.048)}px "Space Grotesk", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = c.accent;
        ctx.shadowBlur = 0;
        ctx.fillText("CYBER-CPU", 0, -R * 0.05);
        ctx.font = `600 ${Math.round(R * 0.036)}px "Space Grotesk", monospace`;
        ctx.fillStyle = `rgba(${c.rgb},.70)`;
        ctx.fillText("64-BIT // CLK", 0, R * 0.03);
        ctx.fillText("REV 4.2", 0, R * 0.09);

        ctx.restore();

        // 4. 12 Primary PCB Bus Signal Traces (with authentic 45-degree elbows!)
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);

            const x0 = cx + cosA * (R * 0.33);
            const y0 = cy + sinA * (R * 0.33);

            const elbowA = a + (i % 2 === 0 ? 0.22 : -0.22);
            const x1 = cx + Math.cos(elbowA) * (R * 0.52);
            const y1 = cy + Math.sin(elbowA) * (R * 0.52);

            const x2 = cx + cosA * (R * 0.74);
            const y2 = cy + sinA * (R * 0.74);

            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(${c.rgb},.38)`;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Plated Via at elbow turn
            ctx.beginPath();
            ctx.arc(x1, y1, R * 0.012, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x1, y1, R * 0.005, 0, Math.PI * 2);
            ctx.fillStyle = "#0c1017";
            ctx.fill();

            // 5. 12 SMD Component Hour Pads & Silkscreen Brackets [ 12 ]
            ctx.save();
            ctx.translate(x2, y2);
            ctx.rotate(a + Math.PI / 2);

            const pw = R * 0.045, ph = R * 0.024;
            ctx.beginPath();
            ctx.rect(-pw, -ph, pw * 2, ph * 2);
            ctx.fillStyle = "#1e222a";
            ctx.fill();
            ctx.strokeStyle = `rgba(${c.rgb},.55)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = c.accent;
            ctx.shadowBlur = 6;
            ctx.fillRect(-pw, -ph, pw * 0.45, ph * 2);
            ctx.fillRect(pw - pw * 0.45, -ph, pw * 0.45, ph * 2);

            ctx.restore();

            // Hour Silkscreen Numeral & Brackets: [ 01 ], [ 12 ]
            const numR = R * 0.81;
            const hNum = i === 0 ? 12 : i;
            const nx = cx + cosA * numR;
            const ny = cy + sinA * numR;
            const txt = hNum < 10 ? `[ 0${hNum} ]` : `[ ${hNum} ]`;
            ctx.font = `bold ${Math.round(R * 0.068)}px "Space Grotesk", monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 5;
            ctx.fillText(txt, nx, ny);
        }

        ctx.restore();
        return off;
    }

    // ── Design 10: Gem Crown (multi-colored precious gem markers,
    //    prismatic bezel, iridescent face, faceted gem hour nodes) ──
    //
    // Gem palette: 4 cardinal gems + 8 interpolated intermediate stones.
    // Unlike every other design this face uses MULTIPLE hues rather than
    // deriving everything from the single accent tint.
    function buildFaceGemCrown(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        // ── Gem color map (12 o'clock positions, clockwise) ──
        // Cardinals: Diamond(12), Sapphire(3), Emerald(6), Ruby(9)
        // Intermediates: smooth HSL interpolations between neighbors
        const gemColors = [
            { h: 210, s: 8,  l: 88 }, // 12 — diamond
            { h: 240, s: 55, l: 72 }, //  1 — tanzanite
            { h: 225, s: 62, l: 66 }, //  2 — iolite
            { h: 215, s: 80, l: 62 }, //  3 — sapphire
            { h: 185, s: 65, l: 58 }, //  4 — aquamarine
            { h: 160, s: 60, l: 56 }, //  5 — tourmaline
            { h: 152, s: 58, l: 52 }, //  6 — emerald
            { h: 90,  s: 48, l: 56 }, //  7 — peridot
            { h: 40,  s: 60, l: 60 }, //  8 — citrine
            { h: 340, s: 65, l: 55 }, //  9 — ruby
            { h: 310, s: 45, l: 60 }, // 10 — amethyst
            { h: 280, s: 42, l: 66 }, // 11 — lavender
        ];
        function gemHSL(idx, alpha) {
            const g = gemColors[idx % 12];
            return alpha !== undefined
                ? `hsla(${g.h},${g.s}%,${g.l}%,${alpha})`
                : `hsl(${g.h},${g.s}%,${g.l}%)`;
        }

        // Smooth HSL interpolation across adjacent gems
        function getBlendedGemColor(frac12, alpha) {
            const mod = ((frac12 % 12) + 12) % 12;
            const i0 = Math.floor(mod);
            const i1 = (i0 + 1) % 12;
            const t = mod - i0;
            const g0 = gemColors[i0];
            const g1 = gemColors[i1];
            let dh = g1.h - g0.h;
            if (dh > 180) dh -= 360;
            if (dh < -180) dh += 360;
            const h = (g0.h + dh * t + 360) % 360;
            const s = g0.s + (g1.s - g0.s) * t;
            const l = g0.l + (g1.l - g0.l) * t;
            return alpha !== undefined
                ? `hsla(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%,${alpha})`
                : `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
        }

        // ── Iridescent face glow (multi-hue radial) ──
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.06);
        bg.addColorStop(0,    `rgba(${c.rgb},.08)`);
        bg.addColorStop(0.35, `hsla(280,30%,60%,.04)`);
        bg.addColorStop(0.55, `hsla(160,30%,55%,.03)`);
        bg.addColorStop(0.75, `hsla(215,35%,58%,.02)`);
        bg.addColorStop(1,    "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        // ── Outer bezel: prismatic double ring ──
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Inner bezel ring
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.895, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.18)`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();

        // ── Prismatic bezel fill: seamlessly blended rainbow crown ──
        ctx.save();
        if (typeof ctx.createConicGradient === "function") {
            const conic = ctx.createConicGradient(-Math.PI / 2, cx, cy);
            const numStops = 48;
            for (let s = 0; s <= numStops; s++) {
                const frac = s / numStops;
                conic.addColorStop(frac, getBlendedGemColor(frac * 12, 0.28));
            }
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.9225, 0, Math.PI * 2);
            ctx.strokeStyle = conic;
            ctx.lineWidth = R * 0.055;
            ctx.stroke();
        } else {
            const steps = 180;
            for (let i = 0; i < steps; i++) {
                const a0 = (i / steps) * Math.PI * 2 - Math.PI / 2;
                const a1 = ((i + 1.2) / steps) * Math.PI * 2 - Math.PI / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, R * 0.9225, a0, a1);
                ctx.strokeStyle = getBlendedGemColor((i / steps) * 12, 0.28);
                ctx.lineWidth = R * 0.055;
                ctx.stroke();
            }
        }
        ctx.restore();

        // ── 60 Chromatic minute dots (smoothly interpolated hues) ──
        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue;
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const gemFrac = (i / 60) * 12;
            ctx.save();
            ctx.beginPath();
            ctx.arc(
                cx + Math.cos(a) * R * 0.86,
                cy + Math.sin(a) * R * 0.86,
                R * 0.0055, 0, Math.PI * 2
            );
            ctx.fillStyle = getBlendedGemColor(gemFrac, 0.45);
            ctx.fill();
            ctx.restore();
        }

        // ── Concentric setting rings ──
        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.70, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.14)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.12)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // ── 12 Faceted Gem Hour Markers (Bespoke CyberGems Diamond Cut) ──
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const isCardinal = i % 3 === 0;
            const is12 = i === 0;
            const gx = cx + Math.cos(a) * R * 0.82;
            const gy = cy + Math.sin(a) * R * 0.82;
            const color = gemHSL(i);

            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(a + Math.PI / 2);

            if (is12) {
                // ── Position 12: Master CyberGems Official Logo Emblem ──
                // Exact official vector silhouette of CyberGems (C & G glyphs)
                // from the brand design system with gradient and crystalline glow.
                const CG_LOGO_SVG =
                    "M4.18,5.02L4.18,4.09C4.18,3.92 4.06,3.79 3.91,3.79L3.55,3.79C3.4,3.79 3.28,3.92 3.28,4.09L3.28,4.7C3.28,4.96 3.29,5.25 3.11,5.2C3.04,5.18 2.55,4.46 2.46,4.34C2.34,4.2 1.33,2.99 1.3,2.9C1.24,2.74 1.39,2.62 1.45,2.55L2.38,1.39C2.43,1.33 2.55,1.17 2.64,1.14C2.68,1.12 2.85,1.12 3.01,1.12C3.26,1.12 3.31,1.12 3.31,1.41C3.31,1.83 3.32,2.33 3.3,2.39L3.31,2.39C3.31,2.45 3.3,2.5 3.3,2.54C3.31,2.7 3.43,2.84 3.57,2.84L3.9,2.84C4.04,2.84 4.17,2.71 4.17,2.54L4.17,2.28C4.18,1.85 4.19,1.08 4.17,0.59L4.17,0.39C4.17,0.29 4.16,0.21 4.14,0.15C4.13,0.14 4.13,0.13 4.13,0.13C4.09,0.07 4.04,0.03 3.96,0.01C3.88,-0 3.33,0.01 3.03,0.01C2.78,-0 2.45,-0.01 2.29,0.02C2.09,0.06 1.89,0.36 1.76,0.52C1.69,0.62 1.61,0.72 1.53,0.81L0.13,2.55C-0.17,2.91 0.08,3.03 0.48,3.53C0.79,3.91 1.1,4.28 1.42,4.67C1.57,4.86 1.73,5.04 1.89,5.23C2.04,5.43 2.2,5.61 2.36,5.81C2.82,6.35 3.31,6.97 3.78,7.51C3.84,7.58 3.94,7.75 4.08,7.69C4.2,7.64 4.17,7.41 4.17,7.24C4.18,6.5 4.18,5.76 4.18,5.02ZM4.85,0.02C4.68,0.05 4.63,0.18 4.63,0.39L4.63,7.22C4.63,7.4 4.59,7.67 4.75,7.7C4.87,7.73 4.96,7.59 5.08,7.46C5.17,7.35 5.25,7.25 5.34,7.14C5.39,7.08 5.43,7.04 5.48,6.98L6.67,5.55C6.76,5.43 6.85,5.35 6.94,5.23L7.2,4.91C7.4,4.64 8.7,3.17 8.73,3.06C8.82,2.81 8.54,2.85 8.39,2.85L6.8,2.85L6.45,2.85C6.27,2.85 6.17,2.93 6.15,3.12C6.14,3.25 6.14,3.53 6.17,3.62C6.29,3.91 6.51,3.72 6.62,3.82C6.68,3.87 6.66,3.97 6.62,4.03C6.58,4.08 6.53,4.13 6.49,4.18L5.69,5.15C5.64,5.21 5.54,5.23 5.52,5.13C5.5,5.08 5.51,1.84 5.51,1.42C5.51,1.12 5.56,1.12 5.81,1.12C5.99,1.12 6.16,1.09 6.28,1.21C6.44,1.38 6.93,2.06 7.07,2.16C7.14,2.21 7.26,2.22 7.37,2.22C7.58,2.22 7.8,2.23 8,2.23C8.22,2.22 8.36,2.16 8.14,1.87C8.05,1.75 7.97,1.66 7.87,1.54C7.78,1.44 7.7,1.31 7.62,1.21L6.83,0.24C6.61,-0.07 6.42,0.01 5.94,0.01C5.77,0.01 4.94,-0 4.85,0.02Z";

                if (typeof Path2D !== "undefined") {
                    const cgPath = new Path2D(CG_LOGO_SVG);
                    const targetH = R * 0.112;
                    const s = targetH / 7.82;
                    ctx.scale(s, s);
                    ctx.translate(-4.325, -3.84);

                    // Official CyberGems Gradient (Electric purple to radiant cyan)
                    const grad = ctx.createLinearGradient(4.3, 7.8, 4.3, 0);
                    grad.addColorStop(0, "#7a5cff");
                    grad.addColorStop(0.45, "#38bdf8");
                    grad.addColorStop(1, "#00f2ff");

                    ctx.shadowColor = "#00f2ff";
                    ctx.shadowBlur = 18;
                    ctx.fillStyle = grad;
                    ctx.fill(cgPath);

                    // Specular edge definition
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
                    ctx.lineWidth = 0.28;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = "#ffffff";
                    ctx.stroke(cgPath);
                }
            } else {
                // ── Positions 1..11: 3D Faceted Brilliant Cut Diamonds ──
                const gSize = isCardinal ? R * 0.046 : R * 0.034;
                const wT = gSize * 0.58;   // table half-width
                const wG = gSize * 1.05;   // girdle half-width
                const hT = gSize * 0.80;   // top level (-hT)
                const hG = gSize * 0.20;   // girdle level (-hG)
                const hP = gSize * 1.18;   // culet point (+hP)
                const tH = -hG * 0.35;     // inner facet center

                // 1. Outer diamond silhouette with glow
                ctx.shadowColor = color;
                ctx.shadowBlur = isCardinal ? 14 : 8;

                // Left facet plane (light reflection side)
                ctx.beginPath();
                ctx.moveTo(-wT, -hT);
                ctx.lineTo(0, -hT);
                ctx.lineTo(0, tH);
                ctx.lineTo(-wT * 0.6, tH);
                ctx.lineTo(-wG, -hG);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.45);
                ctx.fill();

                // Right facet plane (body shade)
                ctx.beginPath();
                ctx.moveTo(0, -hT);
                ctx.lineTo(wT, -hT);
                ctx.lineTo(wG, -hG);
                ctx.lineTo(wT * 0.6, tH);
                ctx.lineTo(0, tH);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.28);
                ctx.fill();

                // Left lower pavilion facet
                ctx.beginPath();
                ctx.moveTo(-wG, -hG);
                ctx.lineTo(0, tH);
                ctx.lineTo(0, hP);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.38);
                ctx.fill();

                // Right lower pavilion facet
                ctx.beginPath();
                ctx.moveTo(wG, -hG);
                ctx.lineTo(0, tH);
                ctx.lineTo(0, hP);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.22);
                ctx.fill();

                // Table facet (crown brilliant kite)
                ctx.beginPath();
                ctx.moveTo(0, -hT * 0.96);
                ctx.lineTo(wT * 0.55, tH);
                ctx.lineTo(0, hG * 0.5);
                ctx.lineTo(-wT * 0.55, tH);
                ctx.closePath();
                ctx.fillStyle = "rgba(255,255,255,0.40)";
                ctx.fill();

                // Outer silhouette stroke
                ctx.beginPath();
                ctx.moveTo(-wT, -hT);
                ctx.lineTo(wT, -hT);
                ctx.lineTo(wG, -hG);
                ctx.lineTo(0, hP);
                ctx.lineTo(-wG, -hG);
                ctx.closePath();
                ctx.strokeStyle = color;
                ctx.lineWidth = isCardinal ? 1.6 : 1.2;
                ctx.stroke();

                // Fine internal facet lines
                ctx.beginPath();
                ctx.moveTo(-wT, -hT); ctx.lineTo(0, tH);
                ctx.moveTo(wT, -hT);  ctx.lineTo(0, tH);
                ctx.moveTo(-wG, -hG); ctx.lineTo(0, tH);
                ctx.moveTo(wG, -hG);  ctx.lineTo(0, tH);
                ctx.moveTo(0, hP);    ctx.lineTo(0, tH);
                ctx.strokeStyle = "rgba(255,255,255,0.35)";
                ctx.lineWidth = 0.8;
                ctx.shadowBlur = 0;
                ctx.stroke();

                // 4-Prong micro-chaton claws at the 4 key corners
                ctx.fillStyle = "rgba(255,255,255,0.90)";
                const pR = gSize * 0.08;
                const prongs = [
                    [-wT, -hT],
                    [wT, -hT],
                    [-wG, -hG],
                    [wG, -hG]
                ];
                for (let p = 0; p < 4; p++) {
                    ctx.beginPath();
                    ctx.arc(prongs[p][0], prongs[p][1], pR, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Central brilliance white spark
                ctx.beginPath();
                ctx.arc(0, tH * 0.8, gSize * 0.16, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.shadowColor = color;
                ctx.shadowBlur = isCardinal ? 10 : 5;
                ctx.fill();
            }

            ctx.restore();
        }

        return off;
    }

    function drawClock(ts, force) {

        const canvas = document.getElementById("clock-canvas");
        if (!canvas || curView !== "home" || !mainActive) {
            clockRaf = null;
            return;
        }
        // Schedule the next frame first, then bail out early if we are
        // still inside the current frame budget (framerate cap).
        if (!force) {
            clockRaf = requestAnimationFrame(drawClock);
        }
        if (ts === undefined) ts = performance.now();
        if (!force && ts - clockLastFrame < CLOCK_FRAME_MS - 0.5) {
            return;
        }
        clockLastFrame = ts;

        const ctx = canvas.getContext("2d");
        const W = canvas.width,
            H = canvas.height;
        const cx = W / 2,
            cy = H / 2,
            R = Math.min(W, H) * 0.46;
        const c = themeColors();

        const now = new Date();
        const ms = now.getMilliseconds();
        const sec = now.getSeconds() + ms / 1000;
        const min = now.getMinutes() + sec / 60;
        const hr = (now.getHours() % 12) + min / 60;
        const secA = (sec / 60) * Math.PI * 2 - Math.PI / 2;
        const minA = (min / 60) * Math.PI * 2 - Math.PI / 2;
        const hrA = (hr / 12) * Math.PI * 2 - Math.PI / 2;

        ctx.clearRect(0, 0, W, H);

        // Static face: rendered once to an offscreen canvas and reused
        // every frame (see buildClockFace). Rebuilt only when the canvas
        // size, accent color or dial design changes — the ticks/markers/
        // numerals and their shadowBlur strokes no longer redraw at 60fps.
        const design = currentClockDesign();
        const faceKey = `${W}x${H}|${c.accent}|${c.rgb}|d${design}`;
        if (faceKey !== clockFaceKey) {
            clockFaceCanvas = buildClockFace(W, H, cx, cy, R, c);
            clockFaceKey = faceKey;
        }
        ctx.drawImage(clockFaceCanvas, 0, 0);

        // ── Breathing outer rim highlight (signature glow) ──
        // Segments keeps the rim flat: its 60-segment ring IS the
        // second indicator, a second glow would fight it.
        if (design !== 3) {
            const rimR = design === 5 || design === 7 || design === 8 || design === 9 || design === 10 ? R * 0.94 : R * 0.985;
            const br =
                0.68 +
                0.18 * (1 - Math.cos((Date.now() * 2 * Math.PI) / 3200));
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, rimR, 0, Math.PI * 2);
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = design === 5 ? 2.5 : 2;
            ctx.globalAlpha = br;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = design === 5 ? 16 : 10;
            ctx.stroke();
            ctx.restore();
        }

        // ── Segments: 60-segment progress ring (design 3) ──
        // Lit segments = whole elapsed seconds; the leading segment
        // fills smoothly with the in-flight second, so the ring sweeps
        // once per minute exactly like the second hand it replaces.
        if (design === 3) {
            const segR = R * 0.885;
            const gap = (Math.PI * 2) / 240; // angular gap between segments
            const total = 60;
            for (let i = 0; i < total; i++) {
                const lit = sec >= i + 1;
                const partial = Math.min(1, Math.max(0, sec - i));
                const a0 = (i / total) * Math.PI * 2 - Math.PI / 2 + gap;
                const a1 = ((i + 1) / total) * Math.PI * 2 - Math.PI / 2 - gap;
                const alpha = lit ? 0.85 : 0.18 + partial * 0.67;
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, segR, a0, Math.max(a0 + 0.001, a1));
                ctx.strokeStyle = `rgba(${c.rgb},${alpha})`;
                ctx.lineWidth = R * 0.045;
                ctx.shadowColor = c.accent;
                ctx.shadowBlur = lit || partial > 0 ? 8 : 0;
                ctx.stroke();
                ctx.restore();
            }
        }

        // ── Quantum Orbit: Dynamic Rotating Quantum Arcs (design 5) ──
        if (design === 5) {
            const rot1 = ((Date.now() / 4800) % (Math.PI * 2));
            const rot2 = -((Date.now() / 6200) % (Math.PI * 2));
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.30)`;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 6;
            // Arc 1
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.60, rot1, rot1 + Math.PI * 0.7);
            ctx.stroke();
            // Arc 2
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.72, rot2, rot2 + Math.PI * 0.5);
            ctx.stroke();
            ctx.restore();
        }

        // ── Cyber Chrono: Dynamic Functional Subdial Needles (design 6) ──
        if (design === 6) {
            const sub1X = cx - R * 0.38, sub1Y = cy;
            const sub2X = cx + R * 0.38, sub2Y = cy;
            const subLen = R * 0.135;

            // Subdial 1: 24-Hour needle
            const a24 = (((now.getHours() % 24) + min / 60) / 24) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.6;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.moveTo(sub1X - Math.cos(a24) * (subLen * 0.25), sub1Y - Math.sin(a24) * (subLen * 0.25));
            ctx.lineTo(sub1X + Math.cos(a24) * subLen, sub1Y + Math.sin(a24) * subLen);
            ctx.stroke();
            // Pivot pin
            ctx.beginPath();
            ctx.arc(sub1X, sub1Y, R * 0.015, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();

            // Subdial 2: 60-Second telemetry needle
            const a60 = (sec / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(sub2X - Math.cos(a60) * (subLen * 0.25), sub2Y - Math.sin(a60) * (subLen * 0.25));
            ctx.lineTo(sub2X + Math.cos(a60) * subLen, sub2Y + Math.sin(a60) * subLen);
            ctx.stroke();
            // Pivot pin
            ctx.beginPath();
            ctx.arc(sub2X, sub2Y, R * 0.015, 0, Math.PI * 2);
            ctx.fillStyle = c.handSec;
            ctx.fill();
            ctx.restore();
        }

        // ── Reactor Core: Dynamic Plasma Vortex & Flux Pulse (design 8) ──
        if (design === 8) {
            const plasmaRot = ((Date.now() / 4200) % (Math.PI * 2));
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.35)`;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 8;
            // Inner plasma vortex arcs
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.26, plasmaRot, plasmaRot + Math.PI * 0.6);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.26, plasmaRot + Math.PI, plasmaRot + Math.PI * 1.6);
            ctx.stroke();
            // Core breathing energy glow
            const pulse = 0.10 + 0.08 * (1 + Math.sin(Date.now() / 500));
            ctx.fillStyle = `rgba(${c.rgb},${pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── Circuit PCB: Dynamic Clock Signal Activity (design 9) ──
        if (design === 9) {
            const pulseStep = Math.floor((Date.now() / 400) % 4);
            const cardAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
            const a = cardAngles[pulseStep];
            const px = cx + Math.cos(a) * (R * 0.52);
            const py = cy + Math.sin(a) * (R * 0.52);
            ctx.save();
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, R * 0.016, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── Gem Crown: Prismatic sparkle sweep (design 10) ──
        // A highlight "spark" travels around the gem crown ring,
        // illuminating each gem as it passes (one revolution per 12s)
        if (design === 10) {
            const sparkAngle = ((Date.now() / 12000) % 1) * Math.PI * 2 - Math.PI / 2;
            const sparkR = R * 0.82;
            const sparkX = cx + Math.cos(sparkAngle) * sparkR;
            const sparkY = cy + Math.sin(sparkAngle) * sparkR;
            const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, R * 0.15);
            sparkGrad.addColorStop(0, "rgba(255,255,255,0.35)");
            sparkGrad.addColorStop(0.4, "rgba(255,255,255,0.10)");
            sparkGrad.addColorStop(1, "transparent");
            ctx.save();
            ctx.fillStyle = sparkGrad;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, R * 0.15, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Brand wordmark — pendulum sweep: a soft glow walks across the
        // word one letter per exact second, swinging left↔right like a
        // metronome. The text is user-editable (settings: clockBrand);
        // empty falls back to the default, and it is always uppercased.
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const rawBrand = (cfg.clockBrand || "").trim();
        const word = (rawBrand || "CYBERGEMS").toUpperCase().slice(0, 16);
        const tracking = R * 0.004;
        const fontLoaded = document.fonts ? document.fonts.check("16px Orbitron") : true;
        const gemsKey = `${R}|${tracking}|${word}|${fontLoaded}`;
        if (gemsKey !== cybergemsCacheKey) {
            cybergemsCacheKey = gemsKey;
            // Start at the nominal size, then shrink to fit the dial so long
            // names never overflow the face. Measured with the real font so
            // the fit is exact per glyph.
            let fontPx = R * 0.066;
            const maxWidth = R * 1.18;
            const measure = (px) => {
                ctx.font = `${px}px Orbitron,monospace`;
                const widths = [];
                let total = 0;
                for (let i = 0; i < word.length; i++) {
                    widths.push(ctx.measureText(word[i]).width);
                    total += widths[i] + (i < word.length - 1 ? tracking : 0);
                }
                return { widths, total };
            };
            let m = measure(fontPx);
            if (m.total > maxWidth && m.total > 0) {
                fontPx *= maxWidth / m.total;
                m = measure(fontPx);
            }
            cybergemsFontPx = fontPx;
            cybergemsWidths = m.widths;
            cybergemsTotal = m.total;
        }
        ctx.font = `${cybergemsFontPx}px Orbitron,monospace`;
        const widths = cybergemsWidths;
        const total = cybergemsTotal;
        // Triangle wave: 0→span then span→0, advancing one unit per second,
        // so the peak lands exactly on a letter on every whole second and
        // works for any word length.
        const span = word.length - 1;
        const per = span * 2;
        const ph = per > 0 ? sec % per : 0;
        const center = span > 0 ? (ph <= span ? ph : per - ph) : 0;
        const wy = cy + R * 0.44;
        let wx = cx - total / 2;
        for (let i = 0; i < word.length; i++) {
            const lit = Math.max(0, 1 - Math.abs(i - center) / 1.7);
            const a = 0.34 + 0.58 * lit;
            ctx.fillStyle = `rgba(${c.rgb},${a})`;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 2 + 6 * lit;
            ctx.fillText(word[i], wx, wy);
            wx += widths[i] + tracking;
        }
        ctx.restore();

        // Hands — per-design character:
        // 1 (Classic), 3 (Segments): standard cast-shadowed hands
        // 2 (Minimal): slim glow-only hands
        // 4 (HUD): angular HUD vector indicators
        // 5 (Quantum): energy lance hands with diamond aperture + comet second tracer
        // 6 (Chrono): faceted skeleton sword hands with lume windows + precision second needle
        // 7 (Hex Matrix): stealth angular arrowhead vector hands
        if (design === 2) {
            hand(ctx, cx, cy, hrA, R * 0.50, 2.5, c.accent, 8);
            hand(ctx, cx, cy, minA, R * 0.74, 2, c.accent, 6);
            hand(ctx, cx, cy, secA, R * 0.85, 1, c.handSec, 10);
        } else if (design === 4) {
            hudHand(ctx, cx, cy, hrA, R * 0.52, R * 0.10, 3.5, c.accent);
            hudHand(ctx, cx, cy, minA, R * 0.74, R * 0.12, 3, c.accent);
            hudHand(ctx, cx, cy, secA, R * 0.86, R * 0.14, 1.5, c.handSec);
        } else if (design === 5) {
            quantumHand(ctx, cx, cy, hrA, R * 0.50, 4.0, c.accent);
            quantumHand(ctx, cx, cy, minA, R * 0.74, 2.8, c.accent);
            // Quantum Second hand: laser beam with comet tracer at tip & diamond tail
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.84), cy + Math.sin(secA) * (R * 0.84));
            ctx.stroke();

            // Orbital Comet node at second tip
            const stx = cx + Math.cos(secA) * (R * 0.84);
            const sty = cy + Math.sin(secA) * (R * 0.84);
            ctx.beginPath();
            ctx.arc(stx, sty, R * 0.02, 0, Math.PI * 2);
            ctx.fillStyle = c.handSec;
            ctx.shadowBlur = 16;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(stx, sty, R * 0.009, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.restore();
        } else if (design === 6) {
            chronoHand(ctx, cx, cy, hrA, R * 0.50, 5.2, c.accent);
            chronoHand(ctx, cx, cy, minA, R * 0.74, 3.8, c.accent);
            // Chrono Second needle with circular balance ring
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.16), cy - Math.sin(secA) * (R * 0.16));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.85), cy + Math.sin(secA) * (R * 0.85));
            ctx.stroke();
            // Balance ring
            const bx = cx - Math.cos(secA) * (R * 0.09);
            const by = cy - Math.sin(secA) * (R * 0.09);
            ctx.beginPath();
            ctx.arc(bx, by, R * 0.024, 0, Math.PI * 2);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        } else if (design === 7) {
            matrixHand(ctx, cx, cy, hrA, R * 0.48, 5.0, c.accent);
            matrixHand(ctx, cx, cy, minA, R * 0.72, 3.5, c.accent);
            // Matrix Second needle with chevron arrow tip
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.83), cy + Math.sin(secA) * (R * 0.83));
            ctx.stroke();
            // Chevron arrow tip
            const sx = cx + Math.cos(secA) * (R * 0.83);
            const sy = cy + Math.sin(secA) * (R * 0.83);
            ctx.translate(sx, sy);
            ctx.rotate(secA + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(-R * 0.022, R * 0.025);
            ctx.lineTo(0, -R * 0.02);
            ctx.lineTo(R * 0.022, R * 0.025);
            ctx.stroke();
            ctx.restore();
        } else if (design === 8) {
            reactorHand(ctx, cx, cy, hrA, R * 0.50, 4.8, c.accent);
            reactorHand(ctx, cx, cy, minA, R * 0.74, 3.4, c.accent);
            // Reactor Core second hand: high-energy ion beam with plasma particle tip
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.16), cy - Math.sin(secA) * (R * 0.16));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.86), cy + Math.sin(secA) * (R * 0.86));
            ctx.stroke();
            // Ion particle at tip
            const ix = cx + Math.cos(secA) * (R * 0.86);
            const iy = cy + Math.sin(secA) * (R * 0.86);
            ctx.beginPath();
            ctx.arc(ix, iy, R * 0.016, 0, Math.PI * 2);
            ctx.fillStyle = c.handSec;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ix, iy, R * 0.007, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.restore();
        } else if (design === 9) {
            circuitHand(ctx, cx, cy, hrA, R * 0.48, 5.2, c.accent);
            circuitHand(ctx, cx, cy, minA, R * 0.72, 3.6, c.accent);
            // Circuit PCB second hand: precision gold probe needle with SMD square balance
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.85), cy + Math.sin(secA) * (R * 0.85));
            ctx.stroke();
            // SMD balance square at tail
            const bx = cx - Math.cos(secA) * (R * 0.10);
            const by = cy - Math.sin(secA) * (R * 0.10);
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(secA);
            ctx.beginPath();
            const sq = R * 0.016;
            ctx.rect(-sq, -sq, sq * 2, sq * 2);
            ctx.fillStyle = c.handSec;
            ctx.fill();
            ctx.restore();
            ctx.restore();
        } else if (design === 10) {
            gemHand(ctx, cx, cy, hrA, R * 0.50, 4.0, c.accent);
            gemHand(ctx, cx, cy, minA, R * 0.74, 2.8, c.accent);
            // Gem Crown second hand: slim needle with gem tip
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.84), cy + Math.sin(secA) * (R * 0.84));
            ctx.stroke();
            // Small gem at second tip
            const gtx = cx + Math.cos(secA) * (R * 0.84);
            const gty = cy + Math.sin(secA) * (R * 0.84);
            ctx.beginPath();
            ctx.save();
            ctx.translate(gtx, gty);
            ctx.rotate(secA + Math.PI / 2);
            for (let k = 0; k < 4; k++) {
                const ang = (k / 4) * Math.PI * 2;
                const px = Math.cos(ang) * R * 0.018;
                const py = Math.sin(ang) * R * 0.018;
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = c.handSec;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.007, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.restore();
            ctx.restore();
        } else {
            hand(ctx, cx, cy, hrA, R * 0.52, 5.5, c.accent, 10);
            hand(ctx, cx, cy, minA, R * 0.74, 3.5, c.accent, 8);
            hand(ctx, cx, cy, secA, R * 0.83, 1.5, c.handSec, 12);
            hand(ctx, cx, cy, secA + Math.PI, R * 0.14, 3.5, c.handSec, 8);
        }

        // Center jewel — per-design finish
        ctx.save();
        ctx.shadowColor = c.accent;
        if (design === 2) {
            // Minimal: single clean dot
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.018, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
        } else if (design === 5) {
            // Quantum: pulsing multi-ring particle core
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.038, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.rgb},.30)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.024, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.012, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        } else if (design === 6) {
            // Chrono: knurled precision chronograph pivot
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.032, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.rgb},.40)`;
            ctx.fill();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.014, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        } else if (design === 7) {
            // Hex Matrix: glowing 6-sided crystal polygon
            ctx.shadowBlur = 14;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const ang = (k / 6) * Math.PI * 2 + Math.PI / 6;
                const hx = cx + Math.cos(ang) * R * 0.034;
                const hy = cy + Math.sin(ang) * R * 0.034;
                if (k === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.012, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
        } else if (design === 8) {
            // Reactor Core: pulsing tokamak core with concentric plasma containment rings
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.038, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.rgb},.35)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.022, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.010, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        } else if (design === 9) {
            // Circuit PCB: gold-plated square CPU die cap with pin 1 marker
            ctx.shadowBlur = 10;
            const dieSz = R * 0.032;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath();
            ctx.rect(-dieSz, -dieSz, dieSz * 2, dieSz * 2);
            ctx.fillStyle = "#1e222a";
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            // Pin 1 dot
            ctx.beginPath();
            ctx.arc(-dieSz * 0.52, -dieSz * 0.52, R * 0.005, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();
        } else if (design === 10) {
            // Gem Crown: enlarged luxury prismatic jewel center with
            // a wider orbiting halo of faceted gem satellites and
            // counter-rotating light facets around the hand base.
            const jewR = R * 0.050;
            const orbitR = R * 0.098;
            const haloAngle = (Date.now() / 6500) * Math.PI * 2;
            const rayAngle = -(Date.now() / 9000) * Math.PI * 2;
            const hues = [210, 215, 152, 40, 340, 280]; // Diamond, Sapphire, Emerald, Citrine, Ruby, Amethyst

            // 1. Delicate orbital track
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c.rgb},.16)`;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // 2. Counter-rotating inner micro-rays (light refraction facets)
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.22)`;
            ctx.lineWidth = 1;
            for (let k = 0; k < 6; k++) {
                const a = rayAngle + (k / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * jewR * 1.12, cy + Math.sin(a) * jewR * 1.12);
                ctx.lineTo(cx + Math.cos(a) * (orbitR * 0.84), cy + Math.sin(a) * (orbitR * 0.84));
                ctx.stroke();
            }
            ctx.restore();

            // 3. Orbiting faceted gem satellites (larger, brilliant stones)
            const satR = R * 0.013;
            for (let k = 0; k < 6; k++) {
                const ang = haloAngle + (k / 6) * Math.PI * 2;
                const hx = cx + Math.cos(ang) * orbitR;
                const hy = cy + Math.sin(ang) * orbitR;
                const hue = hues[k];

                ctx.save();
                ctx.translate(hx, hy);
                ctx.rotate(ang + Math.PI / 4);

                // Faceted diamond shape
                ctx.beginPath();
                ctx.moveTo(satR * 1.25, 0);
                ctx.lineTo(0, satR * 1.25);
                ctx.lineTo(-satR * 1.25, 0);
                ctx.lineTo(0, -satR * 1.25);
                ctx.closePath();
                ctx.fillStyle = `hsla(${hue},70%,62%,0.75)`;
                ctx.shadowColor = `hsl(${hue},75%,60%)`;
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.strokeStyle = `hsl(${hue},80%,75%)`;
                ctx.lineWidth = 1.1;
                ctx.stroke();

                // Sparkle brilliance core
                ctx.beginPath();
                ctx.arc(0, 0, satR * 0.38, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.92)";
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.restore();
            }

            // 4. Central faceted gem body
            ctx.save();
            ctx.shadowBlur = 18;
            ctx.shadowColor = c.accent;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const ang = (k / 6) * Math.PI * 2 + Math.PI / 6;
                const gx = cx + Math.cos(ang) * jewR;
                const gy = cy + Math.sin(ang) * jewR;
                if (k === 0) ctx.moveTo(gx, gy);
                else ctx.lineTo(gx, gy);
            }
            ctx.closePath();
            ctx.fillStyle = `rgba(${c.rgb},.42)`;
            ctx.fill();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Internal facet cuts (gem table cut)
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const ang = (k / 6) * Math.PI * 2 + Math.PI / 6;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(ang) * jewR, cy + Math.sin(ang) * jewR);
            }
            ctx.strokeStyle = "rgba(255,255,255,0.30)";
            ctx.lineWidth = 0.9;
            ctx.shadowBlur = 0;
            ctx.stroke();

            // Center brilliance table
            ctx.beginPath();
            ctx.arc(cx, cy, jewR * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.restore();
        } else {
            // Classic & HUD: layered jeweled cap
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.028, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.048, 0, Math.PI * 2);
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.016, 0, Math.PI * 2);
            ctx.fillStyle = "white";
            ctx.globalAlpha = 0.55;
            ctx.fill();
        }
        ctx.restore();
    }

    // ── Quantum Energy Lance Hand (Design 5) ──
    function quantumHand(ctx, cx, cy, angle, len, width, color) {
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const baseLen = len * 0.14;
        const apPos = len * 0.68;
        const apSize = width * 1.5;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        // Base shaft
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (apPos - apSize), cy + uy * (apPos - apSize));
        ctx.stroke();

        // Diamond aperture
        const ax = cx + ux * apPos;
        const ay = cy + uy * apPos;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -apSize);
        ctx.lineTo(apSize * 0.8, 0);
        ctx.lineTo(0, apSize);
        ctx.lineTo(-apSize * 0.8, 0);
        ctx.closePath();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, apSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tip lance
        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * (apPos + apSize), cy + uy * (apPos + apSize));
        ctx.lineTo(cx + ux * len, cy + uy * len);
        ctx.stroke();

        ctx.restore();
    }

    // ── Skeleton Sword Chrono Hand (Design 6) ──
    function chronoHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        const w2 = width / 2;
        const baseLen = len * 0.16;

        // Counterweight tail
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, baseLen);
        ctx.stroke();

        // Skeleton sword blade with lume window
        ctx.beginPath();
        ctx.moveTo(-w2, 0);
        ctx.lineTo(-w2, -len * 0.78);
        ctx.lineTo(0, -len);
        ctx.lineTo(w2, -len * 0.78);
        ctx.lineTo(w2, 0);
        ctx.closePath();
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Lume window cutout
        ctx.beginPath();
        ctx.moveTo(-w2 * 0.5, -len * 0.25);
        ctx.lineTo(-w2 * 0.5, -len * 0.70);
        ctx.lineTo(0, -len * 0.78);
        ctx.lineTo(w2 * 0.5, -len * 0.70);
        ctx.lineTo(w2 * 0.5, -len * 0.25);
        ctx.closePath();
        ctx.stroke();

        // Luminous pointer tip
        ctx.beginPath();
        ctx.moveTo(-w2 * 0.6, -len * 0.80);
        ctx.lineTo(0, -len * 0.96);
        ctx.lineTo(w2 * 0.6, -len * 0.80);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.restore();
    }

    // ── Stealth Arrowhead Matrix Hand (Design 7) ──
    function matrixHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        const w = width * 1.6;
        const baseLen = len * 0.15;

        // Tail
        ctx.lineWidth = width * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, baseLen);
        ctx.stroke();

        // Chevron vector shaft
        ctx.lineWidth = width * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len * 0.62);
        ctx.stroke();

        // Stealth Arrowhead Tip
        ctx.beginPath();
        ctx.moveTo(-w, -len * 0.60);
        ctx.lineTo(0, -len);
        ctx.lineTo(w, -len * 0.60);
        ctx.lineTo(0, -len * 0.72);
        ctx.closePath();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, 0.45)`;
        ctx.fill();

        ctx.restore();
    }

    // ── Reactor Core Hand (Design 8) ──
    // Tapered dual-rail ion-channel lance with luminescent tip and industrial counterweight
    function reactorHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        // Base counterweight notch
        ctx.lineWidth = width * 1.2;
        ctx.beginPath();
        ctx.moveTo(-width * 0.8, len * 0.16);
        ctx.lineTo(width * 0.8, len * 0.16);
        ctx.lineTo(width * 0.5, 0);
        ctx.lineTo(-width * 0.5, 0);
        ctx.closePath();
        ctx.fill();

        // Main dual-rail magnetic blade
        ctx.lineWidth = width * 0.45;
        const w = width * 0.7;
        ctx.beginPath();
        ctx.moveTo(-w, 0);
        ctx.lineTo(-w * 0.35, -len * 0.74);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(w * 0.35, -len * 0.74);
        ctx.stroke();

        // Core plasma emitter tip
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, -len * 0.72);
        ctx.lineTo(0, -len);
        ctx.lineTo(w * 0.5, -len * 0.72);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.restore();
    }

    // ── Circuit PCB Hand (Design 9) ──
    // Copper PCB bus trace with plated solder contact pad and 45-degree chamfered arrow
    function circuitHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        // Tail via pad (circular ring with inner hole)
        const tailLen = len * 0.15;
        ctx.beginPath();
        ctx.arc(0, tailLen, width * 0.85, 0, Math.PI * 2);
        ctx.lineWidth = width * 0.4;
        ctx.stroke();

        // Main trace bus
        ctx.lineWidth = width * 0.65;
        ctx.beginPath();
        ctx.moveTo(0, tailLen - width * 0.85);
        ctx.lineTo(0, -len * 0.65);
        ctx.stroke();

        // SMD Component contact block at 65% mark
        const padY = -len * 0.65;
        const pw = width * 1.1;
        const ph = len * 0.12;
        ctx.beginPath();
        ctx.rect(-pw, padY - ph, pw * 2, ph);
        ctx.fillStyle = "#1e222a";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Solder fillets
        ctx.fillStyle = color;
        ctx.fillRect(-pw, padY - ph, pw * 2, ph * 0.28);
        ctx.fillRect(-pw, padY - ph * 0.28, pw * 2, ph * 0.28);

        // 45-degree chamfered arrow tip
        ctx.beginPath();
        ctx.moveTo(-width * 0.6, padY - ph);
        ctx.lineTo(0, -len);
        ctx.lineTo(width * 0.6, padY - ph);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.restore();
    }

    // ── Gem Crown Hand (Design 10) ──
    // Slim polished hand with a small hexagonal gem set near the tip,
    // evoking haute horlogerie jewelled hands.
    function gemHand(ctx, cx, cy, angle, len, width, color) {
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const baseLen = len * 0.14;
        const gemPos = len * 0.72;
        const gemR = width * 1.2;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        // Base shaft
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (gemPos - gemR * 1.2), cy + uy * (gemPos - gemR * 1.2));
        ctx.stroke();

        // Diamond cut gem setting
        const gx = cx + ux * gemPos;
        const gy = cy + uy * gemPos;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(angle + Math.PI / 2);

        const wT = gemR * 0.60;
        const wG = gemR * 1.05;
        const hT = gemR * 0.80;
        const hG = gemR * 0.20;
        const hP = gemR * 1.15;

        ctx.beginPath();
        ctx.moveTo(-wT, -hT);
        ctx.lineTo(wT, -hT);
        ctx.lineTo(wG, -hG);
        ctx.lineTo(0, hP);
        ctx.lineTo(-wG, -hG);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.40;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Facet lines
        ctx.beginPath();
        ctx.moveTo(-wT, -hT); ctx.lineTo(0, 0);
        ctx.moveTo(wT, -hT);  ctx.lineTo(0, 0);
        ctx.moveTo(-wG, -hG); ctx.lineTo(0, 0);
        ctx.moveTo(wG, -hG);  ctx.lineTo(0, 0);
        ctx.moveTo(0, hP);    ctx.lineTo(0, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 0.8;
        ctx.shadowBlur = 0;
        ctx.stroke();

        // Gem brilliance
        ctx.beginPath();
        ctx.arc(0, 0, gemR * 0.30, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        // Tip lance past the gem
        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * (gemPos + gemR * 1.2), cy + uy * (gemPos + gemR * 1.2));
        ctx.lineTo(cx + ux * len, cy + uy * len);
        ctx.stroke();

        ctx.restore();
    }

    // Angular HUD hand: a short base bar, a gap, then the pointed tip
    // segment — reads as a vector indicator, not a physical needle.
    function hudHand(ctx, cx, cy, angle, len, tipLen, width, color) {
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        // Base-bar counterweight length, relative to the hand length so
        // all three hands share the same proportion at any dial size.
        const baseLen = len * 0.12;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 9;
        ctx.lineCap = "butt";
        // Base bar
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (len - tipLen), cy + uy * (len - tipLen));
        ctx.stroke();
        // Tip segment, slightly thinner and brighter
        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * len, cy + uy * len);
        ctx.lineTo(cx + ux * (len - tipLen), cy + uy * (len - tipLen));
        ctx.stroke();
        ctx.restore();
    }

    function hand(ctx, cx, cy, angle, len, width, color, blur) {
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;

        // Cast shadow: single light from above → shadow falls down-right.
        // Offset scales with hand thickness so the bolder hour hand sits
        // visibly higher above the face than the slim second hand.
        ctx.save();
        ctx.translate(width * 0.7, width * 1.3);
        ctx.strokeStyle = "rgba(0,0,0,.45)";
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();

        // Glowing hand at its true position, floating above the shadow.
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
    }

    function startClockAnim() {
        if (!mainActive || curView !== "home") return;
        if (!clockRaf) drawClock();
    }
    function stopClockAnim() {
        if (clockRaf) {
            cancelAnimationFrame(clockRaf);
            clockRaf = null;
        }
    }

    // ══════════════════════════════════════════════════════════════
    // CALENDAR
    // ══════════════════════════════════════════════════════════════
    let calYear,
        calMonth,
        selDate = null,
        calNotes = {};

    // ISO date key "YYYY-MM-DD" (m is 0-based)
    function isoKey(y, m, d) {
        return `${y}-${pad(m + 1)}-${pad(d)}`;
    }

    function renderCalendar() {
        const container = document.getElementById("cal-months");
        container.innerHTML = "";
        const today = new Date();
        for (let off = -1; off <= 1; off++) {
            let y = calYear,
                m = calMonth + off;
            if (m < 0) {
                m = 11;
                y--;
            }
            if (m > 11) {
                m = 0;
                y++;
            }
            const col = document.createElement("div");
            col.className = "cal-month" + (off === 0 ? "" : " adj");
            const hdr = document.createElement("div");
            hdr.className = "cal-mhdr";
            const monthsLong = getCalMonthsLong();
            hdr.textContent = `${monthsLong[m]} ${y}`;
            col.appendChild(hdr);
            const dlRow = document.createElement("div");
            dlRow.className = "cal-dhdr";
            getCalDays().forEach((l) => {
                const d = document.createElement("div");
                d.className = "cal-dlbl";
                d.textContent = l;
                dlRow.appendChild(d);
            });
            col.appendChild(dlRow);
            const grid = document.createElement("div");
            grid.className = "cal-grid";
            const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
            for (let i = 0; i < startDow; i++) {
                const d = document.createElement("div");
                d.className = "cal-day om";
                grid.appendChild(d);
            }
            const lastDay = new Date(y, m + 1, 0).getDate();
            for (let d = 1; d <= lastDay; d++) {
                const cell = document.createElement("div");
                cell.className = "cal-day";
                cell.textContent = d;
                const key = isoKey(y, m, d);
                if (
                    y === today.getFullYear() &&
                    m === today.getMonth() &&
                    d === today.getDate()
                )
                    cell.classList.add("today");
                if (selDate === key) cell.classList.add("sel");
                if (calNotes[key] && calNotes[key].trim())
                    cell.classList.add("has-note");
                const cy = y,
                    cm = m,
                    cd = d;
                cell.addEventListener("click", () => {
                    document
                        .querySelectorAll(".cal-day.sel")
                        .forEach((c) => c.classList.remove("sel"));
                    cell.classList.add("sel");
                    selDate = key;
                    openNoteModal(cy, cm, cd);
                });
                cell.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Right-click on a day with a note → quick-delete it.
                    const ck = isoKey(cy, cm, cd);
                    if (calNotes[ck] && calNotes[ck].trim()) {
                        delete calNotes[ck];
                        persistNotes();
                        renderCalendar();
                    }
                });
                grid.appendChild(cell);
            }
            col.appendChild(grid);
            container.appendChild(col);
        }
        renderDashboard();
    }

    document
        .getElementById("cal-prev")
        .addEventListener("click", () => {
            calMonth--;
            if (calMonth < 0) {
                calMonth = 11;
                calYear--;
            }
            renderCalendar();
        });
    document
        .getElementById("cal-next")
        .addEventListener("click", () => {
            calMonth++;
            if (calMonth > 11) {
                calMonth = 0;
                calYear++;
            }
            renderCalendar();
        });
        document
            .getElementById("cal-today")
            .addEventListener("click", () => {
                const t = new Date();
                calYear = t.getFullYear();
                calMonth = t.getMonth();
                renderCalendar();
            });
        const calFloatBtn = document.getElementById("cal-float-btn");
        if (calFloatBtn) {
            calFloatBtn.addEventListener("click", () => {
                if (window.cc && window.cc.spawnFloat) {
                    window.cc.spawnFloat("cal");
                }
            });
        }

    // ── Note modal ────────────────────────────────────────────────
    let noteEditKey = null;

    function longDateLabel(y, m, d) {
        const dt = new Date(y, m, d);
        const lang = window.ccI18n.getEffectiveLang();
        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = dt.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }

    function updateNoteCharCounter() {
        const ta = document.getElementById("note-text");
        const counter = document.getElementById("note-char-counter");
        const saveBtn = document.getElementById("note-save");
        if (!ta) return;
        const text = ta.value;
        const len = text.length;
        if (counter) {
            counter.textContent = `${len} / 500`;
            counter.classList.toggle("warning", len >= 420 && len < 490);
            counter.classList.toggle("limit", len >= 490);
        }
        if (saveBtn) {
            saveBtn.disabled = text.trim().length === 0;
        }
    }

    function openNoteModal(y, m, d) {
        noteEditKey = isoKey(y, m, d);
        document.getElementById("note-date-lbl").textContent =
            longDateLabel(y, m, d);
        const ta = document.getElementById("note-text");
        ta.value = calNotes[noteEditKey] || "";
        updateNoteCharCounter();
        document.getElementById("note-delete").style.display = (
            calNotes[noteEditKey] || ""
        ).trim()
            ? ""
            : "none";
        document.getElementById("note-overlay").classList.add("open");
        setTimeout(() => ta.focus(), 60);
    }

    function closeNoteModal() {
        document
            .getElementById("note-overlay")
            .classList.remove("open");
        noteEditKey = null;
    }

    function persistNotes() {
        window.cc.saveSettings({ calendarNotes: calNotes });
    }

    function saveNote() {
        if (!noteEditKey) return;
        const text = document.getElementById("note-text").value.trim();
        if (!text) return;
        calNotes[noteEditKey] = text;
        persistNotes();
        closeNoteModal();
        renderCalendar();
    }

    function deleteNote() {
        if (!noteEditKey) return;
        delete calNotes[noteEditKey];
        persistNotes();
        closeNoteModal();
        renderCalendar();
    }

    document
        .getElementById("note-save")
        .addEventListener("click", saveNote);
    document
        .getElementById("note-delete")
        .addEventListener("click", deleteNote);
    document
        .getElementById("note-cancel")
        .addEventListener("click", closeNoteModal);
    document
        .getElementById("note-close")
        .addEventListener("click", closeNoteModal);
    document
        .getElementById("note-text")
        .addEventListener("input", updateNoteCharCounter);
    document
        .getElementById("note-overlay")
        .addEventListener("click", (e) => {
            if (e.target === e.currentTarget) closeNoteModal();
        });
    document
        .getElementById("note-text")
        .addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveNote();
            } else if (e.key === "Escape") {
                e.preventDefault();
                closeNoteModal();
            }
        });
    document
        .getElementById("note-overlay")
        .addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                closeNoteModal();
            }
        });

    // ── Event deletion confirmation ────────────────────────────────
    // ── Confirmation modal ─────────────────────────────────────────
    let eventDeleteKey = null;
    let confirmCustomCallback = null;

    function showConfirmModal(key) {
        eventDeleteKey = key;
        confirmCustomCallback = null;
        document.getElementById("confirm-title-lbl").textContent = window.ccI18n.t("calendar.confirmDeleteTitle");
        document.getElementById("confirm-msg-lbl").textContent = window.ccI18n.t("calendar.confirmDeleteMsg");
        document.getElementById("confirm-ok").textContent = window.ccI18n.t("calendar.delete");
        document.getElementById("confirm-overlay").classList.add("open");
    }

    function openCustomConfirm({ title, msg, okText, onOk }) {
        eventDeleteKey = null;
        confirmCustomCallback = onOk;
        document.getElementById("confirm-title-lbl").textContent = title;
        document.getElementById("confirm-msg-lbl").textContent = msg;
        document.getElementById("confirm-ok").textContent = okText;
        document.getElementById("confirm-overlay").classList.add("open");
    }

    function closeConfirmModal() {
        document.getElementById("confirm-overlay").classList.remove("open");
        eventDeleteKey = null;
        confirmCustomCallback = null;
    }

    document.getElementById("confirm-ok").addEventListener("click", async () => {
        if (confirmCustomCallback) {
            const cb = confirmCustomCallback;
            closeConfirmModal();
            await cb();
        } else if (eventDeleteKey) {
            delete calNotes[eventDeleteKey];
            persistNotes();
            closeConfirmModal();
            renderCalendar();
        }
    });

    document.getElementById("confirm-cancel").addEventListener("click", closeConfirmModal);
    document.getElementById("confirm-close").addEventListener("click", closeConfirmModal);
    document.getElementById("confirm-overlay").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeConfirmModal();
    });

    // ── Dashboard: Agenda (upcoming notes) + Today stats ──────────
    const MOON_SVGS = [
        // 0: New Moon
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" stroke="var(--border-bright)" stroke-width="1.2" fill="rgba(var(--rgb-accent), 0.08)" style="filter:drop-shadow(0 0 2px var(--border-bright));" /></svg>`,
        // 1: Waxing Crescent
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 1 12 20 A 4 8 0 0 0 12 4" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`,
        // 2: First Quarter
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 1 12 20 Z" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`,
        // 3: Waxing Gibbous
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 1 12 20 A 4 8 0 0 1 12 4 Z" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`,
        // 4: Full Moon
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="var(--accent-a)" stroke="var(--accent-a)" stroke-width="1" style="filter:drop-shadow(0 0 4px var(--accent-a));" /></svg>`,
        // 5: Waning Gibbous
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 0 12 20 A 4 8 0 0 0 12 4 Z" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`,
        // 6: Last Quarter
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 0 12 20 Z" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`,
        // 7: Waning Crescent
        `<svg viewBox="0 0 24 24" class="moon-svg" style="width:16px;height:16px;overflow:visible;"><circle cx="12" cy="12" r="8" fill="rgba(var(--rgb-accent), 0.08)" stroke="var(--border)" stroke-width="1" /><path d="M 12 4 A 8 8 0 0 0 12 20 A 4 8 0 0 1 12 4" fill="var(--accent-a)" style="filter:drop-shadow(0 0 3px var(--accent-a));" /></svg>`
    ];

    function isoWeek(date) {
        const t = new Date(
            Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
        );
        // Thursday of the current week determines the ISO year/week
        t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    }

    function moonPhaseIdx(date) {
        const synodic = 29.53058867;
        const ref = Date.UTC(2000, 0, 6, 18, 14); // known new moon
        let days = (date.getTime() - ref) / 86400000;
        let phase = (days % synodic) / synodic;
        if (phase < 0) phase += 1;
        return Math.round(phase * 8) % 8;
    }

    function renderDashboard() {
        const now = new Date();
        const todayKey = isoKey(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );

        // Agenda — upcoming days (today onward) that carry a note
        const list = document.getElementById("cal-agenda-list");
        list.innerHTML = "";
        const upcoming = Object.keys(calNotes)
            .filter((k) => (calNotes[k] || "").trim() && k >= todayKey)
            .sort()
            .slice(0, 12);
        if (!upcoming.length) {
            const empty = document.createElement("div");
            empty.className = "agenda-empty";
            const ico = document.createElement("div");
            ico.className = "agenda-empty-ico";
            ico.innerHTML = `
                <svg class="cc-ico" viewBox="0 0 24 24" fill="none" style="width: 48px; height: 48px;">
                    <path stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="14 2 14 8 20 8" />
                    <line stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" x1="16" y1="13" x2="8" y2="13" />
                    <line stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" x1="16" y1="17" x2="8" y2="17" />
                    <polyline stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="10 9 9 9 8 9" />
                </svg>
            `;
            ico.addEventListener("click", () => {
                let y, m, d;
                if (selDate) {
                    [y, m, d] = selDate.split("-").map(Number);
                    m = m - 1;
                } else {
                    const today = new Date();
                    y = today.getFullYear();
                    m = today.getMonth();
                    d = today.getDate();
                    selDate = isoKey(y, m, d);
                    document
                        .querySelectorAll(".cal-day.sel")
                        .forEach((c) => c.classList.remove("sel"));
                    const todayCell = Array.from(document.querySelectorAll(".cal-day")).find(cell => 
                        cell.textContent == d && !cell.classList.contains("om")
                    );
                    if (todayCell) todayCell.classList.add("sel");
                }
                openNoteModal(y, m, d);
            });
            const title = document.createElement("div");
            title.className = "agenda-empty-title";
            title.textContent = window.ccI18n.t("calendar.noNotes");
            const tip = document.createElement("div");
            tip.className = "agenda-empty-tip";
            tip.textContent = window.ccI18n.t("calendar.noNotesTip");
            empty.appendChild(ico);
            empty.appendChild(title);
            empty.appendChild(tip);
            list.appendChild(empty);
        } else {
            upcoming.forEach((k) => {
                const [yy, mm, dd] = k.split("-").map(Number);
                const m0 = mm - 1;
                const row = document.createElement("div");
                row.className = "agenda-row";
                const chip = document.createElement("div");
                chip.className = "agenda-chip";
                chip.innerHTML = `${MONTHS_S[m0]}<span class="agenda-chip-d">${pad(dd)}</span>`;
                const prev = document.createElement("div");
                prev.className = "agenda-prev";
                prev.textContent = (calNotes[k] || "")
                    .split("\n")[0]
                    .trim();
                row.appendChild(chip);
                row.appendChild(prev);
                
                const delBtn = document.createElement("button");
                delBtn.className = "agenda-del-btn";
                delBtn.innerHTML = `<span data-ico="x"></span>`;
                row.appendChild(delBtn);

                row.addEventListener("click", () => {
                    calYear = yy;
                    calMonth = m0;
                    selDate = k;
                    renderCalendar();
                    openNoteModal(yy, m0, dd);
                });

                delBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showConfirmModal(k);
                });

                list.appendChild(row);
                
                // Parse icons for newly injected tags
                window.ccIcons && window.ccIcons.replaceIcons(row);
            });
        }

        // Today stats
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const dayOfYear =
            Math.floor((now - yearStart) / 86400000) + 1;
        const isLeap =
            (now.getFullYear() % 4 === 0 &&
                now.getFullYear() % 100 !== 0) ||
            now.getFullYear() % 400 === 0;
        const daysInYear = isLeap ? 366 : 365;
        const lastOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
        ).getDate();
        const set = (id, v, isHtml = false) => {
            const el = document.getElementById(id);
            if (el) {
                if (isHtml) el.innerHTML = v;
                else el.textContent = v;
            }
        };
        set("stat-doy", `${dayOfYear} / ${daysInYear}`);
        set("stat-week", isoWeek(now));
        set("stat-dly", daysInYear - dayOfYear);
        set("stat-dlm", lastOfMonth - now.getDate());
        set("stat-moon", MOON_SVGS[moonPhaseIdx(now)], true);
        updateGreeting();
    }

    // ══════════════════════════════════════════════════════════════
    // TIMER
    // ══════════════════════════════════════════════════════════════
    let tAcc = 0,
        tTotal = 0,
        tRunning = false,
        tLastTick = null,
        tInterval = null,
        tActivePreset = null;

    // Dim the untouched display: before the timer has ever been started
    // (or after a reset with nothing armed) the all-zero digits read as
    // placeholder, not as information. Any armed time or running state
    // brings back full presence.
    function tRefreshIdle() {
        const idle = !tRunning && tAcc === 0 && !tActivePreset;
        document
            .getElementById("t-disp")
            .classList.toggle("idle", idle);
    }

    function tSetDisplay(secs) {
        secs = Math.max(0, secs);
        const totalMs = Math.floor(secs * 1000);
        setDigits(
            document.getElementById("t-h"),
            pad(Math.floor(totalMs / 3600000)),
        );
        setDigits(
            document.getElementById("t-m"),
            pad(Math.floor((totalMs % 3600000) / 60000)),
        );
        setDigits(
            document.getElementById("t-s"),
            pad(Math.floor((totalMs % 60000) / 1000)),
        );
        setDigits(
            document.getElementById("t-ms"),
            pad(totalMs % 1000, 3),
        );
        const pct = tTotal > 0 ? ((tTotal - secs) / tTotal) * 100 : 0;
        document.getElementById("t-prog").style.width = pct + "%";
        document.getElementById("t-prog").style.background =
            secs <= 10 && secs > 0 ? "#ff4444" : "var(--accent-a)";
        const disp = document.getElementById("t-disp");
        disp.classList.toggle(
            "warn",
            secs <= 10 && secs > 0 && tRunning,
        );
    }

    function tGetInputSecs() {
        return (
            (parseInt(document.getElementById("t-ih").value) || 0) *
                3600 +
            (parseInt(document.getElementById("t-im").value) || 0) *
                60 +
            (parseInt(document.getElementById("t-is").value) || 0)
        );
    }
    function tSetInputs(s) {
        document.getElementById("t-ih").value = Math.floor(s / 3600);
        document.getElementById("t-im").value = Math.floor(
            (s % 3600) / 60,
        );
        document.getElementById("t-is").value = s % 60;
    }

    // Reflects whether a duration is armed: START glows & invites the
    // click when there's something to run, stays dim & quiet otherwise.
    let tHintTimer = null;
    function tRefreshReady() {
        if (tRunning) return; // running/paused state owns the button
        const ready = tAcc > 0 || tGetInputSecs() > 0;
        const startBtn = document.getElementById("t-start");
        startBtn.classList.toggle("ready", ready);
        startBtn.classList.toggle("dormant", !ready);
        document.getElementById("t-reset").disabled = !ready;
    }

    // Pressed START with nothing set: instead of a dead no-op, guide the
    // user to where time is chosen (shake + focus + transient hint).
    function tNudge() {
        ["t-presets", "t-manual"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove("shake");
            void el.offsetWidth; // reflow so the animation restarts
            el.classList.add("shake");
        });
        const hint = document.getElementById("t-hint");
        hint.classList.add("show");
        clearTimeout(tHintTimer);
        tHintTimer = setTimeout(
            () => hint.classList.remove("show"),
            3400,
        );
        const im = document.getElementById("t-im");
        im.focus();
        im.select();
    }

    // The attract sweep retires for good once the user engages with
    // time-setting (a preset or the custom inputs). Start/Reset do NOT
    // set a time, so they deliberately leave the invitation running.
    let tAttractStopped = false;
    function tStopAttract() {
        if (tAttractStopped) return;
        tAttractStopped = true;
        document
            .getElementById("t-presets")
            .classList.remove("attract");
    }

    function tStartStop() {
        if (tRunning) {
            tRunning = false;
            tAcc = Math.max(0, tAcc - (Date.now() - tLastTick) / 1000);
            clearInterval(tInterval);
            tRefreshIdle();
        document.getElementById("t-start").innerHTML =
            '<span data-ico="play"></span> RESUME';
        window.ccIcons &&
            window.ccIcons.replaceIcons(
                document.getElementById("t-start"),
            );
            document.getElementById("t-c1").classList.remove("blink");
            document.getElementById("t-c2").classList.remove("blink");
            tRefreshReady(); // RESUME stays armed & inviting
        } else {
            if (tAcc === 0) {
                tTotal = tGetInputSecs();
                tAcc = tTotal;
            }
            if (tAcc <= 0) {
                tNudge();
                return;
            }
            tRunning = true;
            tLastTick = Date.now();
            tRefreshIdle();
            document
                .getElementById("t-start")
                .classList.remove("dormant", "ready");
            document.getElementById("t-start").innerHTML =
                '<span data-ico="pause"></span> PAUSE';
            window.ccIcons &&
                window.ccIcons.replaceIcons(
                    document.getElementById("t-start"),
                );
            document.getElementById("t-reset").disabled = false;
            document.getElementById("t-c1").classList.add("blink");
            document.getElementById("t-c2").classList.add("blink");
            clearInterval(tInterval);
            tInterval = setInterval(() => {
                if (!tRunning) return;
                const now = Date.now();
                tAcc = Math.max(0, tAcc - (now - tLastTick) / 1000);
                tLastTick = now;
                tSetDisplay(tAcc);
                if (tAcc <= 0) {
                    clearInterval(tInterval);
                    tRunning = false;
                    tAcc = 0;
                    tOnComplete();
                }
            }, 50);
        }
    }

    function tReset() {
        clearInterval(tInterval);
        tRunning = false;
        tAcc = 0;
        tTotal = 0;
        tSetDisplay(0);
        document.getElementById("t-prog").style.width = "0%";
        document.getElementById("t-start").innerHTML =
            '<span data-ico="play"></span> START';
        window.ccIcons &&
            window.ccIcons.replaceIcons(
                document.getElementById("t-start"),
            );
        document.getElementById("t-reset").disabled = true;
        document.getElementById("t-c1").classList.remove("blink");
        document.getElementById("t-c2").classList.remove("blink");
        document.getElementById("t-disp").classList.remove("warn");
        document
            .querySelectorAll(".preset-btn")
            .forEach((b) => b.classList.remove("on"));
        tActivePreset = null;
        tRefreshReady(); // back to the dim, "set a time" resting state
        tRefreshIdle();  // untouched zeros dim back down
    }

    function tOnComplete() {
        tSetDisplay(0);
        document.getElementById("t-prog").style.width = "100%";
        document.getElementById("t-start").innerHTML =
            '<span data-ico="play"></span> START';
        window.ccIcons &&
            window.ccIcons.replaceIcons(
                document.getElementById("t-start"),
            );
        document.getElementById("t-c1").classList.remove("blink");
        document.getElementById("t-c2").classList.remove("blink");
        window.audioEngine.chime(
            cfg.alarmSound || "chime-crystal",
            cfg.alarmVolume || 0.75,
        );
        let fl = 0;
        const fi = setInterval(() => {
            const segs = document.querySelectorAll(".t-seg");
            segs.forEach(
                (s) =>
                    (s.style.opacity =
                        s.style.opacity === "0.15" ? "1" : "0.15"),
            );
            if (++fl >= 6) {
                clearInterval(fi);
                segs.forEach((s) => (s.style.opacity = "1"));
            }
        }, 200);
        document.getElementById("t-done").classList.add("vis");
        tRefreshReady(); // inputs still hold the value → re-run is armed
        tRefreshIdle();  // countdown finished at zero → dims unless re-armed
    }

    document
        .getElementById("t-start")
        .addEventListener("click", tStartStop);
    document.getElementById("t-reset").addEventListener("click", () => {
        tReset();
        if (tActivePreset) {
            tAcc = tActivePreset;
            tTotal = tActivePreset;
            tSetDisplay(tActivePreset);
            tSetInputs(tActivePreset);
        }
    });
    document
        .getElementById("t-dismiss")
        .addEventListener("click", () => {
            document.getElementById("t-done").classList.remove("vis");
            tReset();
            if (tActivePreset) {
                tAcc = tActivePreset;
                tTotal = tActivePreset;
                tSetDisplay(tActivePreset);
                tSetInputs(tActivePreset);
            }
        });
    document.querySelectorAll(".preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (tRunning) return;
            const s = parseInt(btn.dataset.s);
            tTotal = s;
            tAcc = s;
            tSetDisplay(s);
            tSetInputs(s);
            document
                .querySelectorAll(".preset-btn")
                .forEach((b) => b.classList.remove("on"));
            btn.classList.add("on");
            tActivePreset = s;
            tStopAttract(); // user engaged → end the invitation
            tRefreshReady(); // a preset just armed the timer → light up START
            tRefreshIdle();  // armed digits wake up from the dim rest
        });
    });
    ["t-ih", "t-im", "t-is"].forEach((id) => {
        const onEdit = () => {
            if (!tRunning) {
                const s = tGetInputSecs();
                tAcc = s;
                tTotal = s;
                tSetDisplay(s);
                tStopAttract(); // editing a custom time ends the invitation
                tRefreshReady();
            }
        };
        const el = document.getElementById(id);
        el.addEventListener("input", onEdit); // live, as digits change
        el.addEventListener("change", onEdit);
    });

    tRefreshReady(); // initial resting state: START dim until a time is set

    // ══════════════════════════════════════════════════════════════
    // STOPWATCH
    // ══════════════════════════════════════════════════════════════
    let swRunning = false,
        swStart = null,
        swPaused = 0,
        swElapsed = 0,
        swRaf = null;
    let laps = [],
        lastLapTotal = 0;

    // Untouched zeros read as placeholder, not information — dim them
    // until the first start; any elapsed time (running or paused)
    // brings the digits back to full presence.
    function swRefreshIdle() {
        const idle = !swRunning && swElapsed === 0;
        document
            .getElementById("sw-disp")
            .classList.toggle("idle", idle);
    }

    function swFmt(ms) {
        const t = Math.floor(ms);
        return {
            h: pad(Math.floor(t / 3600000)),
            m: pad(Math.floor((t % 3600000) / 60000)),
            s: pad(Math.floor((t % 60000) / 1000)),
            ms: pad(t % 1000, 3),
        };
    }
    function swDurStr(ms) {
        const t = swFmt(ms);
        return `${t.h}:${t.m}:${t.s}.${t.ms}`;
    }

    function swUpdate() {
        if (swRunning)
            swElapsed = performance.now() - swStart + swPaused;
        const t = swFmt(swElapsed);
        setDigits(document.getElementById("sw-h"), t.h);
        setDigits(document.getElementById("sw-m"), t.m);
        setDigits(document.getElementById("sw-s"), t.s);
        setDigits(document.getElementById("sw-ms"), t.ms);
        if (swRunning) swRaf = requestAnimationFrame(swUpdate);
    }

    function swStartStop() {
        if (swRunning) {
            swRunning = false;
            swPaused = swElapsed;
            cancelAnimationFrame(swRaf);
            swRefreshIdle();
            document.getElementById("sw-start").innerHTML =
                '<span data-ico="play"></span> RESUME';
            window.ccIcons &&
                window.ccIcons.replaceIcons(
                    document.getElementById("sw-start"),
                );
            document.getElementById("sw-reset").disabled = false;
            document.getElementById("sw-lap").disabled = true;
            document.getElementById("run-dot").classList.remove("on");
        } else {
            swRunning = true;
            swStart = performance.now();
            swRefreshIdle();
            document.getElementById("sw-start").innerHTML =
                '<span data-ico="pause"></span> PAUSE';
            window.ccIcons &&
                window.ccIcons.replaceIcons(
                    document.getElementById("sw-start"),
                );
            document.getElementById("sw-reset").disabled = true;
            document.getElementById("sw-lap").disabled = false;
            document.getElementById("run-dot").classList.add("on");
            swRaf = requestAnimationFrame(swUpdate);
        }
    }

    function swReset() {
        if (swRunning) return;
        swRunning = false;
        swPaused = 0;
        swElapsed = 0;
        laps = [];
        lastLapTotal = 0;
        swUpdate();
        swRenderLaps();
        document.getElementById("sw-start").innerHTML =
            '<span data-ico="play"></span> START';
        window.ccIcons &&
            window.ccIcons.replaceIcons(
                document.getElementById("sw-start"),
            );
        document.getElementById("sw-reset").disabled = true;
        document.getElementById("sw-lap").disabled = true;
        document.getElementById("sw-clear").disabled = true;
        document.getElementById("run-dot").classList.remove("on");
        swRefreshIdle(); // fresh zeros go back to the dim resting state
    }

    function swLap() {
        if (!swRunning) return;
        const tot = swElapsed,
            time = tot - lastLapTotal;
        lastLapTotal = tot;
        laps.push({ n: laps.length + 1, lapTime: time, total: tot });
        swRenderLaps();
        document.getElementById("sw-clear").disabled = false;
    }

    function swRenderLaps() {
        const list = document.getElementById("lap-list");
        const empty = document.getElementById("lap-empty");
        if (!laps.length) {
            empty.style.display = "block";
            list.querySelectorAll(".lap-row").forEach((r) =>
                r.remove(),
            );
            return;
        }
        empty.style.display = "none";
        list.querySelectorAll(".lap-row").forEach((r) => r.remove());
        const times = laps.map((l) => l.lapTime);
        const best = Math.min(...times),
            worst = Math.max(...times);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        [...laps].reverse().forEach((l) => {
            const row = document.createElement("div");
            row.className = "lap-row";
            if (laps.length > 1) {
                if (l.lapTime === best) row.classList.add("best");
                if (l.lapTime === worst) row.classList.add("worst");
            }
            const d = l.lapTime - avg;
            row.innerHTML = `<div class="lap-num">${l.n}</div><div class="lap-time">${swDurStr(l.lapTime)}</div><div class="lap-delta">${d >= 0 ? "+" : "-"}${swDurStr(Math.abs(d))}</div><div class="lap-total">${swDurStr(l.total)}</div>`;
            list.insertBefore(row, list.firstChild);
        });
    }

    document
        .getElementById("sw-start")
        .addEventListener("click", swStartStop);
    document
        .getElementById("sw-reset")
        .addEventListener("click", swReset);
    document.getElementById("sw-lap").addEventListener("click", swLap);
    document.getElementById("sw-copy").addEventListener("click", () => {
        if (!laps.length) return;
        const avg =
            laps.reduce((s, x) => s + x.lapTime, 0) / laps.length;
        const lines = [
            window.ccI18n.t("stopwatch.lapHeader"),
            ...laps.map((l) => {
                const d = l.lapTime - avg;
                return `${l.n}\t${swDurStr(l.lapTime)}\t${d >= 0 ? "+" : "-"}${swDurStr(Math.abs(d))}\t${swDurStr(l.total)}`;
            }),
        ];
        navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    });
    document
        .getElementById("sw-clear")
        .addEventListener("click", () => {
            if (swRunning) return;
            laps = [];
            lastLapTotal = 0;
            swRenderLaps();
            document.getElementById("sw-clear").disabled = true;
        });

    // Both displays open untouched: rest dim until the first interaction.
    tRefreshIdle();
    swRefreshIdle();

    // ══════════════════════════════════════════════════════════════
    // RELAX + AUDIO ENGINE
    // ══════════════════════════════════════════════════════════════
    const RELAX_TRACKS = [
        { id: "night",     icon: "stars" },
        { id: "forest",    icon: "trees" },
        { id: "space",     icon: "planet" },
        { id: "ocean",     icon: "waves" },
        { id: "rain",      icon: "cloud-rain" },
        { id: "fireplace", icon: "flame" },
    ];

    // Build the track cards once, from the same single source of truth
    // used by Zen Flow and the scheduler — no duplicated markup to drift.
    function buildTrackCards() {
        const grid = document.getElementById("track-grid");
        if (!grid) return;
        grid.innerHTML = "";
        RELAX_TRACKS.forEach(({ id, icon }) => {
            const card = document.createElement("div");
            card.className = "tcard";
            card.dataset.track = id;
            card.setAttribute("role", "button");
            card.tabIndex = 0;
            card.setAttribute("data-tooltip-dir", "bottom");
            card.setAttribute("data-tooltip", window.ccI18n ? window.ccI18n.t("relax.tooltip.tcardMix") : "Click to play · Ctrl+Click to blend");
            card.setAttribute("data-i18n-attr", "data-tooltip:relax.tooltip.tcardMix");
            card.innerHTML = `
                <div class="tcard-dot"></div>
                <div class="tcard-ico"><span data-ico="${icon}" data-ico-size="26"></span></div>
                <div class="tcard-name" data-i18n="relax.track.${id}"></div>
                <div class="tcard-desc" data-i18n="relax.track.${id}.desc"></div>
            `;
            grid.appendChild(card);
        });
        // i18n fills the name/desc placeholders; icons need the replacer.
        if (window.ccI18n) window.ccI18n.apply(grid);
        if (window.ccIcons) window.ccIcons.replaceIcons(grid);
    }

    const ZEN_FLOW_TRACK_DURATION = 15 * 60 * 1000; // 15 minutes per track

    let rSelected = null,
        rSesStart = null,
        rSesInterval = null,
        rTipInterval = null,
        rTipIdx = 0;
    let rAstMins = 0,
        rAstRemain = 0,
        rAstTimer = null,
        vizRaf = null,
        rSaveTimer = null;
    let rPacerActive = false,
        rPacerTimer = null,
        rPacerStart = null;
    let zenFlowActive = false,
        zenFlowTimer = null,
        zenFlowQueue = [];

    function startZenFlow() {
        zenFlowActive = true;
        if (zenFlowTimer) clearTimeout(zenFlowTimer);
        
        const track = nextZenFlowTrack();
        preSelectRelaxTrack(track);
        rSelected = track;
        
        window.audioEngine.playTrack(track);
        window.audioEngine.setVolume(cfg.relaxVolume || 0.8);
        updatePlayButtonUI(true);
        
        rStartSession();
        startViz();
        startBreathePacer();
        rStartTips();
        window.cc.saveSettings({ lastRelaxTrack: rSelected });
        if (rAstMins > 0) rStartAutoStop(rAstMins * 60);
        
        updatePlayingTrackCardClass(true);
        scheduleNextZenFlowTrack();
    }

    function stopZenFlow() {
        zenFlowActive = false;
        zenFlowQueue = [];
        if (zenFlowTimer) {
            clearTimeout(zenFlowTimer);
            zenFlowTimer = null;
        }
    }

    function scheduleNextZenFlowTrack() {
        if (zenFlowTimer) clearTimeout(zenFlowTimer);
        zenFlowTimer = setTimeout(() => {
            if (zenFlowActive && window.audioEngine.isPlaying) {
                const track = nextZenFlowTrack();
                preSelectRelaxTrack(track);
                rSelected = track;
                
                window.audioEngine.playTrack(track);
                window.cc.saveSettings({ lastRelaxTrack: rSelected });
                showNextTip();
                
                updatePlayingTrackCardClass(true);
                scheduleNextZenFlowTrack();
            }
        }, ZEN_FLOW_TRACK_DURATION);
    }

    function nextZenFlowTrack() {
        const tracks = ['night', 'forest', 'space', 'ocean', 'rain', 'fireplace'];
        if (zenFlowQueue.length === 0) {
            // Create shuffled list of all 6 tracks
            zenFlowQueue = [...tracks].sort(() => Math.random() - 0.5);
            // Ensure the first track of the new set doesn't match the last played track
            if (rSelected && zenFlowQueue[0] === rSelected && zenFlowQueue.length > 1) {
                const tmp = zenFlowQueue[0];
                zenFlowQueue[0] = zenFlowQueue[1];
                zenFlowQueue[1] = tmp;
            }
        }
        return zenFlowQueue.shift();
    }

    function updatePlayButtonUI(isPlaying) {
        const playBtn = document.getElementById("r-play");
        if (!playBtn) return;
        const iconName = isPlaying && !rPaused ? "pause" : "play";

        // Tray sync: report what's playing (last track while paused) so
        // the tray menu can show and toggle it from anywhere.
        if (window.cc && window.cc.reportRelaxPlaying) {
            const reported = isPlaying
                ? (window.audioEngine.currentTrack || rSelected)
                : null;
            window.cc.reportRelaxPlaying(reported);
        }

        let text = "";
        let labelKey = "";
        let tooltipKey = "";
        if (isPlaying && rPaused) {
            labelKey = "relax.resume";
            text = window.ccI18n.t("relax.resume");
            tooltipKey = "relax.tooltip.resume";
        } else if (isPlaying) {
            labelKey = "relax.pause";
            text = window.ccI18n.t("relax.pause");
            tooltipKey = "relax.tooltip.pause";
        } else {
            labelKey = "relax.play";
            text = window.ccI18n.t("relax.play");
            tooltipKey = "relax.tooltip.play";
        }

        playBtn.innerHTML = `<span data-ico="${iconName}"></span> <span id="r-play-text" data-i18n="${labelKey}">${text}</span>`;
        if (window.ccIcons) {
            window.ccIcons.replaceIcons(playBtn);
        }

        // Update dynamic tooltip wrapper
        const playWrap = document.getElementById("r-play-wrap");
        if (playWrap) {
            playWrap.setAttribute("data-i18n-attr", `data-tooltip:${tooltipKey}`);
            playWrap.setAttribute("data-tooltip", window.ccI18n.t(tooltipKey));
        }

        // Breathe circle active tint follows playback state
        const circle = document.getElementById("breathe-circle");
        if (circle) {
            circle.setAttribute("data-active", isPlaying && !rPaused ? "1" : "0");
        }

        // Shuffle button shows its active state while Zen Flow runs
        const shuffleBtn = document.getElementById("r-shuffle");
        if (shuffleBtn) {
            shuffleBtn.classList.toggle("on", zenFlowActive);
        }
    }

    const boxPhases = [
        { name: "inhale", duration: 4000, startScale: 1.0, endScale: 1.5 },
        { name: "hold", duration: 4000, startScale: 1.5, endScale: 1.5 },
        { name: "exhale", duration: 4000, startScale: 1.5, endScale: 1.0 },
        { name: "hold", duration: 4000, startScale: 1.0, endScale: 1.0 }
    ];
    const relax478Phases = [
        { name: "inhale", duration: 4000, startScale: 1.0, endScale: 1.5 },
        { name: "hold", duration: 7000, startScale: 1.5, endScale: 1.5 },
        { name: "exhale", duration: 8000, startScale: 1.5, endScale: 1.0 }
    ];

    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function startBreathePacer() {
        stopBreathePacer();
        rPacerActive = true;
        const pattern = cfg.breathePattern || "box";
        const phases = pattern === "478" ? relax478Phases : boxPhases;
        const totalDuration = phases.reduce((acc, p) => acc + p.duration, 0);
        rPacerStart = performance.now();
        
        function tick() {
            if (!rPacerActive) return;
            // Pause rendering while another view is active (the audio
            // keeps playing; the circle is invisible anyway). The phase
            // math is time-based, so it re-syncs seamlessly on return.
            if (curView !== "relax") {
                rPacerTimer = requestAnimationFrame(tick);
                return;
            }
            // Audio paused: freeze the circle exactly where it is instead
            // of advancing the pattern clock, so resume continues the
            // phase mid-breath instead of jumping back.
            if (rPaused) {
                rPacerTimer = requestAnimationFrame(tick);
                return;
            }
            const elapsed = (performance.now() - rPacerStart) % totalDuration;
            
            let accumulated = 0;
            let currentPhase = phases[0];
            let phaseElapsed = 0;
            
            for (const p of phases) {
                if (elapsed < accumulated + p.duration) {
                    currentPhase = p;
                    phaseElapsed = elapsed - accumulated;
                    break;
                }
                accumulated += p.duration;
            }
            
            const progress = phaseElapsed / currentPhase.duration;
            const easedProgress = easeInOut(progress);
            const scale = currentPhase.startScale + (currentPhase.endScale - currentPhase.startScale) * easedProgress;
            
            const circle = document.getElementById("breathe-circle");
            if (circle) {
                circle.style.transform = `scale(${scale})`;
            }
            const phaseLabel = document.getElementById("breathe-phase");
            if (phaseLabel) {
                const phaseText = window.ccI18n.t(`relax.breathe.${currentPhase.name}`);
                if (phaseLabel.textContent !== phaseText) {
                    phaseLabel.textContent = phaseText;
                }
            }
            const guideLabel = document.getElementById("breathe-guide-text");
            if (guideLabel) {
                const guideText = window.ccI18n.t(`relax.breathe.guide.${currentPhase.name}`);
                if (guideLabel.textContent !== guideText) {
                    guideLabel.textContent = guideText;
                }
            }
            
            rPacerTimer = requestAnimationFrame(tick);
        }
        rPacerTimer = requestAnimationFrame(tick);
    }

    function stopBreathePacer() {
        rPacerActive = false;
        if (rPacerTimer) {
            cancelAnimationFrame(rPacerTimer);
            rPacerTimer = null;
        }
        const circle = document.getElementById("breathe-circle");
        if (circle) {
            circle.style.transform = "";
        }
        const phaseLabel = document.getElementById("breathe-phase");
        if (phaseLabel) {
            phaseLabel.textContent = window.ccI18n.t("relax.breathe.start");
        }
        const guideLabel = document.getElementById("breathe-guide-text");
        if (guideLabel) {
            guideLabel.textContent = window.ccI18n.t("relax.breathe.guide.ready");
        }
    }

    function preSelectRelaxTrack(id) {
        rSelected = id;
        document
            .querySelectorAll(".tcard")
            .forEach((c) =>
                c.classList.toggle("on", c.dataset.track === id),
            );
    }

    function updatePlayingTrackCardClass(isPlaying) {
        const playing = typeof isPlaying === "boolean" ? isPlaying : window.audioEngine.isPlaying;
        document.querySelectorAll(".tcard").forEach((c) => {
            const shouldPlay = playing && c.dataset.track === rSelected;
            c.classList.toggle("playing", shouldPlay);
        });
    }

    // Normal track play (triggered when a track is clicked manually)
    function rPlayTrack() {
        if (!rSelected) return;
        stopZenFlow();
        window.audioEngine.playTrack(rSelected);
        window.audioEngine.setVolume(cfg.relaxVolume || 0.8);
        updatePlayButtonUI(true);
        rStartSession();
        startViz();
        startBreathePacer();
        rStartTips();
        window.cc.saveSettings({ lastRelaxTrack: rSelected });
        if (rAstMins > 0) rStartAutoStop(rAstMins * 60);
        updatePlayingTrackCardClass(true);
    }

    function rStop(isManual = false) {
        stopZenFlow();
        const fade = isManual ? 1.0 : 2.0;
        window.audioEngine.clearLayers();
        window.audioEngine.stop(fade);
        // Undo any auto-stop slow fade so the next session starts at
        // the configured volume, not whatever the glide left behind.
        window.audioEngine.setVolume(cfg.relaxVolume || 0.8);
        rPaused = false;
        updatePlayButtonUI(false);
        rStopSession();
        stopBreathePacer();
        rStopTips();
        rClearAutoStop();
        updatePlayingTrackCardClass(false);
        updateMixStateUI();
    }

    function rTogglePlay() {
        if (window.audioEngine.isPlaying) {
            rPauseOrResume();
        } else if (rSelected) {
            rPlayTrack();
        } else {
            // Nothing selected yet: Zen Flow is the sensible default
            startZenFlow();
        }
    }

    // Real pause: suspends the whole AudioContext (positions freeze in
    // place) and freezes the session/tips/pacer clocks. Resume restores
    // everything without losing elapsed time.
    let rPaused = false;
    let rPauseResumedAt = 0;
    let rPauseAccum = 0;

    function rPause() {
        if (!window.audioEngine.isPlaying || rPaused) return;
        rPaused = true;
        rPauseResumedAt = Date.now();
        window.audioEngine.suspend();
        // Freeze the tips cycle; session/pacer clocks are time-offset on resume.
        if (rTipInterval) {
            clearInterval(rTipInterval);
            rTipInterval = null;
        }
        // Freeze the auto-stop countdown by stopping its interval; the
        // remaining seconds stay in rAstRemain until resume re-arms it.
        if (rAstTimer) {
            clearInterval(rAstTimer);
            rAstTimer = null;
        }
        updatePlayButtonUI(true); // re-render with the Resume label
    }

    function rResume() {
        if (!rPaused) return;
        rPaused = false;
        const pauseMs = Date.now() - rPauseResumedAt;
        rPauseAccum += pauseMs;
        window.audioEngine.resume();
        // Guard: if an auto-stop slow fade started before the pause, the
        // master gain may still be gliding toward 0 — pin it back to the
        // configured volume so resuming is actually audible.
        window.audioEngine.setVolume(cfg.relaxVolume || 0.8);
        // Session clock: shift the epoch so elapsed time skips the pause.
        if (rSesStart) rSesStart += pauseMs;
        // Pacer: the rAF froze during the pause, so shifting the epoch
        // forward by the pause length makes `now - rPacerStart` unchanged
        // — the phase resumes exactly where it froze (mid-breath).
        if (rPacerStart) rPacerStart += pauseMs;
        if (rSesStart) rStartTips(); // tips cycle resumes with the session
        if (rAstMins > 0 && rAstRemain > 0) rStartAutoStop(rAstRemain);
        updatePlayButtonUI(true);
    }

    function rPauseOrResume() {
        if (rPaused) rResume();
        else rPause();
    }

    function rStartSession() {
        if (rSesInterval) clearInterval(rSesInterval);
        if (!rSesStart) rSesStart = Date.now();
        rSesInterval = setInterval(() => {
            // While paused, the clock is frozen on screen (rSesStart is
            // shifted on resume); skipping the update keeps the display
            // from ticking forward during the pause.
            if (rPaused) return;
            const ms = Date.now() - rSesStart;
            const h = Math.floor(ms / 3600000),
                m = Math.floor((ms % 3600000) / 60000),
                s = Math.floor((ms % 60000) / 1000);
            document.getElementById("r-ses").textContent =
                `${pad(h)}:${pad(m)}:${pad(s)}`;
        }, 1000);
    }
    function rStopSession() {
        if (rSesInterval) clearInterval(rSesInterval);
        rSesInterval = null;
        rSesStart = null;
        document.getElementById("r-ses").textContent = "00:00:00";
    }

    // Mindfulness Tips Shuffled progressive logic
    let rTipsShufflePool = [];
    let rCurrentTipPhase = null;
    let rCurrentTipTrack = null;

    function getCurrentPhase() {
        if (!rSesStart) return "opening";
        const elapsedMs = Date.now() - rSesStart;
        
        // If auto-stop is active, determine by remaining time and total duration
        if (rAstMins > 0 && rAstRemain > 0) {
            if (rAstRemain <= 60) {
                return "closing";
            }
            const totalSecs = rAstMins * 60;
            const elapsedSecs = totalSecs - rAstRemain;
            if (elapsedSecs < totalSecs / 3) {
                return "opening";
            } else if (elapsedSecs < (2 * totalSecs) / 3) {
                return "deepening";
            } else {
                return "closing";
            }
        }
        
        // Fallback (infinite session): use elapsed thresholds
        if (elapsedMs < 120000) { // 2 minutes
            return "opening";
        } else if (elapsedMs < 420000) { // 7 minutes
            return "deepening";
        } else {
            return "closing";
        }
    }

    function getTipsPool(phase, track) {
        let specificPool = window.ccI18n.t(`tips.${phase}.${track}`);
        let defaultPool = window.ccI18n.t(`tips.${phase}.default`);
        if (!Array.isArray(specificPool)) specificPool = [];
        if (!Array.isArray(defaultPool)) defaultPool = [];
        return [...specificPool, ...defaultPool];
    }

    function showNextTip() {
        const phase = getCurrentPhase();
        const track = rSelected || "default";
        
        if (phase !== rCurrentTipPhase || track !== rCurrentTipTrack || rTipsShufflePool.length === 0) {
            rCurrentTipPhase = phase;
            rCurrentTipTrack = track;
            rTipsShufflePool = getTipsPool(phase, track);
            // Shuffling
            rTipsShufflePool.sort(() => Math.random() - 0.5);
        }
        
        const tip = rTipsShufflePool.pop() || "Focus on your breath.";
        const el = document.getElementById("r-tip");
        if (el) {
            el.classList.add("fade");
            setTimeout(() => {
                el.textContent = tip;
                el.classList.remove("fade");
            }, 400);
        }
    }

    function rStartTips() {
        if (rTipInterval) clearInterval(rTipInterval);
        
        // Reset shuffle state for the session
        rTipsShufflePool = [];
        rCurrentTipPhase = null;
        rCurrentTipTrack = null;
        
        // Show first tip immediately
        showNextTip();
        
        // Set cycle loop (30s)
        rTipInterval = setInterval(showNextTip, 30000);
    }

    function rStopTips() {
        if (rTipInterval) clearInterval(rTipInterval);
        rTipInterval = null;
    }

    // Auto-stop: instead of a hard cut at 0, the master gain glides to
    // silence over the last minute so sleep sessions fade out gently.
    const AUTO_STOP_FADE_SECS = 60;
    function rStartAutoStop(secs) {
        rClearAutoStop();
        rAstRemain = secs;
        rAstUpdateDisplay();
        rAstTimer = setInterval(() => {
            if (!window.audioEngine.isPlaying) return;
            rAstRemain = Math.max(0, rAstRemain - 1);
            rAstUpdateDisplay();
            if (rAstRemain === AUTO_STOP_FADE_SECS) {
                window.audioEngine.beginSlowFade(AUTO_STOP_FADE_SECS);
            }
            if (rAstRemain <= 0) {
                rClearAutoStop();
                rStop();
                rShowNotify(window.ccI18n.t("relax.sessionComplete"));
            }
        }, 1000);
    }
    function rClearAutoStop() {
        if (rAstTimer) clearInterval(rAstTimer);
        rAstTimer = null;
        document.getElementById("r-ast-cd").style.display = "none";
    }
    function rAstUpdateDisplay() {
        const m = Math.floor(rAstRemain / 60),
            s = rAstRemain % 60;
        const el = document.getElementById("r-ast-cd");
        el.textContent = window.ccI18n.t("relax.stopsIn", { time: pad(m) + ":" + pad(s) });
        el.style.display = "inline";
    }
    function rShowNotify(msg) {
        const el = document.getElementById("r-notify");
        el.textContent = msg;
        el.classList.add("show");
        setTimeout(() => el.classList.remove("show"), 3000);
    }

    // Visualizer
    function startViz() {
        if (vizRaf || curView !== "relax") return;
        const canvas = document.getElementById("viz-canvas");
        // The wrap is now flex-sized (fills the right column), so sync
        // the bitmap to BOTH axes, not just the width.
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext("2d");
        const h = canvas.height,
            w = canvas.width;
        function draw() {
            if (curView !== "relax") {
                vizRaf = null;
                return;
            }
            ctx.clearRect(0, 0, w, h);
            // Cache theme colors per frame (theme changes are rare;
            // reading getComputedStyle twice per bar per frame was
            // the single hottest cost in this loop).
            const bodyStyle = getComputedStyle(document.body);
            const acc = bodyStyle.getPropertyValue("--accent-a").trim() || "#00d4ff";
            const rgb = bodyStyle.getPropertyValue("--rgb-accent").trim() || "0,212,255";
            if (window.audioEngine.isPlaying) {
                const data = window.audioEngine.getAnalyserData();
                const bars = 56;
                const gap = w / bars;
                // One shared gradient per frame instead of one per bar:
                // all bars span the same y range (0..h).
                const g = ctx.createLinearGradient(0, 0, 0, h);
                g.addColorStop(0, acc);
                g.addColorStop(1, `rgba(${rgb},.18)`);
                for (let i = 0; i < bars; i++) {
                    const percent = i / (bars - 1 || 1);
                    const maxActiveBin = Math.floor(data.length * 0.32);
                    const idx = Math.floor(Math.pow(percent, 1.8) * maxActiveBin);
                    let v = (data[idx] || 0) / 255;
                    // Boost higher frequencies slightly for visual balance
                    v = Math.min(1.0, v * (1 + percent * 0.8));
                    const bh = Math.max(2, v * h * 0.88),
                        x = Math.floor(i * gap),
                        nextX = Math.floor((i + 1) * gap),
                        barW = Math.max(1, nextX - x - 1),
                        y = h - bh;
                    ctx.fillStyle = g;
                    ctx.fillRect(x, y, barW, bh);
                    ctx.fillStyle = `rgba(${rgb},.07)`;
                    ctx.fillRect(x, h, barW, bh * 0.28);
                    ctx.fillStyle = acc;
                    ctx.fillRect(x, y - 2, barW, 2);
                }
            } else {
                const time = Date.now() * 0.001;
                ctx.lineWidth = 1.5;
                
                ctx.strokeStyle = `rgba(${rgb}, 0.08)`;
                ctx.beginPath();
                ctx.moveTo(0, h / 2);
                ctx.lineTo(w, h / 2);
                ctx.stroke();

                for (let wIdx = 0; wIdx < 3; wIdx++) {
                    ctx.beginPath();
                    const opacity = 0.05 + (wIdx * 0.04);
                    ctx.strokeStyle = `rgba(${rgb}, ${opacity})`;

                    const freq = 0.008 + (wIdx * 0.004);
                    const amp = 15 + (wIdx * 8);
                    const speed = 1.2 + (wIdx * 0.5);

                    for (let x = 0; x < w; x++) {
                        const angle = (x * freq) + (time * speed);
                        const y = (h / 2) + Math.sin(angle) * amp * Math.cos(x * 0.002);
                        if (x === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
                // No standby text: idle waves alone read as "waiting".
            }
            vizRaf = requestAnimationFrame(draw);
        }
        draw();
    }
    function stopViz() {
        if (vizRaf) {
            cancelAnimationFrame(vizRaf);
            vizRaf = null;
        }
        const canvas = document.getElementById("viz-canvas");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Track cards
    buildTrackCards();
    document.querySelectorAll(".tcard").forEach((card) => {
        card.addEventListener("click", (e) => {
            const t = card.dataset.track;

            // Ctrl+Click blends tracks as layers (Rain + Fireplace, etc.)
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (window.audioEngine.isLayerActive(t)) {
                    window.audioEngine.removeLayer(t);
                } else {
                    window.audioEngine.addLayer(t);
                }
                updateMixStateUI();
                return;
            }

            if (rPaused && rSelected === t) {
                // Same track while paused: just resume
                stopZenFlow();
                rResume();
                return;
            }
            stopZenFlow();
            if (rSelected === t && window.audioEngine.isPlaying) {
                rPause(); // second click on the playing card pauses it
                return;
            }
            rPaused = false;
            // Switching to a solo track also clears any blend layers
            window.audioEngine.clearLayers();
            preSelectRelaxTrack(t);
            rSelected = t;
            if (window.audioEngine.isPlaying) {
                window.audioEngine.playTrack(t);
                updatePlayButtonUI(true);
                updatePlayingTrackCardClass(true);
            } else {
                rPlayTrack();
            }
            updateMixStateUI();
        });
        // Keyboard parity for the role="button" cards
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Reflect active blend layers on the cards: layered cards get the
    // active tint too (dot + border). The solo selection keeps its own
    // highlight; the two sources can coexist (solo + layers).
    function updateMixStateUI() {
        const layered = window.audioEngine.activeLayerIds();
        document.querySelectorAll(".tcard").forEach((c) => {
            c.classList.toggle(
                "on",
                layered.includes(c.dataset.track) || c.dataset.track === rSelected,
            );
        });
        updatePlayButtonUI(window.audioEngine.isPlaying || layered.length > 0);
    }

    document
        .getElementById("r-play")
        .addEventListener("click", rTogglePlay);
    document.getElementById("r-shuffle").addEventListener("click", () => {
        // Zen Flow (continuous shuffle) is a deliberate mode choice,
        // separate from the primary Play/Pause CTA.
        if (zenFlowActive) {
            rStop(true);
        } else {
            if (rSelected) preSelectRelaxTrack(null);
            startZenFlow();
        }
    });
    document.getElementById("r-stop").addEventListener("click", () => {
        rStop(true);
        document
            .querySelectorAll(".tcard")
            .forEach((c) => c.classList.remove("on"));
        rSelected = null;
    });

    // Breathing circle click toggles pause/play (not full stop, so a
    // mid-session glance at the circle can't wipe the session timer).
    document.getElementById("breathe-circle").addEventListener("click", () => {
        if (!window.audioEngine.isPlaying) {
            if (rSelected) rPlayTrack();
            else startZenFlow();
        } else {
            rPauseOrResume();
        }
    });

    document.getElementById("r-vol").addEventListener("input", (e) => {
        const v = e.target.value / 100;
        document.getElementById("r-vol-val").textContent =
            e.target.value + "%";
        window.audioEngine.setVolume(v);
        clearTimeout(rSaveTimer);
        rSaveTimer = setTimeout(
            () => window.cc.saveSettings({ relaxVolume: v }),
            400,
        );
    });

    // Mute banner: one click clears the global mute that silences every
    // sound in the app (same setting as the tray "Sound" toggle).
    const rMuteEnable = document.getElementById("r-mute-enable");
    if (rMuteEnable) {
        rMuteEnable.addEventListener("click", () => {
            window.cc.saveSettings({ audioMuted: false });
        });
    }

    document.querySelectorAll(".ast-btn").forEach((b) => {
        b.addEventListener("click", () => {
            const m = parseInt(b.dataset.min);
            rAstMins = m;
            document
                .querySelectorAll(".ast-btn")
                .forEach((x) =>
                    x.classList.toggle(
                        "on",
                        parseInt(x.dataset.min) === m,
                    ),
                );
            if (m > 0 && window.audioEngine.isPlaying)
                rStartAutoStop(m * 60);
            else rClearAutoStop();
        });
    });

    document.querySelectorAll(".breathe-pat-btn").forEach((b) => {
        b.addEventListener("click", () => {
            const pat = b.dataset.pat;
            window.cc.saveSettings({ breathePattern: pat });
            document
                .querySelectorAll(".breathe-pat-btn")
                .forEach((x) =>
                    x.classList.toggle("on", x.dataset.pat === pat),
                );
            cfg.breathePattern = pat;
            // Restart the pacer only while actually breathing; during an
            // audio pause the tick is frozen, and re-arming here would
            // leave the circle stuck at "Ready" until the next session.
            // rResume's epoch shift keeps the old cycle, so the new
            // pattern simply takes effect on the next full start.
            if (rPacerActive && !rPaused) startBreathePacer();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // SETTINGS MODAL
    // ══════════════════════════════════════════════════════════════
    let sDebounce = {};

    // ── Mini preview (peek) ──────────────────────────────────
    // While the "Modo Mini" tab is open in the settings modal, the
    // real mini window is shown as a live preview (set_mini_preview).
    // The mini re-applies every settings change on its own, so the
    // sliders update it as they move — no more blind adjustments.
    function syncMiniPreview() {
        const open = document
            .getElementById("s-overlay")
            .classList.contains("open");
        const active = document.querySelector(".s-nav-btn.on");
        const on = open && !!active && active.dataset.stab === "mini";
        window.cc
            .setMiniPreview(on)
            .catch((e) => console.error("mini preview failed:", e));
    }

    function switchSettingsTab(tabName) {
        document
            .querySelectorAll(".s-nav-btn")
            .forEach((t) => t.classList.toggle("on", t.dataset.stab === tabName));
        document
            .querySelectorAll(".s-panel")
            .forEach((p) => p.classList.toggle("on", p.id === "stab-" + tabName));
        syncMiniPreview();
    }

    function openSettings(targetTab, focusSelector) {
        document.getElementById("s-overlay").classList.add("open");
        if (typeof renderTimeSyncSettings === "function") renderTimeSyncSettings();
        // Only explicit string tabs switch; raw event objects from direct
        // click bindings must never clear the active tab.
        if (typeof targetTab === "string" && targetTab) {
            switchSettingsTab(targetTab);
        } else {
            // Reopening without an explicit tab keeps the previous one
            // active — re-sync the peek with whatever tab is showing.
            syncMiniPreview();
        }
        loadScreensList();
        // Focus (and select) a specific control once the modal is painted,
        // e.g. clicking the clock opens Settings with the name field ready.
        if (focusSelector) {
            requestAnimationFrame(() => {
                const el = document.querySelector(focusSelector);
                if (el) {
                    el.focus();
                    if (typeof el.select === "function") el.select();
                }
            });
        }
    }

    function loadScreensList() {
        window.cc.getScreens().then((screens) => {
            const el = document.getElementById("s-screens");
            el.innerHTML = "";
            screens.forEach((s) => {
                const card = document.createElement("div");
                card.className = "s-screen-card" + (s.current ? " s-screen-current" : "");
                const primaryText = window.ccI18n.t('settings.display.primary');
                const activeText = window.ccI18n.t('settings.display.active');
                const inUseText = window.ccI18n.t('settings.display.inUse');

                card.innerHTML = `
                  <span class="s-row-ico" data-ico="monitor"></span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-family:var(--font-ui);font-size:13px;font-weight:500;
                      letter-spacing:.1px;color:var(--text-hi);margin-bottom:3px;">
                      ${s.label}
                      ${s.primary ? `<span style="font-size:9px;font-weight:600;background:var(--accent-dim);border:1px solid var(--border-bright);color:var(--accent-a);border-radius:4px;padding:1px 6px;margin-left:6px;">${primaryText}</span>` : ""}
                      ${s.current ? `<span style="font-size:9px;font-weight:600;background:rgba(var(--rgb-accent),.2);border:1px solid var(--border-active);color:var(--accent-a);border-radius:4px;padding:1px 4px;margin-left:4px;">${activeText}</span>` : ""}
                    </div>
                    <div style="font-family:var(--font-ui);font-size:12px;color:var(--text-md);">
                      ${s.width} × ${s.height} px  &nbsp;·&nbsp;
                      pos (${s.x}, ${s.y})
                    </div>
                  </div>
                  ${s.current ? `<span style="font-family:var(--font-mono);font-size:9px;letter-spacing:.5px;color:var(--accent-a);">${inUseText}</span>` : ""}
                `;
                if (!s.current) {
                    // The whole card selects this display.
                    card.addEventListener("click", async () => {
                        const res = await window.cc.selectDisplay(s.id);
                        if (res) {
                            // Refresh list to show new ACTIVE state
                            setTimeout(loadScreensList, 150);
                        }
                    });
                }
                el.appendChild(card);
            });

            // The monitor tiles were inserted after the initial icon
            // pass ran at load; render them now.
            if (window.ccIcons) window.ccIcons.replaceIcons(el);
        });
    }
    function closeSettings() {
        const overlay = document.getElementById("s-overlay");
        // Commit any pending field edit (e.g. the clock name) before hiding:
        // blur fires the control's change handler while it is still live.
        const active = document.activeElement;
        if (active && overlay.contains(active)) active.blur();
        overlay.classList.remove("open");
        // The Saved badge is per-open: it comes back the next time a
        // setting is moved inside the modal.
        const savedPill = document.getElementById("s-autosave-pill");
        if (savedPill) savedPill.classList.add("is-hidden");
        // End the mini peek if it was running.
        syncMiniPreview();
    }

    // ── Saved badge (sidebar footer pill) ───────────────────
    // Shown whenever a settings change is persisted while the modal is
    // open — every modal control persists through saveSettings — and it
    // stays visible until the modal closes. Wrapping the bridge call
    // keeps the badge honest: interactions that change nothing (tab
    // switches, test-sound buttons) never light it up.
    const origSaveSettings = window.cc.saveSettings.bind(window.cc);
    window.cc.saveSettings = (patch) => {
        const savedPill = document.getElementById("s-autosave-pill");
        if (savedPill) savedPill.classList.remove("is-hidden");
        return origSaveSettings(patch);
    };

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings)
        btnSettings.addEventListener("click", () => openSettings());
    const tbarSettings = document.getElementById("tbar-btn-settings");
    if (tbarSettings)
        tbarSettings.addEventListener("click", () => openSettings());
    document
        .getElementById("s-close")
        .addEventListener("click", closeSettings);
    document
        .getElementById("s-nav-close")
        .addEventListener("click", closeSettings);
    document
        .getElementById("s-overlay")
        .addEventListener("click", (e) => {
            if (e.target === e.currentTarget) closeSettings();
        });
    // Esc or Enter anywhere dismisses the settings modal (document-level so
    // it also works when focus sits on the trigger outside the overlay).
    document.addEventListener("keydown", (e) => {
        const overlay = document.getElementById("s-overlay");
        if (!overlay.classList.contains("open")) return;
        if (e.key === "Escape" || e.key === "Enter") {
            e.preventDefault();
            closeSettings();
        }
    });

    // Space toggles play/pause while the Relax view is active. Skips
    // editable controls so typing (e.g. clock name) never triggers it.
    document.addEventListener("keydown", (e) => {
        if (e.key !== " " || curView !== "relax") return;
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        e.preventDefault();
        rTogglePlay();
    });

    // Settings tabs (sidebar nav buttons in the settings modal)
    document.querySelectorAll(".s-nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => switchSettingsTab(btn.dataset.stab));
    });

    // Format
    document.querySelectorAll(".s-fmt").forEach((b) => {
        b.addEventListener("click", () => {
            window.cc.saveSettings({ clockFormat: b.dataset.fmt });
            document
                .querySelectorAll(".s-fmt")
                .forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
        });
    });

    // Text size tiers (Appearance): apply live via the CSS var so the
    // change is visible instantly, and persist for next launch.
    document.querySelectorAll("#s-ui-scale .s-fmt").forEach((b) => {
        b.addEventListener("click", () => {
            const scale = parseFloat(b.dataset.uiScale) || 1;
            window.cc.saveSettings({ uiScale: scale });
            document.documentElement.style.setProperty(
                "--ui-scale",
                String(scale),
            );
            document
                .querySelectorAll("#s-ui-scale .s-fmt")
                .forEach((x) => x.classList.toggle("on", x === b));
        });
    });

    // Dial design (Appearance + floating switcher): the canvas loop picks
    // the new design on the very next frame (the face cache key includes
    // the design id), so persisting is all the live-apply it needs.
    // Both surfaces share the data-clock-design contract; match by value,
    // not by element, so a switcher click also lights the picker up.
    document.querySelectorAll("[data-clock-design]").forEach((b) => {
        b.addEventListener("click", () => {
            const design = parseInt(b.dataset.clockDesign, 10) || 1;
            cfg.clockDesign = design;
            window.cc.saveSettings({ clockDesign: design });
            updateDialDesignUI(design);
        });
    });
    const dialPrev = document.getElementById("dial-prev");
    const dialNext = document.getElementById("dial-next");
    if (dialPrev) {
        dialPrev.addEventListener("click", (e) => {
            e.stopPropagation();
            dialPrev.classList.add("hide-tooltip");
            dialPrev.blur();
            cycleDialDesign(1);
        });
        dialPrev.addEventListener("mouseleave", () => {
            dialPrev.classList.remove("hide-tooltip");
        });
    }
    if (dialNext) {
        dialNext.addEventListener("click", (e) => {
            e.stopPropagation();
            dialNext.classList.add("hide-tooltip");
            dialNext.blur();
            cycleDialDesign(-1);
        });
        dialNext.addEventListener("mouseleave", () => {
            dialNext.classList.remove("hide-tooltip");
        });
    }

    const sClockAutoCycle = document.getElementById("s-clock-auto-cycle");
    if (sClockAutoCycle) {
        sClockAutoCycle.addEventListener("change", (e) => {
            const val = e.target.checked;
            cfg.clockAutoCycle = val;
            const sub = document.getElementById("s-clock-auto-cycle-sub");
            if (sub) sub.style.display = val ? "flex" : "none";
            window.cc.saveSettings({ clockAutoCycle: val });
            setupClockAutoCycle();
        });
    }
    const sClockAutoCycleInterval = document.getElementById("s-clock-auto-cycle-interval");
    if (sClockAutoCycleInterval) {
        sClockAutoCycleInterval.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10) || 15;
            cfg.clockAutoCycleInterval = val;
            window.cc.saveSettings({ clockAutoCycleInterval: val });
            setupClockAutoCycle();
        });
    }
    const sClockAutoCycleMode = document.getElementById("s-clock-auto-cycle-mode");
    if (sClockAutoCycleMode) {
        sClockAutoCycleMode.addEventListener("change", (e) => {
            const val = e.target.value;
            cfg.clockAutoCycleMode = val;
            window.cc.saveSettings({ clockAutoCycleMode: val });
            setupClockAutoCycle();
        });
    }


    // Toggles
    document
        .getElementById("s-sec")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({ showSeconds: e.target.checked }),
        );
    // Analog clock brand wordmark — free text, max 16 chars; blank restores
    // the default. Saved on change (blur/Enter) to avoid a write per keystroke.
    // The Reset button appears only while the name differs from the default,
    // so the resting UI stays clean.
    const CLOCK_NAME_DEFAULT = "CYBERGEMS";
    const sClockName = document.getElementById("s-clock-name");
    const sClockNameRestore = document.getElementById("s-clock-name-restore");
    function refreshClockNameRestoreBtn() {
        if (!sClockName || !sClockNameRestore) return;
        const changed = (sClockName.value || "").trim() !== CLOCK_NAME_DEFAULT;
        sClockNameRestore.style.display = changed ? "" : "none";
    }
    if (sClockName) {
        sClockName.addEventListener("input", refreshClockNameRestoreBtn);
        sClockName.addEventListener("change", () => {
            const text = sClockName.value.trim().slice(0, 16);
            sClockName.value = text;
            window.cc.saveSettings({ clockBrand: text });
            refreshClockNameRestoreBtn();
        });
    }
    if (sClockNameRestore) {
        sClockNameRestore.addEventListener("click", () => {
            if (sClockName) sClockName.value = CLOCK_NAME_DEFAULT;
            window.cc.saveSettings({ clockBrand: CLOCK_NAME_DEFAULT });
            refreshClockNameRestoreBtn();
        });
    }
    // Initial visibility for the loaded settings (applySettings fills the
    // input before this runs via onInit → applySettings ordering).
    refreshClockNameRestoreBtn();

    // Optional display name for the full-mode welcome greeting. Saved on
    // change so typing stays local and does not trigger a write per key.
    const sDisplayName = document.getElementById("s-display-name");
    if (sDisplayName) {
        sDisplayName.addEventListener("input", () => {
            const text = sDisplayName.value.trim().replace(/\s+/g, " ").slice(0, 32);
            cfg.displayName = text;
            updateGreeting();
        });
        sDisplayName.addEventListener("change", () => {
            const text = sDisplayName.value.trim().replace(/\s+/g, " ").slice(0, 32);
            sDisplayName.value = text;
            cfg.displayName = text;
            window.cc.saveSettings({ displayName: text });
            updateGreeting();
        });
    }

    // Hide analog clock / hide calendar: side grips on Home view and Settings
    // toggles drive the respective settings through broadcast round-trip.
    const clockGrip = document.getElementById("clock-grip");
    if (clockGrip) {
        clockGrip.addEventListener("click", () => {
            window.cc.saveSettings({ fullHideClock: !(cfg.fullHideClock === true) });
        });
    }
    const sHideClock = document.getElementById("s-hide-clock");
    if (sHideClock) {
        sHideClock.addEventListener("change", (e) => {
            window.cc.saveSettings({ fullHideClock: e.target.checked });
        });
    }
    const calGrip = document.getElementById("cal-grip");
    if (calGrip) {
        calGrip.addEventListener("click", () => {
            window.cc.saveSettings({ fullHideCalendar: !(cfg.fullHideCalendar === true) });
        });
    }
    const sHideCal = document.getElementById("s-hide-cal");
    if (sHideCal) {
        sHideCal.addEventListener("change", (e) => {
            window.cc.saveSettings({ fullHideCalendar: e.target.checked });
        });
    }
    // Greeting card click opens Settings on General tab with username field focused and selected
    const calGreetingCard = document.getElementById("cal-greeting-card");
    if (calGreetingCard) {
        calGreetingCard.addEventListener("click", () => {
            openSettings("general", "#s-display-name");
        });
    }
    // Mini mode settings
    document.querySelectorAll('[data-mini-design]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.dataset.miniDesign);
            document.querySelectorAll('[data-mini-design]').forEach((b) => b.classList.remove('on'));
            btn.classList.add('on');
            // Real Sun Cycle row only applies to design 7 — sync its visibility
            const solarRow = document.getElementById('s-mini-solar-row');
            if (solarRow) solarRow.style.display = mode === 7 ? 'flex' : 'none';
            window.cc.saveSettings({ miniDesign: mode });
        });
    });

    const sMiniAutoCycle = document.getElementById("s-mini-auto-cycle");
    if (sMiniAutoCycle) {
        sMiniAutoCycle.addEventListener("change", (e) => {
            const val = e.target.checked;
            cfg.miniAutoCycle = val;
            const sub = document.getElementById("s-mini-auto-cycle-sub");
            if (sub) sub.style.display = val ? "flex" : "none";
            window.cc.saveSettings({ miniAutoCycle: val });
        });
    }
    const sMiniAutoCycleInterval = document.getElementById("s-mini-auto-cycle-interval");
    if (sMiniAutoCycleInterval) {
        sMiniAutoCycleInterval.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10) || 15;
            cfg.miniAutoCycleInterval = val;
            window.cc.saveSettings({ miniAutoCycleInterval: val });
        });
    }
    const sMiniAutoCycleMode = document.getElementById("s-mini-auto-cycle-mode");
    if (sMiniAutoCycleMode) {
        sMiniAutoCycleMode.addEventListener("change", (e) => {
            const val = e.target.value;
            cfg.miniAutoCycleMode = val;
            window.cc.saveSettings({ miniAutoCycleMode: val });
        });
    }
    const sMiniBgOp = document.getElementById('s-minibg-op');
    if (sMiniBgOp) {
        sMiniBgOp.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            document.getElementById('s-minibg-op-val').textContent = v + '%';
            window.cc.saveSettings({ miniBgOpacity: v / 100 });
        });
    }
    const sMiniOp = document.getElementById('s-mini-op');
    if (sMiniOp) {
        sMiniOp.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            document.getElementById('s-mini-op-val').textContent = v + '%';
            window.cc.saveSettings({ miniOpacity: v / 100 });
        });
    }
    // Mini zoom — discrete stops: 50 / 100 (default) / 200 / 400 %
    const MINI_ZOOM_STEPS = [0.5, 1, 2, 4];
    const sMiniZoom = document.getElementById('s-mini-zoom');
    if (sMiniZoom) {
        sMiniZoom.addEventListener('input', (e) => {
            const idx = parseInt(e.target.value);
            const factor = MINI_ZOOM_STEPS[idx] ?? 1;
            document.getElementById('s-mini-zoom-val').textContent = Math.round(factor * 100) + '%';
            window.cc.saveSettings({ miniZoom: factor });
        });
    }
    const sMiniLock = document.getElementById('s-mini-lock');
    if (sMiniLock) {
        sMiniLock.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniPositionLocked: e.target.checked });
        });
    }
    const sMiniCollapse = document.getElementById('s-mini-collapse');
    if (sMiniCollapse) {
        sMiniCollapse.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniCollapseDate: e.target.checked });
        });
    }
    const sMiniScan = document.getElementById('s-mini-scan');
    if (sMiniScan) {
        sMiniScan.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniScanlines: e.target.checked });
        });
    }
    const sMiniSolar = document.getElementById('s-mini-solar');
    if (sMiniSolar) {
        sMiniSolar.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniSolarReal: e.target.checked });
        });
    }
    const sMiniClickThrough = document.getElementById('s-mini-clickthrough');
    if (sMiniClickThrough) {
        sMiniClickThrough.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniClickThrough: e.target.checked });
        });
    }
    const sMiniAnim = document.getElementById('s-mini-anim');
    if (sMiniAnim) {
        sMiniAnim.addEventListener('change', (e) => {
            window.cc.saveSettings({ miniNoAnimations: e.target.checked });
        });
    }
    document
        .getElementById("s-aot")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({ alwaysOnTop: e.target.checked }),
        );
    document
        .getElementById("s-startup")
        .addEventListener("change", (e) => {
            const checked = e.target.checked;
            window.cc.setStartup(checked);
            document.getElementById("s-startup-mini-row").style.display = checked ? "flex" : "none";
            window.cc.saveSettings({
                startWithWindows: checked,
            });
        });
    document
        .getElementById("s-startup-mini")
        .addEventListener("change", (e) => {
            window.cc.saveSettings({
                startInMiniMode: e.target.checked,
            });
        });
    // Master audio mute (same setting the tray toggle drives)
    const sCloseAction = document.getElementById("s-close-action");
    if (sCloseAction) {
        sCloseAction.addEventListener("change", (e) => {
            const val = e.target.value;
            let closeToTray = null;
            if (val === "tray") closeToTray = true;
            else if (val === "quit") closeToTray = false;
            window.cc.saveSettings({ closeToTray });
        });
    }
    const sAudioMute = document.getElementById("s-audio-mute");
    if (sAudioMute) {
        sAudioMute.addEventListener("change", (e) => {
            window.cc.saveSettings({ audioMuted: e.target.checked });
        });
    }
    document
        .getElementById("s-lang")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({ language: e.target.value }),
        );

    // ── Brand footer / About ────────────────────────────────
    // The update flow, diagnostics and links live in the dedicated About
    // window (src/about/) since v1.3 — the settings modal only shows the
    // brand footer (version + copyright) that launches it, mirroring
    // CyberViewer's config modal.
    let appVersion = "";

    function renderBrandVersion() {
        const el = document.getElementById("s-brand-version");
        if (!el) return;
        el.textContent = `v${appVersion || "…"}`;
    }

    window.cc.getAppVersion().then((v) => {
        appVersion = v;
        renderBrandVersion();
    });

    const brandAboutBtn = document.getElementById("s-brand-about");
    if (brandAboutBtn) {
        brandAboutBtn.addEventListener("click", () => {
            window.cc.openWindow("about");
        });
    }

    // Windows Integration: open the classic date and time properties
    // dialog (timedate.cpl), same as the taskbar clock's context menu.
    const sBtnDatetime = document.getElementById("s-btn-datetime");
    if (sBtnDatetime) {
        sBtnDatetime.addEventListener("click", () => {
            window.cc.openDatetimeProperties();
        });
    }

    // Clock accuracy: drift readout under the Windows Integration
    // section. The backend checks on its own (boot retries + every 6h)
    // and notifies when the drift exceeds a minute; this UI only shows
    // the measurement and offers a manual check.
    function formatDriftString(drift) {
        if (drift == null) return "";
        const abs = Math.abs(drift);
        const driftTxt = abs < 60000 ? (abs / 1000).toFixed(1) + " s"
            : abs < 3600000 ? Math.round(abs / 60000) + " min"
            : abs < 86400000 ? Math.round(abs / 3600000) + " h"
            : Math.round(abs / 86400000) + " d";
        const sign = drift >= 0 ? "+" : "-";
        return sign + driftTxt;
    }

    function renderClockAccuracy(s) {
        const el = document.getElementById("s-clock-status");
        if (!el) return;
        const drift = s ? s.clockDriftMs : null;
        const at = s ? s.clockCheckedAt : null;
        if (drift == null || at == null) {
            el.textContent = window.ccI18n.t("settings.general.clockNever");
            return;
        }
        const when = new Date(at * 1000).toLocaleString();
        el.textContent = window.ccI18n.t("settings.general.clockDrift") + ": " + formatDriftString(drift)
            + " · " + window.ccI18n.t("settings.general.clockLastCheck") + ": " + when;
    }

    let clockDriftBannerDismissed = false;

    function updateClockDriftBanner(s) {
        const banner = document.getElementById("clock-drift-banner");
        if (!banner) return;
        const drift = s ? s.clockDriftMs : null;
        if (drift != null && Math.abs(drift) > 60000 && !clockDriftBannerDismissed) {
            const desc = document.getElementById("clock-drift-banner-desc");
            if (desc) {
                desc.textContent = window.ccI18n.t("banner.clockDriftMsg", {
                    drift: formatDriftString(drift)
                });
            }
            banner.hidden = false;
        } else {
            banner.hidden = true;
        }
    }

    const btnDriftDismiss = document.getElementById("btn-drift-dismiss");
    if (btnDriftDismiss) {
        btnDriftDismiss.addEventListener("click", () => {
            clockDriftBannerDismissed = true;
            const banner = document.getElementById("clock-drift-banner");
            if (banner) banner.hidden = true;
        });
    }

    const btnDriftSync = document.getElementById("btn-drift-sync");
    if (btnDriftSync) {
        btnDriftSync.addEventListener("click", async () => {
            btnDriftSync.disabled = true;
            btnDriftSync.classList.add("is-syncing");
            try {
                const res = await window.cc.syncSystemClock();
                if (res && res.drift_ms != null) {
                    cfg.clockDriftMs = res.drift_ms;
                    cfg.clockCheckedAt = res.checked_at;
                    renderClockAccuracy(cfg);
                    updateClockDriftBanner(cfg);
                }
            } catch (e) {
                console.error("Time sync failed:", e);
            } finally {
                btnDriftSync.disabled = false;
                btnDriftSync.classList.remove("is-syncing");
            }
        });
    }

    if (window.cc.onClockAccuracy) {
        window.cc.onClockAccuracy((payload) => {
            if (!payload) return;
            if (payload.source === "unreachable") {
                const el = document.getElementById("s-clock-status");
                if (el) el.textContent = window.ccI18n.t("settings.general.clockUnreachable");
                return;
            }
            cfg.clockDriftMs = payload.driftMs;
            cfg.clockCheckedAt = payload.checkedAt;
            renderClockAccuracy(cfg);
            updateClockDriftBanner(cfg);
        });
    }

    const sClockAcc = document.getElementById("s-clock-acc");
    if (sClockAcc) {
        sClockAcc.addEventListener("change", (e) => {
            window.cc.saveSettings({ clockAccuracyEnabled: e.target.checked });
        });
    }

    // Automatic monitor: full mode opens where the mouse is.
    // Automatic monitor: full mode opens where the mouse is. While it
    // is on, the manual picker below has no effect, so it is disabled.
    function syncDisplayAutoUI(auto) {
        const screens = document.getElementById("s-screens");
        if (screens) screens.classList.toggle("is-disabled", auto === true);
    }
    const sDisplayAuto = document.getElementById("s-display-auto");
    if (sDisplayAuto) {
        sDisplayAuto.addEventListener("change", (e) => {
            window.cc.saveSettings({ displayAuto: e.target.checked });
            syncDisplayAutoUI(e.target.checked);
        });
    }

    // Global hotkey recorder: click the field, press the combination.
    // Backspace/Delete or the X button clear it (disabled); Escape
    // cancels. Bare keys are ignored so typing is never hijacked.
    const sHotkey = document.getElementById("s-hotkey");
    const sHotkeyDesc = document.getElementById("s-hotkey-desc");
    const DEFAULT_HOTKEY = "Alt+Shift+C";
    const HOTKEY_MODIFIER_KEYS = ["Control", "Shift", "Alt", "Meta"];

    function friendlyHotkey(canonical) {
        if (!canonical) return "";
        return canonical
            .split("+")
            .map((part) => part.replace(/^Key/, "").replace(/^Digit/, ""))
            .join("+");
    }
    function renderHotkey() {
        if (!sHotkey) return;
        const val = cfg.hotkeyToggle || "";
        sHotkey.value = friendlyHotkey(val);
        sHotkey.classList.toggle("is-empty", !val);
        sHotkey.classList.remove("is-recording");
        if (sHotkeyDesc) {
            sHotkeyDesc.textContent = window.ccI18n.t(
                val ? "settings.general.hotkeyDesc" : "settings.general.hotkeyOff",
            );
        }
    }
    async function commitHotkey(raw) {
        try {
            const normalized = await window.cc.setHotkey(raw);
            cfg.hotkeyToggle = normalized || "";
        } catch (err) {
            console.warn("setHotkey rejected:", err);
            if (sHotkeyDesc) {
                sHotkeyDesc.textContent = window.ccI18n.t("settings.general.hotkeyInvalid");
            }
        }
        renderHotkey();
    }
    if (sHotkey) {
        sHotkey.addEventListener("keydown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") {
                renderHotkey();
                sHotkey.blur();
                return;
            }
            if (e.key === "Backspace" || e.key === "Delete") {
                commitHotkey("");
                return;
            }
            if (HOTKEY_MODIFIER_KEYS.includes(e.key)) {
                // Modifiers alone: show the partial combo and wait for
                // the final key.
                const mods = [];
                if (e.ctrlKey) mods.push("Ctrl");
                if (e.altKey) mods.push("Alt");
                if (e.shiftKey) mods.push("Shift");
                if (e.metaKey) mods.push("Win");
                sHotkey.value = mods.join("+") + "+…";
                sHotkey.classList.add("is-recording");
                return;
            }
            if (!(e.ctrlKey || e.altKey || e.metaKey)) {
                // Bare keys would hijack normal typing: ignore.
                renderHotkey();
                return;
            }
            const parts = [];
            if (e.ctrlKey) parts.push("Ctrl");
            if (e.altKey) parts.push("Alt");
            if (e.shiftKey) parts.push("Shift");
            if (e.metaKey) parts.push("Win");
            let keyLabel = e.key === " " ? "Space" : e.key;
            parts.push(keyLabel.length === 1 ? keyLabel.toUpperCase() : keyLabel);
            commitHotkey(parts.join("+"));
        });
        sHotkey.addEventListener("blur", renderHotkey);
    }
    const sHotkeyClear = document.getElementById("s-hotkey-clear");
    if (sHotkeyClear) {
        sHotkeyClear.addEventListener("click", () => commitHotkey(""));
    }
    const sHotkeyRestore = document.getElementById("s-hotkey-restore");
    if (sHotkeyRestore) {
        sHotkeyRestore.addEventListener("click", () => commitHotkey(DEFAULT_HOTKEY));
    }

    const sBtnClockCheck = document.getElementById("s-btn-clock-check");
    if (sBtnClockCheck) {
        sBtnClockCheck.addEventListener("click", async () => {
            sBtnClockCheck.disabled = true;
            const lbl = sBtnClockCheck.querySelector('[data-i18n="settings.general.clockCheck"]');
            const prev = lbl ? lbl.textContent : null;
            if (lbl) lbl.textContent = window.ccI18n.t("settings.general.clockChecking");
            try {
                const res = await window.cc.checkClockAccuracy();
                // Success and unreachable both arrive via the
                // clock:accuracy event; a null result (bridge fallback)
                // still gets the unreachable text.
                if (!res) {
                    const el = document.getElementById("s-clock-status");
                    if (el) el.textContent = window.ccI18n.t("settings.general.clockUnreachable");
                }
            } finally {
                sBtnClockCheck.disabled = false;
                if (lbl && prev != null) lbl.textContent = prev;
            }
        });
    }

    // Unattended time synchronization settings and actions
    async function renderTimeSyncSettings() {
        if (!window.cc || !window.cc.getTimeSyncTaskStatus) return;
        try {
            const isRegistered = await window.cc.getTimeSyncTaskStatus();
            const badge = document.getElementById("s-timesync-task-status");
            const btnLbl = document.getElementById("s-btn-timesync-task-lbl");
            const autoRow = document.getElementById("s-row-clock-auto-sync");
            if (badge) {
                badge.textContent = window.ccI18n.t(
                    isRegistered ? "settings.general.timeSyncStatusActive" : "settings.general.timeSyncStatusInactive"
                );
                badge.classList.toggle("active", isRegistered);
            }
            if (btnLbl) {
                btnLbl.textContent = window.ccI18n.t(
                    isRegistered ? "settings.general.timeSyncBtnAuthorized" : "settings.general.timeSyncBtnEnable"
                );
            }
            if (sBtnTimeSyncTask) {
                sBtnTimeSyncTask.disabled = isRegistered;
            }
            if (sClockAutoSync) {
                sClockAutoSync.disabled = !isRegistered;
            }
            if (autoRow) {
                autoRow.classList.toggle("is-disabled", !isRegistered);
            }
        } catch (e) {
            console.warn("renderTimeSyncSettings error:", e);
        }
    }

    const sClockAutoSync = document.getElementById("s-clock-auto-sync");
    if (sClockAutoSync) {
        sClockAutoSync.addEventListener("change", (e) => {
            window.cc.saveSettings({ clockAutoSync: e.target.checked });
        });
    }

    const sShowSuite = document.getElementById("s-show-suite");
    if (sShowSuite) {
        sShowSuite.addEventListener("change", (e) => {
            window.cc.saveSettings({ showSuiteRecommendations: e.target.checked });
        });
    }

    const sBtnTimeSyncTask = document.getElementById("s-btn-timesync-task");
    if (sBtnTimeSyncTask) {
        sBtnTimeSyncTask.addEventListener("click", async () => {
            const btnLbl = document.getElementById("s-btn-timesync-task-lbl");
            const badge = document.getElementById("s-timesync-task-status");
            sBtnTimeSyncTask.disabled = true;
            if (btnLbl) btnLbl.textContent = window.ccI18n.t("settings.general.timeSyncAuthorizing");
            if (badge) badge.textContent = window.ccI18n.t("settings.general.timeSyncAuthorizing");
            try {
                const isRegistered = await window.cc.getTimeSyncTaskStatus();
                if (isRegistered) {
                    await window.cc.removeTimeSyncTask();
                } else {
                    await window.cc.setupTimeSyncTask();
                }
                await renderTimeSyncSettings();
            } catch (e) {
                console.error("Task setup/remove failed:", e);
                await renderTimeSyncSettings();
            } finally {
                sBtnTimeSyncTask.disabled = false;
            }
        });
    }

    const sBtnSyncTime = document.getElementById("s-btn-sync-time");
    if (sBtnSyncTime) {
        sBtnSyncTime.addEventListener("click", async () => {
            sBtnSyncTime.disabled = true;
            const statusEl = document.getElementById("s-timesync-run-status");
            if (statusEl) {
                statusEl.style.display = "inline-block";
                statusEl.className = "s-status-badge warning";
                statusEl.textContent = window.ccI18n.t("settings.general.timeSyncing");
            }
            try {
                const res = await window.cc.syncSystemClock();
                if (res && res.drift_ms != null) {
                    cfg.clockDriftMs = res.drift_ms;
                    cfg.clockCheckedAt = res.checked_at;
                    renderClockAccuracy(cfg);
                    updateClockDriftBanner(cfg);
                    if (statusEl) {
                        statusEl.className = "s-status-badge active";
                        statusEl.textContent = window.ccI18n.t("settings.general.timeSyncSuccess");
                        setTimeout(() => { statusEl.style.display = "none"; }, 4000);
                    }
                }
            } catch (e) {
                if (statusEl) {
                    statusEl.className = "s-status-badge warning";
                    statusEl.textContent = window.ccI18n.t("settings.general.timeSyncError");
                    setTimeout(() => { statusEl.style.display = "none"; }, 4000);
                }
            } finally {
                sBtnSyncTime.disabled = false;
            }
        });
    }

    const sBtnReset = document.getElementById("s-btn-reset");
    if (sBtnReset) {
        sBtnReset.addEventListener("click", () => {
            openCustomConfirm({
                title: window.ccI18n.t("settings.general.resetConfirmTitle"),
                msg: window.ccI18n.t("settings.general.resetConfirmMsg"),
                okText: window.ccI18n.t("settings.general.resetBtn"),
                onOk: async () => {
                    const newSettings = await window.cc.resetSettings();
                    applySettings(newSettings);
                    renderCalendar();
                },
            });
        });
    }

    // Alarms
    document
        .getElementById("s-half-en")
        .addEventListener("change", (e) => {
            if (e.target.checked) {
                document.getElementById("s-full-en").checked = false;
                document.getElementById("s-quart-en").checked = false;
                window.cc.saveSettings({
                    alarmHalfHour: { ...cfg.alarmHalfHour, enabled: true },
                    alarmFullHour: { ...cfg.alarmFullHour, enabled: false },
                    alarmQuarterHour: { ...cfg.alarmQuarterHour, enabled: false }
                });
            } else {
                window.cc.saveSettings({
                    alarmHalfHour: { ...cfg.alarmHalfHour, enabled: false }
                });
            }
        });
    document
        .getElementById("s-full-en")
        .addEventListener("change", (e) => {
            if (e.target.checked) {
                document.getElementById("s-half-en").checked = false;
                document.getElementById("s-quart-en").checked = false;
                window.cc.saveSettings({
                    alarmFullHour: { ...cfg.alarmFullHour, enabled: true },
                    alarmHalfHour: { ...cfg.alarmHalfHour, enabled: false },
                    alarmQuarterHour: { ...cfg.alarmQuarterHour, enabled: false }
                });
            } else {
                window.cc.saveSettings({
                    alarmFullHour: { ...cfg.alarmFullHour, enabled: false }
                });
            }
        });
    document
        .getElementById("s-quart-en")
        .addEventListener("change", (e) => {
            if (e.target.checked) {
                document.getElementById("s-half-en").checked = false;
                document.getElementById("s-full-en").checked = false;
                window.cc.saveSettings({
                    alarmQuarterHour: { ...cfg.alarmQuarterHour, enabled: true },
                    alarmHalfHour: { ...cfg.alarmHalfHour, enabled: false },
                    alarmFullHour: { ...cfg.alarmFullHour, enabled: false }
                });
            } else {
                window.cc.saveSettings({
                    alarmQuarterHour: { ...cfg.alarmQuarterHour, enabled: false }
                });
            }
        });
    document
        .getElementById("s-half-snd")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({
                alarmHalfHour: { ...cfg.alarmHalfHour, sound: e.target.value },
            }),
        );
    document
        .getElementById("s-full-snd")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({
                alarmFullHour: { ...cfg.alarmFullHour, sound: e.target.value },
            }),
        );
    document
        .getElementById("s-quart-snd")
        .addEventListener("change", (e) =>
            window.cc.saveSettings({
                alarmQuarterHour: { ...cfg.alarmQuarterHour, sound: e.target.value },
            }),
        );
    document
        .getElementById("s-half-test")
        .addEventListener("click", () => {
            const ah = cfg.alarmHalfHour || {};
            if (ah.customPath) {
                window.audioEngine.playFile(ah.customPath, { loop: false });
            } else {
                window.audioEngine.chime(
                    document.getElementById("s-half-snd").value,
                    cfg.alarmVolume || 0.75,
                );
            }
        });
    document
        .getElementById("s-full-test")
        .addEventListener("click", () => {
            const af = cfg.alarmFullHour || {};
            if (af.customPath) {
                window.audioEngine.playFile(af.customPath, { loop: false });
            } else {
                window.audioEngine.chime(
                    document.getElementById("s-full-snd").value,
                    cfg.alarmVolume || 0.75,
                );
            }
        });
    document
        .getElementById("s-quart-test")
        .addEventListener("click", () => {
            const aq = cfg.alarmQuarterHour || {};
            if (aq.customPath) {
                window.audioEngine.playFile(aq.customPath, { loop: false });
            } else {
                window.audioEngine.chime(
                    document.getElementById("s-quart-snd").value,
                    cfg.alarmVolume || 0.75,
                );
            }
        });
    document
        .getElementById("s-half-file")
        .addEventListener("click", async () => {
            const p = await window.cc.openFileDialog();
            if (p) {
                window.cc.saveSettings({
                    alarmHalfHour: { ...cfg.alarmHalfHour, customPath: p },
                });
                showCustomFile("half", p);
            }
        });
    document
        .getElementById("s-full-file")
        .addEventListener("click", async () => {
            const p = await window.cc.openFileDialog();
            if (p) {
                window.cc.saveSettings({
                    alarmFullHour: { ...cfg.alarmFullHour, customPath: p },
                });
                showCustomFile("full", p);
            }
        });
    document
        .getElementById("s-quart-file")
        .addEventListener("click", async () => {
            const p = await window.cc.openFileDialog();
            if (p) {
                window.cc.saveSettings({
                    alarmQuarterHour: { ...cfg.alarmQuarterHour, customPath: p },
                });
                showCustomFile("quart", p);
            }
        });
    document
        .getElementById("s-half-fclr")
        .addEventListener("click", () => {
            window.cc.saveSettings({
                alarmHalfHour: { ...cfg.alarmHalfHour, customPath: null },
            });
            showCustomFile("half", null);
        });
    document
        .getElementById("s-full-fclr")
        .addEventListener("click", () => {
            window.cc.saveSettings({
                alarmFullHour: { ...cfg.alarmFullHour, customPath: null },
            });
            showCustomFile("full", null);
        });
    document
        .getElementById("s-quart-fclr")
        .addEventListener("click", () => {
            window.cc.saveSettings({
                alarmQuarterHour: { ...cfg.alarmQuarterHour, customPath: null },
            });
            showCustomFile("quart", null);
        });

    // Alarm Schedule Restrictions
    document.getElementById("s-alarm-sched-en").addEventListener("change", (e) => {
        window.cc.saveSettings({ alarmScheduleEnabled: e.target.checked });
    });
    ['s-alarm-sched-start-h', 's-alarm-sched-start-m', 's-alarm-sched-start-ap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                window.cc.saveSettings({ alarmScheduleStart: getAlarmSchedTime("start") });
            });
        }
    });
    ['s-alarm-sched-end-h', 's-alarm-sched-end-m', 's-alarm-sched-end-ap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                window.cc.saveSettings({ alarmScheduleEnd: getAlarmSchedTime("end") });
            });
        }
    });

    // Volumes
    document.getElementById("s-avol").addEventListener("input", (e) => {
        document.getElementById("s-avol-val").textContent =
            e.target.value + "%";
        clearTimeout(sDebounce.av);
        sDebounce.av = setTimeout(
            () =>
                window.cc.saveSettings({
                    alarmVolume: e.target.value / 100,
                }),
            300,
        );
    });
    document.getElementById("s-rvol").addEventListener("input", (e) => {
        document.getElementById("s-rvol-val").textContent =
            e.target.value + "%";
        window.audioEngine.setVolume(e.target.value / 100);
        clearTimeout(sDebounce.rv);
        sDebounce.rv = setTimeout(
            () =>
                window.cc.saveSettings({
                    relaxVolume: e.target.value / 100,
                }),
            300,
        );
    });

    // ══════════════════════════════════════════════════════════════
    // TITLE BAR BUTTONS
    // ══════════════════════════════════════════════════════════════
    // No dragging here on purpose: full mode always covers the work
    // area of its monitor (only minimize is allowed), and starting a
    // system caption drag would re-enable the native double-click
    // maximize/restore toggle, which let the window end up bigger
    // than the monitor on multi-DPI setups.
    const btnAot = document.getElementById("btn-aot");
    if (btnAot) {
        btnAot.addEventListener("click", async () => {
            const on = await window.cc.toggleAlwaysOnTop();
            btnAot.classList.toggle("on", on);
        });
    }
    // ── First-Close Confirmation Modal ───────────────────────
    const firstCloseOverlay = document.getElementById("first-close-overlay");
    const firstCloseRememberChk = document.getElementById("first-close-remember-chk");
    const btnFirstCloseQuit = document.getElementById("btn-first-close-quit");
    const btnFirstCloseTray = document.getElementById("btn-first-close-tray");

    function openFirstCloseModal() {
        if (!firstCloseOverlay) return;
        if (firstCloseRememberChk) firstCloseRememberChk.checked = false;
        firstCloseOverlay.hidden = false;
    }

    function closeFirstCloseModal() {
        if (firstCloseOverlay) firstCloseOverlay.hidden = true;
    }

    function handleFirstCloseChoice(action) {
        closeFirstCloseModal();
        const remember = firstCloseRememberChk ? firstCloseRememberChk.checked : false;
        if (remember) {
            window.cc.saveSettings({ closeToTray: action === "tray" });
        }
        if (action === "tray") {
            window.cc.hideWindow("main");
        } else {
            if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
            else window.close();
        }
    }

    if (btnFirstCloseQuit) {
        btnFirstCloseQuit.addEventListener("click", () => handleFirstCloseChoice("quit"));
    }
    if (btnFirstCloseTray) {
        btnFirstCloseTray.addEventListener("click", () => handleFirstCloseChoice("tray"));
    }

    window.addEventListener("keydown", (e) => {
        if (!firstCloseOverlay || firstCloseOverlay.hidden) return;

        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeFirstCloseModal();
        } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleFirstCloseChoice("tray");
        } else if (e.key === " " || e.code === "Space") {
            const tag = (e.target && e.target.tagName) || "";
            if (tag === "INPUT" || tag === "BUTTON") return;
            e.preventDefault();
            e.stopPropagation();
            handleFirstCloseChoice("quit");
        }
    });

    function requestWindowClose() {
        if (cfg && cfg.closeToTray === true) {
            window.cc.hideWindow("main");
        } else if (cfg && cfg.closeToTray === false) {
            if (window.cc && window.cc.closeWindow) window.cc.closeWindow();
            else window.close();
        } else {
            openFirstCloseModal();
        }
    }

    document
        .getElementById("btn-mini")
        .addEventListener("click", () => window.cc.goMini());
    document
        .getElementById("btn-close")
        .addEventListener("click", () => requestWindowClose());

    // ── Titlebar Brand (click -> About window) ────────────────
    const tbarBrand = document.getElementById("tbar-brand");
    if (tbarBrand) {
        tbarBrand.addEventListener("click", () => {
            if (window.cc && window.cc.showAboutWindow) {
                window.cc.showAboutWindow();
            }
        });
        tbarBrand.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (window.cc && window.cc.showAboutWindow) {
                    window.cc.showAboutWindow();
                }
            }
        });
    }

    // ── Titlebar More Menu ────────────────────────────────────
    const tbarBtnMore = document.getElementById("tbar-btn-more");
    const tbarMoreMenu = document.getElementById("tbar-more-menu");
    function hideTbarMoreMenu() {
        if (!tbarMoreMenu || tbarMoreMenu.hidden) return;
        tbarMoreMenu.hidden = true;
        if (tbarBtnMore) {
            tbarBtnMore.setAttribute("aria-expanded", "false");
            tbarBtnMore.classList.remove("on");
        }
    }
    function toggleTbarMoreMenu() {
        if (!tbarMoreMenu) return;
        const willShow = tbarMoreMenu.hidden;
        hideAllContextMenus();
        tbarMoreMenu.hidden = !willShow;
        if (tbarBtnMore) {
            tbarBtnMore.setAttribute("aria-expanded", String(willShow));
            tbarBtnMore.classList.toggle("on", willShow);
        }
    }
    if (tbarBtnMore && tbarMoreMenu) {
        tbarBtnMore.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleTbarMoreMenu();
        });
        document.addEventListener("click", (e) => {
            if (!tbarMoreMenu.hidden && !tbarMoreMenu.contains(e.target) && e.target !== tbarBtnMore) {
                hideTbarMoreMenu();
            }
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !tbarMoreMenu.hidden) {
                hideTbarMoreMenu();
            }
        });

        tbarMoreMenu.querySelectorAll(".tbar-more-item").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                hideTbarMoreMenu();
                const action = btn.dataset.action;
                if (action === "toggle_pin") {
                    const on = await window.cc.toggleAlwaysOnTop();
                    btnAot?.classList.toggle("on", on);
                } else if (action === "mini_mode") {
                    window.cc.goMini();
                } else if (action === "time_sync") {
                    try {
                        const res = await window.cc.syncSystemClock();
                        if (res && res.drift_ms != null) {
                            cfg.clockDriftMs = res.drift_ms;
                            cfg.clockCheckedAt = res.checked_at;
                            renderClockAccuracy(cfg);
                            updateClockDriftBanner(cfg);
                        }
                    } catch (err) {
                        console.error("Time sync from more menu failed:", err);
                    }
                } else if (action === "docs") {
                    window.cc.openExternalUrl("https://github.com/CyberGems/CyberClock/wiki");
                } else if (action === "website") {
                    window.cc.openExternalUrl("https://cybergems.org");
                } else if (action === "donate") {
                    window.cc.openExternalUrl("https://ko-fi.com/cybergems");
                } else if (action === "about") {
                    window.cc.showAboutWindow();
                } else if (action === "exit") {
                    if (window.cc && window.cc.trayMenuAction) {
                        window.cc.trayMenuAction("quit");
                    }
                }
            });
        });
    }

    // ══════════════════════════════════════════════════════════════
    // CUSTOM CONTEXT MENUS (Full Mode & Text Inputs)
    // ══════════════════════════════════════════════════════════════
    const fullCtxMenu = document.getElementById("full-ctx-menu");
    const textCtxMenu = document.getElementById("text-ctx-menu");
    let activeTextTarget = null;

    function positionCtxMenu(menuEl, x, y) {
        menuEl.style.display = "block";
        const menuWidth = menuEl.offsetWidth;
        const menuHeight = menuEl.offsetHeight;
        const posX = (x + menuWidth > window.innerWidth) ? Math.max(8, window.innerWidth - menuWidth - 8) : Math.max(8, x);
        const posY = (y + menuHeight > window.innerHeight) ? Math.max(8, window.innerHeight - menuHeight - 8) : Math.max(8, y);
        menuEl.style.left = `${posX}px`;
        menuEl.style.top = `${posY}px`;
    }

    function showFullContextMenu(x, y) {
        hideAllContextMenus();
        if (fullCtxMenu) positionCtxMenu(fullCtxMenu, x, y);
    }

    function showTextContextMenu(x, y, targetInput) {
        hideAllContextMenus();
        activeTextTarget = targetInput;
        if (!textCtxMenu) return;

        const hasSelection = typeof targetInput.selectionStart === "number" &&
            targetInput.selectionStart !== targetInput.selectionEnd;
        const hasValue = (targetInput.value || "").length > 0;
        const isReadOnly = Boolean(targetInput.readOnly || targetInput.disabled);

        const btnCut = document.getElementById("ctx-text-cut");
        const btnCopy = document.getElementById("ctx-text-copy");
        const btnPaste = document.getElementById("ctx-text-paste");
        const btnSelectAll = document.getElementById("ctx-text-selectall");
        const btnClear = document.getElementById("ctx-text-clear");

        if (btnCut) btnCut.classList.toggle("disabled", !hasSelection || isReadOnly);
        if (btnCopy) btnCopy.classList.toggle("disabled", !hasSelection);
        if (btnPaste) btnPaste.classList.toggle("disabled", isReadOnly);
        if (btnSelectAll) btnSelectAll.classList.toggle("disabled", !hasValue);
        if (btnClear) btnClear.classList.toggle("disabled", !hasValue || isReadOnly);

        positionCtxMenu(textCtxMenu, x, y);
    }

    function hideAllContextMenus() {
        if (fullCtxMenu) fullCtxMenu.style.display = "none";
        if (textCtxMenu) textCtxMenu.style.display = "none";
    }

    document.addEventListener("contextmenu", (e) => {
        const textTarget = e.target.closest("input[type='text'], input[type='number'], input[type='search'], input:not([type]), textarea");
        e.preventDefault();
        if (textTarget) {
            showTextContextMenu(e.clientX, e.clientY, textTarget);
        } else {
            showFullContextMenu(e.clientX, e.clientY);
        }
    });

    // Close context menu on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".ctx-menu")) {
            hideAllContextMenus();
        }
    });

    // Close context menu on escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideAllContextMenus();
        }
    });

    // Close context menu on blur (when clicking outside window)
    window.addEventListener("blur", () => {
        hideAllContextMenus();
    });

    // Wire context menu items
    document.getElementById("ctx-btn-mini").addEventListener("click", () => {
        hideAllContextMenus();
        window.cc.goMini();
    });
    document.getElementById("ctx-btn-home").addEventListener("click", () => {
        hideAllContextMenus();
        navigate("home");
    });
    document.getElementById("ctx-btn-timer").addEventListener("click", () => {
        hideAllContextMenus();
        navigate("timer");
    });
    document.getElementById("ctx-btn-stopwatch").addEventListener("click", () => {
        hideAllContextMenus();
        navigate("stopwatch");
    });
    document.getElementById("ctx-btn-relax").addEventListener("click", () => {
        hideAllContextMenus();
        navigate("relax");
    });
    document.getElementById("ctx-btn-dial-cycle")?.addEventListener("click", () => {
        hideAllContextMenus();
        cycleDialDesign(1);
    });
    document.getElementById("ctx-btn-settings").addEventListener("click", () => {
        hideAllContextMenus();
        openSettings();
    });
    document.getElementById("ctx-btn-close").addEventListener("click", () => {
        hideAllContextMenus();
        window.cc.hideWindow("main");
    });

    // Wire text context menu actions
    document.getElementById("ctx-text-cut")?.addEventListener("click", async () => {
        if (!activeTextTarget || activeTextTarget.readOnly || activeTextTarget.disabled) {
            hideAllContextMenus();
            return;
        }
        const start = activeTextTarget.selectionStart;
        const end = activeTextTarget.selectionEnd;
        if (typeof start === "number" && typeof end === "number" && start !== end) {
            const selectedText = activeTextTarget.value.substring(start, end);
            try {
                await navigator.clipboard.writeText(selectedText);
            } catch (_) {}
            activeTextTarget.setRangeText("", start, end, "end");
            activeTextTarget.dispatchEvent(new Event("input", { bubbles: true }));
        }
        activeTextTarget.focus();
        hideAllContextMenus();
    });

    document.getElementById("ctx-text-copy")?.addEventListener("click", async () => {
        if (!activeTextTarget) {
            hideAllContextMenus();
            return;
        }
        const start = activeTextTarget.selectionStart;
        const end = activeTextTarget.selectionEnd;
        if (typeof start === "number" && typeof end === "number" && start !== end) {
            const selectedText = activeTextTarget.value.substring(start, end);
            try {
                await navigator.clipboard.writeText(selectedText);
            } catch (_) {}
        }
        activeTextTarget.focus();
        hideAllContextMenus();
    });

    document.getElementById("ctx-text-paste")?.addEventListener("click", async () => {
        if (!activeTextTarget || activeTextTarget.readOnly || activeTextTarget.disabled) {
            hideAllContextMenus();
            return;
        }
        activeTextTarget.focus();
        try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
                const start = activeTextTarget.selectionStart ?? activeTextTarget.value.length;
                const end = activeTextTarget.selectionEnd ?? activeTextTarget.value.length;
                const maxLen = activeTextTarget.maxLength > 0 ? activeTextTarget.maxLength : Infinity;
                const currentLen = activeTextTarget.value.length - (end - start);
                const allowedText = clipText.slice(0, Math.max(0, maxLen - currentLen));
                activeTextTarget.setRangeText(allowedText, start, end, "end");
                activeTextTarget.dispatchEvent(new Event("input", { bubbles: true }));
            }
        } catch (_) {
            document.execCommand("paste");
        }
        hideAllContextMenus();
    });

    document.getElementById("ctx-text-selectall")?.addEventListener("click", () => {
        if (activeTextTarget) {
            activeTextTarget.focus();
            activeTextTarget.select();
        }
        hideAllContextMenus();
    });

    document.getElementById("ctx-text-clear")?.addEventListener("click", () => {
        if (activeTextTarget && !activeTextTarget.readOnly && !activeTextTarget.disabled) {
            activeTextTarget.value = "";
            activeTextTarget.dispatchEvent(new Event("input", { bubbles: true }));
            activeTextTarget.focus();
        }
        hideAllContextMenus();
    });


    // ═══════════════════════════════════════════════════════════
    // AUTO SCHEDULER (Backend Assisted)
    // ═══════════════════════════════════════════════════════════
    const ALL_TRACKS = ['night','forest','space','ocean','rain','fireplace'];
    let shuffleQueue = [];

    // Custom time selector (honours 12h/24h from settings; stores 24h "HH:MM")
    function buildSchedTimeOptions() {
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById('sched-time-h');
        const mSel = document.getElementById('sched-time-m');
        const apSel = document.getElementById('sched-time-ap');
        if (!hSel || !mSel || !apSel) return;
        hSel.innerHTML = '';
        const hStart = is12 ? 1 : 0, hEnd = is12 ? 12 : 23;
        for (let h = hStart; h <= hEnd; h++) {
            const o = document.createElement('option');
            o.value = String(h); o.textContent = pad(h);
            hSel.appendChild(o);
        }
        if (!mSel.options.length) {
            for (let m = 0; m <= 59; m++) {
                const o = document.createElement('option');
                o.value = String(m); o.textContent = pad(m);
                mSel.appendChild(o);
            }
        }
        apSel.style.display = is12 ? '' : 'none';
    }
    function setSchedTime(hhmm) {
        const [H, M] = (hhmm || '22:00').split(':').map(Number);
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById('sched-time-h');
        const mSel = document.getElementById('sched-time-m');
        const apSel = document.getElementById('sched-time-ap');
        if (!hSel) return;
        mSel.value = String(M);
        if (is12) {
            let h12 = H % 12; if (h12 === 0) h12 = 12;
            hSel.value = String(h12);
            apSel.value = H >= 12 ? 'PM' : 'AM';
        } else {
            hSel.value = String(H);
        }
    }
    function getSchedTime() {
        const is12 = cfg.clockFormat === '12h';
        const hSel = document.getElementById('sched-time-h');
        const mSel = document.getElementById('sched-time-m');
        const apSel = document.getElementById('sched-time-ap');
        let H = parseInt(hSel.value, 10);
        const M = parseInt(mSel.value, 10);
        if (is12) {
            if (apSel.value === 'AM') { if (H === 12) H = 0; }
            else { if (H !== 12) H += 12; }
        }
        return pad(H) + ':' + pad(M);
    }
    function fmtSchedDisplay(H, M) {
        if (cfg.clockFormat === '12h') {
            const ap = H >= 12 ? 'PM' : 'AM';
            let h12 = H % 12; if (h12 === 0) h12 = 12;
            return `${pad(h12)}:${pad(M)} ${ap}`;
        }
        return `${pad(H)}:${pad(M)}`;
    }

    function applySchedUI(s) {
        const sched = s.relaxScheduler || {};
        document.getElementById('sched-enable').checked = !!sched.enabled;
        buildSchedTimeOptions();
        setSchedTime(sched.time || '22:00');
        document.getElementById('sched-repeat').value = String(sched.repeat !== undefined ? sched.repeat : 60);
        document.getElementById('sched-track').value = sched.track || 'random-one';
        document.getElementById('sched-duration').value = String(sched.duration !== undefined ? sched.duration : 15);
        updateSchedStatus(sched);
    }
    function getSchedTrack(trackOverride) {
        const sched = cfg.relaxScheduler || {};
        const t = trackOverride || sched.track || 'random-one';
        if (t === 'random-one') return ALL_TRACKS[Math.floor(Math.random() * ALL_TRACKS.length)];
        if (t === 'shuffle-all') {
            if (shuffleQueue.length === 0) shuffleQueue = [...ALL_TRACKS].sort(() => Math.random() - 0.5);
            return shuffleQueue.shift();
        }
        return t;
    }
    function updateSchedStatus(sched) {
        const statusEl = document.getElementById('sched-status');
        const nextEl = document.getElementById('sched-next');
        const t = (key, vars) => window.ccI18n.t(key, vars);
        if (!sched || !sched.enabled) {
            if (statusEl) { statusEl.textContent = t("relax.schedOff"); statusEl.classList.remove('on'); }
            if (nextEl) nextEl.textContent = t("relax.schedOffNext");
            updateRelaxSchedLine(sched);
            return;
        }
        if (statusEl) { statusEl.textContent = t("relax.schedOn"); statusEl.classList.add('on'); }

        // Next run: the backend's loop re-fires every `repeat` minutes
        // from the first firing at `time`, so mirror that math here.
        const [h, m] = (sched.time || '22:00').split(':').map(Number);
        const repeat = sched.repeat !== undefined ? sched.repeat : 60;
        const now = new Date();
        let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
        if (repeat > 0) {
            // Recurring: roll forward from the start time by full repeat
            // intervals until we're strictly past "now".
            while (next <= now) {
                next = new Date(next.getTime() + repeat * 60000);
            }
        } else if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        if (nextEl) {
            nextEl.textContent = t("relax.schedNextRun", {
                time: fmtSchedDisplay(next.getHours(), next.getMinutes()),
            });
        }
        updateRelaxSchedLine(sched, next);
    }

    // Compact status line on the Relax view: "Next: 22:00 · Rain · 15m".
    // The scheduler's controls live in Settings; the Relax view only
    // needs to answer "when is the next automatic session?".
    function updateRelaxSchedLine(sched, next) {
        const lineEl = document.getElementById('r-sched-line');
        if (!lineEl) return;
        if (!sched || !sched.enabled) {
            lineEl.textContent = "";
            lineEl.style.display = "none";
            return;
        }
        const t = (key, vars) => window.ccI18n.t(key, vars);
        const durKey = `relax.duration.${sched.duration}m`;
        let duration;
        if (sched.duration === 0) duration = t("relax.duration.stopped");
        else if (sched.duration === 60) duration = t("relax.duration.1h");
        else duration = t(durKey);
        const trackLabel = sched.track === 'random-one' ? t("relax.track.randomOne")
            : sched.track === 'shuffle-all' ? t("relax.track.shuffleAll")
            : t(`relax.track.${sched.track}`);
        const when = next
            ? fmtSchedDisplay(next.getHours(), next.getMinutes())
            : (sched.time || '22:00');
        lineEl.style.display = "";
        lineEl.textContent = t("relax.schedStatus", {
            time: when, track: trackLabel, duration,
        });
    }

    // Scheduler event listeners
    document.getElementById('sched-enable').addEventListener('change', (e) => {
        window.cc.saveSettings({
            relaxScheduler: { ...cfg.relaxScheduler, enabled: e.target.checked }
        });
    });
    ['sched-time-h', 'sched-time-m', 'sched-time-ap'].forEach((id) => {
        document.getElementById(id).addEventListener('change', () => {
            window.cc.saveSettings({
                relaxScheduler: { ...cfg.relaxScheduler, time: getSchedTime() }
            });
        });
    });
    document.getElementById('sched-repeat').addEventListener('change', (e) => {
        window.cc.saveSettings({
            relaxScheduler: { ...cfg.relaxScheduler, repeat: parseInt(e.target.value) }
        });
    });
    document.getElementById('sched-track').addEventListener('change', (e) => {
        window.cc.saveSettings({
            relaxScheduler: { ...cfg.relaxScheduler, track: e.target.value }
        });
    });
    document.getElementById('sched-duration').addEventListener('change', (e) => {
        window.cc.saveSettings({
            relaxScheduler: { ...cfg.relaxScheduler, duration: parseInt(e.target.value) }
        });
    });

    document.getElementById("r-next-tip").addEventListener("click", showNextTip);

    window.ccI18n.onChange((effective, configured) => {
        if (!window.audioEngine.isPlaying) {
            const el = document.getElementById("r-tip");
            if (el) el.textContent = window.ccI18n.t("relax.startPrompt");
        } else {
            showNextTip();
        }
        updateDialDesignUI(cfg.clockDesign || 1);
        renderUpdateNotice();
    });

    // ══════════════════════════════════════════════════════════════
    // IPC
    // ══════════════════════════════════════════════════════════════
    const updateActionBtn = document.getElementById("update-notice-action");
    if (updateActionBtn) updateActionBtn.addEventListener("click", handleUpdateNoticeAction);
    const updateSkipBtn = document.getElementById("update-notice-skip");
    if (updateSkipBtn) updateSkipBtn.addEventListener("click", skipCurrentUpdate);
    const updateReleaseBtn = document.getElementById("update-notice-release");
    if (updateReleaseBtn) updateReleaseBtn.addEventListener("click", openCurrentRelease);
    const updateCloseBtn = document.getElementById("update-notice-close");
    if (updateCloseBtn) {
        updateCloseBtn.addEventListener("click", () => {
            updateNoticeDismissed = true;
            hideUpdateNotice();
        });
    }
    if (window.cc && window.cc.isPortable) {
        window.cc.isPortable().then((value) => {
            updatePortable = !!value;
            if (updateStatus.state === "available" || updateStatus.state === "downloaded") {
                renderUpdateNotice();
            }
        }).catch(() => {});
    }
    if (window.cc && window.cc.onUpdateStatus) {
        window.cc.onUpdateStatus(handleUpdateStatus);
    }

    window.cc.onInit((s) => {
        applySettings(s);
        const startPromptEl = document.getElementById("r-tip");
        if (startPromptEl) startPromptEl.textContent = window.ccI18n.t("relax.startPrompt");
        setMainActive(true);
        syncDigitalClock();
        calNotes = s.calendarNotes || {};
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        renderCalendar();
        requestAnimationFrame(() => {
            setupClock();
            syncHomeClock();
            if (typeof drawClock === "function" && isMainActive() && curView === "home") {
                drawClock();
            }
        });
        // Clicking the analog clock opens Settings on Appearance with the
        // clock-name field focused and selected, ready to type.
        const clockCanvas = document.getElementById("clock-canvas");
        if (clockCanvas) {
            clockCanvas.style.cursor = "pointer";
            clockCanvas.addEventListener("click", () =>
                openSettings("appearance", "#s-clock-name"),
            );
        }
        window.addEventListener("resize", () => {
            stopClockAnim();
            setupClock();
            syncHomeClock();
        });
        // Dynamically adjust clock canvas whenever the clock panel resizes (debounced to keep CSS animations silky smooth)
        const clockPanelEl = document.querySelector(".clock-panel");
        if (clockPanelEl && typeof ResizeObserver !== "undefined") {
            let prevW = 0, prevH = 0;
            let resizeTimer = null;
            const ro = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const w = Math.floor(entry.contentRect.width);
                    const h = Math.floor(entry.contentRect.height);
                    if (w !== prevW || h !== prevH) {
                        prevW = w;
                        prevH = h;
                        if (resizeTimer) clearTimeout(resizeTimer);
                        resizeTimer = setTimeout(() => {
                            setupClock();
                        }, 460);
                    }
                }
            });
            ro.observe(clockPanelEl);
        }

        // Auto-reveal bottom navigation bar when cursor approaches the bottom in solo-clock mode
        document.addEventListener("mousemove", (e) => {
            if (document.body.classList.contains("home-no-calendar") && curView === "home") {
                const nearBottom = e.clientY >= window.innerHeight - 80;
                const nav = document.querySelector(".floating-nav");
                if (nav) nav.classList.toggle("nav-revealed", nearBottom);
            }
        });
    });

    window.cc.onSettingsUpdated((s) => {
        applySettings(s);
        // Keep calendar notes in sync if changed elsewhere.
        let notesChanged = false;
        if (s.calendarNotes) {
            if (
                JSON.stringify(s.calendarNotes) !==
                JSON.stringify(calNotes)
            ) {
                calNotes = s.calendarNotes;
                notesChanged = true;
            }
        }
        if (typeof calYear === "number") {
            // Full re-render when notes changed; otherwise just refresh
            // the dashboard so agenda/stats follow a language switch.
            if (notesChanged) renderCalendar();
            else renderDashboard();
        }
        const overlay = document.getElementById("s-overlay");
        if (overlay && overlay.classList.contains("open")) {
            loadScreensList();
        }
    });

    window.cc.onMiniMenuAction((action) => {
        if (action === "settings") {
            openSettings();
        } else if (action.startsWith("open-note:")) {
            const dateStr = action.split(":")[1];
            const [y, m, d] = dateStr.split("-").map(Number);
            const m0 = m - 1;
            
            navigate("home");
            calYear = y;
            calMonth = m0;
            selDate = dateStr;
            renderCalendar();
            openNoteModal(y, m0, d);
        } else if (VIEW_ORDER.includes(action)) {
            navigate(action);
        }
    });

    window.cc.onAlarmChime((p) => {
        if (p.customPath) window.audioEngine.playFile(p.customPath, { loop: false });
        else
            window.audioEngine.chime(
                p.sound || "chime-digital",
                cfg.alarmVolume || 0.75,
            );
    });

    // Tray quick toggle: play/pause the relax audio without navigating.
    if (window.cc && window.cc.onTrayRelaxToggle) {
        window.cc.onTrayRelaxToggle(() => {
            if (window.audioEngine.isPlaying) {
                rPauseOrResume();
            } else if (rSelected) {
                rPlayTrack();
            } else {
                startZenFlow();
            }
        });
    }

    window.cc.onRelaxTrigger((p) => {
        const track = getSchedTrack(p.track);
        // Scheduled sessions always start from silence (not blended with
        // whatever might still be fading out) and at the configured volume.
        window.audioEngine.clearLayers();
        rPaused = false;
        preSelectRelaxTrack(track);
        rSelected = track;
        rPlayTrack();
        const dur = parseInt(p.duration);
        if (dur > 0) {
            rAstMins = dur;
            rStartAutoStop(dur * 60);
            document.querySelectorAll(".ast-btn").forEach((x) =>
                x.classList.toggle("on", parseInt(x.dataset.min) === dur)
            );
        }
    });

