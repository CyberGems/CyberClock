/**
 * CyberClock shared update presentation helpers.
 *
 * The updater knows whether a release exists, while this small browser-side
 * helper turns GitHub's Markdown notes into a safe, short preview for the
 * main window and the About window.
 */
(function () {
    "use strict";

    const REPO_URL = "https://github.com/CyberGems/CyberClock";
    const API_URL = "https://api.github.com/repos/CyberGems/CyberClock";

    function releaseUrl(version) {
        if (!version) return `${REPO_URL}/releases`;
        const clean = String(version).replace(/^v+/i, "");
        return `${REPO_URL}/releases/tag/v${encodeURIComponent(clean)}`;
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

    function parseChangelogPeek(markdown, limit = 4) {
        if (!markdown) return [];
        const targetedMarkdown = extractLanguageSection(markdown);
        const lines = String(targetedMarkdown)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const bullets = lines
            .filter((line) => /^[-*+]\s+/.test(line))
            .map(cleanLine)
            .filter(Boolean);

        const candidates = bullets.length
            ? bullets
            : lines
                  .filter((line) => !/^#{1,6}\s+/.test(line))
                  .map(cleanLine)
                  .filter(Boolean);

        return [...new Set(candidates)].slice(0, limit);
    }

    async function fetchReleaseDetails(version, fallbackNotes = "") {
        const details = {
            notes: fallbackNotes || "",
            bullets: parseChangelogPeek(fallbackNotes),
            url: releaseUrl(version),
        };

        if (!version) return details;
        const cleanVersion = String(version).replace(/^v+/i, "");

        try {
            const response = await fetch(
                `${API_URL}/releases/tags/v${encodeURIComponent(cleanVersion)}`,
                {
                    headers: {
                        Accept: "application/vnd.github+json",
                    },
                },
            );
            if (!response.ok) return details;
            const release = await response.json();
            details.notes = release.body || details.notes;
            details.bullets = parseChangelogPeek(details.notes);
            details.url = release.html_url || details.url;
        } catch (error) {
            // The update itself is independent from the optional preview.
            // Keep the release card useful when GitHub's API is unavailable.
            console.debug("Update notes unavailable:", error);
        }

        return details;
    }

    window.ccUpdates = {
        fetchReleaseDetails,
        parseChangelogPeek,
        releaseUrl,
    };
})();
