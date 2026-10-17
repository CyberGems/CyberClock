(function () {
    "use strict";

    const tipEl = document.getElementById("mini-tip");
    let currentPayload = null;
    let tipDesign = "1";

    function isoNow() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function renderTip(data) {
        if (!data || !tipEl) return;
        currentPayload = data;
        tipDesign = data.design || "1";
        tipEl.dataset.design = tipDesign;

        if (window.CCTint && data.theme) window.CCTint.apply(data.theme);
        if (window.ccI18n && data.language) window.ccI18n.setLang(data.language);

        const t = (key, vars) => (window.ccI18n ? window.ccI18n.t(key, vars) : key);
        tipEl.replaceChildren();

        // 1. Alarm notice (if active)
        if (data.alarm) {
            const alarmBlock = document.createElement("div");
            alarmBlock.className = "mini-tip-alarm";
            alarmBlock.addEventListener("click", (e) => e.stopPropagation());

            const alarmTitle = document.createElement("div");
            alarmTitle.className = "mini-tip-alarm-title";
            alarmTitle.textContent = window.ccI18n?.displayAlarmLabel
                ? window.ccI18n.displayAlarmLabel(data.alarm.label)
                : (data.alarm.label || t("alarms.notice.title"));

            const alarmMsg = document.createElement("div");
            alarmMsg.className = "mini-tip-alarm-msg";
            alarmMsg.textContent = data.alarm.message || t("alarms.notice.now");

            const alarmActions = document.createElement("div");
            alarmActions.className = "mini-tip-alarm-actions";

            if (data.alarm.alarmId) {
                const snoozeBtn = document.createElement("button");
                snoozeBtn.type = "button";
                snoozeBtn.className = "mini-tip-alarm-btn";
                const snoozeMinutes = Number(data.alarm.snoozeMinutes) || 10;
                snoozeBtn.textContent = t("alarms.notice.snoozeFor", { n: snoozeMinutes });
                snoozeBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (window.cc?.snoozeAlarm) {
                        try {
                            await window.cc.snoozeAlarm(data.alarm.alarmId, snoozeMinutes);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
                });
                alarmActions.appendChild(snoozeBtn);
            }

            const dismissBtn = document.createElement("button");
            dismissBtn.type = "button";
            dismissBtn.className = "mini-tip-alarm-btn";
            dismissBtn.textContent = t("alarms.notice.dismiss");
            dismissBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (window.cc?.dismissAlarm && data.alarm.alarmId) {
                    try {
                        await window.cc.dismissAlarm(data.alarm.alarmId);
                    } catch (err) {
                        console.error(err);
                    }
                }
                if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
            });
            alarmActions.appendChild(dismissBtn);

            alarmBlock.appendChild(alarmTitle);
            alarmBlock.appendChild(alarmMsg);
            alarmBlock.appendChild(alarmActions);
            tipEl.appendChild(alarmBlock);
            tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";
        }

        // 2. Update notice (if active)
        if (data.updateVersion) {
            const updBlock = document.createElement("div");
            updBlock.className = "mini-tip-update";
            updBlock.addEventListener("click", (e) => e.stopPropagation());

            const updHeader = document.createElement("div");
            updHeader.className = "mini-tip-update-header";
            const updTitle = document.createElement("span");
            updTitle.className = "mini-tip-update-title";
            updTitle.textContent = "CyberClock";
            const updVer = document.createElement("span");
            updVer.className = "mini-tip-update-ver";
            updVer.textContent = `v${data.updateVersion}`;
            updHeader.appendChild(updTitle);
            updHeader.appendChild(updVer);
            updBlock.appendChild(updHeader);

            const updActions = document.createElement("div");
            updActions.className = "mini-tip-update-actions";

            const btnOpen = document.createElement("button");
            btnOpen.type = "button";
            btnOpen.className = "mini-tip-update-btn primary";
            btnOpen.textContent = t("update.prompt.viewAndUpdate");
            btnOpen.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.cc?.goFull) window.cc.goFull();
                if (window.cc?.menuAction) window.cc.menuAction("open-update");
                if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
            });

            const btnDismiss = document.createElement("button");
            btnDismiss.type = "button";
            btnDismiss.className = "mini-tip-update-btn";
            btnDismiss.textContent = t("update.prompt.dismiss");
            btnDismiss.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.cc?.skipUpdate) window.cc.skipUpdate(data.updateVersion);
                if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
            });

            updActions.appendChild(btnOpen);
            updActions.appendChild(btnDismiss);
            updBlock.appendChild(updActions);
            tipEl.appendChild(updBlock);
            tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";
        }

        // 3. Date header
        const dateDiv = document.createElement("div");
        dateDiv.className = "mini-tip-date";
        dateDiv.textContent = data.dateStr || "";
        tipEl.appendChild(dateDiv);
        tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";

        // 4. Clock drift block (if significant)
        if (data.driftMs != null && Math.abs(data.driftMs) > 60000) {
            const abs = Math.abs(data.driftMs);
            const driftTxt = abs < 60000 ? (abs / 1000).toFixed(1) + " s"
                : abs < 3600000 ? Math.round(abs / 60000) + " min"
                : abs < 86400000 ? Math.round(abs / 3600000) + " h"
                : Math.round(abs / 86400000) + " d";
            const sign = data.driftMs >= 0 ? "+" : "-";

            const driftBlock = document.createElement("div");
            driftBlock.className = "mini-tip-drift-block";

            const driftHead = document.createElement("div");
            driftHead.className = "mini-tip-drift-head";
            driftHead.textContent = `⚠️ ${t("mini.tip.clockDriftTitle")}`;
            driftBlock.appendChild(driftHead);

            const driftMsg = document.createElement("div");
            driftMsg.className = "mini-tip-drift-msg";
            driftMsg.textContent = t("mini.tip.clockDriftMsg", { drift: sign + driftTxt });
            driftBlock.appendChild(driftMsg);

            const syncBtn = document.createElement("button");
            syncBtn.type = "button";
            syncBtn.className = "mini-tip-sync-btn";
            syncBtn.textContent = t("mini.tip.syncNow");
            syncBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                syncBtn.disabled = true;
                syncBtn.textContent = t("settings.general.timeSyncing");
                try {
                    await window.cc?.syncSystemClock();
                    if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
                } catch (err) {
                    console.error(err);
                    syncBtn.textContent = t("settings.general.timeSyncError");
                }
            });
            driftBlock.appendChild(syncBtn);
            tipEl.appendChild(driftBlock);
            tipEl.appendChild(document.createElement("div")).className = "mini-tip-divider";
        }

        // 5. Note or empty note button
        if (data.note) {
            const noteDiv = document.createElement("div");
            noteDiv.className = "mini-tip-note";
            noteDiv.textContent = `📝 ${data.note.split("\n")[0].trim()}`;
            tipEl.appendChild(noteDiv);
        } else {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "mini-tip-note empty";
            emptyDiv.textContent = `🌸 ${t("mini.tip.noNotes")}`;
            tipEl.appendChild(emptyDiv);

            const btnDiv = document.createElement("div");
            btnDiv.className = "mini-tip-action-btn";
            btnDiv.textContent = t("mini.tip.createNote");
            tipEl.appendChild(btnDiv);
        }

        // 6. Upcoming events stat
        const upcoming = data.upcoming || 0;
        let statText;
        if (upcoming === 0) {
            statText = t("mini.tip.scheduleClear");
        } else if (upcoming === 1) {
            statText = t("mini.tip.oneUpcoming");
        } else {
            statText = t("mini.tip.nUpcoming", { n: upcoming });
        }

        const statDiv = document.createElement("div");
        statDiv.className = "mini-tip-stat";
        if (upcoming > 1) {
            const parts = t("mini.tip.nUpcoming", { n: "\u0000" }).split("\u0000");
            statDiv.appendChild(document.createTextNode(parts[0] || ""));
            const countEl = document.createElement("b");
            countEl.textContent = String(upcoming);
            statDiv.appendChild(countEl);
            statDiv.appendChild(document.createTextNode(parts[1] || ""));
        } else {
            statDiv.textContent = statText;
        }
        tipEl.appendChild(statDiv);

        // Notify backend of measured dimensions after render
        requestAnimationFrame(() => {
            const rect = tipEl.getBoundingClientRect();
            const w = Math.ceil(rect.width + 20);
            const h = Math.ceil(rect.height + 18);
            if (window.cc?.miniTipReady) {
                window.cc.miniTipReady(w, h);
            }
        });
    }

    // Click on tip card: open note
    tipEl.addEventListener("click", () => {
        const todayKey = isoNow();
        if (window.cc?.goFull) window.cc.goFull();
        if (window.cc?.menuAction) window.cc.menuAction("open-note:" + todayKey);
        if (window.cc?.hideMiniTip) window.cc.hideMiniTip();
    });

    // Hover lifecycle
    document.body.addEventListener("mouseenter", () => {
        if (window.cc?.setMiniTipHovered) window.cc.setMiniTipHovered(true);
    });

    document.body.addEventListener("mouseleave", () => {
        if (window.cc?.setMiniTipHovered) window.cc.setMiniTipHovered(false);
        if (window.cc?.scheduleHideMiniTip) window.cc.scheduleHideMiniTip();
    });

    // Listen for placement changes (above vs below clock)
    if (window.cc?.onTipPlacement) {
        window.cc.onTipPlacement((p) => {
            if (p && p.placement) {
                document.body.dataset.placement = p.placement;
            }
        });
    }

    // Listen for data payload
    if (window.cc?.onTipPayload) {
        window.cc.onTipPayload((data) => {
            renderTip(data);
        });
    }

    function defaultPayload() {
        const now = new Date();
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "es";
        const locale = lang === "es" ? "es-ES" : "en-US";
        let dateStr = now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        return {
            dateStr,
            note: "",
            upcoming: 0,
            design: "1",
            theme: "ice",
            language: lang
        };
    }

    // Render immediately on load so the card is never blank
    renderTip(defaultPayload());

    // Also query initial/persisted payload
    if (window.cc?.getMiniTipPayload) {
        window.cc.getMiniTipPayload().then((data) => {
            if (data) renderTip(data);
        }).catch(() => {});
    }

    // Also query initial placement
    if (window.cc?.getMiniTipPlacement) {
        window.cc.getMiniTipPlacement().then((p) => {
            if (p) document.body.dataset.placement = p;
        }).catch(() => {});
    }
})();
