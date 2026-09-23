/* ═══════════════════════════════════════════════════════════
   CyberClock — Floating Calendar Window Logic
   CyberGems © 2026
═══════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    let cfg = {};
    const now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();

    const titleEl = document.getElementById("cal-title");
    const weekdaysEl = document.getElementById("cal-weekdays");
    const gridEl = document.getElementById("cal-grid");

    const MONTHS_ES = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const MONTHS_EN = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ];

    const DAYS_ES = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];
    const DAYS_EN = ["mon.", "tue.", "wed.", "thu.", "fri.", "sat.", "sun."];

    function applySettings(s) {
        if (!s) return;
        cfg = s;
        if (cfg.theme && window.CCTint) {
            window.CCTint.apply(cfg.theme);
        }
        if (window.ccI18n) {
            window.ccI18n.setLang(cfg.language || "auto");
            window.ccI18n.apply(document);
        }
        renderCalendar();
    }

    function renderCalendar() {
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "es";
        const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
        const days = lang === "es" ? DAYS_ES : DAYS_EN;

        // Title
        if (titleEl) {
            titleEl.textContent = `${months[viewMonth]} ${viewYear}`;
        }

        // Weekdays Header
        if (weekdaysEl) {
            weekdaysEl.innerHTML = days
                .map((d, i) => `<span class="${i >= 5 ? 'cal-we' : ''}">${d}</span>`)
                .join("");
        }

        // Calendar Days Grid
        if (!gridEl) return;
        gridEl.innerHTML = "";

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
        const todayDate = today.getDate();

        // Total days in current month
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        // Day of week for 1st day (0 = Sun, 1 = Mon ... 6 = Sat)
        const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
        // Shift to Mon = 0 ... Sun = 6
        const startOffset = (firstDayRaw + 6) % 7;

        // Previous month overflow days
        const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
        for (let i = startOffset - 1; i >= 0; i--) {
            const cell = document.createElement("div");
            cell.className = "cal-day-cell cal-other";
            cell.textContent = String(prevMonthDays - i);
            gridEl.appendChild(cell);
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement("div");
            const dayOfWeek = (startOffset + d - 1) % 7;
            const isWeekend = dayOfWeek >= 5;
            const isToday = isCurrentMonth && d === todayDate;

            let cls = "cal-day-cell";
            if (isWeekend) cls += " cal-weekend";
            if (isToday) cls += " cal-today";
            cell.className = cls;
            cell.textContent = String(d);
            gridEl.appendChild(cell);
        }

        // Next month trailing overflow days (pad to 35 or 42 cells for visual balance)
        const totalCellsSoFar = startOffset + daysInMonth;
        const totalRows = totalCellsSoFar > 35 ? 42 : 35;
        const trailingDays = totalRows - totalCellsSoFar;
        for (let next = 1; next <= trailingDays; next++) {
            const cell = document.createElement("div");
            cell.className = "cal-day-cell cal-other";
            cell.textContent = String(next);
            gridEl.appendChild(cell);
        }
    }

    // Navigation handlers
    const btnPrev = document.getElementById("btn-cal-prev");
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            viewMonth--;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
            }
            renderCalendar();
        });
    }

    const btnNext = document.getElementById("btn-cal-next");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            viewMonth++;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
            }
            renderCalendar();
        });
    }

    const btnToday = document.getElementById("btn-cal-today");
    if (btnToday) {
        btnToday.addEventListener("click", () => {
            const t = new Date();
            viewYear = t.getFullYear();
            viewMonth = t.getMonth();
            renderCalendar();
        });
    }

    const btnClose = document.getElementById("btn-cal-close");
    if (btnClose) {
        btnClose.addEventListener("click", () => {
            try {
                if (window.__TAURI__ && window.__TAURI__.window) {
                    window.__TAURI__.window.getCurrentWindow().close();
                } else {
                    window.close();
                }
            } catch (e) {
                window.close();
            }
        });
    }

    // Mouse wheel navigation over shell
    const shell = document.getElementById("cal-shell");
    if (shell) {
        shell.addEventListener("wheel", (e) => {
            if (e.deltaY < 0) {
                viewMonth--;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear--;
                }
                renderCalendar();
            } else if (e.deltaY > 0) {
                viewMonth++;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear++;
                }
                renderCalendar();
            }
        }, { passive: true });
    }

    // Load initial settings
    if (window.cc && window.cc.getSettings) {
        window.cc.getSettings().then((s) => applySettings(s));
    }
    if (window.cc && window.cc.onSettingsUpdated) {
        window.cc.onSettingsUpdated((s) => applySettings(s));
    }
    if (window.cc && window.cc.onInit) {
        window.cc.onInit((s) => applySettings(s));
    }

    renderCalendar();
})();
