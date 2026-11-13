(function () {
    const commands = [
        ["undo", "rotate-ccw", "Ctrl+Z"],
        ["redo", "rotate-ccw", "Ctrl+Y"],
        ["cut", "scissors", "Ctrl+X"],
        ["copy", "copy", "Ctrl+C"],
        ["paste", "clipboard", "Ctrl+V"],
        ["selectAll", "select-all", "Ctrl+A"],
        ["delete", "trash", "Del"],
    ];
    const selector = 'input:is([type="text"], [type="search"], [type="password"], [type="email"], [type="url"], [type="tel"], [type="number"], [type="date"], [type="time"], [type="datetime-local"], [type="month"], [type="week"], :not([type])), textarea, [contenteditable]:not([contenteditable="false"])';
    const menu = document.createElement("div");
    menu.className = "text-context-menu";
    menu.popover = "manual";
    let target = null;
    let opening = 0;

    const buttons = new Map(commands.map(([command, icon, shortcut]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.command = command;
        button.innerHTML = `<span data-ico="${icon}" data-ico-size="14" aria-hidden="true"></span>
            <span data-i18n="ctx.${command}"></span><kbd aria-hidden="true">${shortcut}</kbd>`;
        menu.append(button);
        return [command, button];
    }));
    document.body.append(menu);
    window.ccIcons.replaceIcons(menu);

    function hide() {
        opening++;
        if (menu.matches(":popover-open")) menu.hidePopover();
        target = null;
    }

    function selection(field) {
        if (typeof field.selectionStart === "number") {
            return field.value.slice(field.selectionStart, field.selectionEnd);
        }
        const selected = window.getSelection();
        return field.contains(selected?.anchorNode) ? selected.toString() : "";
    }

    function insert(field, value) {
        if (field.maxLength >= 0 && typeof field.selectionStart === "number") {
            const room = field.maxLength - field.value.length + field.selectionEnd - field.selectionStart;
            value = value.slice(0, Math.max(0, room));
        }
        if (value) document.execCommand("insertText", false, value);
    }

    menu.addEventListener("pointerdown", event => event.preventDefault());
    document.addEventListener("contextmenu", event => {
        if (menu.contains(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const field = event.target.closest(selector);
        if (!field || field.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        hide();
        target = field;
        field.focus();
        window.ccI18n.apply(menu);
        const selected = selection(field);
        const canCopy = field.type !== "password" && !!selected;
        const writable = !field.readOnly;
        const hasValue = !!(field.value ?? field.textContent);
        const state = {
            undo: writable && document.queryCommandEnabled("undo"),
            redo: writable && document.queryCommandEnabled("redo"),
            cut: writable && canCopy,
            copy: canCopy,
            paste: false,
            selectAll: hasValue,
            delete: writable && !!selected,
        };
        for (const [command, button] of buttons) button.disabled = !state[command];
        menu.showPopover();
        menu.style.left = Math.max(4, Math.min(event.clientX, innerWidth - menu.offsetWidth - 4)) + "px";
        menu.style.top = Math.max(4, Math.min(event.clientY, innerHeight - menu.offsetHeight - 4)) + "px";
        const request = opening;
        if (writable && navigator.clipboard) {
            navigator.clipboard.readText().then(value => {
                if (request === opening) buttons.get("paste").disabled = !value;
            }).catch(() => {});
        }
    }, true);

    for (const [command, button] of buttons) {
        button.addEventListener("click", async () => {
            const field = target;
            if (!field || button.disabled) return;
            const selected = selection(field);
            const start = field.selectionStart;
            const end = field.selectionEnd;
            hide();
            field.focus();
            if (command === "paste") {
                try {
                    const value = await navigator.clipboard.readText();
                    if (document.activeElement === field) insert(field, value);
                } catch (_) {}
            } else if (command === "copy" || command === "cut") {
                try {
                    await navigator.clipboard.writeText(selected);
                    if (command === "cut" && document.activeElement === field
                        && field.selectionStart === start && field.selectionEnd === end && selection(field) === selected) {
                        document.execCommand("delete");
                    }
                } catch (_) {}
            } else {
                document.execCommand(command);
            }
        });
    }

    document.addEventListener("pointerdown", event => {
        if (target && !menu.contains(event.target)) hide();
    }, true);
    window.addEventListener("keydown", event => {
        if (event.key === "Escape" && target) {
            event.preventDefault();
            event.stopImmediatePropagation();
            hide();
        }
    }, true);
    window.addEventListener("blur", hide);
})();
