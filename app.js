/* Hora: clock, alarms, timers, stopwatch. Plain JS, no dependencies. */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const pad = n => String(n).padStart(2, "0");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = { name: "Gliwice", region: "Poland", lat: 50.29, lon: 18.67, home: true };

const CITIES = [
  ["London","Europe/London",51.51,-0.13],["New York","America/New_York",40.71,-74.0],["Tokyo","Asia/Tokyo",35.68,139.69],
  ["Los Angeles","America/Los_Angeles",34.05,-118.24],["Chicago","America/Chicago",41.88,-87.63],["Toronto","America/Toronto",43.65,-79.38],
  ["Denver","America/Denver",39.74,-104.99],["Mexico City","America/Mexico_City",19.43,-99.13],["São Paulo","America/Sao_Paulo",-23.55,-46.63],
  ["Honolulu","Pacific/Honolulu",21.31,-157.86],["Reykjavík","Atlantic/Reykjavik",64.15,-21.94],["Lisbon","Europe/Lisbon",38.72,-9.14],
  ["Paris","Europe/Paris",48.86,2.35],["Berlin","Europe/Berlin",52.52,13.4],["Istanbul","Europe/Istanbul",41.01,28.98],
  ["Cairo","Africa/Cairo",30.04,31.24],["Cape Town","Africa/Johannesburg",-33.92,18.42],["Dubai","Asia/Dubai",25.2,55.27],
  ["Mumbai","Asia/Kolkata",19.08,72.88],["Bangkok","Asia/Bangkok",13.76,100.5],["Singapore","Asia/Singapore",1.35,103.82],
  ["Hong Kong","Asia/Hong_Kong",22.32,114.17],["Shanghai","Asia/Shanghai",31.23,121.47],["Seoul","Asia/Seoul",37.57,126.98],
  ["Sydney","Australia/Sydney",-33.87,151.21],["Auckland","Pacific/Auckland",-36.85,174.76]
].map(([name, tz, lat, lon]) => ({ name, tz, lat, lon }));

const SKINS = {
  live:   { name: "Live sky" },
  linen:  { name: "Linen",   top: "#f5efe3", bot: "#e2d4bc", cls: "light", stars: 0 },
  indigo: { name: "Indigo",  top: "#0b1433", bot: "#22336b", stars: .85 },
  dusk:   { name: "Dusk",    top: "#2a2453", bot: "#cf7f6c", stars: .3, glow: .6 },
  bed:    { name: "Bedside", top: "#0d0303", bot: "#1e0606", cls: "red", stars: 0 }
};

const DEF = {
  skin: "live", font: "crust", h24: true, secs: true, correct: true, ticks: true, wake: false, notify: false, analog: false,
  cities: ["Europe/London", "America/New_York", "Asia/Tokyo"],
  alarms: [
    { id: 1, h: 7, m: 0, label: "Work", days: [1,1,1,1,1,0,0], on: true, sound: "glass", gentle: true, snooze: 9, scene: "sunrise" },
    { id: 2, h: 9, m: 30, label: "Slow Sunday", days: [0,0,0,0,0,0,1], on: false, sound: "dawn", gentle: true, snooze: 9, scene: "bloom" }
  ],
  timers: [], focus: null, setMs: 300000, setLabel: "Timer", timerSound: "ding", timerFile: "", timerRingFor: 2,
  watch: { run: false, start: 0, acc: 0, laps: [] }
};
let S;
try { S = Object.assign(JSON.parse(JSON.stringify(DEF)), JSON.parse(localStorage.getItem("hora") || "{}")); }
catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
if (!S.fontChosen || S.font === "yourbold" || S.font === "matrole") S.font = "crust";
const save = () => { try { localStorage.setItem("hora", JSON.stringify(S)); } catch (e) {} };

/* ---------- time & honesty ---------- */
let OFF = 0, UNC = null, SYNC = "idle", SYNCED_AT = 0;
const now = () => Date.now() + (S.correct ? OFF : 0);

function hm(d) {
  const h = d.getHours(), m = d.getMinutes();
  return S.h24 ? pad(h) + ":" + pad(m) : ((h % 12) || 12) + ":" + pad(m);
}
const ampm = d => S.h24 ? "" : (d.getHours() < 12 ? "AM" : "PM");
const hmA = d => hm(d) + (S.h24 ? "" : " " + ampm(d));
function dur(ms) {
  ms = Math.max(0, ms);
  const m = Math.ceil(ms / 60000);
  if (ms < 60000) return "under a minute";
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? h + " h" + (mm ? " " + mm + " m" : "") : mm + " m";
}
function clk(ms) {
  const t = Math.ceil(Math.max(0, ms) / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
}
function swFmt(ms) {
  ms = Math.max(0, ms);
  const cs = Math.floor(ms / 10) % 100, t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return { main: (h ? h + ":" + pad(m) : m) + ":" + pad(s), cs: "." + pad(cs) };
}
const swStr = ms => { const f = swFmt(ms); return f.main + f.cs; };

const partsCache = {};
function tzParts(tz, ms) {
  const f = partsCache[tz] || (partsCache[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const p = {}; f.formatToParts(ms).forEach(x => p[x.type] = x.value);
  return p;
}
function tzOffsetMin(tz, ms) {
  const p = tzParts(tz, ms);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}
function tzTime(tz, ms) {
  const p = tzParts(tz, ms), h = +p.hour % 24, m = +p.minute;
  return { t: S.h24 ? pad(h) + ":" + pad(m) : ((h % 12) || 12) + ":" + pad(m), ap: S.h24 ? "" : (h < 12 ? "AM" : "PM"), key: p.year + p.month + p.day };
}
const localKey = ms => { const d = new Date(ms); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };

/* Compare with the server's clock using the Date header. Each reply bounds the offset to a 1 s window;
   intersecting several replies narrows it. */
async function sync() {
  SYNC = "idle"; paintBadge();
  let lo = -Infinity, hi = Infinity, n = 0;
  const base = location.href.split("#")[0].split("?")[0];
  for (let i = 0; i < 7; i++) {
    try {
      const t0 = Date.now();
      const r = await fetch(base + "?hora=" + t0 + i, { method: "HEAD", cache: "no-store" });
      const t1 = Date.now();
      const dh = r.headers.get("date"); const sv = dh ? Date.parse(dh) : NaN;
      if (isNaN(sv)) break;
      lo = Math.max(lo, sv - t1); hi = Math.min(hi, sv + 1000 - t0); n++;
    } catch (e) { break; }
    await sleep(137 + i * 31);
  }
  if (n >= 2 && lo <= hi) { OFF = (lo + hi) / 2; UNC = (hi - lo) / 2; SYNC = "ok"; }
  else { OFF = 0; UNC = null; SYNC = "fail"; }
  SYNCED_AT = Date.now();
  paintBadge(); recalcAlarms();
}
function paintBadge() {
  const b = $("#sync"), t = $("#syncTxt"); b.className = "badge";
  let acc;
  if (SYNC === "idle") { b.classList.add("idle"); t.textContent = "Checking clock…"; acc = "Checking your clock against the internet's…"; }
  else if (SYNC === "fail") {
    b.classList.add("idle"); t.textContent = "Device clock · unchecked";
    acc = "Hora couldn't reach a time source just now, so it's showing your device's own clock. Phones usually sync themselves and are within a fraction of a second, but Hora won't claim that without checking.";
  } else {
    const a = Math.abs(OFF) / 1000, u = Math.max(UNC, 50) / 1000;
    if (Math.abs(OFF) <= Math.max(UNC, 500)) { t.textContent = "On time ±" + u.toFixed(1) + " s"; }
    else { b.classList.add("warn"); t.textContent = "Device " + a.toFixed(1) + " s " + (OFF > 0 ? "slow" : "fast") + (S.correct ? " · fixed" : ""); }
    acc = "Hora compared your device with an internet clock several times. Your device is <b>" + a.toFixed(2) + " s " + (OFF >= 0 ? "slow" : "fast") +
      "</b>, give or take " + u.toFixed(2) + " s. " + (S.correct ? "The time on screen, alarms and timers are corrected for this." : "Correction is off, so you're seeing the device's own time.") +
      " The time source only gives whole seconds, which is why there's a margin. Alarms are rounded to the minute anyway.";
  }
  $("#accText").innerHTML = acc;
}
$("#sync").onclick = () => { openSheet(`<h2>Clock accuracy</h2><div class="kind">${$("#syncTxt").textContent}</div><div class="honest">${$("#accText").innerHTML}</div><div class="acts"><button class="btn wide" id="sAgain">Check again</button></div>`); $("#sAgain").onclick = () => { closeSheet(); sync(); }; };
$("#resync").onclick = () => sync();

/* ---------- sun & sky ---------- */
const RAD = Math.PI / 180;
function sunAlt(ms, lat, lon) {
  const d = ms / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const H = (gmst * 15 + lon) * RAD - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(H)) / RAD;
}
function crossings(dayStart, thr, lat = HOME.lat, lon = HOME.lon) {
  const f = t => sunAlt(t, lat, lon) - thr, out = { rise: null, set: null }, step = 600000;
  let a = dayStart, fa = f(a);
  for (let t = dayStart + step; t <= dayStart + 86400000; t += step) {
    const ft = f(t);
    if ((fa < 0) !== (ft < 0)) {
      let lo = t - step, hi = t;
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if ((f(m) < 0) === (fa < 0)) lo = m; else hi = m; }
      if (fa < 0) out.rise = hi; else out.set = hi;
    }
    a = t; fa = ft;
  }
  return out;
}
const SKY = [
  [-20, "#050a20", "#121b44"], [-12, "#0a1331", "#223170"], [-6, "#18245f", "#5b4f92"], [-2, "#27306f", "#c87a7c"],
  [2, "#3b57a3", "#eea472"], [8, "#3a72c6", "#a8cbec"], [25, "#2c69cc", "#9dcff5"]
];
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
function skyFor(alt) {
  if (alt <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) if (alt <= SKY[i][0]) {
    const t = (alt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
    return [mix(SKY[i - 1][1], SKY[i][1], t), mix(SKY[i - 1][2], SKY[i][2], t)];
  }
  const l = SKY[SKY.length - 1]; return [l[1], l[2]];
}
(function makeStars() {
  const box = $("#stars"); let h = "";
  for (let i = 0; i < 90; i++) {
    const s = Math.random() < .12 ? 2 : Math.random() < .5 ? 1.4 : 1;
    h += `<i style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;width:${s}px;height:${s}px;opacity:${(.4 + Math.random() * .6).toFixed(2)};animation-delay:${(Math.random() * 4).toFixed(2)}s"></i>`;
  }
  box.innerHTML = h;
})();
function paintSky() {
  const sk = SKINS[S.skin] || SKINS.live, scr = $("#screen");
  let top, bot, stars, glow = 0;
  if (S.skin === "live") {
    const alt = sunAlt(now(), PLACE().lat, PLACE().lon);
    [top, bot] = skyFor(alt);
    stars = clamp((-alt - 3) / 9, 0, 1);
    glow = clamp(1 - Math.abs(alt - 1) / 7, 0, 1) * .9;
  } else { top = sk.top; bot = sk.bot; stars = sk.stars; glow = sk.glow || 0; }
  scr.style.setProperty("--sky-top", top); scr.style.setProperty("--sky-bot", bot);
  scr.classList.toggle("light", sk.cls === "light"); scr.classList.toggle("red", sk.cls === "red");
  $("#stars").style.opacity = stars; $("#glow").style.opacity = glow;
  document.querySelector('meta[name="theme-color"]').content = top;
}

/* ---------- audio ---------- */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
document.addEventListener("pointerdown", () => ac(), { passive: true });
function tick(f = 1) {
  if (!S.ticks) return; const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(2300 * f, t); o.frequency.exponentialRampToValueAtTime(800 * f, t + .03);
  g.gain.setValueAtTime(.045, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + .06);
}
/* Each voice is a small synth patch; sounds are short phrases of notes that repeat while ringing. */
function env(g, t, peak, att, len) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + len); }
const VOICES = {
  bell(a, out, f, t, v, len) {
    [1, 2.01, 2.76, 5.4].forEach((p, i) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f * p;
      env(g, t, v * [1, .45, .28, .1][i], .01, len / (1 + i * .6)); o.connect(g).connect(out); o.start(t); o.stop(t + len);
    });
  },
  mallet(a, out, f, t, v, len) {
    [[1, 1], [3.93, .28], [9.2, .06]].forEach(([p, m], i) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f * p;
      env(g, t, v * m * 1.3, .004, len / (1 + i * 2)); o.connect(g).connect(out); o.start(t); o.stop(t + len);
    });
  },
  pluck(a, out, f, t, v, len) {
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + len * .6); lp.connect(out);
    [[1, "triangle", 0], [2, "sine", .4], [1, "sawtooth", .12]].forEach(([p, ty, m], i) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = ty; o.frequency.value = f * p * (i === 2 ? 1.003 : 1);
      env(g, t, v * (m || 1) * .9, .003, len); o.connect(g).connect(lp); o.start(t); o.stop(t + len);
    });
  },
  pad(a, out, f, t, v, len) {
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = .4; lp.connect(out);
    [-6, 6].forEach(dt => {
      const o = a.createOscillator(), g = a.createGain(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = dt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .35, t + len * .35); g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g).connect(lp); o.start(t); o.stop(t + len + .05);
    });
  },
  chirp(a, out, f, t, v, len) {
    const o = a.createOscillator(), g = a.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + len * .5); o.frequency.exponentialRampToValueAtTime(f * 1.1, t + len);
    env(g, t, v * .8, .01, len); o.connect(g).connect(out); o.start(t); o.stop(t + len + .02);
  },
  beep(a, out, f, t, v, len) {
    const o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter(); o.type = "square"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = f * 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .35, t + .005); g.gain.setValueAtTime(v * .35, t + len - .01); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + len + .02);
  },
  bowl(a, out, f, t, v, len) {
    [[1, 1, 0], [1.004, .8, 0], [2.71, .3, 0], [5.1, .08, 0]].forEach(([p, m]) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f * p;
      env(g, t, v * m, .06, len); o.connect(g).connect(out); o.start(t); o.stop(t + len);
    });
  }
};
const N = n => 440 * Math.pow(2, n / 12);   // semitones from A4
const SOUNDS = {
  glass:   { name: "Glass",        voice: "bell",   every: 2400, notes: [[3, 0], [7, .16], [10, .32], [15, .48]], len: 2.2 },
  dawn:    { name: "Dawn",         voice: "bell",   every: 3400, notes: [[-9, 0], [-5, .45], [-2, .9], [3, 1.35]], len: 3.6 },
  rise:    { name: "Rise",         voice: "bell",   every: 2600, notes: [[3, 0], [5, .13], [7, .26], [10, .39], [12, .52], [15, .65]], len: 2 },
  marimba: { name: "Marimba",      voice: "mallet", every: 2100, notes: [[3, 0], [7, .14], [10, .28], [15, .42], [10, .7], [15, .84]], len: .9 },
  harp:    { name: "Harp",         voice: "pluck",  every: 3000, notes: [[-7, 0], [0, .11], [5, .22], [9, .33], [12, .44], [17, .55]], len: 2.2 },
  lumen:   { name: "Lumen",        voice: "pad",    every: 3800, notes: [[-16, 0], [-12, 0], [-9, 0], [-5, 0], [-2, .2]], len: 3.4 },
  bowl:    { name: "Singing bowl", voice: "bowl",   every: 5200, notes: [[-14, 0], [-7, 2.4]], len: 5 },
  birds:   { name: "Birdsong",     voice: "chirp",  every: 2800, notes: [[31, 0, .09], [33, .12, .07], [31, .22, .09], [36, .7, .12], [34, .9, .06], [36, 1.0, .06], [29, 1.6, .14]], len: .1 },
  crystal: { name: "Crystal",      voice: "bell",   every: 2000, notes: [[15, 0], [19, .08], [22, .16], [27, .24]], len: 1.6 },
  ding:    { name: "Ding",         voice: "bell",   every: 2200, notes: [[7, 0], [3, .35]], len: 2.4 },
  pulse:   { name: "Pulse",        voice: "beep",   every: 1400, notes: [[12, 0], [12, .15], [12, .3], [12, .45]], len: .09 },
  kitchen: { name: "Kitchen",      voice: "beep",   every: 1600, notes: [[27, 0], [27, .07], [27, .14], [27, .21], [27, .28], [27, .35], [27, .42], [27, .49]], len: .045 }
};
const ALARM_SOUNDS = ["glass", "dawn", "rise", "marimba", "harp", "lumen", "bowl", "birds", "crystal", "pulse"];
const TIMER_SOUNDS = ["ding", "glass", "marimba", "crystal", "harp", "bowl", "pulse", "kitchen"];
function playSound(name, vol = .8, at) {
  const a = ac(); if (!a) return;
  const s = SOUNDS[name] || SOUNDS.glass, t = at || a.currentTime + .03, out = a.createGain();
  out.gain.value = vol * .22; out.connect(a.destination);
  s.notes.forEach(([n, d, l]) => VOICES[s.voice](a, out, N(n), t + d, 1, l || s.len));
}
/* one phrase plus a short breath, so a ringing sound repeats like a real ringtone */
function loopPeriod(name) {
  const s = SOUNDS[name] || SOUNDS.glass, last = Math.max(...s.notes.map(n => n[1]));
  const tail = s.voice === "pad" ? s.len : s.voice === "bowl" ? 2.6 : s.voice === "beep" ? .45 : s.voice === "chirp" ? .9 : .7;
  return last + tail;
}
/* the user's own audio files */
let AUD = null, AUDTO = null;
function stopFile() { clearTimeout(AUDTO); if (AUD) { AUD.pause(); AUD.src = ""; AUD = null; } }
async function playFile(key, vol, loop, maxMs) {
  stopFile();
  const m = await SC.media.get(key); if (!m) return false;
  const el = new Audio(m.url); el.loop = loop; el.volume = clamp(vol, 0, 1); AUD = el;
  try { await el.play(); } catch (e) { AUD = null; return false; }
  if (maxMs) AUDTO = setTimeout(stopFile, maxMs);
  return true;
}
function preview(sound, key) { stopFile(); if (sound === "custom") playFile(key, .8, false, 7000); else playSound(sound, .7); }
const soundName = (sound, fileName) => sound === "custom" ? (fileName || "Your sound") : (SOUNDS[sound] || SOUNDS.glass).name;
/* a picker grid shared by the alarm editor and the timer sheet */
const WAVE = `<svg viewBox="0 0 24 12"><path d="M1 6h2M5 3v6M8 1v10M11 4v4M14 2v8M17 4v4M20 3v6M23 6h0"/></svg>`;
function soundGrid(list, cur, fileName, id) {
  return `<div class="snds" id="${id}">` + list.map(k => `<div class="snd ${cur === k ? "on" : ""}" data-k="${k}">${WAVE}<b>${SOUNDS[k].name}</b></div>`).join("") +
    `<label class="snd file ${cur === "custom" ? "on" : ""}" data-k="custom"><svg viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg><b>${fileName ? esc(fileName) : "Your sound"}</b><input type="file" accept="audio/*"></label></div>`;
}
function bindSoundGrid(id, key, get, set) {
  const root = $("#" + id), paint = () => $$("#" + id + " .snd").forEach(x => x.classList.toggle("on", x.dataset.k === get().sound));
  $$("#" + id + " .snd:not(.file)").forEach(x => x.onclick = () => { set({ sound: x.dataset.k }); paint(); preview(x.dataset.k); });
  const file = root.querySelector(".file"), inp = file.querySelector("input");
  file.onclick = e => { if (e.target === inp) return; if (get().fileName && get().sound !== "custom") { e.preventDefault(); set({ sound: "custom" }); paint(); preview("custom", key); } };
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 40 * 1024 * 1024) { toast("That file is over 40 MB"); return; }
    const kept = await SC.media.put(key, f), nm = f.name.replace(/\.[^.]+$/, "").slice(0, 26);
    set({ sound: "custom", fileName: nm }); file.querySelector("b").textContent = nm; paint(); preview("custom", key);
    toast(kept ? "Sound set" : "Set for now, but this browser won't keep it after closing");
  };
}

/* ---------- toast, sheet ---------- */
let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200); }
let onSheetClose = null;
function openSheet(html, after) {
  $("#sheetBody").innerHTML = html; $("#scrim").classList.add("show"); $("#sheet").classList.add("show"); $("#sheet").scrollTop = 0;
  if (after) requestAnimationFrame(after);
}
function closeSheet() { $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); if (onSheetClose) { onSheetClose(); onSheetClose = null; } }
$("#scrim").onclick = closeSheet;

/* ---------- tabs ---------- */
let VIEW = "vClock";
function go(v) {
  if (v === VIEW) return; VIEW = v; tick(.8);
  $$(".view").forEach(x => x.classList.toggle("show", x.id === v));
  $$(".tab").forEach(x => x.classList.toggle("on", x.dataset.v === v));
  if (v === "vClock") drawRuler();
  renderAll();
}
$$(".tab").forEach(t => t.onclick = () => go(t.dataset.v));

/* ---------- clock face ---------- */
(function buildAnalog() {
  const svg = $("#analog"); let h = `<circle cx="120" cy="120" r="114" fill="rgba(255,255,255,.06)" stroke="var(--glass-b)"/>`;
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * RAD, big = i % 5 === 0, r1 = big ? 98 : 103, r2 = 108;
    h += `<line class="tk" x1="${120 + Math.sin(a) * r1}" y1="${120 - Math.cos(a) * r1}" x2="${120 + Math.sin(a) * r2}" y2="${120 - Math.cos(a) * r2}" stroke-width="${big ? 2 : 1}" opacity="${big ? .9 : .35}"/>`;
  }
  [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([n, d]) => h += `<text class="num" x="${120 + Math.sin(d * RAD) * 82}" y="${120 - Math.cos(d * RAD) * 82}">${n}</text>`);
  h += `<line class="hh" id="aH" x1="120" y1="128" x2="120" y2="66" stroke-width="5"/><line class="mh" id="aM" x1="120" y1="132" x2="120" y2="40" stroke-width="3"/>
        <line class="sh" id="aS" x1="120" y1="142" x2="120" y2="30" stroke-width="1.4"/><circle cx="120" cy="120" r="4.5" fill="var(--accent)"/><circle cx="120" cy="120" r="1.8" fill="var(--sky-top)"/>`;
  svg.innerHTML = h;
})();

/* ---------- hero: the place being viewed (home first, then world cities) ---------- */
let PIDX = 0;
function places() { return [HOME, ...S.cities.map(tz => CITIES.find(c => c.tz === tz)).filter(Boolean)]; }
function PLACE() { const p = places(); if (PIDX >= p.length) PIDX = 0; return p[PIDX]; }
function clockAt(p, ms) {
  if (p.home) { const d = new Date(ms); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() + d.getMilliseconds() / 1000 }; }
  const q = tzParts(p.tz, ms); return { h: +q.hour % 24, m: +q.minute, s: +q.second + (ms % 1000) / 1000 };
}
const fmtHM = (h, m) => S.h24 ? pad(h) + ":" + pad(m) : ((h % 12) || 12) + ":" + pad(m);
const apOf = h => S.h24 ? "" : (h < 12 ? "AM" : "PM");
function pT(ms, p = PLACE()) { const c = clockAt(p, ms); return fmtHM(c.h, c.m) + (S.h24 ? "" : " " + apOf(c.h)); }
const offMin = (p, ms) => p.home ? -new Date(ms).getTimezoneOffset() : tzOffsetMin(p.tz, ms);
const dayStartOf = (p, ms) => { const c = clockAt(p, ms); return ms - Math.round(((c.h * 60 + c.m) * 60 + c.s) * 1000); };
function moonAt(ms) {
  const syn = 29.530588853, age = (((ms - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn + syn) % syn, ph = age / syn;
  const lit = Math.round((1 - Math.cos(ph * TAU_)) / 2 * 100);
  const name = ph < .03 || ph > .97 ? "New moon" : ph < .22 ? "Waxing crescent" : ph < .28 ? "First quarter" : ph < .47 ? "Waxing gibbous" : ph < .53 ? "Full moon" : ph < .72 ? "Waning gibbous" : ph < .78 ? "Last quarter" : "Waning crescent";
  return { lit, name, ph };
}
const TAU_ = Math.PI * 2;
function isoWeek(y, mo, d) {
  const t = new Date(Date.UTC(y, mo, d)), wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
const utcTxt = m => "UTC" + (m === 0 ? "" : (m > 0 ? "+" : "−") + Math.floor(Math.abs(m) / 60) + (Math.abs(m) % 60 ? ":" + pad(Math.abs(m) % 60) : ""));
const hDur = ms => { const m = Math.round(ms / 60000); return Math.floor(m / 60) + " h " + pad(m % 60) + " m"; };

/* ---------- Hora Line: the clock's own digits, drawn as single rounded strokes on a 60x100 grid ---------- */
const GLYPH = {
  "0": "M8 31A22 22 0 0 1 52 31V69A22 22 0 0 1 8 69Z",
  "1": "M19 21L35 8V92",
  "2": "M9 31A21 21 0 0 1 51 31C51 47 39 57 9 92H52",
  "3": "M10 8H50L27 41C42 39 53 50 53 65C53 81 42 92 29 92C19 92 12 87 8 80",
  "4": "M41 92V8L8 66H54",
  "5": "M50 8H15L12 45C18 40 24 38 31 38C44 38 53 50 53 65C53 81 43 92 30 92C20 92 12 87 8 79",
  "6": "M42 8L13 54M8 68A22 22 0 1 0 52 68A22 22 0 1 0 8 68",
  "7": "M8 8H52L21 92",
  "8": "M11 28A19 19 0 1 0 49 28A19 19 0 1 0 11 28M8 70A22 22 0 1 0 52 70A22 22 0 1 0 8 70",
  "9": "M8 32A22 22 0 1 0 52 32A22 22 0 1 0 8 32M47 46L18 92"
};
const glyphSvg = ch => ch === ":"
  ? `<svg class="gl colon" viewBox="0 0 24 100"><circle cx="12" cy="36" r="6.5"/><circle cx="12" cy="70" r="6.5"/></svg>`
  : `<svg class="gl" viewBox="-6 -6 72 112"><path d="${GLYPH[ch] || ""}" pathLength="1"/></svg>`;
function lineTime(box, hm, ss, ap) {
  if (box.dataset.f !== "line") { box.innerHTML = `<span class="lt main"></span><span class="tside"><span class="lt sec"></span><span class="lap2"></span></span>`; box.dataset.f = "line"; }
  const put = (el, str) => {
    const slots = el.children;
    if (slots.length !== str.length) { el.innerHTML = [...str].map(() => `<span class="slot"></span>`).join(""); }
    [...str].forEach((ch, i) => {
      const s = el.children[i];
      if (s.dataset.c !== ch) { s.dataset.c = ch; s.innerHTML = glyphSvg(ch); if (box.dataset.ready) s.firstChild.classList.add("draw"); }
    });
  };
  const sec = box.querySelector(".sec"), apEl = box.querySelector(".lap2");
  put(box.children[0], hm); put(sec, ss);
  sec.style.display = ss ? "" : "none";
  apEl.textContent = ap;
  box.dataset.ready = "1";
}

/* the alarm screen shows the time in the same digits as the main clock */
function ringTime() {
  const d = new Date(now()), el = $("#rT");
  if (S.font === "line") { lineTime(el, hm(d), "", S.h24 ? "" : ampm(d)); return; }
  const t = hm(d) + (S.h24 ? "" : " " + ampm(d));
  if (el.dataset.f !== S.font) { el.innerHTML = ""; el.dataset.f = S.font; delete el.dataset.ready; }
  if (el.textContent !== t) { el.textContent = t; el.style.scale = ""; const w = el.scrollWidth, max = ($("#ring").clientWidth || 360) - 40; if (w > max) el.style.scale = (max / w).toFixed(3); }
}
function fitDigi() {
  const d = $("#digi"), box = $("#face"); if (!d || !box.clientWidth) return;
  d.style.transform = ""; const w = d.scrollWidth, max = box.clientWidth - 4;
  d.style.transform = w > max ? `scale(${(max / w).toFixed(3)})` : "";
}
addEventListener("resize", fitDigi);
if (document.fonts) document.fonts.addEventListener("loadingdone", fitDigi);
function renderFace() {
  const n = now(), p = PLACE(), c = clockAt(p, n);
  $("#face").classList.toggle("ana", S.analog);
  if (S.analog) {
    const m = c.m + c.s / 60, h = (c.h % 12) + m / 60;
    $("#aH").setAttribute("transform", `rotate(${h * 30} 120 120)`);
    $("#aM").setAttribute("transform", `rotate(${m * 6} 120 120)`);
    $("#aS").setAttribute("transform", `rotate(${c.s * 6} 120 120)`);
  } else {
    if (S.font === "solid" || S.font === "crust") {
      const html = fmtHM(c.h, c.m) + (S.secs ? `<span class="ss">${pad(Math.floor(c.s))}</span>` : "") + (S.h24 ? "" : `<span class="ap">${apOf(c.h)}</span>`);
      if ($("#digi").dataset.f !== S.font || $("#digi").innerHTML !== html) { $("#digi").innerHTML = html; $("#digi").dataset.f = S.font; fitDigi(); }
    } else lineTime($("#digi"), fmtHM(c.h, c.m), S.secs ? pad(Math.floor(c.s)) : "", apOf(c.h));
  }
  const opt = { weekday: "long", day: "numeric", month: "long" }; if (!p.home) opt.timeZone = p.tz;
  $("#dateLine").textContent = new Date(n).toLocaleDateString("en-GB", opt);
}
$("#face").onclick = () => { if (HERO.swiped) return; S.analog = !S.analog; save(); tick(); renderFace(); };

/* ---------- daylight + hero stats ---------- */
let SUNKEY = "", SUN = null;
function renderSun() {
  const n = now(), p = PLACE(), key = p.name + dayStartOf(p, n);
  if (key !== SUNKEY) {
    SUNKEY = key;
    const d0 = dayStartOf(p, n), c = crossings(d0, -0.833, p.lat, p.lon), g = crossings(d0, 6, p.lat, p.lon), tm = crossings(d0 + 86400000, -0.833, p.lat, p.lon);
    SUN = { rise: c.rise, set: c.set, gold: g.set, tRise: tm.rise };
  }
  const { rise, set, gold, tRise } = SUN;
  $("#rise").textContent = rise ? pT(rise) : "—"; $("#set").textContent = set ? pT(set) : "—";
  $("#hRise").textContent = rise ? pT(rise) : "—"; $("#hSet").textContent = set ? pT(set) : "—";
  let big, f, day = rise && set && n >= rise && n < set;
  if (day) { big = dur(set - n) + " of daylight left"; f = (n - rise) / (set - rise); }
  else if (rise && n < rise) { big = "Sunrise in " + dur(rise - n); f = null; }
  else { big = "Sunrise in " + dur((tRise || n) - n); f = null; }
  $("#sunBig").textContent = big;
  $("#goldTxt").textContent = gold && n < gold ? "Golden hour " + pT(gold) : (gold && set && n >= gold && n < set ? "Golden hour now" : "");
  const P0 = [16, 70], P1 = [160, -18], P2 = [304, 70];
  let sx, sy, op = 1;
  if (f !== null) { const u = 1 - f; sx = u * u * P0[0] + 2 * u * f * P1[0] + f * f * P2[0]; sy = u * u * P0[1] + 2 * u * f * P1[1] + f * f * P2[1]; }
  else {
    const a = set && n >= set ? set : (rise ? rise - 43200000 : n), b = set && n >= set ? tRise : rise;
    const ff = b && a ? clamp((n - a) / (b - a), 0, 1) : .5;
    sx = 16 + ff * 288; sy = 70 + Math.sin(ff * Math.PI) * 12; op = .45;
  }
  $("#sunSvg").innerHTML = `
    <defs><radialGradient id="sg"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#ffc98a" stop-opacity="0"/></radialGradient>
    <clipPath id="sc"><rect x="0" y="-30" width="${sx}" height="101"/></clipPath></defs>
    <path d="M16 70 Q160 -18 304 70" fill="none" stroke="var(--fg2)" stroke-width="1.2" stroke-dasharray="2 5" opacity=".7"/>
    ${f !== null ? `<path d="M16 70 Q160 -18 304 70" fill="none" stroke="var(--fg)" stroke-width="2" clip-path="url(#sc)" opacity=".9"/>` : ""}
    <line x1="0" y1="70" x2="320" y2="70" stroke="var(--glass-b)" stroke-width="1"/>
    <circle cx="${sx}" cy="${sy}" r="22" fill="url(#sg)" opacity="${op * .9}"/>
    <circle cx="${sx}" cy="${sy}" r="6.5" fill="${f !== null ? "#fff6df" : "var(--fg2)"}" opacity="${op}"/>`;
  renderHero(n, p, day);
}
function renderHero(n, p, day) {
  const { rise, set } = SUN, moon = moonAt(n), nx = nextAlarm();
  const T = [
    ["Day length", rise && set ? hDur(set - rise) : "—"],
    ["Next alarm", nx ? pT(nx.at) : "Off", nx ? "in " + dur(nx.at - n) : ""],
    [moon.name, moon.lit + "%", "Moon"].slice(0, 2)
  ];
  const h = T.map(([k, v, s]) => `<div class="hm"><b>${v}</b><span>${k}${s ? " · " + s : ""}</span></div>`).join("");
  if ($("#hGrid").innerHTML !== h) $("#hGrid").innerHTML = h;
}
const HERO = { swiped: false };

/* ---------- world + ruler ---------- */
const R = { shift: 0, PX: 34 };
function drawRuler() {
  const c = $("#rulerC"), w = c.clientWidth, h = c.clientHeight, dpr = devicePixelRatio || 1;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const fg = getComputedStyle($("#screen")).getPropertyValue("--fg").trim() || "#fff";
  const d = new Date(now()), cur = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, center = cur + R.shift;
  const span = (w / 2) / R.PX * 60, h0 = Math.floor((center - span) / 60) - 1, h1 = Math.ceil((center + span) / 60) + 1;
  x.fillStyle = fg; x.strokeStyle = fg; x.font = "600 9.5px -apple-system,sans-serif"; x.textAlign = "center"; x.lineWidth = 1;
  for (let H = h0; H <= h1; H++) for (let q = 0; q < 4; q++) {
    const xx = w / 2 + (H * 60 + q * 15 - center) / 60 * R.PX, major = q === 0, hh = ((H % 24) + 24) % 24;
    x.globalAlpha = major ? .8 : .3; x.beginPath(); x.moveTo(xx, major ? 5 : 8); x.lineTo(xx, major ? 13 : 11); x.stroke();
    if (major && hh % 3 === 0) { x.globalAlpha = hh === 0 ? .95 : .6; x.fillText(hh === 0 ? "0h" : pad(hh), xx, h - 5); }
  }
}
(function rulerInput() {
  const el = $("#ruler"); let drag = false, lx = 0, lastH = 0, anim;
  const lim = 24 * 60;
  el.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; el.setPointerCapture(e.pointerId); cancelAnimationFrame(anim); lastH = Math.floor(R.shift / 60); });
  el.addEventListener("pointermove", e => {
    if (!drag) return;
    R.shift = clamp(R.shift - (e.clientX - lx) / R.PX * 60, -lim, lim); lx = e.clientX;
    const hh = Math.floor(R.shift / 60); if (hh !== lastH) { tick(1.1); lastH = hh; }
    drawRuler(); renderWorld();
  });
  const end = () => {
    if (!drag) return; drag = false;
    const from = R.shift, to = Math.round(R.shift / 15) * 15, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 220), e2 = 1 - Math.pow(1 - k, 3); R.shift = from + (to - from) * e2; drawRuler(); renderWorld(); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => { e.preventDefault(); R.shift = clamp(R.shift + (e.deltaX || e.deltaY) * .6, -lim, lim); drawRuler(); renderWorld(); }, { passive: false });
  $("#tNow").onclick = () => { R.shift = 0; tick(); drawRuler(); renderWorld(); };
})();
function renderWorld() {
  const n = now(), at = n + R.shift * 60000, sh = Math.round(R.shift);
  if (Math.abs(sh) < 1) { $("#tLabel").textContent = "Now"; $("#tDelta").textContent = "drag to plan across time zones"; $("#tNow").style.display = "none"; }
  else { $("#tLabel").textContent = (sh > 0 ? "+" : "−") + dur(Math.abs(sh) * 60000).replace("under a minute", "0 m"); $("#tDelta").textContent = hmA(new Date(at)) + " in Gliwice"; $("#tNow").style.display = "inline-block"; }
  const lkey = localKey(at), loff = -new Date(at).getTimezoneOffset();
  let h = "";
  S.cities.forEach(tz => {
    const c = CITIES.find(x => x.tz === tz); if (!c) return;
    const t = tzTime(tz, at), diff = (tzOffsetMin(tz, at) - loff) / 60;
    const day = t.key === lkey ? "Today" : (t.key > lkey ? "Tomorrow" : "Yesterday");
    const ds = diff === 0 ? "Same time" : (diff > 0 ? "+" : "−") + Math.abs(diff) + " h";
    const alt = sunAlt(at, c.lat, c.lon), [tp, bt] = skyFor(alt);
    const hr = +tzParts(tz, at).hour % 24, awake = hr >= 8 && hr < 22 ? (hr >= 9 && hr < 18 ? `<span class="pill">Work hours</span>` : `<span class="pill dim">Awake</span>`) : `<span class="pill amber">Asleep</span>`;
    h += `<div class="row"><div class="ic" style="background:linear-gradient(${tp},${bt})"></div><div class="tx"><b>${c.name}</b><span>${day} · ${ds} &nbsp;${awake}</span></div><div class="rt">${t.t}${t.ap ? `<small>${t.ap}</small>` : ""}</div></div>`;
  });
  if (!S.cities.length) h = `<div class="empty">No cities yet. Tap Edit to add some.</div>`;
  if ($("#world").innerHTML !== h) $("#world").innerHTML = h;
}
$("#editCities").onclick = () => {
  openSheet(`<h2>World clocks</h2><div class="kind">Tap a city to add or remove it</div><input class="field" id="cq" placeholder="Search cities" autocomplete="off"><div class="cityl" id="cl" style="margin-top:8px"></div>`, () => {
    const list = () => {
      const q = $("#cq").value.trim().toLowerCase(), n = now();
      $("#cl").innerHTML = CITIES.filter(c => !q || c.name.toLowerCase().includes(q)).map(c => {
        const on = S.cities.includes(c.tz), t = tzTime(c.tz, n);
        return `<div class="row" data-tz="${c.tz}"><div class="check ${on ? "on" : ""}">${on ? "✓" : ""}</div><div class="tx"><b>${c.name}</b><span>${c.tz.split("/").pop().replace(/_/g, " ")}</span></div><div class="rt" style="font-size:18px">${t.t}${t.ap ? `<small>${t.ap}</small>` : ""}</div></div>`;
      }).join("");
      $$("#cl .row").forEach(r => r.onclick = () => {
        const tz = r.dataset.tz, i = S.cities.indexOf(tz);
        if (i >= 0) S.cities.splice(i, 1); else S.cities.push(tz);
        save(); tick(); list(); renderWorld();
      });
    };
    $("#cq").oninput = list; list();
  });
};

/* ---------- alarms ---------- */
const NEXT = {}; let SNOOZES = [];
const DAYN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function nextAt(a, from) {
  const b = new Date(from), any = a.days.some(Boolean);
  for (let d = 0; d < 8; d++) {
    const c = new Date(b.getFullYear(), b.getMonth(), b.getDate() + d, a.h, a.m, 0, 0);
    if (c.getTime() <= from) continue;
    if (!any || a.days[(c.getDay() + 6) % 7]) return c.getTime();
  }
  return null;
}
function recalcAlarms() { const n = now(); S.alarms.forEach(a => NEXT[a.id] = a.on ? nextAt(a, n) : null); }
function daysText(a) {
  const d = a.days, c = d.filter(Boolean).length;
  if (!c) return "Once";
  if (c === 7) return "Every day";
  if (c === 5 && d.slice(0, 5).every(Boolean)) return "Weekdays";
  if (c === 2 && d[5] && d[6]) return "Weekends";
  return DAYN.filter((_, i) => d[i]).join(", ");
}
function nextAlarm() {
  let best = null;
  S.alarms.forEach(a => { if (NEXT[a.id] && (!best || NEXT[a.id] < best.at)) best = { at: NEXT[a.id], a }; });
  SNOOZES.forEach(s => { if (!best || s.at < best.at) best = { at: s.at, a: s.a, snoozed: true }; });
  return best;
}
function renderAlarms() {
  const n = now(), nx = nextAlarm();
  $("#alarmSub").textContent = nx ? (nx.snoozed ? "Snoozed, rings again in " : "Next alarm rings in ") + dur(nx.at - n) : "No alarms on";
  const list = [...S.alarms].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  let h = list.map(a => {
    const d = new Date(2000, 0, 1, a.h, a.m), when = a.on && NEXT[a.id] ? " · in " + dur(NEXT[a.id] - n) : "";
    return `<div class="card alarm ${a.on ? "" : "off"}" data-id="${a.id}" data-sc="${a.scene || "sunrise"}${a.mv || ""}"><div class="vis"></div><div class="shade"></div><div class="at">${hm(d)}${S.h24 ? "" : `<small>${ampm(d)}</small>`}</div><div class="meta"><b>${esc(a.label || "Alarm")}</b><span>${daysText(a)}${when}</span><span>${esc(soundName(a.sound, a.fileName))}${a.gentle ? " · gentle wake" : ""} · snooze ${a.snooze} min</span></div><div class="sw-t ${a.on ? "on" : ""}" data-tg></div></div>`;
  }).join("");
  if (!list.length) h = `<div class="card empty">No alarms yet. Tap + to add one.</div>`;
  if ($("#alarmList").dataset.h !== h) {
    $("#alarmList").innerHTML = h; $("#alarmList").dataset.h = h;
    $$("#alarmList .alarm").forEach(el => {
      const a = S.alarms.find(x => x.id == el.dataset.id);
      SC.visual(el.querySelector(".vis"), a, { fps: 20, dpr: 1.5 });
      el.querySelector("[data-tg]").onclick = e => {
        e.stopPropagation(); a.on = !a.on; save(); recalcAlarms(); tick(a.on ? 1.2 : .8);
        if (a.on) toast("Rings in " + dur(NEXT[a.id] - now())); renderAlarms(); renderNow();
      };
      el.onclick = () => editAlarm(a);
    });
  }
  // bedtime from next real alarm
  if (nx) {
    const opts = [6, 5, 4].map(c => ({ c, t: nx.at - c * 90 * 60000 - 15 * 60000 })).filter(o => o.t > n - 60000);
    $("#sleepCard").style.display = "";
    $("#cycles").innerHTML = opts.length ? opts.map(o => `<div class="cyc ${o.c === 5 ? "best" : ""}"><b>${hm(new Date(o.t))}</b><span>${o.c} cycles · ${(o.c * 1.5).toString().replace(".5", "½")} h</span></div>`).join("")
      : `<div class="empty" style="padding:4px 0">Under 4 sleep cycles left before ${hm(new Date(nx.at))}. A 20-minute nap beats nothing.</div>`;
  } else $("#sleepCard").style.display = "none";
}
const SC = window.HoraScenes;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
$("#addAlarm").onclick = () => editAlarm(null);

function editAlarm(src) {
  const isNew = !src, d = new Date(now() + 3600000);
  const a = src ? JSON.parse(JSON.stringify(src)) : { id: Date.now(), h: d.getHours(), m: 0, label: "", days: [0,0,0,0,0,0,0], on: true, sound: "glass", gentle: true, snooze: 9, scene: "sunrise" };
  if (!a.scene) a.scene = "sunrise";
  const tiles = Object.entries(SC.SCENES).map(([k, s]) => `<div class="tile ${a.scene === k ? "on" : ""}" data-k="${k}"><div class="vis" style="position:absolute;inset:0"></div><span>${s.name}</span></div>`).join("") +
    `<label class="tile add ${a.scene === "custom" ? "on" : ""}" data-k="custom"><div class="vis" style="position:absolute;inset:0"></div><div class="plus">＋</div><span>Your photo or video</span><input type="file" accept="image/*,video/*" id="eFile"></label>`;
  const col = (n, id) => `<div class="col" id="${id}">${Array.from({ length: n }, (_, i) => `<div class="it">${pad(i)}</div>`).join("")}</div>`;
  openSheet(`
    <h2>${isNew ? "New alarm" : "Edit alarm"}</h2>
    <div class="wheel">${col(24, "wh")}<div class="colon">:</div>${col(60, "wm")}</div>
    <div class="inline" id="eIn">—</div>
    <div class="lab">Label</div><input class="field" id="eLabel" maxlength="30" placeholder="Alarm" value="${esc(a.label)}">
    <div class="lab">Repeat</div>
    <div class="days" id="eDays">${DAYN.map((x, i) => `<div class="d ${a.days[i] ? "on" : ""}" data-i="${i}">${x[0]}</div>`).join("")}</div>
    <div class="quick"><a data-q="wd">Weekdays</a><a data-q="we">Weekends</a><a data-q="all">Every day</a><a data-q="none">Once</a></div>
    <div class="lab">Wake-up scene</div>
    <div class="tiles" id="eTiles">${tiles}</div>
    <div class="lab">Sound</div>
    ${soundGrid(ALARM_SOUNDS, a.sound, a.fileName, "eSound")}
    <div class="lab">Snooze</div>
    <div class="chips" id="eSnz" style="margin-bottom:0">${[5, 9, 15].map(m => `<div class="ch" data-m="${m}"><b>${m}</b><span>min</span></div>`).join("")}<div class="ch" data-m="c"><b>Custom</b><span id="eSnzC"></span></div></div>
    <div class="snzc" id="eSnzBox"><button class="stp" data-d="-1" aria-label="Shorter">−</button><div class="snzv"><b id="eSnzV">${a.snooze}</b><span>minutes</span></div><button class="stp" data-d="1" aria-label="Longer">+</button>
      <input type="range" class="rng" id="eSnzR" min="1" max="60" step="1" value="${a.snooze}"></div>
    <div class="lab">If you don't answer</div>
    <div class="ifno">
      <div class="ifrow"><span>Ring for</span><div class="chips" id="eFor" style="margin:0;padding:0">${[1, 3, 5, 10, 15, 30].map(m => `<div class="ch" data-m="${m}"><b>${m}</b><span>min</span></div>`).join("")}</div></div>
      <div class="ifrow"><span>Then</span><div class="seg" id="eAfter"><div data-v="snooze">Snooze</div><div data-v="stop">Stop</div></div></div>
      <small id="eIfTxt"></small>
    </div>
    <div class="tog" style="margin-top:10px"><div>Gentle wake<small>Starts quiet and gets louder over 30 seconds</small></div><div class="sw-t ${a.gentle ? "on" : ""}" id="eGentle"></div></div>
    <div class="acts">${isNew ? "" : `<button class="btn ghost" id="eDel">Delete</button>`}<button class="btn ghost" id="eTest">Preview</button><button class="btn wide" id="eSave">Save</button></div>
  `, () => {
    const wh = $("#wh"), wm = $("#wm");
    const setSel = (colEl, v) => colEl.querySelectorAll(".it").forEach((x, i) => x.classList.toggle("sel", i === v));
    wh.scrollTop = a.h * 40; wm.scrollTop = a.m * 40; setSel(wh, a.h); setSel(wm, a.m);
    const inl = () => { const t = nextAt(a, now()); $("#eIn").innerHTML = t ? `Rings <b>${new Date(t).toLocaleDateString("en-GB", { weekday: "long" })}</b> at ${hmA(new Date(t))}, in <b>${dur(t - now())}</b>` : ""; };
    const bind = (el, key, max) => el.addEventListener("scroll", () => {
      const v = clamp(Math.round(el.scrollTop / 40), 0, max);
      if (v !== a[key]) { a[key] = v; setSel(el, v); tick(1.3); inl(); }
    }, { passive: true });
    bind(wh, "h", 23); bind(wm, "m", 59);
    $$("#eDays .d").forEach(x => x.onclick = () => { a.days[x.dataset.i] = a.days[x.dataset.i] ? 0 : 1; x.classList.toggle("on"); tick(); inl(); });
    $$(".quick a").forEach(x => x.onclick = () => {
      const q = x.dataset.q; a.days = q === "wd" ? [1,1,1,1,1,0,0] : q === "we" ? [0,0,0,0,0,1,1] : q === "all" ? [1,1,1,1,1,1,1] : [0,0,0,0,0,0,0];
      $$("#eDays .d").forEach((d, i) => d.classList.toggle("on", !!a.days[i])); tick(); inl();
    });
    const paintTiles = () => $$("#eTiles .tile").forEach(t => {
      const k = t.dataset.k; t.classList.toggle("on", a.scene === k);
      if (k !== "custom") SC.visual(t.querySelector(".vis"), { scene: k }, { fps: 20, dpr: 1.5 });
      else if (SC.media.peek(a.id) || (src && src.scene === "custom")) { SC.visual(t.querySelector(".vis"), { scene: "custom", id: a.id }, { fps: 20 }); t.querySelector(".plus").style.display = "none"; }
    });
    paintTiles();
    $$("#eTiles .tile:not(.add)").forEach(t => t.onclick = () => { a.scene = t.dataset.k; tick(1.2); paintTiles(); });
    $("#eTiles .tile.add").onclick = e => { if (SC.media.peek(a.id) && a.scene !== "custom" && e.target.tagName !== "INPUT") { e.preventDefault(); a.scene = "custom"; tick(1.2); paintTiles(); } };
    $("#eFile").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 80 * 1024 * 1024) { toast("That file is over 80 MB, try a shorter clip"); return; }
      const kept = await SC.media.put(a.id, f);
      a.scene = "custom"; a.mv = Date.now() % 100000;
      const box = $("#eTiles .tile.add .vis"); box.dataset.v = ""; paintTiles(); tick(1.2);
      toast(kept ? (f.type.startsWith("video") ? "Video set for this alarm" : "Photo set for this alarm") : "Set for now, but this browser won't keep it after closing");
    };
    bindSoundGrid("eSound", "snd" + a.id, () => a, v => Object.assign(a, v));
    let custom = ![5, 9, 15].includes(a.snooze);
    const paintSnz = () => {
      $$("#eSnz .ch").forEach(y => y.classList.toggle("on", y.dataset.m === "c" ? custom : !custom && +y.dataset.m === a.snooze));
      $("#eSnzC").textContent = custom ? a.snooze + " min" : "";
      $("#eSnzBox").classList.toggle("show", custom);
      $("#eSnzV").textContent = a.snooze; $("#eSnzR").value = a.snooze;
      $("#eSnzR").style.setProperty("--p", ((a.snooze - 1) / 59 * 100) + "%");
    };
    $$("#eSnz .ch").forEach(x => x.onclick = () => {
      if (x.dataset.m === "c") { custom = true; if ([5, 9, 15].includes(a.snooze)) a.snooze = 12; }
      else { custom = false; a.snooze = +x.dataset.m; }
      tick(); paintSnz();
    });
    const nudge = d => { const v = clamp(a.snooze + d, 1, 60); if (v !== a.snooze) { a.snooze = v; tick(1.3); paintSnz(); } };
    $$("#eSnzBox .stp").forEach(b => {
      let rep = null;
      b.onpointerdown = () => { nudge(+b.dataset.d); rep = setTimeout(function r() { nudge(+b.dataset.d); rep = setTimeout(r, 70); }, 380); };
      b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(rep);
    });
    $("#eSnzR").oninput = e => { a.snooze = +e.target.value; tick(1.3); paintSnz(); };
    paintSnz();
    a.ringFor = a.ringFor || 10; a.after = a.after || "snooze";
    const paintIf = () => {
      $$("#eFor .ch").forEach(y => y.classList.toggle("on", +y.dataset.m === a.ringFor));
      $$("#eAfter div").forEach(y => y.classList.toggle("on", y.dataset.v === a.after));
      $("#eIfTxt").textContent = a.after === "snooze"
        ? `Rings for ${a.ringFor} min, then snoozes for ${a.snooze} min. After 3 unanswered snoozes it stops.`
        : `Rings for ${a.ringFor} min, then stops.`;
    };
    $$("#eFor .ch").forEach(x => x.onclick = () => { a.ringFor = +x.dataset.m; tick(); paintIf(); });
    $$("#eAfter div").forEach(x => x.onclick = () => { a.after = x.dataset.v; tick(); paintIf(); });
    paintIf();
    $("#eSnz").addEventListener("click", () => setTimeout(paintIf));
    $("#eSnzBox").addEventListener("pointerup", () => setTimeout(paintIf)); $("#eSnzR").addEventListener("input", paintIf);
    onSheetClose = stopFile;
    $("#eGentle").onclick = e => { a.gentle = !a.gentle; e.currentTarget.classList.toggle("on"); tick(); };
    $("#eTest").onclick = () => { a.label = $("#eLabel").value.trim(); closeSheet(); ring({ kind: "alarm", title: a.label || "Alarm", sub: "This is a preview", sound: a.sound, key: "snd" + a.id, gentle: a.gentle, a, preview: true }); };
    if ($("#eDel")) $("#eDel").onclick = () => { S.alarms = S.alarms.filter(x => x.id !== a.id); SC.media.del(a.id); SC.media.del("snd" + a.id); save(); recalcAlarms(); closeSheet(); toast("Alarm deleted"); renderAll(); };
    $("#eSave").onclick = () => {
      a.label = $("#eLabel").value.trim(); a.on = true;
      const i = S.alarms.findIndex(x => x.id === a.id); if (i >= 0) S.alarms[i] = a; else S.alarms.push(a);
      save(); recalcAlarms(); closeSheet(); tick(1.2); toast("Rings in " + dur(NEXT[a.id] - now())); renderAll();
    };
    inl();
  });
}

/* ---------- ringing ---------- */
let RING = null, ringIv = null, ringStart = 0, QUEUE = [], ringAuto = null;
function soundLoop(o) {
  const own = o.sound === "custom", key = own ? "glass" : o.sound;
  const vol = () => o.gentle ? Math.min(1, .12 + (Date.now() - ringStart) / 30000) : .9;
  // Schedule each phrase on the audio clock so the loop is seamless instead of drifting with timers.
  const synth = () => {
    const a = ac(); if (!a) return;
    let at = a.currentTime + .05, lastV = 0;
    const per = loopPeriod(key);
    const pump = () => {
      while (at < a.currentTime + .6) { playSound(key, vol(), at); at += per; }
      if (navigator.vibrate && Date.now() - lastV > 1600) { navigator.vibrate([200, 120, 200]); lastV = Date.now(); }
    };
    pump(); ringIv = setInterval(pump, 150);
  };
  if (own) {
    playFile(o.key, vol(), true).then(ok => {
      if (RING !== o) { stopFile(); return; }
      if (!ok) { synth(); return; }
      ringIv = setInterval(() => { if (AUD) AUD.volume = clamp(vol(), 0, 1); if (navigator.vibrate) navigator.vibrate([200, 120, 200]); }, 1600);
    });
  } else synth();
  const lim = o.kind === "timer" ? 60000 * (S.timerRingFor || 2) : o.preview ? 15000 : (o.a.ringFor || 10) * 60000;
  o.endsAt = Date.now() + lim;
  ringAuto = setTimeout(() => { if (RING === o) autoEnd(o); }, lim);
  if (document.hidden && S.notify && "Notification" in window && Notification.permission === "granted") { try { new Notification("Hora · " + o.title, { body: o.sub || "", icon: "icons/icon.svg" }); } catch (e) {} }
}
function autoEnd(o) {
  if (o.kind === "alarm" && !o.preview && (o.a.after || "snooze") === "snooze" && (o.auto || 0) < 3) {
    SNOOZES.push({ at: now() + o.a.snooze * 60000, a: o.a, auto: (o.auto || 0) + 1 });
    stopRing(); toast("No answer, snoozed for " + o.a.snooze + " min");
  } else stopRing();
}
function ring(o) {
  if (RING) { QUEUE.push(o); return; }
  RING = o; ringStart = Date.now();
  if (o.kind === "timer") { soundLoop(o); ISL.open = true; renderIsland(); return; }
  const d = new Date(now());
  $("#rK").textContent = o.preview ? "Alarm preview" : o.auto ? "Alarm · snoozed " + o.auto + "×" : "Alarm";
  ringTime();
  $("#rL").textContent = o.title; $("#rS").textContent = o.sub || "";
  $("#rB").innerHTML = `<div class="slide" id="rSlide"><div class="chev"><i></i><i></i><i></i></div><span>Slide up to stop</span></div>
    <button class="btn snz" id="rA"><svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>Snooze · ${o.a.snooze} min</button>
    <div class="rauto" id="rAuto"></div>`;
  const R0 = $("#ring"); R0.classList.add("show", "scene"); R0.style.setProperty("--up", 0);
  SC.visual($("#rVis"), o.a, { fps: 50, dpr: 2 });
  soundLoop(o);
  $("#rA").onclick = e => {
    e.stopPropagation();
    if (!o.preview) { SNOOZES.push({ at: now() + o.a.snooze * 60000, a: o.a }); toast("Snoozed until " + hmA(new Date(now() + o.a.snooze * 60000))); }
    tick(.9); stopRing();
  };
  // slide up anywhere above the snooze button
  let y0 = null, up = 0;
  const H = () => R0.clientHeight || 700;
  R0.onpointerdown = e => { if (e.target.closest("#rA")) return; y0 = e.clientY; up = 0; R0.classList.add("drag"); try { R0.setPointerCapture(e.pointerId); } catch (_) {} };
  R0.onpointermove = e => { if (y0 === null) return; up = clamp((y0 - e.clientY) / H(), 0, 1); R0.style.setProperty("--up", up.toFixed(3)); };
  R0.onpointerup = R0.onpointercancel = () => {
    if (y0 === null) return; y0 = null; R0.classList.remove("drag");
    if (up > .28) { R0.style.setProperty("--up", 1); tick(1.4); setTimeout(() => { stopRing(); if (!o.preview) toast("Good morning"); }, 260); }
    else R0.style.setProperty("--up", 0);
  };
  paintAuto();
}
function paintAuto() {
  const o = RING, el = $("#rAuto"); if (!o || o.kind !== "alarm" || !el) return;
  const left = Math.max(0, o.endsAt - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
  const then = o.preview ? "stops" : (o.a.after || "snooze") === "snooze" && (o.auto || 0) < 3 ? "snoozes" : "stops";
  el.textContent = `Rings for ${m}:${pad(s)} more, then ${then} by itself`;
}
function stopRing() {
  clearInterval(ringIv); clearTimeout(ringAuto); stopFile(); RING = null;
  const R0 = $("#ring"); R0.classList.remove("show", "drag"); R0.style.setProperty("--up", 0); R0.onpointerdown = R0.onpointermove = R0.onpointerup = R0.onpointercancel = null;
  ISL.open = false;
  if (navigator.vibrate) navigator.vibrate(0);
  renderAll(); renderIsland();
  if (QUEUE.length) setTimeout(() => ring(QUEUE.shift()), 300);
}

/* ---------- live activity island ---------- */
const ISL = { open: false, until: 0, sig: "" }, CI = 2 * Math.PI * 9;
function islandData() {
  if (RING && RING.kind === "timer") return { k: "alert", label: RING.title, sub: RING.sub, t: "0:00", p: 0 };
  const list = S.timers.filter(t => !t.done), run = list.filter(t => t.run).sort((a, b) => a.endAt - b.endAt);
  const t = run[0] || list[0];
  if (t) {
    const r = tRem(t);
    return { k: "timer", id: t.id, run: t.run, label: t.label + (list.length > 1 ? ` +${list.length - 1}` : ""), full: t.label, sub: t.run ? "Ends " + hmA(new Date(t.endAt)) + (list.length > 1 ? ` · ${list.length} timers` : "") : "Paused", t: clk(r), p: t.total ? r / t.total : 0 };
  }
  if (W.run) { const e = swEl(); return { k: "sw", label: "Stopwatch", full: "Stopwatch", sub: "Lap " + (W.laps.length + 1) + " · " + swStr(e - lapSum()), t: swFmt(e).main, p: (e / 1000 % 60) / 60 }; }
  return null;
}
function renderIsland() {
  const el = $("#island"), d = islandData();
  if (!d) { el.className = "island"; ISL.open = false; document.title = "Hora"; return; }
  if (ISL.open && d.k !== "alert" && Date.now() > ISL.until) ISL.open = false;
  el.className = "island act" + (ISL.open ? " open" : "") + (d.k === "alert" ? " alert" : "") + (d.k === "sw" ? " sw" : "");
  const arc = `${(CI * clamp(d.p, 0, 1)).toFixed(2)} ${CI}`;
  $("#iArc").setAttribute("stroke-dasharray", arc); $("#xArc").setAttribute("stroke-dasharray", arc);
  $("#iL").textContent = d.k === "alert" ? "Done" : d.label; $("#iT").textContent = d.t;
  $("#xL").textContent = d.k === "alert" ? d.label : d.full; $("#xS").textContent = d.sub; $("#xT").textContent = d.t;
  $("#xP").style.width = (d.k === "sw" ? d.p : 1 - d.p) * 100 + "%";
  document.title = d.k === "alert" ? "Done · " + d.label : d.t + " · " + d.full;
  const play = `<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>`, pause = `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
  const sig = d.k + (d.run ? 1 : 0) + W.run;
  if (sig !== ISL.sig) {
    ISL.sig = sig;
    $("#xB").innerHTML = d.k === "alert" ? `<button class="xb" data-a="plus">+1 min</button><button class="xb or" data-a="stop">Stop</button>`
      : d.k === "timer" ? `<button class="xb x" data-a="cancel" aria-label="Cancel">✕</button><button class="xb" data-a="plus">+1 min</button><button class="xb or" data-a="pause">${d.run ? pause + "Pause" : play + "Resume"}</button>`
      : `<button class="xb" data-a="lap">Lap</button><button class="xb or" data-a="swstop">${pause}Stop</button>`;
  }
  ISL.d = d;
}
$("#island").onclick = e => {
  const d = ISL.d, b = e.target.closest("[data-a]");
  if (!d || !$("#island").classList.contains("act")) return;
  if (b) {
    e.stopPropagation(); ISL.until = Date.now() + 6000;
    const a = b.dataset.a;
    if (d.k === "alert") {
      const t = S.timers.find(x => x.id === RING.tid);
      if (a === "plus" && t) { t.done = false; t.run = true; t.total = 60000; t.endAt = now() + 60000; S.focus = t.id; }
      if (a === "stop") { S.timers = S.timers.filter(x => x.id !== RING.tid); if (S.focus === RING.tid) S.focus = null; }
      save(); tick(1.2); stopRing(); return;
    }
    const t = S.timers.find(x => x.id === d.id);
    if (a === "pause" && t) { if (t.run) { t.left = tRem(t); t.run = false; } else { t.endAt = now() + t.left; t.run = true; } }
    if (a === "plus" && t) { if (t.run) t.endAt += 60000; else t.left += 60000; t.total += 60000; }
    if (a === "cancel" && t) { S.timers = S.timers.filter(x => x !== t); if (S.focus === t.id) S.focus = null; ISL.open = false; }
    if (a === "lap") swLap();
    if (a === "swstop") { swToggle(); ISL.open = false; }
    save(); tick(); renderAll(); renderIsland(); return;
  }
  if (!ISL.open) { ISL.open = true; ISL.until = Date.now() + 6000; tick(.9); }
  else if (d.k !== "alert") {
    ISL.open = false;
    if (e.target.closest(".xtop")) { if (d.id) S.focus = d.id; go(d.k === "sw" ? "vWatch" : "vTimer"); }
  }
  renderIsland();
};

/* ---------- timers ---------- */
const C1 = 2 * Math.PI * 124;
const PRESETS = [["Tea", 3], ["Eggs", 7], ["Pasta", 10], ["Nap", 20], ["Focus", 25], ["Bread", 40], ["Laundry", 45]];
(function buildDial() {
  let h = "";
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * RAD, big = i % 5 === 0, r1 = big ? 100 : 104, r2 = 109;
    h += `<line class="dtick" x1="${150 + Math.sin(a) * r1}" y1="${150 - Math.cos(a) * r1}" x2="${150 + Math.sin(a) * r2}" y2="${150 - Math.cos(a) * r2}" stroke-width="${big ? 1.6 : 1}" opacity="${big ? .8 : .35}"/>`;
  }
  [0, 15, 30, 45].forEach(m => { const a = m * 6 * RAD; h += `<text x="${150 + Math.sin(a) * 86}" y="${150 - Math.cos(a) * 86}" fill="var(--fg2)" font-size="11" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,sans-serif">${m}</text>`; });
  $("#dTicks").innerHTML = h;
  $("#presets").innerHTML = PRESETS.map(([l, m]) => `<div class="ch" data-l="${l}" data-m="${m}"><b>${l}</b><span>${m} m</span></div>`).join("") +
    `<div class="ch" data-add="30"><b>+30 s</b></div><div class="ch" data-add="60"><b>+1 m</b></div><div class="ch" data-add="300"><b>+5 m</b></div>`;
  $$("#presets .ch").forEach(c => c.onclick = () => {
    if (c.dataset.add) { S.setMs = Math.min(S.setMs + c.dataset.add * 1000, 5 * 3600000); }
    else { S.setMs = c.dataset.m * 60000; S.setLabel = c.dataset.l; S.focus = null; startTimer(); return; }
    S.focus = null; save(); tick(); renderTimer();
  });
})();
const tRem = t => t.run ? Math.max(0, t.endAt - now()) : t.left;
const focused = () => S.timers.find(t => t.id === S.focus && !t.done);
function startTimer() {
  if (S.setMs < 1000) { toast("Drag the ring to set a time"); return; }
  const t = { id: Date.now(), label: S.setLabel || "Timer", total: S.setMs, left: S.setMs, endAt: now() + S.setMs, run: true, done: false };
  S.timers.push(t); S.focus = t.id; S.setLabel = "Timer"; save(); tick(1.3); ISL.open = true; ISL.until = Date.now() + 2800;
  toast(t.label + " · ends " + hmA(new Date(t.endAt))); renderAll();
}
function renderTimer() {
  const f = focused(), n = now();
  $("#newTimer").style.display = f ? "grid" : "none";
  let p, big, lbl, k = $("#dKnob");
  if (f) {
    const r = tRem(f); p = f.total ? r / f.total : 0; big = clk(r);
    lbl = `<b>${esc(f.label)}</b> · ${f.run ? "ends " + hmA(new Date(f.endAt)) : "paused"}`;
    k.style.display = "none";
    $("#timerSub").textContent = f.run ? "Running · set for " + dur(f.total) : "Paused";
  } else {
    const mins = S.setMs / 60000; p = (mins % 60) / 60 || (mins >= 60 ? 1 : 0); big = clk(S.setMs);
    lbl = S.setMs ? `<b>${esc(S.setLabel)}</b> · would end ${hmA(new Date(n + S.setMs))}` : "Drag the ring";
    k.style.display = "";
    const a = (mins % 60) * 6 * RAD; k.setAttribute("cx", 150 + Math.sin(a) * 124); k.setAttribute("cy", 150 - Math.cos(a) * 124);
    $("#timerSub").textContent = mins >= 60 ? "Each full turn of the ring is an hour" : "Drag the ring, or pick a preset";
  }
  const arc = $("#dArc"); arc.setAttribute("stroke-dasharray", `${(C1 * clamp(p, 0, 1)).toFixed(1)} ${C1}`);
  arc.classList.toggle("lap2", !f && S.setMs >= 3600000);
  $("#dBig").textContent = big; if ($("#dLbl").innerHTML !== lbl) $("#dLbl").innerHTML = lbl;
  const ctl = f
    ? `<button class="btn ghost" id="tC">Cancel</button><button class="btn ghost" id="tP1">+1 min</button><button class="btn" id="tP" style="min-width:104px">${f.run ? "Pause" : "Resume"}</button>`
    : `<button class="btn ghost" id="tClr">Clear</button><button class="btn wide" id="tGo" style="max-width:200px">Start</button>`;
  if ($("#tCtrls").dataset.h !== ctl) {
    $("#tCtrls").innerHTML = ctl; $("#tCtrls").dataset.h = ctl;
    if (f) {
      $("#tC").onclick = () => { const ff = focused(); S.timers = S.timers.filter(t => t !== ff); S.focus = (S.timers.find(t => !t.done) || {}).id || null; save(); tick(.8); renderAll(); };
      $("#tP1").onclick = () => { const ff = focused(); if (ff.run) ff.endAt += 60000; else ff.left += 60000; ff.total += 60000; save(); tick(); renderAll(); };
      $("#tP").onclick = toggleFocused;
    } else {
      $("#tGo").onclick = startTimer;
      $("#tClr").onclick = () => { S.setMs = 0; S.setLabel = "Timer"; save(); tick(.8); renderTimer(); };
    }
  }
  // list
  const list = S.timers.filter(t => !t.done);
  $("#tListCard").style.display = list.length > (f ? 1 : 0) ? "" : "none";
  const lh = list.map(t => {
    const r = tRem(t), pp = t.total ? r / t.total : 0, c = 2 * Math.PI * 13;
    return `<div class="row trow ${t.id === S.focus ? "foc" : ""}" data-id="${t.id}"><svg class="mini" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" stroke="var(--glass-b)"/><circle cx="17" cy="17" r="13" stroke="var(--fg)" stroke-linecap="round" stroke-dasharray="${(c * pp).toFixed(1)} ${c}" transform="rotate(-90 17 17)"/></svg>
      <div class="tx"><b>${esc(t.label)}</b><span>${t.run ? "Ends " + hmA(new Date(t.endAt)) : "Paused"}</span></div><div class="rt" style="font-size:20px">${clk(r)}</div></div>`;
  }).join("");
  if ($("#tList").dataset.h !== lh) {
    $("#tList").innerHTML = lh; $("#tList").dataset.h = lh;
    $$("#tList .trow").forEach(r => r.onclick = () => { S.focus = +r.dataset.id; save(); tick(); renderTimer(); });
  }
}
function toggleFocused() {
  const f = focused(); if (!f) return;
  if (f.run) { f.left = tRem(f); f.run = false; } else { f.endAt = now() + f.left; f.run = true; }
  save(); tick(); renderAll();
}
$("#newTimer").onclick = () => { S.focus = null; S.setMs = S.setMs || 300000; save(); tick(); renderTimer(); };
const paintTSnd = () => $("#tSndN").textContent = soundName(S.timerSound, S.timerFile);
$("#tSnd").onclick = () => {
  openSheet(`<h2>Finish sound</h2><div class="kind">Plays when any timer ends. Tap to hear it.</div>${soundGrid(TIMER_SOUNDS, S.timerSound, S.timerFile, "tSndG")}<div class="acts"><button class="btn wide" id="tSndOk">Done</button></div>`, () => {
    bindSoundGrid("tSndG", "sndtimer", () => ({ sound: S.timerSound, fileName: S.timerFile }), v => { if (v.sound) S.timerSound = v.sound; if (v.fileName) S.timerFile = v.fileName; save(); paintTSnd(); });
    $("#tSndOk").onclick = closeSheet;
  });
  onSheetClose = stopFile;
};
paintTSnd();
(function dialInput() {
  const svg = $("#dial"); let drag = false, lastA = 0, acc = 0, lastMin = 0;
  const ang = e => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) / RAD; };
  svg.addEventListener("pointerdown", e => {
    if (focused()) return;
    drag = true; svg.setPointerCapture(e.pointerId);
    const a = (ang(e) + 360) % 360, base = Math.floor(S.setMs / 3600000) * 360;
    acc = base + a; lastA = a; lastMin = -1; move(e, true);
  });
  const move = (e, first) => {
    if (!drag) return;
    const a = (ang(e) + 360) % 360; let d = a - lastA;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    if (!first) acc += d; lastA = a;
    acc = clamp(acc, 0, 5 * 360);
    const mins = Math.round(acc / 6);
    if (mins !== lastMin) { lastMin = mins; S.setMs = mins * 60000; tick(mins % 5 === 0 ? 1.25 : 1); renderTimer(); }
  };
  svg.addEventListener("pointermove", e => move(e));
  const end = () => { if (drag) { drag = false; save(); } };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
})();

/* ---------- stopwatch ---------- */
const W = S.watch, C2 = 2 * Math.PI * 92;
const swEl = () => W.acc + (W.run ? now() - W.start : 0);
const lapSum = () => W.laps.reduce((a, b) => a + b, 0);
function swToggle() {
  if (W.run) { W.acc = swEl(); W.run = false; tick(.9); }
  else { W.start = now(); W.run = true; tick(1.2); }
  save(); renderWatchStatic(); renderNow();
}
function swLap() {
  if (W.run) { W.laps.push(swEl() - lapSum()); tick(1.4); save(); renderWatchStatic(); }
  else if (swEl() > 0) { W.acc = 0; W.laps = []; tick(.7); save(); renderWatchStatic(); renderWatch(); }
}
$("#swS").onclick = swToggle; $("#swL").onclick = swLap;
$("#copyLaps").onclick = async () => {
  let run = 0; const txt = W.laps.map((v, i) => { run += v; return `Lap ${i + 1}\t${swStr(v)}\t${swStr(run)}`; }).join("\n");
  try { await navigator.clipboard.writeText("Lap\tTime\tTotal\n" + txt); toast("Laps copied"); } catch (e) { toast("Couldn't copy here"); }
};
(function buildSw() {
  let h = "";
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * RAD, big = i % 5 === 0, r1 = big ? 78 : 82, r2 = 86;
    h += `<line class="dtick" x1="${110 + Math.sin(a) * r1}" y1="${110 - Math.cos(a) * r1}" x2="${110 + Math.sin(a) * r2}" y2="${110 - Math.cos(a) * r2}" stroke-width="${big ? 1.5 : 1}" opacity="${big ? .8 : .3}"/>`;
  }
  $("#swTicks").innerHTML = h;
})();
function renderWatchStatic() {
  const s = $("#swS"), l = $("#swL"), e = swEl();
  s.textContent = W.run ? "Stop" : (e ? "Resume" : "Start"); s.className = "rbtn " + (W.run ? "stop" : "go");
  l.textContent = W.run || !e ? "Lap" : "Reset"; l.style.opacity = !W.run && !e ? .45 : 1;
  const laps = W.laps; $("#lapCard").style.display = laps.length ? "" : "none";
  if (laps.length) {
    const mn = Math.min(...laps), mx = Math.max(...laps), avg = lapSum() / laps.length;
    let run = 0; const rows = laps.map((v, i) => { run += v; return { i, v, run }; }).reverse();
    $("#laps").innerHTML = rows.map(r => {
      const tag = laps.length >= 3 && r.v === mn ? `<span class="pill">Fastest</span>` : laps.length >= 3 && r.v === mx ? `<span class="pill amber">Slowest</span>` : "";
      const dv = (r.v - avg) / 1000, ds = laps.length >= 2 ? `${dv >= 0 ? "+" : "−"}${Math.abs(dv).toFixed(2)} vs avg` : "";
      return `<div class="lap"><div class="n">Lap ${r.i + 1}</div><div class="d">${tag} ${ds}<br>total ${swStr(r.run)}</div><div class="v">${swStr(r.v)}</div></div>`;
    }).join("");
  }
  $("#watchSub").textContent = W.run ? "Running · L for a lap, Space to stop" : e ? "Paused" : "Space to start, L for a lap";
}
function renderWatch() {
  const e = swEl(), f = swFmt(e), cur = e - lapSum();
  $("#swBig").innerHTML = f.main + `<small>${f.cs}</small>`;
  const sec = (e / 1000) % 60, a = sec * 6 * RAD;
  $("#swArc").setAttribute("stroke-dasharray", `${(C2 * sec / 60).toFixed(1)} ${C2}`);
  $("#swDot").setAttribute("cx", 110 + Math.sin(a) * 92); $("#swDot").setAttribute("cy", 110 - Math.cos(a) * 92);
  $("#swLapNow").textContent = "Lap " + (W.laps.length + 1);
  $("#swLapT").textContent = swStr(cur);
  const ld = $("#swLapDot");
  if (W.laps.length) {
    const avg = lapSum() / W.laps.length, la = ((avg / 1000) % 60) * 6 * RAD;
    ld.style.display = ""; ld.setAttribute("cx", 110 + Math.sin(la) * 92); ld.setAttribute("cy", 110 - Math.cos(la) * 92);
    const dv = (cur - avg) / 1000;
    $("#swPace").innerHTML = `<span class="pill ${dv <= 0 ? "" : "amber"}">${dv <= 0 ? "Ahead" : "Behind"} ${Math.abs(dv).toFixed(1)} s</span>`;
  } else { ld.style.display = "none"; $("#swPace").innerHTML = ""; }
}

/* ---------- now bar ---------- */
const IC = {
  timer: `<svg viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/></svg>`,
  watch: `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7.5"/><path d="M12 14V10M10 2.5h4"/></svg>`,
  alarm: `<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1.5M4.5 5.5l3-2.5M19.5 5.5l-3-2.5"/></svg>`
};
let NOWGO = null;
function renderNow() {
  const n = now(), bar = $("#now");
  const running = S.timers.filter(t => t.run && !t.done).sort((a, b) => a.endAt - b.endAt);
  const t = running[0], nx = nextAlarm();
  let o = null;
  if (nx && nx.at - n < 12 * 3600000 && VIEW !== "vAlarm" && VIEW !== "vProfile") o = { ic: "alarm", t: (nx.snoozed ? "Snoozed · " : "") + (nx.a.label || "Alarm"), s: "Rings at " + hmA(new Date(nx.at)), r: "in " + dur(nx.at - n), v: "vAlarm" };
  bar.classList.toggle("show", !!o);
  $$(".tab").forEach(x => x.classList.toggle("run", (x.dataset.v === "vTimer" && running.length > 0) || (x.dataset.v === "vWatch" && W.run)));
  if (!o) return;
  if ($("#nDot").dataset.k !== o.ic) { $("#nDot").innerHTML = IC[o.ic]; $("#nDot").dataset.k = o.ic; }
  $("#nT").textContent = o.t; $("#nS").textContent = o.s; $("#nR").textContent = o.r;
  $("#nP").style.width = o.p != null ? clamp(o.p, 0, 1) * 100 + "%" : "0";
  NOWGO = o;
}
$("#now").onclick = () => { if (!NOWGO) return; if (NOWGO.id) S.focus = NOWGO.id; go(NOWGO.v); };

/* ---------- profile ---------- */
function renderSkins() {
  $("#skins").innerHTML = Object.entries(SKINS).map(([k, s]) => {
    let bg;
    if (k === "live") { const [a, b] = skyFor(sunAlt(now(), HOME.lat, HOME.lon)); bg = `linear-gradient(135deg,${a},${b})`; }
    else bg = `linear-gradient(${s.top},${s.bot})`;
    return `<div class="skin ${S.skin === k ? "on" : ""}" data-k="${k}"><div class="sw" style="background:${bg}"></div>${s.name}</div>`;
  }).join("");
  $$("#skins .skin").forEach(el => el.onclick = () => { S.skin = el.dataset.k; save(); tick(); paintSky(); renderSkins(); drawRuler(); });
}
const TOGS = [
  ["h24", "24-hour clock", "Off shows AM and PM"],
  ["secs", "Show seconds", "On the digital clock"],
  ["correct", "Correct device drift", "Uses the accuracy check to fix the time on screen"],
  ["wake", "Keep screen awake", "So alarms and timers can ring while Hora is open"],
  ["notify", "Notify when in another tab", "Shows a notification when something rings"],
  ["ticks", "Tactile sounds", "Soft ticks on the dial, wheel and buttons"]
];
function renderFontPick() {
  const pv = "10:42".split("").map(glyphSvg).join("");
  const h = `<div class="fp ${S.font === "line" || !S.font ? "on" : ""}" data-f="line"><div class="pv">${pv}</div>Hora Line</div>
    <div class="fp ${S.font === "solid" ? "on" : ""}" data-f="solid"><div class="pv"><b>10:42</b></div>Rounded</div>
    <div class="fp yb ${S.font === "crust" ? "on" : ""}" data-f="crust" style="grid-column:1 / -1"><div class="pv"><b>10:42</b></div>Crust Cream <span id="ybState"></span></div>`;
  if ($("#fontPick").innerHTML !== h) {
    $("#fontPick").innerHTML = h;
    $$("#fontPick .fp").forEach(el => el.onclick = () => { S.font = el.dataset.f; S.fontChosen = true; save(); tick(1.2); renderFontPick(); renderFace(); });
  }
  const st = $("#ybState"); if (st) st.textContent = YB === "ok" ? "" : YB === "missing" ? "· file not found" : "· loading…";
}
/* Crust Cream is the user's own font file (fonts/CrustCream.otf), or the copy installed on this device. */
let YB = "wait";
if (document.fonts && document.fonts.load) {
  document.fonts.load('400 40px "Crust Cream"', "0123456789:").then(f => { YB = f.length ? "ok" : "missing"; }).catch(() => YB = "missing")
    .finally(() => { if (YB === "missing" && S.font === "crust") toast("Crust Cream font file not found, using Rounded"); renderFace(); if (VIEW === "vProfile") renderFontPick(); });
}

/* ---------- install & shortcuts ---------- */
let INSTALL = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL = e; if (VIEW === "vProfile") renderDefault(); });
addEventListener("appinstalled", () => { INSTALL = null; toast("Hora is on your home screen"); renderDefault(); });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function renderDefault() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), inst = standalone();
  const add = inst ? `<div class="instok">✓ Installed. Hora opens like an app.</div>`
    : INSTALL ? `<button class="btn wide" id="instBtn" style="width:100%;margin-bottom:12px">Add Hora to home screen</button>`
    : `<ol class="steps"><li>${ios ? "Tap <b>Share</b>, then <b>Add to Home Screen</b>." : "Open the browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to home screen</b>."}</li></ol>`;
  const h = add + `<ol class="steps" ${inst || INSTALL ? "" : 'start="2"'} style="${inst || INSTALL ? "" : "counter-reset:s 1"}">
      <li><b>Move it to your dock</b> where the stock Clock app was, so it's the one you tap.</li>
      <li><b>Long-press the icon</b> for shortcuts: New alarm, Timer and Stopwatch.</li>
      <li>Turn on <b>Keep screen awake</b> above, so alarms can ring overnight.</li>
    </ol>
    <div class="honest" style="margin:4px 0 0">Phones don't let a web app become the <b>default</b> clock. Android has no setting for a default clock app, and the system decides what rings when the phone is locked. To get that, Hora would need to be a real Android app.</div>`;
  if ($("#defBody").innerHTML !== h) {
    $("#defBody").innerHTML = h;
    if ($("#instBtn")) $("#instBtn").onclick = async () => { INSTALL.prompt(); const r = await INSTALL.userChoice.catch(() => ({})); if (r.outcome === "accepted") INSTALL = null; renderDefault(); };
  }
}
function openFromShortcut() {
  const q = new URLSearchParams(location.search).get("tab");
  const map = { alarm: "vAlarm", timer: "vTimer", stopwatch: "vWatch", clock: "vClock" };
  if (q === "newalarm") { go("vAlarm"); setTimeout(() => editAlarm(null), 300); }
  else if (map[q]) go(map[q]);
  if (q && history.replaceState) history.replaceState(null, "", location.pathname);
}

function renderToggles() {
  $("#toggles").innerHTML = TOGS.map(([k, t, s]) => `<div class="tog"><div>${t}<small>${s}</small></div><div class="sw-t ${S[k] ? "on" : ""}" data-k="${k}"></div></div>`).join("");
  $$("#toggles .sw-t").forEach(el => el.onclick = async () => {
    const k = el.dataset.k; S[k] = !S[k];
    if (k === "notify" && S.notify && "Notification" in window && Notification.permission !== "granted") {
      try { const p = await Notification.requestPermission(); if (p !== "granted") { S.notify = false; toast("Notifications are blocked in the browser"); } } catch (e) { S.notify = false; }
    }
    if (k === "wake") await wake();
    if (k === "correct") { recalcAlarms(); paintBadge(); }
    save(); tick(); renderToggles(); renderAll(); drawRuler();
  });
}
let WL = null;
async function wake() {
  try {
    if (S.wake && "wakeLock" in navigator && !document.hidden) { if (!WL) { WL = await navigator.wakeLock.request("screen"); WL.addEventListener("release", () => WL = null); } }
    else if (WL) { await WL.release(); WL = null; }
    if (S.wake && !("wakeLock" in navigator)) toast("This browser can't keep the screen awake");
  } catch (e) {}
}

/* ---------- loop ---------- */
function check() {
  const n = now();
  S.alarms.forEach(a => {
    if (a.on && NEXT[a.id] && n >= NEXT[a.id]) {
      const late = n - NEXT[a.id];
      if (!a.days.some(Boolean)) a.on = false;
      NEXT[a.id] = a.on ? nextAt(a, n + 1000) : null; save();
      if (late < 15 * 60000) ring({ kind: "alarm", title: a.label || "Alarm", sub: new Date(n).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), sound: a.sound, key: "snd" + a.id, gentle: a.gentle, a });
    }
  });
  SNOOZES = SNOOZES.filter(s => { if (n >= s.at) { ring({ kind: "alarm", title: s.a.label || "Alarm", sub: s.auto ? "Snoozed automatically" : "After snoozing", sound: s.a.sound, key: "snd" + s.a.id, gentle: false, a: s.a, auto: s.auto || 0 }); return false; } return true; });
  S.timers.forEach(t => {
    if (t.run && !t.done && n >= t.endAt) {
      t.done = true; t.run = false; t.left = 0; save();
      ring({ kind: "timer", title: t.label + " is done", sub: "Set for " + dur(t.total) + " · finished " + hmA(new Date(t.endAt)), sound: S.timerSound, key: "sndtimer", gentle: false, tid: t.id });
    }
  });
}
let lastMin = -1;
function renderAll() {
  renderFace(); renderNow();
  if (VIEW === "vClock") { renderWorld(); renderSun(); }
  if (VIEW === "vAlarm") renderAlarms();
  if (VIEW === "vTimer") renderTimer();
  if (VIEW === "vWatch") { renderWatchStatic(); renderWatch(); }
  if (VIEW === "vProfile") { renderSkins(); renderFontPick(); renderToggles(); renderDefault(); }
}
setInterval(() => {
  check();
  const m = Math.floor(now() / 60000);
  if (m !== lastMin) { lastMin = m; paintSky(); if (VIEW === "vClock") { renderSun(); drawRuler(); } if (VIEW === "vAlarm") renderAlarms(); }
  if (!S.analog) renderFace();
  renderNow(); renderIsland();
  if (VIEW === "vClock") renderWorld();
  if (VIEW === "vTimer") renderTimer();
  if (RING) { ringTime(); paintAuto(); }
  if (SYNC !== "idle" && Date.now() - SYNCED_AT > 30 * 60000) sync();
}, 250);
(function raf() {
  if (S.analog && VIEW === "vClock") renderFace();
  if (VIEW === "vWatch" && W.run) renderWatch();
  if (VIEW === "vTimer" && focused() && focused().run) {
    const f = focused(); $("#dArc").setAttribute("stroke-dasharray", `${(C1 * clamp(tRem(f) / f.total, 0, 1)).toFixed(1)} ${C1}`);
  }
  requestAnimationFrame(raf);
})();

/* ---------- keys & lifecycle ---------- */
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
  if (RING && (e.key === "Escape" || e.key === "Enter")) { stopRing(); return; }
  if ("12345".includes(e.key) && e.key.length === 1) { go(["vClock", "vAlarm", "vTimer", "vWatch", "vProfile"][+e.key - 1]); return; }
  if (e.key === "Escape") { closeSheet(); return; }
  if (VIEW === "vWatch") {
    if (e.code === "Space") { e.preventDefault(); swToggle(); }
    else if (e.key === "l" || e.key === "L") { if (W.run) swLap(); }
    else if ((e.key === "r" || e.key === "R") && !W.run) swLap();
  } else if (VIEW === "vTimer" && e.code === "Space") { e.preventDefault(); focused() ? toggleFocused() : startTimer(); }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { wake(); check(); renderAll(); if (Date.now() - SYNCED_AT > 5 * 60000) sync(); } });
addEventListener("resize", drawRuler);

S.timers = S.timers.filter(t => !t.done || t.run);
recalcAlarms(); paintSky(); renderAll(); drawRuler(); renderWatchStatic(); renderWatch(); wake(); openFromShortcut();
if (S.focus && !focused()) S.focus = null;
sync();
})();
