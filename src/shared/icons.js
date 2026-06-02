/**
 * CyberClock — Shared Icon System
 * Injects an SVG sprite + replaces `[data-ico]` placeholders with `<svg><use/></svg>`.
 */
(() => {
    "use strict";

    const SPRITE_ID = "__cc_icons_sprite__";
    const STYLE_ID = "__cc_icons_style__";

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
          .cc-ico{display:inline-block;width:1em;height:1em;flex-shrink:0;vertical-align:-0.125em}
          .cc-ico use{pointer-events:none}
          .cc-ico{color:currentColor}
        `;
        document.head.appendChild(style);
    }

    function ensureSprite() {
        if (document.getElementById(SPRITE_ID)) return;
        const wrap = document.createElement("div");
        wrap.id = SPRITE_ID;
        wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
        wrap.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <symbol id="cc-i-pin" viewBox="0 0 24 24">
    <g transform="rotate(45 12 12)">
      <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
        d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.58A2 2 0 0 1 15 9.18V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.18a2 2 0 0 1-.78 1.58l-2.78 3.58A2 2 0 0 0 5 15.24Z"/>
      <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
        d="M12 17v5"/>
    </g>
  </symbol>
  <symbol id="cc-i-expand" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M15 3h6v6"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M9 21H3v-6"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M21 3l-7 7"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M3 21l7-7"/>
  </symbol>
  <symbol id="cc-i-gear" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M19.4 15a1.9 1.9 0 0 0 .4 2.1l.1.1-1.5 2.6-.1-.1a2 2 0 0 0-2.3.8l-.1.2h-3l-.1-.2a2 2 0 0 0-1.7-1 2 2 0 0 0-1 .2l-.1.1-2.6-1.5.1-.1a1.9 1.9 0 0 0 .4-2.1l-.1-.2-2.2-1.3.1-.2a2 2 0 0 0 0-2.1l-.1-.2 2.2-1.3.1-.2a1.9 1.9 0 0 0-.4-2.1l-.1-.1 2.6-1.5.1.1a2 2 0 0 0 2.3-.8l.1-.2h3l.1.2a2 2 0 0 0 2.7.8l.1-.1 1.5 2.6-.1.1a1.9 1.9 0 0 0-.4 2.1l.1.2 2.2 1.3-.1.2a2 2 0 0 0 0 2.1l.1.2-2.2 1.3Z"/>
  </symbol>
  <symbol id="cc-i-minimize" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
      d="M6 18h12"/>
  </symbol>
  <symbol id="cc-i-x" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
      d="M18 6 6 18"/>
    <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
      d="M6 6l12 12"/>
  </symbol>
  <symbol id="cc-i-clock" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M12 7v6l4 2"/>
  </symbol>
  <symbol id="cc-i-timer" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M9 2h6"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M12 8a9 9 0 1 0 9 9"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M17 5l-2 2"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M12 12l-3 3"/>
  </symbol>
  <symbol id="cc-i-stopwatch" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M9 2h6"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M12 7a9 9 0 1 0 9 9"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M19 4l-2 2"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M12 12l0-4"/>
  </symbol>
  <symbol id="cc-i-lotus" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      d="M12 20c-4 0-7-2.5-9-6 3.5.2 6-1.2 9-4 3 2.8 5.5 4.2 9 4-2 3.5-5 6-9 6Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      d="M12 10c-1.8-2.2-2.6-4.4-2.4-6.6 1.2.8 2 .8 2.4.8s1.2 0 2.4-.8c.2 2.2-.6 4.4-2.4 6.6Z"/>
  </symbol>
  <symbol id="cc-i-back" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
      d="M15 18l-6-6 6-6"/>
  </symbol>
  <symbol id="cc-i-play" viewBox="0 0 24 24">
    <path fill="currentColor" d="M9 7.5v9l8-4.5-8-4.5Z"/>
  </symbol>
  <symbol id="cc-i-stop" viewBox="0 0 24 24">
    <rect x="7.5" y="7.5" width="9" height="9" fill="currentColor" rx="1.4"/>
  </symbol>
  <symbol id="cc-i-pause" viewBox="0 0 24 24">
    <rect x="7" y="6" width="3.5" height="12" fill="currentColor" rx="1.2"/>
    <rect x="13.5" y="6" width="3.5" height="12" fill="currentColor" rx="1.2"/>
  </symbol>
  <symbol id="cc-i-flag" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M6 21V4"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M6 5h10l-1.5 3L16 11H6"/>
  </symbol>
  <symbol id="cc-i-copy" viewBox="0 0 24 24">
    <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/>
    <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"/>
  </symbol>
  <symbol id="cc-i-trash" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      d="M4 7h16"/>
    <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      d="M10 11v6M14 11v6"/>
    <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      d="M6 7l1 14h10l1-14"/>
    <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      d="M9 7V4h6v3"/>
  </symbol>
  <symbol id="cc-i-folder" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
  </symbol>
  <symbol id="cc-i-bell" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M10 21a2 2 0 0 0 4 0"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z"/>
  </symbol>
  <symbol id="cc-i-volume-low" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M11 5 6 9H3v6h3l5 4V5Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>
  </symbol>
  <symbol id="cc-i-volume-high" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M11 5 6 9H3v6h3l5 4V5Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M15.5 8.5a5 5 0 0 1 0 7"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M18 6.5a8 8 0 0 1 0 11"/>
  </symbol>
  <symbol id="cc-i-flame" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 1-1 3-3 4-1-2-1-4-1-7-4 3-6 7-6 10 0 4 3 7 6 7Z"/>
  </symbol>
  <symbol id="cc-i-trees" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M10 14 7 10l3-4 3 4-3 4Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M17 15 14 11l3-4 3 4-3 4Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M10 14v8M17 15v7"/>
  </symbol>
  <symbol id="cc-i-stars" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      d="M19 12l.7 2.1L22 15l-2.3.9L19 18l-.7-2.1L16 15l2.3-.9L19 12Z"/>
  </symbol>
  <symbol id="cc-i-waves" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M3 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M3 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>
  </symbol>
  <symbol id="cc-i-cloud-rain" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M7 18a4 4 0 1 1 .8-7.9A5 5 0 0 1 18 10a3 3 0 0 1 0 6H7Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M10 20l-1 2M14 20l-1 2M18 20l-1 2"/>
  </symbol>
  <symbol id="cc-i-home" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      d="M3 11 12 3l9 8v10a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 21V11Z"/>
    <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
      d="M9 22v-7h6v7"/>
  </symbol>
</svg>
        `;
        document.body.appendChild(wrap);
    }

    function icoNameToSymbol(name) {
        const k = String(name || "").trim();
        if (!k) return null;
        return `#cc-i-${k}`;
    }

    function replaceIcons(root = document) {
        ensureStyle();
        ensureSprite();
        root.querySelectorAll("[data-ico]").forEach((el) => {
            const name = el.getAttribute("data-ico");
            const href = icoNameToSymbol(name);
            if (!href) return;
            const size = el.getAttribute("data-ico-size"); // optional numeric px
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "cc-ico");
            svg.setAttribute("aria-hidden", "true");
            if (size) {
                svg.style.width = `${size}px`;
                svg.style.height = `${size}px`;
            }
            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttribute("href", href);
            svg.appendChild(use);
            el.replaceChildren(svg);
            el.removeAttribute("data-ico");
            el.removeAttribute("data-ico-size");
        });
    }

    function init() {
        replaceIcons();
    }

    window.ccIcons = {
        init,
        replaceIcons,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();

