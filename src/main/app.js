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

    // Skin dots (sidebar + settings)
    function applySkin(t) {
        document.body.dataset.theme = t;
        document
            .querySelectorAll(".skin-dot")
            .forEach((d) =>
                d.classList.toggle("active", d.dataset.theme === t),
            );
        document
            .querySelectorAll(".s-ttile")
            .forEach((d) =>
                d.classList.toggle("on", d.dataset.theme === t),
            );
    }

    document.querySelectorAll(".skin-dot").forEach((d) =>
        d.addEventListener("click", () => {
            window.cc.saveSettings({ theme: d.dataset.theme });
            applySkin(d.dataset.theme);
        }),
    );

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
    function applySettings(s) {
        cfg = s;
        document.body.dataset.theme = s.theme || "arctic-ice";
        // Scanlines are mini-mode only — full mode never has them
        applySkin(s.theme || "arctic-ice");
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
        const clockNameEl = document.getElementById("s-clock-name");
        if (clockNameEl) {
            clockNameEl.value = s.clockBrand || "CYBERGEMS";
            // Keep the Reset button in sync with the loaded value.
            if (typeof refreshClockNameRestoreBtn === "function") {
                refreshClockNameRestoreBtn();
            }
        }
        // Hide analog clock (full-mode Home): collapse the panel and let
        // the calendar dashboard absorb the freed width.
        const hideClock = s.fullHideClock === true;
        const homeView = document.getElementById("view-home");
        if (homeView) homeView.classList.toggle("no-clock", hideClock);
        const hideClockEl = document.getElementById("s-hide-clock");
        if (hideClockEl) hideClockEl.checked = hideClock;
        const gripEl = document.getElementById("clock-grip");
        if (gripEl) {
            gripEl.title = window.ccI18n.t(
                hideClock ? "tooltip.showClock" : "tooltip.hideClock",
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

        const langEl = document.getElementById("s-lang");
        if (langEl) langEl.value = s.language || "auto";
        window.ccI18n.setLang(s.language || "auto");
        window.ccI18n.apply(document);
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
    let mainActive = false;
    function isMainActive() {
        return mainActive;
    }
    function setMainActive(v) {
        const nv = !!v;
        mainActive = nv;
        document.body.classList.toggle("cc-inactive", !nv);
        syncHomeClock();
        syncDigitalClock();
    }

    function syncHomeClock() {
        const hidden = document
            .getElementById("view-home")
            ?.classList.contains("no-clock");
        if (!hidden && isMainActive() && curView === "home") {
            startClockAnim();
        } else {
            stopClockAnim();
        }
    }

    document.addEventListener("visibilitychange", () => {
        syncHomeClock();
        syncDigitalClock();
    });

    window.cc.onActiveWindow((label) => setMainActive(label === "main"));

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
        const panel = canvas.parentElement;
        const size = Math.min(
            panel.clientWidth - 36,
            panel.clientHeight - 36,
        );
        canvas.width = size;
        canvas.height = size;
        cybergemsCacheKey = null;
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

    function drawClock(ts) {
        const canvas = document.getElementById("clock-canvas");
        if (!canvas || curView !== "home" || !mainActive) {
            clockRaf = null;
            return;
        }
        // Schedule the next frame first, then bail out early if we are
        // still inside the current frame budget (framerate cap).
        clockRaf = requestAnimationFrame(drawClock);
        if (ts === undefined) ts = performance.now();
        if (ts - clockLastFrame < CLOCK_FRAME_MS - 0.5) {
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
        // size or accent color changes — the ticks/markers/numerals and
        // their shadowBlur strokes no longer redraw at 60fps.
        const faceKey = `${W}x${H}|${c.accent}|${c.rgb}`;
        if (faceKey !== clockFaceKey) {
            clockFaceCanvas = buildClockFace(W, H, cx, cy, R, c);
            clockFaceKey = faceKey;
        }
        ctx.drawImage(clockFaceCanvas, 0, 0);

        // ── Breathing outer rim highlight (signature glow) ──
        const br =
            0.68 +
            0.18 * (1 - Math.cos((Date.now() * 2 * Math.PI) / 3200));
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.985, 0, Math.PI * 2);
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.globalAlpha = br;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();

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
        const gemsKey = `${R}|${tracking}|${word}`;
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

        // Hands
        hand(ctx, cx, cy, hrA, R * 0.52, 5.5, c.accent, 10);
        hand(ctx, cx, cy, minA, R * 0.74, 3.5, c.accent, 8);
        hand(ctx, cx, cy, secA, R * 0.83, 1.5, c.handSec, 12);
        hand(ctx, cx, cy, secA + Math.PI, R * 0.14, 3.5, c.handSec, 8);

        // Center jewel
        ctx.save();
        ctx.shadowColor = c.accent;
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

    // ── Note modal ────────────────────────────────────────────────
    let noteEditKey = null;

    function longDateLabel(y, m, d) {
        const dt = new Date(y, m, d);
        const lang = window.ccI18n.getEffectiveLang();
        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = dt.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }

    function openNoteModal(y, m, d) {
        noteEditKey = isoKey(y, m, d);
        document.getElementById("note-date-lbl").textContent =
            longDateLabel(y, m, d);
        const ta = document.getElementById("note-text");
        ta.value = calNotes[noteEditKey] || "";
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
        if (text) calNotes[noteEditKey] = text;
        else delete calNotes[noteEditKey];
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
        .getElementById("note-close")
        .addEventListener("click", closeNoteModal);
    document
        .getElementById("note-overlay")
        .addEventListener("click", (e) => {
            if (e.target === e.currentTarget) closeNoteModal();
        });
    document
        .getElementById("note-text")
        .addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveNote();
            } else if (e.key === "Escape") {
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
        canvas.width = canvas.offsetWidth;
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

    function switchSettingsTab(tabName) {
        document
            .querySelectorAll(".s-nav-btn")
            .forEach((t) => t.classList.toggle("on", t.dataset.stab === tabName));
        document
            .querySelectorAll(".s-panel")
            .forEach((p) => p.classList.toggle("on", p.id === "stab-" + tabName));
    }

    function openSettings(targetTab, focusSelector) {
        document.getElementById("s-overlay").classList.add("open");
        // Only explicit string tabs switch; raw event objects from direct
        // click bindings must never clear the active tab.
        if (typeof targetTab === "string" && targetTab) {
            switchSettingsTab(targetTab);
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
                card.style.cssText = `
                  display:flex;align-items:center;gap:12px;
                  padding:12px 14px;
                  background:${s.current ? "var(--accent-dim)" : "var(--bg-01)"};
                  border:1px solid ${s.current ? "var(--border-active)" : "var(--border)"};
                  border-radius:6px;margin-bottom:8px;
                  box-shadow:${s.current ? "var(--glow-xs)" : "none"};
                  transition:all .2s;
                `;
                const primaryText = window.ccI18n.t('settings.display.primary');
                const activeText = window.ccI18n.t('settings.display.active');
                const inUseText = window.ccI18n.t('settings.display.inUse');
                const moveHereText = window.ccI18n.t('settings.display.moveHere');

                card.innerHTML = `
                  <div style="font-size:22px;flex-shrink:0;">${s.primary ? "🖥️" : "📺"}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-family:'Orbitron',monospace;font-size:9px;letter-spacing:1.5px;
                      color:${s.current ? "var(--accent-a)" : "var(--text-md)"};
                      text-shadow:${s.current ? "var(--glow-xs)" : "none"};
                      text-transform:uppercase;margin-bottom:3px;">
                      ${s.label}
                      ${s.primary ? `<span style="font-size:7px;background:var(--accent-dim);border:1px solid var(--border-bright);color:var(--accent-a);border-radius:3px;padding:1px 5px;margin-left:6px;">${primaryText}</span>` : ""}
                      ${s.current ? `<span style="font-size:7px;background:rgba(var(--rgb-accent),.2);border:1px solid var(--border-active);color:var(--accent-a);border-radius:3px;padding:1px 5px;margin-left:4px;">${activeText}</span>` : ""}
                    </div>
                    <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-lo);">
                      ${s.width} × ${s.height} px  &nbsp;·&nbsp;
                      pos (${s.x}, ${s.y})
                    </div>
                  </div>
                      ${
                      s.current
                          ? `<span style="font-family:'Orbitron',monospace;font-size:8px;letter-spacing:1px;color:var(--accent-a);text-shadow:var(--glow-xs);">${inUseText}</span>`
                          : `<button data-did="${s.id}" class="s-move-btn"
                        style="font-family:'Orbitron',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;
                          background:transparent;border:1px solid var(--border-bright);color:var(--accent-a);
                          padding:7px 14px;border-radius:4px;cursor:pointer;white-space:nowrap;transition:all .18s;"
                      >${moveHereText}</button>`
                  }
                `;
                el.appendChild(card);
            });

            // Wire Move Here buttons
            el.querySelectorAll(".s-move-btn").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const id = parseInt(btn.dataset.did);
                    btn.textContent = "…";
                    btn.disabled = true;
                    const res = await window.cc.selectDisplay(id);
                    if (res) {
                        // Refresh list to show new ACTIVE state
                        setTimeout(loadScreensList, 150);
                    } else {
                        btn.textContent = window.ccI18n.t('settings.display.error');
                    }
                });
            });
        });
    }
    function closeSettings() {
        const overlay = document.getElementById("s-overlay");
        // Commit any pending field edit (e.g. the clock name) before hiding:
        // blur fires the control's change handler while it is still live.
        const active = document.activeElement;
        if (active && overlay.contains(active)) active.blur();
        overlay.classList.remove("open");
    }

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings)
        btnSettings.addEventListener("click", () => openSettings());
    document
        .getElementById("nav-btn-settings")
        .addEventListener("click", () => openSettings());
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

    // Theme tiles
    document.querySelectorAll(".s-ttile").forEach((t) => {
        t.addEventListener("click", () => {
            window.cc.saveSettings({ theme: t.dataset.theme });
            applySkin(t.dataset.theme);
        });
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

    // Hide analog clock — the side grip on the Home view and the Settings
    // toggle drive the same setting through the same broadcast round-trip.
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
    document.querySelector(".tbar").addEventListener("mousedown", (e) => {
        if (e.target.closest(".tbar-right, .tbar-brand")) return;
        if (e.button === 0 && window.cc && window.cc.startDragging) {
            window.cc.startDragging();
        }
    });

    const btnAot = document.getElementById("btn-aot");
    if (btnAot) {
        btnAot.addEventListener("click", async () => {
            const on = await window.cc.toggleAlwaysOnTop();
            btnAot.classList.toggle("on", on);
        });
    }
    document
        .getElementById("btn-mini")
        .addEventListener("click", () => window.cc.goMini());
    document
        .getElementById("btn-close")
        .addEventListener("click", () => window.cc.hideWindow("main"));

    // ══════════════════════════════════════════════════════════════
    // CUSTOM CONTEXT MENU (Full Mode)
    // ══════════════════════════════════════════════════════════════
    const fullCtxMenu = document.getElementById("full-ctx-menu");

    function showFullContextMenu(x, y) {
        // Ensure menu position stays on screen
        fullCtxMenu.style.display = "block";
        
        const menuWidth = fullCtxMenu.offsetWidth;
        const menuHeight = fullCtxMenu.offsetHeight;
        
        const posX = (x + menuWidth > window.innerWidth) ? Math.max(8, window.innerWidth - menuWidth - 8) : Math.max(8, x);
        const posY = (y + menuHeight > window.innerHeight) ? Math.max(8, window.innerHeight - menuHeight - 8) : Math.max(8, y);
        
        fullCtxMenu.style.left = `${posX}px`;
        fullCtxMenu.style.top = `${posY}px`;
    }

    function hideFullContextMenu() {
        fullCtxMenu.style.display = "none";
    }

    document.addEventListener("contextmenu", (e) => {
        // Ignore context menu on inputs/textareas so default behaves normally
        if (e.target.closest("input, textarea")) return;
        
        e.preventDefault();
        showFullContextMenu(e.clientX, e.clientY);
    });

    // Close context menu on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".ctx-menu")) {
            hideFullContextMenu();
        }
    });

    // Close context menu on escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideFullContextMenu();
        }
    });

    // Close context menu on blur (when clicking outside window)
    window.addEventListener("blur", () => {
        hideFullContextMenu();
    });

    // Wire context menu items
    document.getElementById("ctx-btn-mini").addEventListener("click", () => {
        hideFullContextMenu();
        window.cc.goMini();
    });
    document.getElementById("ctx-btn-home").addEventListener("click", () => {
        hideFullContextMenu();
        navigate("home");
    });
    document.getElementById("ctx-btn-timer").addEventListener("click", () => {
        hideFullContextMenu();
        navigate("timer");
    });
    document.getElementById("ctx-btn-stopwatch").addEventListener("click", () => {
        hideFullContextMenu();
        navigate("stopwatch");
    });
    document.getElementById("ctx-btn-relax").addEventListener("click", () => {
        hideFullContextMenu();
        navigate("relax");
    });
    document.getElementById("ctx-btn-settings").addEventListener("click", () => {
        hideFullContextMenu();
        openSettings();
    });
    document.getElementById("ctx-btn-close").addEventListener("click", () => {
        hideFullContextMenu();
        window.cc.hideWindow("main");
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
    });

    // ══════════════════════════════════════════════════════════════
    // IPC
    // ══════════════════════════════════════════════════════════════
    window.cc.onInit((s) => {
        applySettings(s);
        const startPromptEl = document.getElementById("r-tip");
        if (startPromptEl) startPromptEl.textContent = window.ccI18n.t("relax.startPrompt");
        // Initial active state from saved mode; live updates arrive via
        // the backend "cc:active-window" broadcast.
        setMainActive((s.windowMode || s.window_mode) === "full");
        syncDigitalClock();
        calNotes = s.calendarNotes || {};
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        renderCalendar();
        requestAnimationFrame(() => {
            setupClock();
            syncHomeClock();
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

