/* ═══════════════════════════════════════════════════════════
   CyberClock — Shared Canvas Analog Clock Engine
   Supports all 10 Cyber-Neon Dial Designs & Live Dynamics
   CyberGems © 2026
═══════════════════════════════════════════════════════════ */
(function () {
    "use strict";

    function themeColors() {
        const cs = getComputedStyle(document.body);
        const g = (n) => cs.getPropertyValue(n).trim();
        return {
            accent: g("--accent-a") || "#00d4ff",
            handSec: g("--hand-sec") || "#ff4444",
            rgb: g("--rgb-accent") || "0,212,255",
        };
    }

    const DIAL_DESIGN_KEYS = [
        "settings.appearance.dialClassic",
        "settings.appearance.dialMinimal",
        "settings.appearance.dialSegments",
        "settings.appearance.dialHud",
        "settings.appearance.dialQuantum",
        "settings.appearance.dialChrono",
        "settings.appearance.dialMatrix",
        "settings.appearance.dialReactor",
        "settings.appearance.dialCircuit",
        "settings.appearance.dialGemCrown",
    ];

    const DIAL_DESIGN_DEFAULTS = [
        "Classic",
        "Minimal",
        "Segments",
        "HUD",
        "Quantum",
        "Chrono",
        "Hex Matrix",
        "Reactor Core",
        "Circuit PCB",
        "Gem Crown",
    ];

    function getDialDesignName(designNum) {
        const d = Math.min(10, Math.max(1, parseInt(designNum, 10) || 1));
        const key = DIAL_DESIGN_KEYS[d - 1];
        return window.ccI18n ? window.ccI18n.t(key) : (DIAL_DESIGN_DEFAULTS[d - 1] || "Classic");
    }

    // ── Design 1: Classic ─────────────────────────────────────────
    function buildFaceClassic(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
        bg.addColorStop(0, `rgba(${c.rgb},.07)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.025)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.885, 0, Math.PI * 2);
        ctx.clip();
        const dome = ctx.createLinearGradient(cx, cy - R * 0.9, cx, cy + R * 0.9);
        dome.addColorStop(0, `rgba(${c.rgb},.10)`);
        dome.addColorStop(0.5, "rgba(0,0,0,0)");
        dome.addColorStop(1, "rgba(0,0,0,.42)");
        ctx.fillStyle = dome;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();

        const bezel = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
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

        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue;
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.32)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R * 0.845, cy + Math.sin(a) * R * 0.845);
            ctx.lineTo(cx + Math.cos(a) * R * 0.885, cy + Math.sin(a) * R * 0.885);
            ctx.stroke();
            ctx.restore();
        }

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const big = i % 3 === 0;
            ctx.save();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = big ? 3 : 1.5;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = big ? 14 : 5;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * R * (big ? 0.66 : 0.74), cy + Math.sin(a) * R * (big ? 0.66 : 0.74));
            ctx.lineTo(cx + Math.cos(a) * R * 0.885, cy + Math.sin(a) * R * 0.885);
            ctx.stroke();
            ctx.restore();
        }

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
            ctx.fillText(lbl, cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
        });
        ctx.restore();

        return off;
    }

    // ── Design 2: Minimal ─────────────────────────────────────────
    function buildFaceMinimal(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
        bg.addColorStop(0, `rgba(${c.rgb},.05)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.02)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.30)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const big = i % 3 === 0;
            const r = big ? R * 0.013 : R * 0.006;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, r, 0, Math.PI * 2);
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

    // ── Design 3: Neon Segments ───────────────────────────────────
    function buildFaceSegments(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.09)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.03)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

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

    // ── Design 4: Cyber HUD ───────────────────────────────────────
    function buildFaceHud(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.08)`);
        bg.addColorStop(0.65, `rgba(${c.rgb},.025)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

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
        [0.34, 0.58].forEach((f) => {
            ctx.beginPath();
            ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();

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

        ctx.save();
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
            const bx = cx + Math.cos(a) * R * 0.98;
            const by = cy + Math.sin(a) * R * 0.98;
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

    // ── Design 5: Quantum Orbit ───────────────────────────────────
    function buildFaceQuantum(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.06);
        bg.addColorStop(0, `rgba(${c.rgb},.12)`);
        bg.addColorStop(0.45, `rgba(${c.rgb},.04)`);
        bg.addColorStop(0.85, `rgba(${c.rgb},.01)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.38)`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.stroke();

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

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
        ctx.setLineDash([14, 8]);
        ctx.strokeStyle = `rgba(${c.rgb},.20)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.60, 0, Math.PI * 2);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = `rgba(${c.rgb},.16)`;
        ctx.lineWidth = 1;
        ctx.stroke();

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

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const isCardinal = i % 3 === 0;
            const nx = cx + Math.cos(a) * R * 0.82;
            const ny = cy + Math.sin(a) * R * 0.82;

            ctx.save();
            if (isCardinal) {
                const dSize = R * 0.045;
                ctx.translate(nx, ny);
                ctx.rotate(a + Math.PI / 2);

                ctx.beginPath();
                ctx.moveTo(0, -dSize * 1.6);
                ctx.lineTo(0, dSize * 1.6);
                ctx.moveTo(-dSize * 1.2, 0);
                ctx.lineTo(dSize * 1.2, 0);
                ctx.strokeStyle = `rgba(${c.rgb},.40)`;
                ctx.lineWidth = 1;
                ctx.stroke();

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

                ctx.beginPath();
                ctx.arc(0, 0, R * 0.012, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.shadowBlur = 8;
                ctx.fill();
            } else {
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

    // ── Design 6: Cyber Chrono ────────────────────────────────────
    function buildFaceChrono(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.08);
        bg.addColorStop(0, `rgba(${c.rgb},.08)`);
        bg.addColorStop(0.7, `rgba(${c.rgb},.02)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

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

        const telemarks = [
            { a: 0, t: "60" }, { a: 1, t: "400" }, { a: 2, t: "300" },
            { a: 3, t: "240" }, { a: 4, t: "180" }, { a: 5, t: "140" },
            { a: 6, t: "120" }, { a: 7, t: "100" }, { a: 8, t: "85" },
            { a: 9, t: "75" }, { a: 10, t: "68" }, { a: 11, t: "64" },
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

        const sub2X = cx + R * 0.38, sub2Y = cy;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sub2X, sub2Y, subR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.rgb},.04)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

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

        for (let i = 0; i < 12; i++) {
            if (i === 3 || i === 9) continue;
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const is12 = i === 0;
            const is6 = i === 6;
            const bLen = is12 ? R * 0.11 : is6 ? R * 0.09 : R * 0.075;
            const bWid = is12 ? R * 0.024 : R * 0.016;

            ctx.save();
            ctx.translate(cx + Math.cos(a) * (R * 0.865 - bLen / 2), cy + Math.sin(a) * (R * 0.865 - bLen / 2));
            ctx.rotate(a + Math.PI / 2);

            ctx.strokeStyle = c.accent;
            ctx.lineWidth = bWid;
            ctx.lineCap = "butt";
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = is12 ? 10 : 5;
            ctx.beginPath();
            ctx.moveTo(0, -bLen / 2);
            ctx.lineTo(0, bLen / 2);
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(-bWid * 0.4, bLen / 2 - R * 0.018, bWid * 0.8, R * 0.018);
            ctx.restore();
        }

        return off;
    }

    // ── Design 7: Hex Matrix ──────────────────────────────────────
    function buildFaceMatrix(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05);
        bg.addColorStop(0, `rgba(${c.rgb},.10)`);
        bg.addColorStop(0.5, `rgba(${c.rgb},.03)`);
        bg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();

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

            ctx.beginPath();
            ctx.moveTo(-cw, -ch);
            ctx.lineTo(0, ch);
            ctx.lineTo(cw, -ch);
            ctx.stroke();

            if (isCardinal) {
                ctx.beginPath();
                ctx.moveTo(-cw * 0.75, -ch - R * 0.02);
                ctx.lineTo(0, ch - R * 0.02);
                ctx.lineTo(cw * 0.75, -ch - R * 0.02);
                ctx.stroke();
            }

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

    // ── Design 8: Reactor Core ────────────────────────────────────
    function buildFaceReactor(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.02);
        bgGrad.addColorStop(0, `rgba(${c.rgb},.16)`);
        bgGrad.addColorStop(0.35, `rgba(${c.rgb},.06)`);
        bgGrad.addColorStop(0.75, "rgba(10,12,18,.92)");
        bgGrad.addColorStop(1, "rgba(6,8,12,.98)");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = bgGrad;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.50)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.25)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

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

        const cardAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
        for (let k = 0; k < 4; k++) {
            const ca = cardAngles[k];
            ctx.save();
            ctx.translate(cx + Math.cos(ca) * (R * 0.94), cy + Math.sin(ca) * (R * 0.94));
            ctx.rotate(ca + Math.PI / 2);
            ctx.beginPath();
            const bw = R * 0.034, bh = R * 0.040;
            ctx.rect(-bw, -bh / 2, bw * 2, bh);
            ctx.fillStyle = "#12151e";
            ctx.fill();
            ctx.strokeStyle = c.accent;
            ctx.lineWidth = 1.6;
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.010, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();
        }

        [0.72, 0.56, 0.38].forEach((cr, idx) => {
            ctx.beginPath();
            ctx.arc(cx, cy, R * cr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c.rgb},${0.16 + idx * 0.07})`;
            ctx.lineWidth = 1.2;
            ctx.setLineDash(idx === 1 ? [4, 6] : [8, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        for (let i = 0; i < 12; i++) {
            const hNum = i === 0 ? 12 : i;
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a + Math.PI / 2);

            const wInner = R * 0.022;
            const wOuter = R * 0.042;
            const yInner = -R * 0.38;
            const yOuter = -R * 0.65;

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

            ctx.beginPath();
            ctx.arc(0, yOuter - R * 0.013, R * 0.014, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();

            const numR = R * 0.80;
            const nx = cx + cosA * numR;
            const ny = cy + sinA * numR;
            ctx.font = `bold ${Math.round(R * 0.082)}px Orbitron, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 6;
            ctx.fillText(hNum < 10 ? `0${hNum}` : `${hNum}`, nx, ny);
        }

        const coreR = R * 0.28;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(12, 16, 24, 0.92)";
        ctx.fill();
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 0.70, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.32)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, coreR * 0.40, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.22)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
        return off;
    }

    // ── Design 9: Circuit PCB ─────────────────────────────────────
    function buildFaceCircuit(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = "#0c1017";
        ctx.fill();

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

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.16)`;
        ctx.lineWidth = 1.0;
        ctx.stroke();

        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isHour = i % 5 === 0;
            const vr = R * 0.91;
            const vx = cx + Math.cos(a) * vr;
            const vy = cy + Math.sin(a) * vr;

            ctx.beginPath();
            ctx.arc(vx, vy, isHour ? R * 0.015 : R * 0.008, 0, Math.PI * 2);
            ctx.fillStyle = isHour ? c.accent : `rgba(${c.rgb},.40)`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(vx, vy, isHour ? R * 0.006 : R * 0.0035, 0, Math.PI * 2);
            ctx.fillStyle = "#0c1017";
            ctx.fill();
        }

        const chipSz = R * 0.22;
        ctx.save();
        ctx.translate(cx, cy);

        ctx.beginPath();
        ctx.rect(-chipSz, -chipSz, chipSz * 2, chipSz * 2);
        ctx.fillStyle = "#141822";
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.rgb},.60)`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-chipSz + R * 0.030, -chipSz + R * 0.030, R * 0.012, 0, Math.PI * 2);
        ctx.fillStyle = c.accent;
        ctx.fill();

        const pins = 6;
        const pinSpan = (chipSz * 1.6) / (pins - 1);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(${c.rgb},.45)`;
        for (let p = 0; p < pins; p++) {
            const offset = -chipSz * 0.8 + p * pinSpan;
            ctx.beginPath(); ctx.moveTo(offset, -chipSz); ctx.lineTo(offset, -chipSz - R * 0.035); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(offset, chipSz); ctx.lineTo(offset, chipSz + R * 0.035); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-chipSz, offset); ctx.lineTo(-chipSz - R * 0.035, offset); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(chipSz, offset); ctx.lineTo(chipSz + R * 0.035, offset); ctx.stroke();
        }

        ctx.beginPath();
        ctx.rect(-chipSz * 0.38, -chipSz * 0.38, chipSz * 0.76, chipSz * 0.76);
        ctx.strokeStyle = `rgba(${c.rgb},.25)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold ${Math.round(R * 0.034)}px "Space Grotesk", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = c.accent;
        ctx.shadowBlur = 0;
        ctx.fillText("CPU-64", 0, -chipSz * 0.64);
        ctx.font = `600 ${Math.round(R * 0.026)}px "Space Grotesk", monospace`;
        ctx.fillStyle = `rgba(${c.rgb},.65)`;
        ctx.fillText("CLK", 0, chipSz * 0.64);

        ctx.restore();

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);
            const isCardinal = i % 3 === 0;

            const rStart = R * 0.26;
            const rEnd = R * 0.67;

            if (isCardinal) {
                const x0 = cx + cosA * rStart;
                const y0 = cy + sinA * rStart;
                const x2 = cx + cosA * rEnd;
                const y2 = cy + sinA * rEnd;

                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(${c.rgb},.38)`;
                ctx.lineWidth = 1.6;
                ctx.stroke();

                const smdDist = R * 0.52;
                ctx.save();
                ctx.translate(cx + cosA * smdDist, cy + sinA * smdDist);
                ctx.rotate(a + Math.PI / 2);
                const pw = R * 0.038, ph = R * 0.018;
                ctx.beginPath();
                ctx.rect(-pw, -ph, pw * 2, ph * 2);
                ctx.fillStyle = "#1e222a";
                ctx.fill();
                ctx.strokeStyle = `rgba(${c.rgb},.55)`;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = c.accent;
                ctx.fillRect(-pw, -ph, pw * 0.40, ph * 2);
                ctx.fillRect(pw - pw * 0.40, -ph, pw * 0.40, ph * 2);
                ctx.restore();
            } else {
                const x0 = cx + cosA * rStart;
                const y0 = cy + sinA * rStart;

                const elbowOffset = (i % 2 === 0 ? 0.16 : -0.16);
                const elbowA = a + elbowOffset;
                const x1 = cx + Math.cos(elbowA) * (R * 0.45);
                const y1 = cy + Math.sin(elbowA) * (R * 0.45);

                const x2 = cx + cosA * rEnd;
                const y2 = cy + sinA * rEnd;

                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(${c.rgb},.38)`;
                ctx.lineWidth = 1.6;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x1, y1, R * 0.010, 0, Math.PI * 2);
                ctx.fillStyle = c.accent;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x1, y1, R * 0.004, 0, Math.PI * 2);
                ctx.fillStyle = "#0c1017";
                ctx.fill();

                const smdDist = R * 0.58;
                ctx.save();
                ctx.translate(cx + cosA * smdDist, cy + sinA * smdDist);
                ctx.rotate(a + Math.PI / 2);
                const pw = R * 0.034, ph = R * 0.016;
                ctx.beginPath();
                ctx.rect(-pw, -ph, pw * 2, ph * 2);
                ctx.fillStyle = "#1e222a";
                ctx.fill();
                ctx.strokeStyle = `rgba(${c.rgb},.50)`;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = c.accent;
                ctx.fillRect(-pw, -ph, pw * 0.38, ph * 2);
                ctx.fillRect(pw - pw * 0.38, -ph, pw * 0.38, ph * 2);
                ctx.restore();
            }

            const tx = cx + cosA * rEnd;
            const ty = cy + sinA * rEnd;
            ctx.beginPath();
            ctx.arc(tx, ty, R * 0.011, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx, ty, R * 0.004, 0, Math.PI * 2);
            ctx.fillStyle = "#0c1017";
            ctx.fill();

            const numR = R * 0.80;
            const hNum = i === 0 ? 12 : i;
            const nx = cx + cosA * numR;
            const ny = cy + sinA * numR;
            const txt = hNum < 10 ? `[0${hNum}]` : `[${hNum}]`;
            ctx.font = `bold ${Math.round(R * 0.062)}px "Space Grotesk", monospace`;
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

    // ── Design 10: Gem Crown ──────────────────────────────────────
    function buildFaceGemCrown(W, H, cx, cy, R, c) {
        const off = document.createElement("canvas");
        off.width = W;
        off.height = H;
        const ctx = off.getContext("2d");

        const gemColors = [
            { h: 210, s: 8,  l: 88 },
            { h: 240, s: 55, l: 72 },
            { h: 225, s: 62, l: 66 },
            { h: 215, s: 80, l: 62 },
            { h: 185, s: 65, l: 58 },
            { h: 160, s: 60, l: 56 },
            { h: 152, s: 58, l: 52 },
            { h: 90,  s: 48, l: 56 },
            { h: 40,  s: 60, l: 60 },
            { h: 340, s: 65, l: 55 },
            { h: 310, s: 45, l: 60 },
            { h: 280, s: 42, l: 66 },
        ];
        function gemHSL(idx, alpha) {
            const g = gemColors[idx % 12];
            return alpha !== undefined ? `hsla(${g.h},${g.s}%,${g.l}%,${alpha})` : `hsl(${g.h},${g.s}%,${g.l}%)`;
        }
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
            return alpha !== undefined ? `hsla(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%,${alpha})` : `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
        }

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

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.35)`;
        ctx.lineWidth = 2;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.895, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.rgb},.18)`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();

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

        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue;
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const gemFrac = (i / 60) * 12;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, R * 0.0055, 0, Math.PI * 2);
            ctx.fillStyle = getBlendedGemColor(gemFrac, 0.45);
            ctx.fill();
            ctx.restore();
        }

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
                const CG_LOGO_SVG =
                    "M4.18,5.02L4.18,4.09C4.18,3.92 4.06,3.79 3.91,3.79L3.55,3.79C3.4,3.79 3.28,3.92 3.28,4.09L3.28,4.7C3.28,4.96 3.29,5.25 3.11,5.2C3.04,5.18 2.55,4.46 2.46,4.34C2.34,4.2 1.33,2.99 1.3,2.9C1.24,2.74 1.39,2.62 1.45,2.55L2.38,1.39C2.43,1.33 2.55,1.17 2.64,1.14C2.68,1.12 2.85,1.12 3.01,1.12C3.26,1.12 3.31,1.12 3.31,1.41C3.31,1.83 3.32,2.33 3.3,2.39L3.31,2.39C3.31,2.45 3.3,2.5 3.3,2.54C3.31,2.7 3.43,2.84 3.57,2.84L3.9,2.84C4.04,2.84 4.17,2.71 4.17,2.54L4.17,2.28C4.18,1.85 4.19,1.08 4.17,0.59L4.17,0.39C4.17,0.29 4.16,0.21 4.14,0.15C4.13,0.14 4.13,0.13 4.13,0.13C4.09,0.07 4.04,0.03 3.96,0.01C3.88,-0 3.33,0.01 3.03,0.01C2.78,-0 2.45,-0.01 2.29,0.02C2.09,0.06 1.89,0.36 1.76,0.52C1.69,0.62 1.61,0.72 1.53,0.81L0.13,2.55C-0.17,2.91 0.08,3.03 0.48,3.53C0.79,3.91 1.1,4.28 1.42,4.67C1.57,4.86 1.73,5.04 1.89,5.23C2.04,5.43 2.2,5.61 2.36,5.81C2.82,6.35 3.31,6.97 3.78,7.51C3.84,7.58 3.94,7.75 4.08,7.69C4.2,7.64 4.17,7.41 4.17,7.24C4.18,6.5 4.18,5.76 4.18,5.02ZM4.85,0.02C4.68,0.05 4.63,0.18 4.63,0.39L4.63,7.22C4.63,7.4 4.59,7.67 4.75,7.7C4.87,7.73 4.96,7.59 5.08,7.46C5.17,7.35 5.25,7.25 5.34,7.14C5.39,7.08 5.43,7.04 5.48,6.98L6.67,5.55C6.76,5.43 6.85,5.35 6.94,5.23L7.2,4.91C7.4,4.64 8.7,3.17 8.73,3.06C8.82,2.81 8.54,2.85 8.39,2.85L6.8,2.85L6.45,2.85C6.27,2.85 6.17,2.93 6.15,3.12C6.14,3.25 6.14,3.53 6.17,3.62C6.29,3.91 6.51,3.72 6.62,3.82C6.68,3.87 6.66,3.97 6.62,4.03C6.58,4.08 6.53,4.13 6.49,4.18L5.69,5.15C5.64,5.21 5.54,5.23 5.52,5.13C5.5,5.08 5.51,1.84 5.51,1.42C5.51,1.12 5.56,1.12 5.81,1.12C5.99,1.12 6.16,1.09 6.28,1.21C6.44,1.38 6.93,2.06 7.07,2.16C7.14,2.21 7.26,2.22 7.37,2.22C7.58,2.22 7.8,2.23 8,2.23C8.22,2.22 8.36,2.16 8.14,1.87C8.05,1.75 7.97,1.66 7.87,1.54C7.78,1.44 7.7,1.31 7.62,1.21L6.83,0.24C6.61,-0.07 6.42,0.01 5.94,0.01C5.77,0.01 4.94,-0 4.85,0.02Z";

                if (typeof Path2D !== "undefined") {
                    const cgPath = new Path2D(CG_LOGO_SVG);
                    const targetH = R * 0.112;
                    const s = targetH / 7.82;
                    ctx.scale(s, s);
                    ctx.translate(-4.325, -3.84);

                    const grad = ctx.createLinearGradient(4.3, 7.8, 4.3, 0);
                    grad.addColorStop(0, "#7a5cff");
                    grad.addColorStop(0.45, "#38bdf8");
                    grad.addColorStop(1, "#00f2ff");

                    ctx.shadowColor = "#00f2ff";
                    ctx.shadowBlur = 18;
                    ctx.fillStyle = grad;
                    ctx.fill(cgPath);

                    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
                    ctx.lineWidth = 0.28;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = "#ffffff";
                    ctx.stroke(cgPath);
                }
            } else {
                const gSize = isCardinal ? R * 0.046 : R * 0.034;
                const wT = gSize * 0.58;
                const wG = gSize * 1.05;
                const hT = gSize * 0.80;
                const hG = gSize * 0.20;
                const hP = gSize * 1.18;
                const tH = -hG * 0.35;

                ctx.shadowColor = color;
                ctx.shadowBlur = isCardinal ? 14 : 8;

                ctx.beginPath();
                ctx.moveTo(-wT, -hT); ctx.lineTo(0, -hT); ctx.lineTo(0, tH);
                ctx.lineTo(-wT * 0.6, tH); ctx.lineTo(-wG, -hG);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.45);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(0, -hT); ctx.lineTo(wT, -hT); ctx.lineTo(wG, -hG);
                ctx.lineTo(wT * 0.6, tH); ctx.lineTo(0, tH);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.28);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(-wG, -hG); ctx.lineTo(0, tH); ctx.lineTo(0, hP);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.38);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(wG, -hG); ctx.lineTo(0, tH); ctx.lineTo(0, hP);
                ctx.closePath();
                ctx.fillStyle = gemHSL(i, 0.22);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(0, -hT * 0.96); ctx.lineTo(wT * 0.55, tH);
                ctx.lineTo(0, hG * 0.5); ctx.lineTo(-wT * 0.55, tH);
                ctx.closePath();
                ctx.fillStyle = "rgba(255,255,255,0.40)";
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(-wT, -hT); ctx.lineTo(wT, -hT); ctx.lineTo(wG, -hG);
                ctx.lineTo(0, hP); ctx.lineTo(-wG, -hG);
                ctx.closePath();
                ctx.strokeStyle = color;
                ctx.lineWidth = isCardinal ? 1.6 : 1.2;
                ctx.stroke();

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

    function buildClockFace(W, H, cx, cy, R, c, design) {
        const d = Math.min(10, Math.max(1, parseInt(design, 10) || 1));
        if (d === 2) return buildFaceMinimal(W, H, cx, cy, R, c);
        if (d === 3) return buildFaceSegments(W, H, cx, cy, R, c);
        if (d === 4) return buildFaceHud(W, H, cx, cy, R, c);
        if (d === 5) return buildFaceQuantum(W, H, cx, cy, R, c);
        if (d === 6) return buildFaceChrono(W, H, cx, cy, R, c);
        if (d === 7) return buildFaceMatrix(W, H, cx, cy, R, c);
        if (d === 8) return buildFaceReactor(W, H, cx, cy, R, c);
        if (d === 9) return buildFaceCircuit(W, H, cx, cy, R, c);
        if (d === 10) return buildFaceGemCrown(W, H, cx, cy, R, c);
        return buildFaceClassic(W, H, cx, cy, R, c);
    }

    // ── Hand Renderers ────────────────────────────────────────────
    function hand(ctx, cx, cy, angle, len, width, color, blur) {
        const ex = cx + Math.cos(angle) * len;
        const ey = cy + Math.sin(angle) * len;

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

    function hudHand(ctx, cx, cy, angle, len, tipLen, width, color) {
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const baseLen = len * 0.12;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 9;
        ctx.lineCap = "butt";
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (len - tipLen), cy + uy * (len - tipLen));
        ctx.stroke();
        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * len, cy + uy * len);
        ctx.lineTo(cx + ux * (len - tipLen), cy + uy * (len - tipLen));
        ctx.stroke();
        ctx.restore();
    }

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

        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (apPos - apSize), cy + uy * (apPos - apSize));
        ctx.stroke();

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

        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * (apPos + apSize), cy + uy * (apPos + apSize));
        ctx.lineTo(cx + ux * len, cy + uy * len);
        ctx.stroke();

        ctx.restore();
    }

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

        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, baseLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w2, 0);
        ctx.lineTo(-w2, -len * 0.78);
        ctx.lineTo(0, -len);
        ctx.lineTo(w2, -len * 0.78);
        ctx.lineTo(w2, 0);
        ctx.closePath();
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w2 * 0.5, -len * 0.25);
        ctx.lineTo(-w2 * 0.5, -len * 0.70);
        ctx.lineTo(0, -len * 0.78);
        ctx.lineTo(w2 * 0.5, -len * 0.70);
        ctx.lineTo(w2 * 0.5, -len * 0.25);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w2 * 0.6, -len * 0.80);
        ctx.lineTo(0, -len * 0.96);
        ctx.lineTo(w2 * 0.6, -len * 0.80);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.restore();
    }

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

        ctx.lineWidth = width * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, baseLen);
        ctx.stroke();

        ctx.lineWidth = width * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len * 0.62);
        ctx.stroke();

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

    function reactorHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.lineWidth = width * 1.2;
        ctx.beginPath();
        ctx.moveTo(-width * 0.8, len * 0.16);
        ctx.lineTo(width * 0.8, len * 0.16);
        ctx.lineTo(width * 0.5, 0);
        ctx.lineTo(-width * 0.5, 0);
        ctx.closePath();
        ctx.fill();

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

    function circuitHand(ctx, cx, cy, angle, len, width, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        const tailLen = len * 0.15;
        ctx.beginPath();
        ctx.arc(0, tailLen, width * 0.85, 0, Math.PI * 2);
        ctx.lineWidth = width * 0.4;
        ctx.stroke();

        ctx.lineWidth = width * 0.65;
        ctx.beginPath();
        ctx.moveTo(0, tailLen - width * 0.85);
        ctx.lineTo(0, -len * 0.65);
        ctx.stroke();

        const padY = -len * 0.65;
        const pw = width * 1.1;
        const ph = len * 0.12;
        ctx.beginPath();
        ctx.rect(-pw, padY - ph, pw * 2, ph);
        ctx.fillStyle = "#1e222a";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillRect(-pw, padY - ph, pw * 2, ph * 0.28);
        ctx.fillRect(-pw, padY - ph * 0.28, pw * 2, ph * 0.28);

        ctx.beginPath();
        ctx.moveTo(-width * 0.6, padY - ph);
        ctx.lineTo(0, -len);
        ctx.lineTo(width * 0.6, padY - ph);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.restore();
    }

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

        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(cx - ux * baseLen, cy - uy * baseLen);
        ctx.lineTo(cx + ux * (gemPos - gemR * 1.2), cy + uy * (gemPos - gemR * 1.2));
        ctx.stroke();

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

        ctx.beginPath();
        ctx.arc(0, 0, gemR * 0.30, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = Math.max(1, width * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + ux * (gemPos + gemR * 1.2), cy + uy * (gemPos + gemR * 1.2));
        ctx.lineTo(cx + ux * len, cy + uy * len);
        ctx.stroke();

        ctx.restore();
    }

    // ── Wordmark Pendulum Rendering ───────────────────────────────
    let brandCacheKey = null;
    let brandFontPx = 16;
    let brandWidths = [];
    let brandTotal = 0;

    function renderBrand(ctx, W, H, cx, cy, R, c, brandText, sec, showBrand) {
        if (showBrand === false) return;
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const rawBrand = (brandText || "").trim();
        const word = (rawBrand || "CYBERGEMS").toUpperCase().slice(0, 16);
        const tracking = R * 0.004;
        const fontLoaded = document.fonts ? document.fonts.check("16px Orbitron") : true;
        const key = `${R}|${tracking}|${word}|${fontLoaded}`;
        if (key !== brandCacheKey) {
            brandCacheKey = key;
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
            brandFontPx = fontPx;
            brandWidths = m.widths;
            brandTotal = m.total;
        }

        ctx.font = `${brandFontPx}px Orbitron,monospace`;
        const widths = brandWidths;
        const total = brandTotal;
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
    }

    // ── Center Jewels & Caps ──────────────────────────────────────
    function renderCenterJewel(ctx, cx, cy, R, c, design) {
        ctx.save();
        ctx.shadowColor = c.accent;
        if (design === 2) {
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.018, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
        } else if (design === 5) {
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
            ctx.fill();
        } else if (design === 8) {
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
            ctx.beginPath();
            ctx.arc(-dieSz * 0.52, -dieSz * 0.52, R * 0.005, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();
        } else if (design === 10) {
            const jewR = R * 0.050;
            const orbitR = R * 0.098;
            const haloAngle = (Date.now() / 6500) * Math.PI * 2;
            const rayAngle = -(Date.now() / 9000) * Math.PI * 2;
            const hues = [210, 215, 152, 40, 340, 280];

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rayAngle);
            for (let r = 0; r < 8; r++) {
                const a = (r / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(a) * orbitR * 1.05, Math.sin(a) * orbitR * 1.05);
                ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();

            ctx.save();
            const haloGrad = ctx.createRadialGradient(cx, cy, jewR * 0.9, cx, cy, orbitR * 1.25);
            haloGrad.addColorStop(0, `rgba(${c.rgb},.25)`);
            haloGrad.addColorStop(0.5, `hsla(280,50%,65%,.12)`);
            haloGrad.addColorStop(1, "transparent");
            ctx.beginPath();
            ctx.arc(cx, cy, orbitR * 1.25, 0, Math.PI * 2);
            ctx.fillStyle = haloGrad;
            ctx.fill();
            ctx.restore();

            for (let s = 0; s < 6; s++) {
                const a = haloAngle + (s / 6) * Math.PI * 2;
                const sx = cx + Math.cos(a) * orbitR;
                const sy = cy + Math.sin(a) * orbitR;
                const satR = R * 0.016;
                const hColor = `hsl(${hues[s]},75%,65%)`;

                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(a + Math.PI / 4);
                ctx.shadowColor = hColor;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.rect(-satR, -satR, satR * 2, satR * 2);
                ctx.fillStyle = `hsla(${hues[s]},65%,55%,.40)`;
                ctx.fill();
                ctx.strokeStyle = hColor;
                ctx.lineWidth = 1.1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, satR * 0.38, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.92)";
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.restore();
            }

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

            ctx.beginPath();
            ctx.arc(cx, cy, jewR * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.restore();
        } else {
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

    // ── Complete Frame Renderer ───────────────────────────────────
    function renderClock(ctx, W, H, options = {}) {
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * (options.dialScale || 0.46);
        const c = options.colors || themeColors();
        const design = Math.min(10, Math.max(1, parseInt(options.design, 10) || 1));
        const showBrand = options.showBrand !== false;
        const brandText = options.brandText || "";

        const now = options.date || new Date();
        const ms = now.getMilliseconds();
        const sec = now.getSeconds() + ms / 1000;
        const min = now.getMinutes() + sec / 60;
        const hr = (now.getHours() % 12) + min / 60;
        const secA = (sec / 60) * Math.PI * 2 - Math.PI / 2;
        const minA = (min / 60) * Math.PI * 2 - Math.PI / 2;
        const hrA = (hr / 12) * Math.PI * 2 - Math.PI / 2;

        ctx.clearRect(0, 0, W, H);

        // 1. Static Dial Face (Rendered or from cache)
        if (options.faceCanvas) {
            ctx.drawImage(options.faceCanvas, 0, 0);
        } else {
            const face = buildClockFace(W, H, cx, cy, R, c, design);
            ctx.drawImage(face, 0, 0);
        }

        // 2. Breathing outer rim
        if (design !== 3) {
            const rimR = design === 5 || design === 7 || design === 8 || design === 9 || design === 10 ? R * 0.94 : R * 0.985;
            const br = 0.68 + 0.18 * (1 - Math.cos((Date.now() * 2 * Math.PI) / 3200));
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

        // 3. Dynamic Segments (design 3)
        if (design === 3) {
            const segR = R * 0.885;
            const gap = (Math.PI * 2) / 240;
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

        // 4. Dynamic Quantum Arcs (design 5)
        if (design === 5) {
            const rot1 = ((Date.now() / 4800) % (Math.PI * 2));
            const rot2 = -((Date.now() / 6200) % (Math.PI * 2));
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.30)`;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.60, rot1, rot1 + Math.PI * 0.7);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.72, rot2, rot2 + Math.PI * 0.5);
            ctx.stroke();
            ctx.restore();
        }

        // 5. Dynamic Chrono Subdial Needles (design 6)
        if (design === 6) {
            const sub1X = cx - R * 0.38, sub1Y = cy;
            const sub2X = cx + R * 0.38, sub2Y = cy;
            const subLen = R * 0.135;

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
            ctx.beginPath();
            ctx.arc(sub1X, sub1Y, R * 0.015, 0, Math.PI * 2);
            ctx.fillStyle = c.accent;
            ctx.fill();
            ctx.restore();

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
            ctx.beginPath();
            ctx.arc(sub2X, sub2Y, R * 0.015, 0, Math.PI * 2);
            ctx.fillStyle = c.handSec;
            ctx.fill();
            ctx.restore();
        }

        // 6. Dynamic Reactor Core Plasma Vortex (design 8)
        if (design === 8) {
            const plasmaRot = ((Date.now() / 4200) % (Math.PI * 2));
            ctx.save();
            ctx.strokeStyle = `rgba(${c.rgb},.35)`;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.23, plasmaRot, plasmaRot + Math.PI * 0.6);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.23, plasmaRot + Math.PI, plasmaRot + Math.PI * 1.6);
            ctx.stroke();
            const pulse = 0.10 + 0.08 * (1 + Math.sin(Date.now() / 500));
            ctx.fillStyle = `rgba(${c.rgb},${pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 0.14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 7. Dynamic Circuit PCB Activity Signal (design 9)
        if (design === 9) {
            const pulseStep = Math.floor((Date.now() / 400) % 4);
            const cardAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
            const a = cardAngles[pulseStep];
            const px = cx + Math.cos(a) * (R * 0.67);
            const py = cy + Math.sin(a) * (R * 0.67);
            ctx.save();
            ctx.fillStyle = c.accent;
            ctx.shadowColor = c.accent;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(px, py, R * 0.016, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 8. Dynamic Gem Crown Sparkle Sweep (design 10)
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

        // 9. Brand Wordmark Pendulum
        renderBrand(ctx, W, H, cx, cy, R, c, brandText, sec, showBrand);

        // 10. Hands Rendering
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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.84), cy + Math.sin(secA) * (R * 0.84));
            ctx.stroke();

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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.16), cy - Math.sin(secA) * (R * 0.16));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.85), cy + Math.sin(secA) * (R * 0.85));
            ctx.stroke();
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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.83), cy + Math.sin(secA) * (R * 0.83));
            ctx.stroke();
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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.16), cy - Math.sin(secA) * (R * 0.16));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.86), cy + Math.sin(secA) * (R * 0.86));
            ctx.stroke();
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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.2;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.85), cy + Math.sin(secA) * (R * 0.85));
            ctx.stroke();
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
            ctx.save();
            ctx.strokeStyle = c.handSec;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = c.handSec;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(cx - Math.cos(secA) * (R * 0.14), cy - Math.sin(secA) * (R * 0.14));
            ctx.lineTo(cx + Math.cos(secA) * (R * 0.84), cy + Math.sin(secA) * (R * 0.84));
            ctx.stroke();
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

        // 11. Center Jewel / Cap
        renderCenterJewel(ctx, cx, cy, R, c, design);
    }

    // Expose engine to global window
    window.CCAnalog = {
        themeColors,
        getDialDesignName,
        buildClockFace,
        renderClock,
        renderBrand,
        renderCenterJewel,
        DIAL_DESIGNS: DIAL_DESIGN_DEFAULTS.map((name, i) => ({ id: i + 1, name, key: DIAL_DESIGN_KEYS[i] })),
    };
})();
