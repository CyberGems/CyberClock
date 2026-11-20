# Privacy — CyberClock

CyberClock runs on your PC and keeps your data on your PC. It has **no account, no telemetry, no analytics SDK and no ads**. It never sends your settings, alarm sounds or backups to its author or to anyone else.

Everything it knows (settings, alarm sounds or backups) stays in `%APPDATA%\com.cybergems.cyberclock\` (settings, alarm sounds and backups). Portable builds keep everything in a `data` folder next to the executable. The installer offers a **Delete app data** checkbox; when checked on a fresh install it removes the app data folders.

## When CyberClock goes online

These are all the connections CyberClock makes by itself. None of them sends your settings, alarm sounds or backups. Like any request on the internet, the server sees your IP address.

| When | Where | What for | How to turn it off |
|---|---|---|---|
| 8 seconds after launch | `github.com` (latest.json) | Check GitHub Releases for a newer version | `autoUpdate` in Settings |
| On startup and every 6 hours when clock accuracy is on | `pool.ntp.org`, `time.windows.com`, `time.google.com` (UDP/123), then `www.cloudflare.com` or `www.google.com` (TCP/80) | Measure clock drift. The clock is only changed when automatic time sync is enabled | Recurring check: `clockAccuracyEnabled`. The startup burst of up to 10 checks has no dedicated setting |
| Only during installation | `go.microsoft.com` | Download the WebView2 runtime if Windows does not have it | No setting; installer only |

A link you click inside the app, or a web page you open in your browser, is your own action and is not a connection the app makes by itself.

## What CyberClock reads on your PC

CyberClock reads the system clock and, when automatic time sync is enabled, adjusts the local time. That information stays on your screen. Anything that changes the system asks for confirmation first and, where possible, is backed up so it can be undone.

## Questions

Open an issue: https://github.com/CyberGems/CyberClock/issues

For a privacy-specific question, use the [contact page](https://cybergems.org/contact). The suite-wide statement is at [cybergems.org/privacy](https://cybergems.org/privacy).
