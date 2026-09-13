/* ═══════════════════════════════════════════════════════════
   CyberClock — Accent Tint Engine · CyberGems © 2026
   Reusable singleton window.CCTint

   The interface has ONE sober structural palette (themes.css).
   Color enters through a single accent seed per tint, which is
   normalized into a quiet saturation/luminance band, expanded
   into the accent family (a/b/c) and kissed into the dark
   panels at a fixed low ratio — a hue breath, never a flood.
═══════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    // Curated tints, hue-separated. `seed` is normalized before
    // use, so these hexes are starting points, not exact paints
    // (swatch pickers should render normalizeSeed(seed) instead).
    const PRESETS = [
        { id: "ice",    seed: "#c8dce8" },
        { id: "cyan",   seed: "#5ac8dc" },
        { id: "azure",  seed: "#6f9fe8" },
        { id: "mint",   seed: "#7fd0b8" },
        { id: "sage",   seed: "#a8c98f" },
        { id: "amber",  seed: "#d9b48a" },
        { id: "rose",   seed: "#d98fa8" },
        { id: "violet", seed: "#b39ddb" },
    ];

    const DEFAULT_ID = "ice";

    // Settings saved by pre-tint versions carry old skin ids;
    // each maps onto the tint that inherited its palette.
    const LEGACY_IDS = {
        "arctic-ice":    "ice",
        "cyber-blue":    "cyan",
        "neon-green":    "mint",
        "plasma-purple": "violet",
        "solar-orange":  "amber",
    };

    // No tint may leave this band: accents stay readable on the
    // dark base and none of them floods the interface.
    const SAT_MIN = 0.3;
    const SAT_MAX = 0.58;
    const LUM_MIN = 0.6;
    const LUM_MAX = 0.86;

    // Ambient kiss: panels shift this ratio toward a mid-tone of
    // the accent hue (lightness/saturation-neutral target, so the
    // base darkness never washes out).
    const BG_KISS = 0.04;
    const BG_BASE = {
        "bg-01": "#031624",
        "bg-02": "#051e30",
        "bg-03": "#07283e",
        "bg-04": "#09324c",
    };

    function clamp(v, lo, hi) {
        return Math.min(hi, Math.max(lo, v));
    }

    function hexToRgb(hex) {
        const h = hex.replace("#", "");
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }

    function rgbToHsl(r, g, b) {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        const d = max - min;
        let h = 0;
        let s = 0;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === rn) h = 60 * (((gn - bn) / d) % 6);
            else if (max === gn) h = 60 * ((bn - rn) / d + 2);
            else h = 60 * ((rn - gn) / d + 4);
            if (h < 0) h += 360;
        }
        return { h, s, l };
    }

    function hslToHex(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const hp = ((h % 360) + 360) % 360 / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1));
        let rn = 0;
        let gn = 0;
        let bn = 0;
        if (hp < 1)       { rn = c; gn = x; }
        else if (hp < 2)  { rn = x; gn = c; }
        else if (hp < 3)  { gn = c; bn = x; }
        else if (hp < 4)  { gn = x; bn = c; }
        else if (hp < 5)  { rn = x; bn = c; }
        else              { rn = c; bn = x; }
        const m = l - c / 2;
        const to = (v) =>
            Math.round(clamp(v + m, 0, 1) * 255)
                .toString(16)
                .padStart(2, "0");
        return `#${to(rn)}${to(gn)}${to(bn)}`;
    }

    function triplet(hex) {
        const { r, g, b } = hexToRgb(hex);
        return `${r}, ${g}, ${b}`;
    }

    function mixHex(baseHex, tintHex, ratio) {
        const a = hexToRgb(baseHex);
        const b = hexToRgb(tintHex);
        const ch = (x, y) =>
            Math.round(x + (y - x) * ratio)
                .toString(16)
                .padStart(2, "0");
        return `#${ch(a.r, b.r)}${ch(a.g, b.g)}${ch(a.b, b.b)}`;
    }

    // Pull any seed into the shared quiet band.
    function normalizeSeed(hex) {
        const { h, s, l } = rgbToHsl(
            hexToRgb(hex).r,
            hexToRgb(hex).g,
            hexToRgb(hex).b,
        );
        return hslToHex(
            h,
            clamp(s, SAT_MIN, SAT_MAX),
            clamp(l, LUM_MIN, LUM_MAX),
        );
    }

    // a = the normalized seed; b = quieter darker sibling (hover
    // borders, secondary glows); c = pale highlight (gradient tops).
    function deriveAccent(normalizedHex) {
        const { h, s, l } = rgbToHsl(
            hexToRgb(normalizedHex).r,
            hexToRgb(normalizedHex).g,
            hexToRgb(normalizedHex).b,
        );
        const b = hslToHex(h, s * 0.9, clamp(l - 0.15, 0.3, 1));
        const c = hslToHex(h, s * 0.8, clamp(l + 0.08, 0, 0.93));
        return { a: normalizedHex, b, c };
    }

    function resolve(id) {
        const key = LEGACY_IDS[id] || id;
        return (
            PRESETS.find((p) => p.id === key) ||
            PRESETS.find((p) => p.id === DEFAULT_ID)
        );
    }

    // Apply a tint by preset id (legacy ids accepted). Sets the
    // seed triplets + kissed panels inline on <body>; themes.css
    // derives the rest. Returns the resolved preset id.
    function apply(id) {
        const preset = resolve(id);
        const { a, b, c } = deriveAccent(normalizeSeed(preset.seed));
        const st = document.body.style;
        st.setProperty("--rgb-accent", triplet(a));
        st.setProperty("--rgb-b", triplet(b));
        st.setProperty("--rgb-c", triplet(c));
        // Mid-tone of the accent hue: carries the hue into the
        // panels without dragging the base darkness around.
        const kissTarget = hslToHex(
            rgbToHsl(hexToRgb(a).r, hexToRgb(a).g, hexToRgb(a).b).h,
            0.5,
            0.45,
        );
        for (const [name, base] of Object.entries(BG_BASE)) {
            st.setProperty(`--${name}`, mixHex(base, kissTarget, BG_KISS));
        }
        document.body.dataset.tint = preset.id;
        return preset.id;
    }

    window.CCTint = { PRESETS, DEFAULT_ID, resolve, normalizeSeed, apply };
})();
