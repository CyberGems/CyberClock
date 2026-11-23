/**
 * CyberClock shared update presentation helpers.
 *
 * The updater knows whether a release exists, while this small browser-side
 * helper turns GitHub's Markdown notes into a short preview for the notice.
 */
(function () {
    "use strict";

    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const API_URL = "https://api.github.com/repos/CyberGems/CyberClock";
    const LEGACY_SKIP_KEYS = ["cyberclock_skipped_update_version", "cc_update_skip_version", "cyberclock_skip_update_version"];
    const cleanVersion = (value) => String(value || "").trim().replace(/^v+/i, "");

    function releaseUrl(version) {
        if (!version) return `${REPO_URL}/releases`;
        const clean = cleanVersion(version);
        return `${REPO_URL}/releases/tag/v${encodeURIComponent(clean)}`;
    }

    function portableUrl(version) {
        const number = encodeURIComponent(cleanVersion(version));
        return `${REPO_URL}/releases/download/v${number}/CyberClock_${number}_x64-portable.zip`;
    }

    function sameVersion(first, second) {
        return Boolean(first && second && cleanVersion(first) === cleanVersion(second));
    }

    function isSkipped(version, configured) {
        if (sameVersion(version, configured)) return true;
        try {
            return LEGACY_SKIP_KEYS.some((key) => sameVersion(version, localStorage.getItem(key)));
        } catch (_) {
            return false;
        }
    }

    function clearLegacySkip(version) {
        try {
            for (const key of LEGACY_SKIP_KEYS) {
                if (sameVersion(version, localStorage.getItem(key))) localStorage.removeItem(key);
            }
        } catch (_) { /* Settings still hold the current skip preference. */ }
    }

    function cleanLine(line) {
        return line
            .replace(/^\s*[-*+]\s+/, "")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/[*_~]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extractLanguageSection(markdown) {
        if (!markdown) return "";
        const lang = (window.ccI18n && typeof window.ccI18n.getEffectiveLang === "function")
            ? window.ccI18n.getEffectiveLang()
            : "en";

        // 1. Check for explicit comment tags: <!-- lang:es --> ... <!-- /lang:es -->
        const commentRegex = new RegExp(`<!--\\s*lang:${lang}\\s*-->([\\s\\S]*?)<!--\\s*/lang:${lang}\\s*-->`, "i");
        const commentMatch = markdown.match(commentRegex);
        if (commentMatch && commentMatch[1]?.trim()) {
            return commentMatch[1].trim();
        }

        // 2. Check for details summary block or header: <summary>...Español...</summary> or ### ...Español...
        if (lang === "es") {
            const esBlockRegex = /(?:<details>[\s\S]*?<summary>[\s\S]*?(?:español|spanish)[\s\S]*?<\/summary>([\s\S]*?)<\/details>)|(?:#{2,4}\s*(?:.*?(?:español|novedades|cambios).*?)\r?\n([\s\S]*?)(?=(?:#{2,4}\s)|<\/details>|$))/i;
            const esMatch = markdown.match(esBlockRegex);
            const content = esMatch ? (esMatch[1] || esMatch[2]) : null;
            if (content && content.trim()) {
                return content.trim();
            }
        }

        // 3. Fallback: if user is on English, or no Spanish block exists, exclude any Spanish details blocks so English remains clean
        return markdown.replace(/<details>[\s\S]*?<summary>[\s\S]*?(?:español|spanish)[\s\S]*?<\/summary>[\s\S]*?<\/details>/gi, "");
    }

    /**
     * Nested-aware preview of the release notes. Top-level bullets absorb their
     * indented sub-bullets and soft-wrapped continuation lines, so suite-standard
     * release bodies (nested lists) do not leak orphan fragments into the peek.
     */
    function parseChangelogPeek(markdown, limit = 4) {
        if (!markdown) return [];
        const targetedMarkdown = extractLanguageSection(markdown);
        const lines = targetedMarkdown.replace(/<!--[\s\S]*?-->|```[\s\S]*?```/g, "").split(/\r?\n/);

        const bullets = [];
        const paragraphs = [];
        let current = null;
        let inList = false;
        let releaseMetadata = false;

        const flush = () => {
            if (current) bullets.push(current);
            current = null;
            inList = false;
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (/^#{1,6}\s+/.test(trimmed)) {
                flush();
                const heading = trimmed.replace(/^#{1,6}\s+[^a-z]*/i, "");
                releaseMetadata = /^(?:before you install|antes de instalar|downloads|descargas|packages|paquetes|checksums|virustotal|sha256)\b/i.test(heading);
                continue;
            }
            if (releaseMetadata) continue;
            // Blank lines, horizontal rules and HTML section markers close the bullet.
            if (!trimmed || /^---+$/.test(trimmed) || /^<\/?(?:p|img|section|details|summary)\b/i.test(trimmed)) {
                flush();
                continue;
            }
            const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
            if (bulletMatch) {
                const text = cleanLine(bulletMatch[1]);
                if (!text) continue;
                if (inList && current && /^\s/.test(rawLine)) {
                    current += ` ${text}`;
                } else {
                    flush();
                    current = text;
                    inList = true;
                }
                continue;
            }
            if (inList && current) {
                current += ` ${cleanLine(trimmed)}`;
            } else {
                const text = cleanLine(trimmed);
                if (text && !/^<!--/.test(trimmed) && !/^\|/.test(trimmed) && !/^>/.test(trimmed)) {
                    paragraphs.push(text);
                }
            }
        }
        flush();

        const candidates = bullets.length ? bullets : paragraphs;
        return [...new Set(candidates)].slice(0, limit);
    }

    async function fetchReleaseNotes(version, fallbackNotes = "") {
        try {
            const response = await fetch(
                `${API_URL}/releases/tags/v${encodeURIComponent(cleanVersion(version))}`,
                {
                    signal: AbortSignal.timeout(10_000),
                    headers: {
                        Accept: "application/vnd.github+json",
                    },
                },
            );
            if (!response.ok) return fallbackNotes;
            const release = await response.json();
            return typeof release.body === "string" && release.body.trim() ? release.body : fallbackNotes;
        } catch (error) {
            // The update itself is independent from the optional preview.
            // Keep the release card useful when GitHub's API is unavailable.
            console.debug("Update notes unavailable:", error);
        }

        return fallbackNotes;
    }

    window.ccUpdates = {
        clearLegacySkip,
        fetchReleaseNotes,
        isSkipped,
        parseChangelogPeek,
        portableUrl,
        releaseUrl,
        sameVersion,
    };
})();
