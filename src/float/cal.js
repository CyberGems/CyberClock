/* ═══════════════════════════════════════════════════════════
   CyberClock — Floating Calendar Window Logic
   CyberGems © 2026
═══════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    let cfg = {};
    let calNotes = {};
    let isAot = false;

    const now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();
    let pickerYear = viewYear;

    const shell = document.getElementById("cal-shell");
    const titleEl = document.getElementById("cal-title");
    const weekdaysEl = document.getElementById("cal-weekdays");
    const gridEl = document.getElementById("cal-grid");

    const popoverEl = document.getElementById("cal-picker-popover");
    const pickerYearVal = document.getElementById("picker-year-val");
    const pickerGrid = document.getElementById("picker-months-grid");
    const btnPickerPrevYear = document.getElementById("btn-picker-prev-year");
    const btnPickerNextYear = document.getElementById("btn-picker-next-year");

    const ctxMenu = document.getElementById("cal-context-menu");
    const ctxAot = document.getElementById("ctx-aot");
    const ctxAotCheck = document.getElementById("ctx-aot-check");
    const ctxToday = document.getElementById("ctx-today");
    const ctxPicker = document.getElementById("ctx-picker");
    const ctxFull = document.getElementById("ctx-full");
    const ctxNewTimer = document.getElementById("ctx-new-timer");
    const ctxNewSw = document.getElementById("ctx-new-sw");
    const ctxNewAnalog = document.getElementById("ctx-new-analog");
    const ctxClose = document.getElementById("ctx-close");
    const opChips = document.querySelectorAll(".cal-op-chip");

    const MONTHS_ES = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const MONTHS_EN = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ];

    const MONTHS_SHORT_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const MONTHS_SHORT_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    const DAYS_ES = ["lun.", "mar.", "mié.", "jue.", "vie.", "sáb.", "dom."];
    const DAYS_EN = ["mon.", "tue.", "wed.", "thu.", "fri.", "sat.", "sun."];

    function isoKey(y, m, d) {
        return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    function currentOpacity() {
        return cfg.floatCalOpacity ?? cfg.miniOpacity ?? 1.0;
    }

    function applyOpacity(op) {
        if (shell) shell.style.setProperty("--cal-opacity", op);
        syncOpacityChips(op);
    }

    function syncOpacityChips(op) {
        const target = Math.round(op * 100);
        opChips.forEach(chip => {
            const chipVal = Math.round(parseFloat(chip.dataset.op) * 100);
            chip.classList.toggle("active", chipVal === target);
        });
    }

    function applySettings(s) {
        if (!s) return;
        cfg = s;
        calNotes = cfg.calendarNotes || {};

        if (cfg.theme && window.CCTint) {
            window.CCTint.apply(cfg.theme);
        }
        if (window.ccI18n) {
            window.ccI18n.setLang(cfg.language || "auto");
            window.ccI18n.apply(document);
        }

        applyOpacity(currentOpacity());
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

        // Helper to construct a day cell with crisp text, permanent LED dot and peek tooltip
        function createDayCell(d, key, isOther, isWeekend, isToday, rowIdx, colIdx) {
            const cell = document.createElement("div");
            let cls = "cal-day-cell";
            if (isOther) cls += " cal-other";
            if (isWeekend) cls += " cal-weekend";
            if (isToday) cls += " cal-today";

            const numSpan = document.createElement("span");
            numSpan.className = "cal-day-num";
            numSpan.textContent = String(d);
            cell.appendChild(numSpan);

            const note = calNotes[key];
            if (note && note.trim()) {
                cls += " has-note";
                const dot = document.createElement("span");
                dot.className = "cal-note-dot";
                cell.appendChild(dot);

                cell.setAttribute("data-tooltip", note.trim());
                cell.setAttribute("data-tooltip-dir", rowIdx === 0 ? "bottom" : "top");
                if (colIdx <= 1) {
                    cell.setAttribute("data-tooltip-align", "left");
                } else if (colIdx >= 5) {
                    cell.setAttribute("data-tooltip-align", "right");
                }
            }

            cell.className = cls;
            cell.addEventListener("click", () => {
                document.querySelectorAll(".cal-day-cell.cal-selected").forEach(c => c.classList.remove("cal-selected"));
                cell.classList.add("cal-selected");
            });

            return cell;
        }

        // Previous month overflow days
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
        const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
        for (let i = startOffset - 1; i >= 0; i--) {
            const dayNum = prevMonthDays - i;
            const key = isoKey(prevYear, prevMonth, dayNum);
            const colIdx = (startOffset - 1 - i) % 7;
            const rowIdx = 0;
            const isWeekend = colIdx >= 5;
            gridEl.appendChild(createDayCell(dayNum, key, true, isWeekend, false, rowIdx, colIdx));
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayIndex = startOffset + d - 1;
            const colIdx = dayIndex % 7;
            const rowIdx = Math.floor(dayIndex / 7);
            const isWeekend = colIdx >= 5;
            const isToday = isCurrentMonth && d === todayDate;
            const key = isoKey(viewYear, viewMonth, d);
            gridEl.appendChild(createDayCell(d, key, false, isWeekend, isToday, rowIdx, colIdx));
        }

        // Next month trailing overflow days (pad to 35 or 42 cells for visual balance)
        const totalCellsSoFar = startOffset + daysInMonth;
        const totalRows = totalCellsSoFar > 35 ? 42 : 35;
        const trailingDays = totalRows - totalCellsSoFar;
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
        const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
        for (let next = 1; next <= trailingDays; next++) {
            const dayIndex = startOffset + daysInMonth + next - 1;
            const colIdx = dayIndex % 7;
            const rowIdx = Math.floor(dayIndex / 7);
            const isWeekend = colIdx >= 5;
            const key = isoKey(nextYear, nextMonth, next);
            gridEl.appendChild(createDayCell(next, key, true, isWeekend, false, rowIdx, colIdx));
        }
    }

    // ── Quick Month & Year Picker ────────────────────────────────
    function openPicker() {
        pickerYear = viewYear;
        updatePickerYear();
        renderPickerMonths();
        popoverEl.hidden = false;
        closeContextMenu();
    }

    function closePicker() {
        if (popoverEl) popoverEl.hidden = true;
    }

    function togglePicker() {
        if (popoverEl.hidden) openPicker();
        else closePicker();
    }

    function updatePickerYear() {
        if (pickerYearVal) pickerYearVal.textContent = String(pickerYear);
        renderPickerMonths();
    }

    function renderPickerMonths() {
        if (!pickerGrid) return;
        pickerGrid.innerHTML = "";
        const lang = window.ccI18n ? window.ccI18n.getEffectiveLang() : "es";
        const shortMonths = lang === "es" ? MONTHS_SHORT_ES : MONTHS_SHORT_EN;

        shortMonths.forEach((name, idx) => {
            const btn = document.createElement("button");
            btn.className = "picker-month-btn";
            if (pickerYear === viewYear && idx === viewMonth) {
                btn.classList.add("active");
            }
            btn.textContent = name;
            btn.addEventListener("click", () => {
                viewYear = pickerYear;
                viewMonth = idx;
                closePicker();
                renderCalendar();
            });
            pickerGrid.appendChild(btn);
        });
    }

    if (titleEl) {
        titleEl.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePicker();
        });
    }

    if (btnPickerPrevYear) {
        btnPickerPrevYear.addEventListener("click", (e) => {
            e.stopPropagation();
            pickerYear--;
            updatePickerYear();
        });
    }

    if (btnPickerNextYear) {
        btnPickerNextYear.addEventListener("click", (e) => {
            e.stopPropagation();
            pickerYear++;
            updatePickerYear();
        });
    }

    // ── Custom Cyber Context Menu ────────────────────────────────
    function openContextMenu(clientX, clientY) {
        closePicker();
        const menuWidth = 185;
        const menuHeight = 210;
        const maxX = 280 - menuWidth - 6;
        const maxY = 280 - menuHeight - 6;

        const x = Math.max(6, Math.min(clientX, maxX));
        const y = Math.max(6, Math.min(clientY, maxY));

        ctxMenu.style.left = `${x}px`;
        ctxMenu.style.top = `${y}px`;

        // Sync Always on top
        if (window.__TAURI__ && window.__TAURI__.window) {
            window.__TAURI__.window.getCurrentWindow().isAlwaysOnTop().then(aot => {
                isAot = !!aot;
                ctxAotCheck.classList.toggle("visible", isAot);
            }).catch(() => {});
        }

        // Sync opacity chips
        syncOpacityChips(currentOpacity());

        ctxMenu.hidden = false;
    }

    function closeContextMenu() {
        if (ctxMenu) ctxMenu.hidden = true;
    }

    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener("click", (e) => {
        if (ctxMenu && !ctxMenu.hidden && !ctxMenu.contains(e.target)) {
            closeContextMenu();
        }
        if (popoverEl && !popoverEl.hidden && !popoverEl.contains(e.target) && e.target !== titleEl) {
            closePicker();
        }
    });

    if (ctxAot) {
        ctxAot.addEventListener("click", async () => {
            closeContextMenu();
            if (window.cc && window.cc.toggleAlwaysOnTop) {
                const res = await window.cc.toggleAlwaysOnTop();
                isAot = !!res;
                ctxAotCheck.classList.toggle("visible", isAot);
            }
        });
    }

    if (ctxToday) {
        ctxToday.addEventListener("click", () => {
            closeContextMenu();
            const t = new Date();
            viewYear = t.getFullYear();
            viewMonth = t.getMonth();
            renderCalendar();
        });
    }

    if (ctxPicker) {
        ctxPicker.addEventListener("click", () => {
            closeContextMenu();
            openPicker();
        });
    }

    opChips.forEach(chip => {
        chip.addEventListener("click", (e) => {
            e.stopPropagation();
            const op = parseFloat(chip.dataset.op);
            if (Number.isFinite(op)) {
                applyOpacity(op);
                if (window.cc && window.cc.saveSettings) {
                    window.cc.saveSettings({ floatCalOpacity: op });
                }
            }
        });
    });

    if (ctxFull) {
        ctxFull.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.goFull) {
                window.cc.goFull();
            }
        });
    }

    if (ctxNewTimer) {
        ctxNewTimer.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("timer");
            }
        });
    }

    if (ctxNewSw) {
        ctxNewSw.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("sw");
            }
        });
    }

    if (ctxNewAnalog) {
        ctxNewAnalog.addEventListener("click", () => {
            closeContextMenu();
            if (window.cc && window.cc.spawnFloat) {
                window.cc.spawnFloat("analog");
            }
        });
    }

    if (ctxClose) {
        ctxClose.addEventListener("click", () => {
            closeContextMenu();
            closeWindow();
        });
    }

    function closeWindow() {
        try {
            if (window.cc && window.cc.closeWindow) {
                window.cc.closeWindow();
            } else if (window.__TAURI__ && window.__TAURI__.window) {
                window.__TAURI__.window.getCurrentWindow().close();
            } else {
                window.close();
            }
        } catch (e) {
            window.close();
        }
    }

    // ── Navigation Buttons ───────────────────────────────────────
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
        btnClose.addEventListener("click", closeWindow);
    }

    // ── Keyboard Navigation ──────────────────────────────────────
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (ctxMenu && !ctxMenu.hidden) {
                closeContextMenu();
                return;
            }
            if (popoverEl && !popoverEl.hidden) {
                closePicker();
                return;
            }
            closeWindow();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            viewMonth--;
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
            }
            renderCalendar();
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            viewMonth++;
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
            }
            renderCalendar();
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            viewYear--;
            renderCalendar();
        } else if (e.key === "ArrowDown" || e.key === "PageDown") {
            e.preventDefault();
            viewYear++;
            renderCalendar();
        } else if (e.key === "Home") {
            e.preventDefault();
            const t = new Date();
            viewYear = t.getFullYear();
            viewMonth = t.getMonth();
            renderCalendar();
        }
    });

    // ── Mouse Wheel Navigation ───────────────────────────────────
    if (shell) {
        shell.addEventListener("wheel", (e) => {
            if (popoverEl && !popoverEl.hidden) return;
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

    // ── Window Dragging from Any Dead Space ──────────────────────
    if (shell) {
        shell.addEventListener("mousedown", (e) => {
            // Exclude interactive elements: buttons, popover, day cells, context menu, op-chips
            if (e.target.closest("button, .cal-btn, .picker-btn, .picker-month-btn, .cal-ctx-menu, .cal-picker-popover, #cal-title, .cal-op-chip")) return;
            if (e.button !== 0) return; // Only primary left-click
            if (cfg.miniPositionLocked === true) return;

            e.preventDefault();
            document.body.classList.add("is-dragging");
            if (window.cc && window.cc.startDragging) {
                window.cc.startDragging()
                    .then(() => document.body.classList.remove("is-dragging"))
                    .catch(() => document.body.classList.remove("is-dragging"));
            }
        });
        window.addEventListener("mouseup", () => {
            document.body.classList.remove("is-dragging");
        });
    }

    // ── Load Initial Settings ────────────────────────────────────
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
