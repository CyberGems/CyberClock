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
        return version
            ? `${REPO_URL}/releases/tag/v${encodeURIComponent(version)}`
            : `${REPO_URL}/releases`;
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

    function parseChangelogPeek(markdown, limit = 4) {
        if (!markdown) return [];
        const lines = String(markdown)
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

        try {
            const response = await fetch(
                `${API_URL}/releases/tags/v${encodeURIComponent(version)}`,
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
