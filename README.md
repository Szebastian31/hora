# Hora

<p align="center"><img src="icons/icon-1024.png" width="160" alt="Hora app icon"></p>

<p align="center"><b>A clock, alarm, timer and stopwatch that tells you how right it is.</b></p>

<p align="center"><a href="https://szebastian31.github.io/hora/"><img src="https://img.shields.io/badge/Open%20Hora-1f2e78?style=for-the-badge" alt="Open Hora"></a></p>

No app store, no account, no ads. Hora runs in your phone's browser and can be added to your home screen like a normal app.

---

## Getting started

1. Open **[szebastian31.github.io/hora](https://szebastian31.github.io/hora/)** on your phone.
2. Add it to your home screen:
   - **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
   - **Android (Chrome):** tap **⋮**, then **Install app** or **Add to home screen**.
3. Open Hora from the home screen. Long-press its icon for shortcuts to New alarm, Timer and Stopwatch.

## What's inside

- **🕰 Clock:** the background is the real sky over your city right now. Tap the time to switch to analog. The **LIVE** badge checks your clock against an internet clock and shows how far off it is.
- **🌍 World:** add cities and drag the time ruler to see what time it will be everywhere, handy for planning calls.
- **⏰ Alarms:** each alarm gets its own moving wake-up scene (or your own photo or video), its own sound (ten built in, or your own file), any snooze length from 1 to 60 minutes, and a choice of what happens if you don't answer. Slide up to stop, tap to snooze.
- **⏳ Timer:** drag the ring like a kitchen timer or tap a preset like Tea or Focus. Run several at once. A live pill at the top shows the countdown wherever you are in the app.
- **⏱ Stopwatch:** laps with your fastest and slowest marked, and whether you're ahead of or behind your average.
- **🎨 Profile:** five skins, three clock styles, 24-hour time and more.

## An honest note about alarms

Hora is a web app, so **alarms only ring while Hora is open on screen**. Turn on **Keep screen awake** in Profile and leave the phone on the nightstand, or keep your phone's own alarm as a backup.

## Privacy

Everything stays on your phone. Your alarms, photos, videos and sounds are saved on your device only and never uploaded.

## Questions or ideas?

Found a bug? [Open an issue](https://github.com/Szebastian31/hora/issues) and describe what happened, which phone you use and which browser.

---

_Hora is Latin for "hour". It's a sibling to Consensus Weather, Fidelis, Vestis and Caelum._

<details>
<summary>For developers</summary>

Plain HTML, CSS and JavaScript with no build step and no dependencies, hosted on GitHub Pages.

| File | What it does |
| --- | --- |
| `index.html` | Layout and styles |
| `app.js` | Clock, alarms, timers, stopwatch, sounds, live pill |
| `scenes.js` | Animated wake-up scenes and saving your own media |
| `manifest.webmanifest`, `sw.js` | Home-screen install, shortcuts and offline cache |
| `icons/` | App icons |
| `icons.html` | Page that exports the PNG icons |

After changing any file, bump `VERSION` in `sw.js` (e.g. `hora-v15`) so installed copies update.

</details>

<p align="center"><img src="icons/icon-1024.png" width="64" alt=""></p>
