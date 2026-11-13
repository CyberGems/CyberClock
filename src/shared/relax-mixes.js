(function () {
    window.bindRelaxMixMenu = function (trigger, actions) {
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        panel.classList.add("relax-mix-menu");
        panel.innerHTML = `
            <div class="relax-mix-menu-title" data-i18n="relax.savedMixes"></div>
            <p class="relax-mix-empty" data-i18n="relax.noSavedMixes"></p>
            <ul class="relax-mix-choices"></ul>
            <div class="relax-mix-actions" role="group" hidden>
                <button type="button" data-edit="rename" data-i18n="relax.mixRename"></button>
                <button type="button" data-edit="update" data-i18n="relax.mixUpdate"></button>
                <button type="button" data-edit="delete" data-i18n="relax.mixDelete"></button>
            </div>
            <div class="relax-mix-confirm" hidden>
                <p></p>
                <button type="button" data-confirm="cancel" data-i18n="common.cancel"></button>
                <button type="button" data-confirm="delete" data-i18n="ctx.delete"></button>
            </div>
            <form class="relax-mix-save" novalidate>
                <input type="text" id="relax-mix-name" maxlength="48" autocomplete="off"
                    data-i18n-attr="aria-label:relax.mixName, placeholder:relax.mixName">
                <button type="submit" data-i18n="common.save"
                    data-i18n-attr="aria-label:relax.saveCurrentMix"></button>
                <button type="button" class="relax-mix-cancel" data-i18n="common.cancel" hidden></button>
            </form>
            <p class="relax-mix-message" role="status" hidden></p>`;
        const list = panel.querySelector("ul");
        const form = panel.querySelector("form");
        const input = form.querySelector("input");
        const save = form.querySelector('[type="submit"]');
        const cancelRename = form.querySelector(".relax-mix-cancel");
        const editActions = panel.querySelector(".relax-mix-actions");
        const confirmDelete = panel.querySelector(".relax-mix-confirm");
        const message = panel.querySelector(".relax-mix-message");
        const empty = panel.querySelector(".relax-mix-empty");
        let names = [];
        let canSave = false;
        let busy = false;
        let editing = null;
        let renaming = false;
        let deleting = false;
        let messageKey = null;

        const t = (key, values) => window.ccI18n.t(key, values);

        function focusOptions(name) {
            const row = Array.from(list.children).find(item => item.dataset.name === name);
            (row?.lastElementChild || list.querySelector("button") || trigger).focus();
        }

        function syncControls() {
            editActions.hidden = editing === null || renaming || deleting;
            if (editing) editActions.setAttribute("aria-label", t("relax.mixOptions", { name: editing }));
            confirmDelete.hidden = !deleting;
            form.hidden = deleting;
            cancelRename.hidden = !renaming;
            input.disabled = busy || (!canSave && !renaming);
            save.disabled = input.disabled;
            save.dataset.i18nAttr = renaming ? "" : "aria-label:relax.saveCurrentMix";
            if (renaming) save.removeAttribute("aria-label");
            else save.setAttribute("aria-label", t("relax.saveCurrentMix"));
            for (const button of editActions.querySelectorAll("button")) {
                button.disabled = busy || (button.dataset.edit === "update" && !canSave);
            }
            confirmDelete.querySelector('[data-confirm="delete"]').disabled = busy;
            cancelRename.disabled = busy;
            for (const item of list.children) {
                item.lastElementChild.setAttribute("aria-expanded", String(item.dataset.name === editing));
            }
        }

        function resetEditor() {
            if (renaming) input.value = "";
            editing = null;
            renaming = false;
            deleting = false;
            syncControls();
        }

        function showMessage(key) {
            messageKey = key;
            message.hidden = !key;
            message.textContent = key ? t(key) : "";
        }

        async function run(change) {
            if (busy) return;
            const previous = editing;
            busy = true;
            syncControls();
            showMessage(null);
            let result;
            try {
                result = await actions.mutate(change);
            } catch (error) {
                console.error(error);
                result = { error: "relax.mixSaveFailed" };
            }
            busy = false;
            if (!result.error) {
                if (change.type === "save") input.value = "";
                resetEditor();
            } else {
                syncControls();
            }
            if (panel.matches(":popover-open")) {
                showMessage(result.error || result.message);
                if (result.error && (renaming || change.type === "save")) input.focus();
                else if (previous && !result.error) focusOptions(change.name || previous);
                else if (result.error && deleting) confirmDelete.querySelector('[data-confirm="delete"]').focus();
                else if (result.error && previous) editActions.querySelector('[data-edit="update"]').focus();
            }
        }

        panel.addEventListener("toggle", event => {
            const open = event.newState === "open";
            trigger.setAttribute("aria-expanded", String(open));
            if (!open) {
                resetEditor();
                showMessage(null);
            }
        });
        if (actions.position) {
            panel.addEventListener("beforetoggle", event => {
                if (event.newState === "open") actions.position(panel, trigger);
            });
        }
        panel.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (editing && !busy) {
                const name = editing;
                resetEditor();
                focusOptions(name);
                return;
            }
            panel.hidePopover();
            trigger.focus();
        });
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (input.disabled) return;
            const name = input.value.trim();
            if (!name) {
                showMessage("relax.mixNameRequired");
                input.focus();
                return;
            }
            run(renaming ? { type: "rename", target: editing, name } : { type: "save", name });
        });
        cancelRename.addEventListener("click", () => {
            renaming = false;
            input.value = "";
            syncControls();
            editActions.querySelector('[data-edit="rename"]').focus();
        });
        editActions.addEventListener("click", event => {
            const action = event.target.closest("button")?.dataset.edit;
            if (!editing || busy) return;
            if (action === "rename") {
                renaming = true;
                input.value = editing;
                syncControls();
                input.focus();
                input.select();
            } else if (action === "delete") {
                deleting = true;
                confirmDelete.querySelector("p").textContent = t("relax.mixDeleteConfirm", { name: editing });
                syncControls();
                confirmDelete.querySelector('[data-confirm="cancel"]').focus();
            } else if (action === "update" && canSave) {
                run({ type: "update", target: editing });
            }
        });
        confirmDelete.addEventListener("click", event => {
            const action = event.target.closest("button")?.dataset.confirm;
            if (busy) return;
            if (action === "cancel") {
                deleting = false;
                syncControls();
                editActions.querySelector('[data-edit="delete"]').focus();
            } else if (action === "delete") {
                run({ type: "delete", target: editing });
            }
        });
        window.ccI18n.apply(panel);

        return {
            render(mixes, ready, activeName) {
                canSave = ready;
                const next = mixes.map(mix => mix.name);
                if (JSON.stringify(names) !== JSON.stringify(next)) {
                    names = next;
                    list.replaceChildren(...names.map(name => {
                        const item = document.createElement("li");
                        item.dataset.name = name;
                        const button = document.createElement("button");
                        button.className = "relax-mix-load";
                        button.type = "button";
                        button.textContent = name;
                        button.title = name;
                        button.addEventListener("click", () => {
                            actions.load(name);
                            panel.hidePopover();
                            trigger.focus();
                        });
                        const options = document.createElement("button");
                        options.className = "relax-mix-options";
                        options.type = "button";
                        options.innerHTML = '<span data-ico="dots" data-ico-size="14" aria-hidden="true"></span>';
                        options.addEventListener("click", () => {
                            if (busy) return;
                            const open = editing !== name;
                            resetEditor();
                            showMessage(null);
                            if (open) {
                                editing = name;
                                syncControls();
                                editActions.firstElementChild.focus();
                            }
                        });
                        item.append(button, options);
                        return item;
                    }));
                    window.ccIcons.replaceIcons(list);
                }
                if (!busy && editing && !names.includes(editing)) resetEditor();
                syncControls();
                if (messageKey) showMessage(messageKey);
                if (deleting) confirmDelete.querySelector("p").textContent = t("relax.mixDeleteConfirm", { name: editing });
                empty.hidden = names.length > 0;
                for (const item of list.children) {
                    const button = item.firstElementChild;
                    const current = String(button.textContent === activeName);
                    if (button.getAttribute("aria-current") !== current) button.setAttribute("aria-current", current);
                    item.lastElementChild.setAttribute("aria-label", t("relax.mixOptions", { name: item.dataset.name }));
                }
            },
        };
    };
})();
