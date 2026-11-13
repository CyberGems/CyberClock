(function () {
    window.bindRelaxMixMenu = function (trigger, actions) {
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        panel.classList.add("relax-mix-menu");
        panel.innerHTML = `
            <div class="relax-mix-menu-title" data-i18n="relax.savedMixes"></div>
            <p class="relax-mix-empty" data-i18n="relax.noSavedMixes"></p>
            <ul class="relax-mix-choices"></ul>
            <form class="relax-mix-save" novalidate>
                <input type="text" id="relax-mix-name" maxlength="48" autocomplete="off"
                    data-i18n-attr="aria-label:relax.mixName, placeholder:relax.mixName">
                <button type="submit" data-i18n="common.save"
                    data-i18n-attr="aria-label:relax.saveCurrentMix"></button>
            </form>
            <p class="relax-mix-message" role="status" hidden></p>`;
        const list = panel.querySelector("ul");
        const form = panel.querySelector("form");
        const input = form.querySelector("input");
        const save = form.querySelector("button");
        const message = panel.querySelector(".relax-mix-message");
        const empty = panel.querySelector(".relax-mix-empty");
        let names = [];
        let canSave = false;
        let busy = false;

        function showMessage(key) {
            message.hidden = !key;
            message.textContent = key ? window.ccI18n.t(key) : "";
        }

        function finishSave(error) {
            busy = false;
            save.disabled = !canSave;
            if (!error) input.value = "";
            if (error || panel.matches(":popover-open")) showMessage(error || "relax.mixSaved");
        }

        panel.addEventListener("toggle", event => {
            const open = event.newState === "open";
            trigger.setAttribute("aria-expanded", String(open));
            if (!open) showMessage(null);
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
            panel.hidePopover();
            trigger.focus();
        });
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!canSave || busy) return;
            const name = input.value.trim();
            if (!name) {
                showMessage("relax.mixNameRequired");
                input.focus();
                return;
            }
            busy = true;
            save.disabled = true;
            showMessage(null);
            actions.save(name);
        });
        window.ccI18n.apply(panel);

        return {
            finishSave,
            render(mixes, ready, activeName) {
                canSave = ready;
                save.disabled = busy || !canSave;
                input.disabled = !canSave;
                const next = mixes.map(mix => mix.name);
                if (JSON.stringify(names) !== JSON.stringify(next)) {
                    names = next;
                    list.replaceChildren(...names.map(name => {
                        const item = document.createElement("li");
                        const button = document.createElement("button");
                        button.type = "button";
                        button.textContent = name;
                        button.title = name;
                        button.addEventListener("click", () => {
                            actions.load(name);
                            panel.hidePopover();
                            trigger.focus();
                        });
                        item.append(button);
                        return item;
                    }));
                }
                empty.hidden = names.length > 0;
                for (const item of list.children) {
                    const button = item.firstElementChild;
                    const current = String(button.textContent === activeName);
                    if (button.getAttribute("aria-current") !== current) button.setAttribute("aria-current", current);
                }
            },
        };
    };
})();
