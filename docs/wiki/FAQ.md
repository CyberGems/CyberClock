# Frequently Asked Questions

General questions about CyberClock features, configuration, and troubleshooting.

---

## General

### What is CyberClock?
CyberClock is a premium cyber-neon styled desktop clock application that combines a clock, calendar, timer, stopwatch, and relaxation module into a single lightweight app.

### Is CyberClock free?
Yes. CyberClock is free and open source under the GPLv3 license. You can help keep it free [here](https://github.com/CyberGems/CyberClock#-donate).

### Does CyberClock work offline?
Yes. CyberClock works fully offline. Only auto-update checks require internet.

---

## Clock

### Can I switch between 12H and 24H format?
Yes. Go to Settings → General → Time format.

### Can I hide the seconds display?
Yes. Toggle "Show seconds" in Settings → General.

### What is the CRT scanlines effect?
A retro CRT monitor overlay that simulates the look of old cathode ray tube displays. Toggle in Settings → Display.

---

## Calendar

### Can I add notes to specific days?
Yes. Select a day in the calendar and click to add a note.

### What is shown in the agenda?
The agenda displays upcoming events, scheduled items, and notes for specific days.

### Does the calendar show moon phases?
Yes. Moon phase icons are displayed for each day.

---

## Timer

### Can I set custom timer durations?
Yes. Use the preset buttons or set a custom duration.

### What happens when the timer reaches zero?
An audible alert plays (if enabled) and a visual notification appears.

---

## Stopwatch

### How do I record laps?
Press the Lap button or use the L key while the stopwatch is running.

### Can I export lap data?
Yes. Click "Copy to clipboard" to copy the lap table for pasting into other apps.

### What statistics are shown?
Best lap, worst lap, average lap, and delta vs average.

---

## Relaxation

### What soundscapes are available?
Night, Forest, Outer Space, Ocean, Rain, and Fireplace.

### What breathing patterns are supported?
Box Breathing (4-4-4-4) and 4-7-8 Breathing.

### Are the sounds pre-recorded?
No. Sounds are procedurally synthesized using the Web Audio API — no loops, infinite variation.

---

## Alarms

### Can I set custom alarms?
Yes. Up to 3 custom alarms with day-of-week repetition.

### Can I use my own sound files?
Yes. Select "Custom sound" in alarm settings.

### How do I silence chimes at night?
Set a schedule window in Settings → Alarms with start/end times.

---

## Mini Mode

### What is Mini Mode?
A compact always-on-top clock bar (260×48) that stays visible over other windows.

### How many skins are available?
12 unique skins including Neon Cyan, Stealth, Hologram, and more.

### Can I lock the position?
Yes. Right-click Mini Mode → Lock position.

---

## Troubleshooting

### CyberClock doesn't start
- Ensure Tauri dependencies are installed
- Try running as Administrator
- Check Windows Event Viewer for errors

### No sound from relaxation module
- Check system volume
- Verify volume slider in relaxation module
- Ensure audio drivers are working

### Chimes not playing
- Check if chimes are enabled
- Verify schedule window settings
- Check volume settings

### Mini Mode not staying on top
- Enable "Always on top" in settings
- Check if another app is forcing topmost

---

## Contributing

### How can I report a bug?
Open an issue on [GitHub Issues](https://github.com/CyberGems/CyberClock/issues) with:
- CyberClock version
- Windows version
- Steps to reproduce
- Expected vs actual behavior

### How can I contribute code?
1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Describe your changes in the PR description

### How can I help with translations?
UI strings are in `src/shared/i18n.js`. Submit a PR with your translation.

### How can I donate?
See the [Donate section](https://github.com/CyberGems/CyberClock#-donate) on the main README.
