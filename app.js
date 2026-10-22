/* Hora: clock, alarms, sleep, timers, stopwatch. Plain JS, no dependencies. */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const pad = n => String(n).padStart(2, "0");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const HOME = { name: "Gliwice", region: "Poland", lat: 50.29, lon: 18.67, home: true };
const RAD = Math.PI / 180, TAU = Math.PI * 2;

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
  indigo: { name: "Indigo",  top: "#0b1433", bot: "#22336b", stars: .85 },
  dusk:   { name: "Dusk",    top: "#2a2453", bot: "#b8726a", stars: .3, glow: .5 },
  linen:  { name: "Linen",   top: "#f5efe3", bot: "#e6d9c3", cls: "light", stars: 0 },
  bed:    { name: "Bedside", top: "#0d0303", bot: "#1e0606", cls: "red", stars: 0 }
};
/* one signature colour; the deep variant is for the light background */
const ACCENTS = {
  rose:  { name: "Rose",  c: "#ff6f91", d: "#d93d66" },
  coral: { name: "Coral", c: "#ff8259", d: "#d4532b" },
  amber: { name: "Amber", c: "#ffb547", d: "#ad6f00" },
  mint:  { name: "Mint",  c: "#4fdcab", d: "#11896a" },
  sky:   { name: "Sky",   c: "#5cc8ff", d: "#1b7fbf" },
  lilac: { name: "Lilac", c: "#b892ff", d: "#7350d1" }
};
const PRESETS0 = [["Tea", 3], ["Eggs", 7], ["Pasta", 10], ["Nap", 20], ["Focus", 25], ["Bread", 40], ["Laundry", 45]].map(([l, m]) => ({ l, ms: m * 60000 }));
const SLEEP_ID = 9001;

const DEF = {
  skin: "live", accent: "rose", font: "crust", h24: true, secs: true, correct: true, ticks: true, wake: false, notify: false, analog: false,
  weather: true, fahr: false, swAnalog: true,
  cities: ["Europe/London", "America/New_York", "Asia/Tokyo"],
  alarms: [
    { id: 1, h: 7, m: 0, label: "Work", days: [1,1,1,1,1,0,0], on: true, sound: "glass", gentle: true, snooze: 9, scene: "sunrise", vib: "pulse" },
    { id: 2, h: 9, m: 30, label: "Slow Sunday", days: [0,0,0,0,0,0,1], on: false, sound: "dawn", gentle: true, snooze: 9, scene: "bloom", vib: "gentle" }
  ],
  sleep: { set: false, on: true, bed: 23 * 60, wake: 7 * 60, days: [1,1,1,1,1,1,1], remind: 30, goal: 8, alarm: true, sound: "dawn", scene: "sunrise" },
  presets: PRESETS0,
  timers: [], focus: null, setMs: 300000, setLabel: "Timer", timerSound: "ding", timerFile: "", timerRingFor: 2,
  watch: { run: false, start: 0, acc: 0, laps: [] }
};
let S;
try { S = Object.assign(JSON.parse(JSON.stringify(DEF)), JSON.parse(localStorage.getItem("hora") || "{}")); }
catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
if (!S.fontChosen || S.font === "yourbold" || S.font === "matrole") S.font = "crust";
if (!ACCENTS[S.accent]) S.accent = "rose";
if (!SKINS[S.skin]) S.skin = "live";
S.sleep = Object.assign(JSON.parse(JSON.stringify(DEF.sleep)), S.sleep || {});
if (!Array.isArray(S.presets)) S.presets = PRESETS0;
/* world cities used to be saved as time zone names; now each is { name, sub, tz, lat, lon } so any place can be added */
S.cities = (S.cities || []).map(c => typeof c === "string" ? CITIES.find(x => x.tz === c) : c).filter(c => c && c.tz && validTz(c.tz));
function validTz(tz) { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; } }
const save = () => { try { localStorage.setItem("hora", JSON.stringify(S)); } catch (e) {} schedNative(); };

/* ---------- Android app bridge (window.HoraNative exists only inside the APK) ---------- */
const NAT = window.HoraNative || null, NATIVE = !!NAT;
if (NATIVE) {
  const wn = document.getElementById("webNote"); if (wn) wn.innerHTML = wn.dataset.native;
  const dc = document.getElementById("defTitle"); if (dc) dc.textContent = "Alarms on this phone";
  document.documentElement.classList.add("native");
  try { Object.defineProperty(navigator, "vibrate", { configurable: true, value: p => { NAT.vibrate(Array.isArray(p) ? p.join(",") : String(p)); return true; } }); } catch (e) {}
}
let schT = null;
/* hand Android every upcoming ring, in device time, so it can wake Hora even when it's closed */
function schedNative() {
  if (!NATIVE) return;
  clearTimeout(schT);
  schT = setTimeout(() => {
    try {
      const off = S.correct ? OFF : 0, n = now(), ev = [];
      // the next few rings of each alarm, so repeats keep working even if Hora isn't opened for days
      S.alarms.forEach(a => { let at = a.on ? NEXT[a.id] : null; for (let i = 0; at && i < 4; i++) { ev.push({ k: "a" + a.id + "@" + at, at: at - off, label: a.label || "Alarm" }); if (!a.days.some(Boolean)) break; at = nextRing(a, at + 1000); } });
      SNOOZES.forEach(s => ev.push({ k: "s" + s.a.id + "@" + s.at, at: s.at - off, label: (s.a.label || "Alarm") + " (snoozed)" }));
      S.timers.forEach(t => { if (t.run && !t.done) ev.push({ k: "t" + t.id + "@" + t.endAt, at: t.endAt - off, label: t.label + " timer" }); });
      // bedtime reminders are quiet notifications, not full-screen alarms ("b" keys)
      bedtimes(n, 4).forEach(b => ev.push({ k: "b" + SLEEP_ID + "@" + b.rem, at: b.rem - off, label: "Bedtime at " + hmA(new Date(b.bed)) }));
      NAT.schedule(JSON.stringify(ev.filter(e => e.at > n - off - 1000).sort((x, y) => x.at - y.at).slice(0, 40)));
    } catch (e) {}
  }, 60);
}
window.horaInsets = (top, bottom) => { const r = document.documentElement.style; r.setProperty("--sat", top + "px"); r.setProperty("--sab", bottom + "px"); };
/* Android Back: close a sheet, then go to the Clock tab, then leave the app */
window.horaBack = () => {
  if (RING) return true;
  if ($("#sheet").classList.contains("show")) { closeSheet(); return true; }
  if (VIEW !== "vClock") { go("vClock"); return true; }
  return false;
};
/* "Hey Google, set an alarm for 7" or "set a timer for 10 minutes" */
window.horaIntent = o => {
  try {
    if (o.type === "alarm" && o.h != null) {
      const a = newAlarm({ h: o.h, m: o.m || 0, label: o.label || "", days: o.days || [0,0,0,0,0,0,0] });
      S.alarms.push(a); save(); recalcAlarms(); go("vAlarm"); renderAll(); toast("Alarm set for " + pad(a.h) + ":" + pad(a.m) + " · rings in " + dur(NEXT[a.id] - now()));
    } else if (o.type === "timer" && o.seconds > 0) {
      S.setMs = o.seconds * 1000; S.setLabel = o.label || "Timer"; S.focus = null; go("vTimer"); startTimer();
    } else if (o.type === "alarms") go("vAlarm");
    else if (o.type === "timers") go("vTimer");
  } catch (e) {}
};

/* ---------- time & honesty ---------- */
let OFF = 0, UNC = null, SYNC = "idle", SYNCED_AT = 0;
const now = () => Date.now() + (S.correct ? OFF : 0);
function hm(d) {
  const h = d.getHours(), m = d.getMinutes();
  return S.h24 ? pad(h) + ":" + pad(m) : ((h % 12) || 12) + ":" + pad(m);
}
const ampm = d => S.h24 ? "" : (d.getHours() < 12 ? "AM" : "PM");
const hmA = d => hm(d) + (S.h24 ? "" : " " + ampm(d));
const fmtHM = (h, m) => S.h24 ? pad(h) + ":" + pad(m) : ((h % 12) || 12) + ":" + pad(m);
const apOf = h => S.h24 ? "" : (h < 12 ? "AM" : "PM");
const minTxt = mins => { const h = Math.floor(mins / 60) % 24; return fmtHM(h, mins % 60) + (S.h24 ? "" : " " + apOf(h)); };
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
const hDur = ms => { const m = Math.round(ms / 60000); return Math.floor(m / 60) + " h " + pad(m % 60) + " m"; };
/* "Today", "Tomorrow" or the weekday name */
function whenDay(ms) {
  const d = new Date(ms), t = new Date(now());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "long" });
}
/* the same, for the middle of a sentence: "today", "tomorrow", "Friday" */
const dayWord = ms => { const w = whenDay(ms); return w === "Today" || w === "Tomorrow" ? w.toLowerCase() : w; };

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
const localKey = ms => { const d = new Date(ms); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };

/* Compare with the server's clock using the Date header. Each reply bounds the offset to a 1 s window;
   intersecting several replies narrows it. */
async function sync() {
  SYNC = "idle"; paintBadge();
  if (NATIVE) { NAT.checkClock(); return; }   // Android does the same check and answers via horaClock
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
  window.horaClock(n, lo, hi);
}
window.horaClock = (n, lo, hi) => {
  if (n >= 2 && lo <= hi) { OFF = (lo + hi) / 2; UNC = (hi - lo) / 2; SYNC = "ok"; } else { OFF = 0; UNC = null; SYNC = "fail"; }
  SYNCED_AT = Date.now(); paintBadge(); recalcAlarms();
};
function paintBadge() {
  const b = $("#sync"), t = $("#syncTxt"); b.className = "badge";
  let acc;
  if (SYNC === "idle") { b.classList.add("idle"); t.textContent = "Checking clock…"; acc = "Checking your clock against the internet's…"; }
  else if (SYNC === "fail") {
    b.classList.add("idle"); t.textContent = "Device clock";
    acc = "Hora couldn't reach a time source just now, so it's showing your device's own clock. Phones usually sync themselves and are within a fraction of a second, but Hora won't claim that without checking.";
  } else {
    const a = Math.abs(OFF) / 1000, u = Math.max(UNC, 50) / 1000;
    if (Math.abs(OFF) <= Math.max(UNC, 500)) t.textContent = "On time ±" + u.toFixed(1) + " s";
    else { b.classList.add("warn"); t.textContent = a.toFixed(1) + " s " + (OFF > 0 ? "slow" : "fast") + (S.correct ? " · fixed" : ""); }
    acc = "Hora compared your device with an internet clock several times. Your device is <b>" + a.toFixed(2) + " s " + (OFF >= 0 ? "slow" : "fast") +
      "</b>, give or take " + u.toFixed(2) + " s. " + (S.correct ? "The time on screen, alarms and timers are corrected for this." : "Correction is off, so you're seeing the device's own time.") +
      " The time source only gives whole seconds, which is why there's a margin. Alarms are rounded to the minute anyway.";
  }
  $("#accText").innerHTML = acc;
}
$("#sync").onclick = () => openSheet(nav("Clock accuracy", "", "Done") + `<div class="kind" style="text-align:center">${$("#syncTxt").textContent}</div><div class="honest">${$("#accText").innerHTML}</div><div class="acts"><button class="btn wide" id="sAgain">Check again</button></div>`, () => { $("#sAgain").onclick = () => { closeSheet(); sync(); }; });
$("#resync").onclick = () => sync();

/* ---------- sun & sky ---------- */
function sunPos(ms) {
  const d = ms / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  return { ra: Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec: Math.asin(Math.sin(e) * Math.sin(L)), gmst: (18.697374558 + 24.06570982441908 * d) % 24 };
}
const altFrom = (p, lat, lon) => { const H = (p.gmst * 15 + lon) * RAD - p.ra; return Math.asin(Math.sin(lat * RAD) * Math.sin(p.dec) + Math.cos(lat * RAD) * Math.cos(p.dec) * Math.cos(H)) / RAD; };
const sunAlt = (ms, lat, lon) => altFrom(sunPos(ms), lat, lon);
function crossings(dayStart, thr, lat = HOME.lat, lon = HOME.lon) {
  const f = t => sunAlt(t, lat, lon) - thr, out = { rise: null, set: null }, step = 600000;
  let fa = f(dayStart);
  for (let t = dayStart + step; t <= dayStart + 86400000; t += step) {
    const ft = f(t);
    if ((fa < 0) !== (ft < 0)) {
      let lo = t - step, hi = t;
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if ((f(m) < 0) === (fa < 0)) lo = m; else hi = m; }
      if (fa < 0) out.rise = hi; else out.set = hi;
    }
    fa = ft;
  }
  return out;
}
/* calmer than a raw sky, so text stays easy to read */
const SKY = [
  [-20, "#050a1e", "#111a40"], [-12, "#0a1231", "#1f2d68"], [-6, "#17225a", "#4f4787"], [-2, "#252d68", "#b07079"],
  [2, "#34509a", "#d9966f"], [8, "#3467b8", "#94b9de"], [25, "#2a60ba", "#8cbbe4"]
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
  const sk = SKINS[S.skin] || SKINS.live, scr = $("#screen"), A = ACCENTS[S.accent];
  let top, bot, stars, glow = 0;
  if (S.skin === "live") {
    const alt = sunAlt(now(), HOME.lat, HOME.lon);
    [top, bot] = skyFor(alt);
    stars = clamp((-alt - 3) / 9, 0, 1);
    glow = clamp(1 - Math.abs(alt - 1) / 7, 0, 1) * .8;
  } else { top = sk.top; bot = sk.bot; stars = sk.stars; glow = sk.glow || 0; }
  scr.style.setProperty("--sky-top", top); scr.style.setProperty("--sky-bot", bot);
  scr.classList.toggle("light", sk.cls === "light"); scr.classList.toggle("red", sk.cls === "red");
  const acc = sk.cls === "red" ? "#ff5a46" : sk.cls === "light" ? A.d : A.c;
  scr.style.setProperty("--acc", acc); scr.style.setProperty("--acc-ink", sk.cls === "light" ? "#fff" : sk.cls === "red" ? "#1a0402" : "#1d0a12");
  if (NATIVE) try { NAT.statusBar(sk.cls === "light"); } catch (e) {}
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
/* Sound engine. Every note goes through one shared chain: a gentle high-pass, a generated room reverb and a soft
   compressor, so the built-in sounds feel like real instruments in a space rather than bare beeps. */
let BUS = null;
function impulse(a, sec, decay) {
  const len = Math.floor(a.sampleRate * sec), b = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, k = .5 - t * .42;   // the tail gets darker as it fades, like a real room
      y += ((Math.random() * 2 - 1) - y) * k;
      d[i] = y * Math.pow(1 - t, decay) * (i < a.sampleRate * .012 ? i / (a.sampleRate * .012) : 1);
    }
  }
  return b;
}
function bus(a) {
  if (BUS && BUS.ctx === a) return BUS.in;
  const inp = a.createGain(), hp = a.createBiquadFilter(), dry = a.createGain(), wet = a.createGain(), rev = a.createConvolver(), pre = a.createDelay(.1), comp = a.createDynamicsCompressor(), out = a.createGain();
  hp.type = "highpass"; hp.frequency.value = 80;
  rev.buffer = impulse(a, 2.6, 2.4); pre.delayTime.value = .022;
  dry.gain.value = .82; wet.gain.value = .34;
  comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .3;
  out.gain.value = 1.15;
  inp.connect(hp); hp.connect(dry).connect(comp); hp.connect(pre).connect(rev).connect(wet).connect(comp); comp.connect(out).connect(a.destination);
  BUS = { ctx: a, in: inp }; return inp;
}
/* attack, then an exponential fall; never quite reaching zero avoids clicks */
function env(g, t, peak, att, len) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + len); }
function osc(a, type, f, t, end, dest, detune = 0) { const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
/* a short filtered noise tick: the "strike" of a mallet or hammer */
let NOISE = null;
function strike(a, out, f, t, v, len = .018) {
  if (!NOISE || NOISE.sampleRate !== a.sampleRate) { NOISE = a.createBuffer(1, a.sampleRate * .1, a.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NOISE; bp.type = "bandpass"; bp.frequency.value = Math.min(f, 9000); bp.Q.value = 1.4;
  env(g, t, v, .001, len); s.connect(bp).connect(g).connect(out); s.start(t); s.stop(t + len + .02);
}
/* plucked string by Karplus-Strong, rendered once per pitch and reused */
const KS = {};
function ksBuffer(a, f, len) {
  const key = Math.round(f) + "@" + a.sampleRate; if (KS[key]) return KS[key];
  const sr = a.sampleRate, n = Math.floor(sr * len), p = Math.max(2, Math.round(sr / f)), b = a.createBuffer(1, n, sr), d = b.getChannelData(0), ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = (Math.random() * 2 - 1) * (.6 + .4 * Math.sin(i / p * Math.PI));
  let idx = 0;
  for (let i = 0; i < n; i++) { const nx = (idx + 1) % p, v = ring[idx]; d[i] = v; ring[idx] = (v + ring[nx]) * .4985; idx = nx; }
  return KS[key] = b;
}
const VOICES = {
  /* a tuned bell: hum, prime, minor-third tierce, fifth and octave partials, each fading at its own rate */
  bell(a, out, f, t, v, len) {
    [[.5, .35, 1.3], [1, 1, 1], [1.19, .32, .7], [1.5, .22, .55], [2, .38, .5], [2.52, .12, .35], [3.01, .1, .25], [4.17, .06, .18]].forEach(([p, m, dk], i) => {
      const g = a.createGain(); g.connect(out); env(g, t, v * m * .55, .002, len * dk);
      osc(a, "sine", f * p, t, t + len * dk + .05, g, i % 2 ? 3 : -3);
    });
    strike(a, out, f * 6, t, v * .08, .01);
  },
  /* marimba: wooden bar modes at 1, ~4 and ~10x, plus the mallet's soft knock */
  mallet(a, out, f, t, v, len) {
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = f * 9; lp.connect(out);
    [[1, 1, 1], [3.99, .22, .22], [10.65, .05, .07], [2, .06, .5]].forEach(([p, m, dk]) => {
      const g = a.createGain(); g.connect(lp); env(g, t, v * m * .9, .003, len * dk); osc(a, "sine", f * p, t, t + len * dk + .05, g);
    });
    strike(a, out, f * 2.5, t, v * .22, .02);
  },
  /* kalimba: a bright tine with a quick metallic overtone */
  tine(a, out, f, t, v, len) {
    [[1, 1, 1], [5.95, .3, .1], [2, .1, .35]].forEach(([p, m, dk]) => {
      const g = a.createGain(); g.connect(out); env(g, t, v * m * .8, .002, len * dk); osc(a, "sine", f * p, t, t + len * dk + .05, g);
    });
    strike(a, out, f * 4, t, v * .12, .012);
  },
  /* electric piano by FM: the brightness fades faster than the note, like a Rhodes */
  keys(a, out, f, t, v, len) {
    const g = a.createGain(), car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain();
    car.type = "sine"; car.frequency.value = f; mod.type = "sine"; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 2.2 * v, t); mg.gain.exponentialRampToValueAtTime(f * .15, t + len * .5);
    mod.connect(mg).connect(car.frequency); car.connect(g).connect(out); env(g, t, v * .5, .004, len);
    car.start(t); mod.start(t); car.stop(t + len + .05); mod.stop(t + len + .05);
    const bark = a.createGain(); bark.connect(out); env(bark, t, v * .06, .001, .15); osc(a, "sine", f * 7.02, t, t + .2, bark);
  },
  /* music box comb: pure and high, with a soft shimmer */
  comb(a, out, f, t, v, len) {
    [[1, 1, 1], [2, .28, .45], [3.03, .1, .25], [4.98, .04, .12]].forEach(([p, m, dk], i) => {
      const g = a.createGain(); g.connect(out); env(g, t, v * m * .6, .0015, len * dk); osc(a, "sine", f * p, t, t + len * dk + .05, g, i ? 2 : 0);
    });
    strike(a, out, f * 3, t, v * .05, .008);
  },
  /* harp: a real plucked string */
  pluck(a, out, f, t, v, len) {
    const s = a.createBufferSource(), g = a.createGain(), lp = a.createBiquadFilter();
    s.buffer = ksBuffer(a, f, Math.min(len, 3)); lp.type = "lowpass"; lp.frequency.value = Math.min(f * 10, 12000);
    g.gain.value = v * .9; s.connect(lp).connect(g).connect(out); s.start(t);
  },
  /* warm pad: three detuned saws per note through a slowly opening filter */
  pad(a, out, f, t, v, len) {
    const lp = a.createBiquadFilter(), g = a.createGain(); lp.type = "lowpass"; lp.Q.value = .7;
    lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1600, t + len * .45); lp.frequency.linearRampToValueAtTime(700, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .16, t + len * .38); g.gain.linearRampToValueAtTime(0, t + len);
    lp.connect(g).connect(out);
    [-9, 0, 8].forEach(dt => osc(a, "sawtooth", f, t, t + len + .05, lp, dt));
    const sub = a.createGain(); sub.gain.value = v * .05; sub.connect(g); osc(a, "sine", f / 2, t, t + len + .05, sub);
  },
  /* songbird: a quick rising whistle with a fast warble */
  chirp(a, out, f, t, v, len) {
    const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * .82, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + len * .45); o.frequency.exponentialRampToValueAtTime(f * 1.02, t + len);
    lfo.frequency.value = 34 + Math.random() * 12; lg.gain.value = f * .035; lfo.connect(lg).connect(o.frequency);
    env(g, t, v * .45, .008, len); o.connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + len + .02); lfo.stop(t + len + .02);
  },
  /* classic digital alarm, rounded off so it isn't harsh */
  beep(a, out, f, t, v, len) {
    const g = a.createGain(), lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = f * 2.4; lp.Q.value = .5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .22, t + .006); g.gain.setValueAtTime(v * .22, t + len - .012); g.gain.linearRampToValueAtTime(0, t + len);
    lp.connect(g).connect(out); osc(a, "square", f, t, t + len + .02, lp); osc(a, "sine", f, t, t + len + .02, g);
  },
  /* singing bowl: slowly beating pairs of partials that bloom and fade */
  bowl(a, out, f, t, v, len) {
    [[1, 1], [2.71, .38], [5.15, .12], [8.43, .04]].forEach(([p, m]) => [0, .7].forEach(beat => {
      const g = a.createGain(); g.connect(out); env(g, t, v * m * .35, .04, len * (1.1 - p / 12)); osc(a, "sine", f * p + beat, t, t + len + .05, g);
    }));
    strike(a, out, f * 3, t, v * .1, .03);
  }
};
const N = n => 440 * Math.pow(2, n / 12);   // semitones from A4
/* notes are [semitones from A4, start in seconds, length?, velocity?] */
const SOUNDS = {
  glass:   { name: "Glass",        voice: "bell",  notes: [[3, 0, 0, 1], [7, .2, 0, .8], [10, .4, 0, .85], [15, .6, 0, .9]], len: 3 },
  dawn:    { name: "Dawn",         voice: "keys",  notes: [[-16, 0, 0, .7], [-9, .02, 0, .55], [-5, .4, 0, .7], [-2, .8, 0, .7], [3, 1.2, 0, .8], [7, 1.6, 0, .75]], len: 3.2 },
  keys:    { name: "Soft keys",    voice: "keys",  notes: [[-14, 0, 0, .6], [-7, 0, 0, .5], [-2, .01, 0, .5], [2, .02, 0, .45], [-12, 1.6, 0, .6], [-5, 1.6, 0, .5], [0, 1.61, 0, .5], [4, 1.62, 0, .45]], len: 2.8 },
  kalimba: { name: "Kalimba",      voice: "tine",  notes: [[3, 0, 0, .9], [10, .22, 0, .7], [7, .44, 0, .8], [15, .66, 0, .75], [12, 1.0, 0, .8], [10, 1.22, 0, .6]], len: 1.8 },
  rise:    { name: "Rise",         voice: "comb",  notes: [[15, 0, 0, .7], [17, .17, 0, .65], [19, .34, 0, .7], [22, .51, 0, .75], [24, .68, 0, .8], [27, .85, 0, .9]], len: 2.2 },
  marimba: { name: "Marimba",      voice: "mallet", notes: [[3, 0, 0, 1], [7, .15, 0, .75], [10, .3, 0, .85], [15, .45, 0, .9], [10, .75, 0, .7], [15, .9, 0, .85]], len: 1.3 },
  harp:    { name: "Harp",         voice: "pluck", notes: [[-7, 0, 0, .8], [0, .12, 0, .7], [5, .24, 0, .75], [9, .36, 0, .7], [12, .48, 0, .8], [17, .6, 0, .85]], len: 2.6 },
  lumen:   { name: "Lumen",        voice: "pad",   notes: [[-16, 0], [-12, 0], [-9, 0], [-5, 0], [-2, .25]], len: 3.8 },
  bowl:    { name: "Singing bowl", voice: "bowl",  notes: [[-14, 0], [-7, 2.6, 0, .7]], len: 6 },
  birds:   { name: "Birdsong",     voice: "chirp", notes: [[31, 0, .11], [33, .14, .08], [31, .26, .1], [36, .75, .14], [34, .96, .07], [36, 1.07, .07], [29, 1.7, .16]], len: .1 },
  crystal: { name: "Crystal",      voice: "comb",  notes: [[15, 0, 0, .8], [19, .1, 0, .7], [22, .2, 0, .75], [27, .3, 0, .85], [31, .5, 0, .6]], len: 2 },
  ding:    { name: "Ding",         voice: "bell",  notes: [[7, 0, 0, 1], [3, .4, 0, .85]], len: 2.8 },
  pulse:   { name: "Classic",      voice: "beep",  notes: [[12, 0], [12, .16], [12, .32], [12, .48]], len: .1 },
  kitchen: { name: "Kitchen",      voice: "beep",  notes: [[27, 0], [27, .08], [27, .16], [27, .24], [27, .32], [27, .4], [27, .48], [27, .56]], len: .05 }
};
const ALARM_SOUNDS = ["glass", "dawn", "keys", "kalimba", "rise", "marimba", "harp", "lumen", "bowl", "birds", "crystal", "pulse"];
const TIMER_SOUNDS = ["ding", "kalimba", "marimba", "glass", "crystal", "harp", "bowl", "pulse", "kitchen"];
function playSound(name, vol = .8, at) {
  const a = ac(); if (!a) return;
  const s = SOUNDS[name] || SOUNDS.glass, t = at || a.currentTime + .03, out = a.createGain();
  out.gain.value = vol * .3; out.connect(bus(a));
  // a little human looseness in timing and touch
  s.notes.forEach(([n, d, l, vel]) => VOICES[s.voice](a, out, N(n), t + d + Math.random() * .008, (vel || 1) * (.92 + Math.random() * .08), l || s.len));
}
/* one phrase plus a short breath, so a ringing sound repeats like a real ringtone */
function loopPeriod(name) {
  const s = SOUNDS[name] || SOUNDS.glass, last = Math.max(...s.notes.map(n => n[1]));
  const tail = { pad: s.len, bowl: 2.8, beep: .5, chirp: 1, pluck: 1, keys: 1.1, tine: .9, comb: .9, mallet: .8, bell: 1 }[s.voice] || .8;
  return last + tail;
}
/* vibration patterns (on, off, on, off… in ms); repeated while ringing */
const VIBS = {
  off:    { name: "Off",       p: [] },
  gentle: { name: "Gentle",    p: [120, 1100] },
  pulse:  { name: "Pulse",     p: [220, 140, 220, 900] },
  heart:  { name: "Heartbeat", p: [90, 110, 90, 900] },
  strong: { name: "Strong",    p: [700, 300, 700, 300] }
};
const vibLen = k => (VIBS[k] || VIBS.pulse).p.reduce((a, b) => a + b, 0);
function buzz(k) { const p = (VIBS[k] || VIBS.pulse).p; if (p.length && navigator.vibrate) navigator.vibrate(p); }
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
/* a picker grid shared by the alarm editor, sleep and the timer sheet */
const WAVE = `<svg viewBox="0 0 24 12"><path d="M1 6h2M5 3v6M8 1v10M11 4v4M14 2v8M17 4v4M20 3v6M23 6h0"/></svg>`;
function soundGrid(list, cur, fileName, id, noFile) {
  return `<div class="snds" id="${id}">` + list.map(k => `<div class="snd ${cur === k ? "on" : ""}" data-k="${k}">${WAVE}<b>${SOUNDS[k].name}</b></div>`).join("") +
    (noFile ? "" : `<label class="snd file ${cur === "custom" ? "on" : ""}" data-k="custom"><svg viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg><b>${fileName ? esc(fileName) : "Your sound"}</b><input type="file" accept="audio/*"></label>`) + `</div>`;
}
function bindSoundGrid(id, key, get, set) {
  const root = $("#" + id), paint = () => $$("#" + id + " .snd").forEach(x => x.classList.toggle("on", x.dataset.k === get().sound));
  $$("#" + id + " .snd:not(.file)").forEach(x => x.onclick = () => { set({ sound: x.dataset.k }); paint(); preview(x.dataset.k); });
  const file = root.querySelector(".file"); if (!file) return;
  const inp = file.querySelector("input");
  file.onclick = e => { if (e.target === inp) return; if (get().fileName && get().sound !== "custom") { e.preventDefault(); set({ sound: "custom" }); paint(); preview("custom", key); } };
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 40 * 1024 * 1024) { toast("That file is over 40 MB"); return; }
    const kept = await SC.media.put(key, f), nm = f.name.replace(/\.[^.]+$/, "").slice(0, 26);
    set({ sound: "custom", fileName: nm }); file.querySelector("b").textContent = nm; paint(); preview("custom", key);
    toast(kept ? "Sound set" : "Set for now, but this browser won't keep it after closing");
  };
}
const SC = window.HoraScenes;

/* ---------- toast, sheet, wheel ---------- */
let toastT;
function toast(msg, act, fn) {
  const t = $("#toast"); t.innerHTML = esc(msg) + (act ? ` <a id="tAct">${esc(act)}</a>` : ""); t.classList.add("show"); clearTimeout(toastT);
  if (act) $("#tAct").onclick = () => { t.classList.remove("show"); fn(); };
  toastT = setTimeout(() => t.classList.remove("show"), act ? 4200 : 2200);
}
let onSheetClose = null;
/* iOS-style sheet top bar: left action, title, right action */
const nav = (title, left = "Cancel", right = "") => `<div class="snav"><a id="snL">${left}</a><b>${title}</b><a class="r" id="snR">${right}</a></div>`;
function openSheet(html, after) {
  $("#sheetBody").innerHTML = html; $("#scrim").classList.add("show"); $("#sheet").classList.add("show"); $("#sheet").scrollTop = 0;
  requestAnimationFrame(() => {
    if (after) after();
    ["#snL", "#snR"].forEach(s => { const e = $(s); if (e && !e.onclick) e.onclick = closeSheet; });
  });
}
function closeSheet() { $("#scrim").classList.remove("show"); $("#sheet").classList.remove("show"); if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); } }
$("#scrim").onclick = closeSheet;
/* scroll wheels: cols is a list of { id, n, step, unit } with ":" strings between them */
function wheel(cols) {
  return `<div class="wheel">` + cols.map(c => typeof c === "string" ? `<div class="colon">${c}</div>`
    : `<div class="col" id="${c.id}">${Array.from({ length: c.n }, (_, i) => `<div class="it">${pad(i * (c.step || 1))}</div>`).join("")}</div>${c.unit ? `<div class="unit">${c.unit}</div>` : ""}`).join("") + `</div>`;
}
function bindWheel(id, val, onChange) {
  const el = $("#" + id), items = el.querySelectorAll(".it"), max = items.length - 1;
  const sel = v => items.forEach((x, i) => x.classList.toggle("sel", i === v));
  el.scrollTop = val * 40; sel(val); let cur = val;
  el.addEventListener("scroll", () => { const v = clamp(Math.round(el.scrollTop / 40), 0, max); if (v !== cur) { cur = v; sel(v); tick(1.3); onChange(v); } }, { passive: true });
  return v => { cur = v; el.scrollTop = v * 40; sel(v); };
}

/* ---------- tabs ---------- */
let VIEW = "vClock";
function go(v) {
  if (v === VIEW) return; VIEW = v; tick(.8);
  $$(".view").forEach(x => x.classList.toggle("show", x.id === v));
  $$(".tab").forEach(x => x.classList.toggle("on", x.dataset.v === v));
  renderAll();
  if (v === "vClock") { drawRuler(); drawMap(); }
}
$$(".tab").forEach(t => t.onclick = () => go(t.dataset.v));

/* ---------- analog face: hour bars, minute dots, date and weather complications ---------- */
(function buildAnalog() {
  const svg = $("#analog"), P = (a, r) => [120 + Math.sin(a * RAD) * r, 120 - Math.cos(a * RAD) * r];
  let h = `<circle cx="120" cy="120" r="116" fill="rgba(255,255,255,.06)" stroke="var(--stroke)"/>`;
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) { if (i % 15 === 0) continue; const [x1, y1] = P(i * 6, 98), [x2, y2] = P(i * 6, 108); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/>`; }
    else { const [x, y] = P(i * 6, 106); h += `<circle cx="${x}" cy="${y}" r="1" fill="var(--fg2)"/>`; }
  }
  [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([n, d]) => { const [x, y] = P(d, 100); h += `<text class="num" x="${x}" y="${y}">${n}</text>`; });
  h += `<text class="cmp" id="aWx" x="120" y="74"></text><text class="cmp" id="aDate" x="120" y="166"></text>
    <line class="hand" id="aH" x1="120" y1="132" x2="120" y2="66" stroke-width="7"/>
    <line class="hand" id="aM" x1="120" y1="134" x2="120" y2="34" stroke-width="4.5"/>
    <g id="aS"><line class="sec" x1="120" y1="142" x2="120" y2="24" stroke-width="1.8"/><circle cx="120" cy="120" r="4.5" fill="var(--acc)"/></g>
    <circle cx="120" cy="120" r="1.8" fill="var(--sky-top)"/>`;
  svg.innerHTML = h;
})();

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
function lineTime(box, hmS, ss, ap) {
  if (box.dataset.f !== "line") { box.innerHTML = `<span class="lt main"></span><span class="tside"><span class="lt sec"></span><span class="lap2"></span></span>`; box.dataset.f = "line"; }
  const put = (el, str) => {
    if (el.children.length !== str.length) el.innerHTML = [...str].map(() => `<span class="slot"></span>`).join("");
    [...str].forEach((ch, i) => {
      const s = el.children[i];
      if (s.dataset.c !== ch) { s.dataset.c = ch; s.innerHTML = glyphSvg(ch); if (box.dataset.ready) s.firstChild.classList.add("draw"); }
    });
  };
  const sec = box.querySelector(".sec");
  put(box.children[0], hmS); put(sec, ss);
  sec.style.display = ss ? "" : "none";
  box.querySelector(".lap2").textContent = ap;
  box.dataset.ready = "1";
}
/* the alarm screen shows the time in the same digits as the main clock */
function ringTime() {
  const d = new Date(now()), el = $("#rT");
  if (S.font === "line") { lineTime(el, hm(d), "", ampm(d)); return; }
  const t = hmA(d);
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
  const d = new Date(now()), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds() + d.getMilliseconds() / 1000;
  $("#face").classList.toggle("ana", S.analog);
  if (S.analog) {
    const mm = m + s / 60, hh = (h % 12) + mm / 60;
    $("#aH").setAttribute("transform", `rotate(${hh * 30} 120 120)`);
    $("#aM").setAttribute("transform", `rotate(${mm * 6} 120 120)`);
    $("#aS").setAttribute("transform", `rotate(${Math.floor(s * 4) / 4 * 6} 120 120)`);
    const dt = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase() + " " + d.getDate();
    if ($("#aDate").textContent !== dt) $("#aDate").textContent = dt;
    const w = wxNow(); $("#aWx").textContent = w ? w.temp : "";
  } else if (S.font === "solid" || S.font === "crust") {
    const html = fmtHM(h, m) + (S.secs ? `<span class="ss">${pad(Math.floor(s))}</span>` : "") + (S.h24 ? "" : `<span class="ap">${apOf(h)}</span>`);
    if ($("#digi").dataset.f !== S.font || $("#digi").innerHTML !== html) { $("#digi").innerHTML = html; $("#digi").dataset.f = S.font; fitDigi(); }
  } else lineTime($("#digi"), fmtHM(h, m), S.secs ? pad(Math.floor(s)) : "", apOf(h));
  const dl = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if ($("#dateLine").textContent !== dl) $("#dateLine").textContent = dl;
}
$("#face").onclick = () => { S.analog = !S.analog; save(); tick(); renderFace(); };

/* ---------- weather (Open-Meteo: free, no account, no key) ---------- */
const WX = { data: null, at: 0, busy: false };
const WMO = c => c === 0 ? ["Clear", "clear"] : c === 1 ? ["Mostly clear", "clear"] : c === 2 ? ["Partly cloudy", "part"] : c === 3 ? ["Cloudy", "cloud"]
  : c <= 48 ? ["Fog", "fog"] : c <= 57 ? ["Drizzle", "rain"] : c <= 65 ? [c === 65 ? "Heavy rain" : c === 61 ? "Light rain" : "Rain", "rain"] : c <= 67 ? ["Freezing rain", "rain"]
  : c <= 77 ? ["Snow", "snow"] : c <= 82 ? ["Showers", "rain"] : c <= 86 ? ["Snow showers", "snow"] : ["Thunderstorm", "storm"];
const CLOUD = `<path d="M7.5 19h9.2a4.1 4.1 0 0 0 .6-8.15A5.6 5.6 0 0 0 6.6 11.2 3.95 3.95 0 0 0 7.5 19z" fill="rgba(255,255,255,.92)"/>`;
function wxIcon(kind, day) {
  const sun = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffcc5c"/>` + Array.from({ length: 8 }, (_, i) => { const a = i * 45 * RAD; return `<line x1="${cx + Math.cos(a) * (r + 2)}" y1="${cy + Math.sin(a) * (r + 2)}" x2="${cx + Math.cos(a) * (r + 4)}" y2="${cy + Math.sin(a) * (r + 4)}" stroke="#ffcc5c" stroke-width="1.6" stroke-linecap="round"/>`; }).join("");
  const moon = (cx, cy, r) => `<path d="M${cx + r * .3} ${cy - r}a${r} ${r} 0 1 0 ${r * .75} ${r * 1.55}A${r * .85} ${r * .85} 0 0 1 ${cx + r * .3} ${cy - r}z" fill="#e8e4ff"/>`;
  const drops = c => [8, 12, 16].map((x, i) => i < 3 ? `<line x1="${x}" y1="20.5" x2="${x - 1.2}" y2="23" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>` : "").join("");
  let b = "";
  if (kind === "clear") b = day ? sun(12, 12, 4.6) : moon(11, 12, 6.5);
  else if (kind === "part") b = (day ? sun(8.5, 8.5, 3.4) : moon(8, 8, 4.6)) + CLOUD;
  else if (kind === "cloud") b = CLOUD;
  else if (kind === "fog") b = `<g stroke="rgba(255,255,255,.85)" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="6" y1="13" x2="18" y2="13"/><line x1="4" y1="17" x2="20" y2="17"/></g>`;
  else if (kind === "rain") b = `<g transform="translate(0 -3)">${CLOUD}</g>` + drops("#7cc4ff");
  else if (kind === "snow") b = `<g transform="translate(0 -3)">${CLOUD}</g>` + [8, 12, 16].map(x => `<circle cx="${x}" cy="21.5" r="1.2" fill="#fff"/>`).join("");
  else b = `<g transform="translate(0 -3)">${CLOUD}</g><path d="M12.5 15.5l-2.5 4h3l-1.5 3.5" fill="none" stroke="#ffcc5c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 24 24">${b}</svg>`;
}
const deg = c => Math.round(S.fahr ? c * 9 / 5 + 32 : c) + "°";
function wxNow() {
  const d = WX.data; if (!d || !d.current || !S.weather) return null;
  const [name, kind] = WMO(d.current.weather_code);
  return { temp: deg(d.current.temperature_2m), feels: deg(d.current.apparent_temperature), name, kind, day: !!d.current.is_day,
    hi: d.daily ? deg(d.daily.temperature_2m_max[0]) : "", lo: d.daily ? deg(d.daily.temperature_2m_min[0]) : "" };
}
async function loadWeather(force) {
  if (!S.weather || WX.busy) return;
  if (!force && WX.data && Date.now() - WX.at < 30 * 60000) return;
  try { const c = JSON.parse(localStorage.getItem("hora-wx") || "null"); if (c && !force && Date.now() - c.at < 30 * 60000) { WX.data = c.data; WX.at = c.at; renderWx(); return; } } catch (e) {}
  WX.busy = true;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${HOME.lat}&longitude=${HOME.lon}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=2`;
    const r = await fetch(u, { cache: "no-store" }), d = await r.json();
    if (d && d.current) { WX.data = d; WX.at = Date.now(); try { localStorage.setItem("hora-wx", JSON.stringify({ at: WX.at, data: d })); } catch (e) {} }
  } catch (e) {}
  WX.busy = false; renderWx();
}
/* the next hours, starting with the current one */
function wxHours(n) {
  const d = WX.data; if (!d || !d.hourly) return [];
  const t = d.hourly.time, cur = new Date(now()), key = cur.getFullYear() + "-" + pad(cur.getMonth() + 1) + "-" + pad(cur.getDate()) + "T" + pad(cur.getHours()) + ":00";
  let i = t.indexOf(key); if (i < 0) i = 0;
  return t.slice(i, i + n).map((x, j) => ({ h: +x.slice(11, 13), t: d.hourly.temperature_2m[i + j], c: d.hourly.weather_code[i + j], p: d.hourly.precipitation_probability[i + j], day: !!d.hourly.is_day[i + j] }));
}
function rainHint() {
  const hs = wxHours(12), w = hs.find((x, j) => j > 0 && x.p >= 50 && WMO(x.c)[1] !== "snow");
  return w ? "Rain likely around " + fmtHM(w.h, 0) : "";
}
function renderWx() {
  const b = $("#wx"), w = wxNow();
  if (!w) { b.hidden = true; $("#rW").innerHTML = ""; return; }
  b.hidden = false;
  const h = `${wxIcon(w.kind, w.day)}${w.temp} <span>${w.name} · H ${w.hi} L ${w.lo}</span><i>›</i>`;
  if (b.innerHTML !== h) b.innerHTML = h;
  $("#rW").innerHTML = `${wxIcon(w.kind, w.day)}${w.temp} · ${w.name} in Gliwice`;
}
$("#wx").onclick = () => {
  const w = wxNow(); if (!w) return;
  const hs = wxHours(13), when = new Date(WX.at), hint = rainHint();
  openSheet(nav("Weather", "", "Done") + `
    <div class="wxbig">${wxIcon(w.kind, w.day)}<div><b>${w.temp}</b><span>${w.name} · feels like ${w.feels}<br>High ${w.hi} · Low ${w.lo}</span></div></div>
    ${hint ? `<div class="honest" style="margin-bottom:14px">☂ <b>${hint}.</b></div>` : ""}
    <div class="hours">${hs.map((x, j) => `<div class="hr"><span>${j ? fmtHM(x.h, 0) : "Now"}</span>${wxIcon(WMO(x.c)[1], x.day)}<b>${deg(x.t)}</b><small>${x.p >= 20 ? x.p + "%" : ""}</small></div>`).join("")}</div>
    <div style="font-size:12px;color:var(--fg2);margin-top:14px;text-align:center">Gliwice · from Open-Meteo, updated ${hmA(when)}</div>`);
};

/* ---------- daylight, moon + hero stats ---------- */
let SUNKEY = "", SUN = null;
const dayStart = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
function moonAt(ms) {
  const syn = 29.530588853, age = (((ms - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn + syn) % syn, ph = age / syn;
  const lit = Math.round((1 - Math.cos(ph * TAU)) / 2 * 100);
  const name = ph < .03 || ph > .97 ? "New moon" : ph < .22 ? "Waxing crescent" : ph < .28 ? "First quarter" : ph < .47 ? "Waxing gibbous" : ph < .53 ? "Full moon" : ph < .72 ? "Waning gibbous" : ph < .78 ? "Last quarter" : "Waning crescent";
  return { lit, name, ph };
}
/* the lit part of the moon as seen from the north */
function moonSvg(ph) {
  const r = 7, k = Math.cos(ph * TAU), wax = ph < .5, rx = Math.abs(k) * r;
  const lit = `M8 1 A${r} ${r} 0 0 ${wax ? 1 : 0} 8 15 A${rx} ${r} 0 0 ${(k > 0) === wax ? 0 : 1} 8 1Z`;
  return `<svg class="moon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="rgba(255,255,255,.16)"/><path d="${lit}" fill="#f1eedf"/></svg>`;
}
function renderSun() {
  const n = now(), key = dayStart(n);
  if (key !== SUNKEY) {
    SUNKEY = key;
    const d0 = dayStart(n), c = crossings(d0, -0.833), g = crossings(d0, 6), tm = crossings(d0 + 86400000, -0.833);
    SUN = { rise: c.rise, set: c.set, gold: g.set, tRise: tm.rise };
  }
  const { rise, set, gold, tRise } = SUN;
  $("#rise").textContent = rise ? hmA(new Date(rise)) : "—"; $("#set").textContent = set ? hmA(new Date(set)) : "—";
  let big, f, day = rise && set && n >= rise && n < set;
  if (day) { big = dur(set - n) + " of daylight left"; f = (n - rise) / (set - rise); }
  else if (rise && n < rise) { big = "Sunrise in " + dur(rise - n); f = null; }
  else { big = "Sunrise in " + dur((tRise || n) - n); f = null; }
  $("#sunBig").textContent = big;
  $("#goldTxt").textContent = gold && n < gold ? "Golden hour " + hmA(new Date(gold)) : gold && set && n >= gold && n < set ? "Golden hour now" : rise && set ? "Day length " + hDur(set - rise) : "";
  const mo = moonAt(n); $("#moonTxt").innerHTML = moonSvg(mo.ph) + mo.name + " · " + mo.lit + "%";
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
    ${f !== null ? `<path d="M16 70 Q160 -18 304 70" fill="none" stroke="var(--acc)" stroke-width="2.4" clip-path="url(#sc)"/>` : ""}
    <line x1="0" y1="70" x2="320" y2="70" stroke="var(--stroke)" stroke-width="1"/>
    <circle cx="${sx}" cy="${sy}" r="22" fill="url(#sg)" opacity="${op * .9}"/>
    <circle cx="${sx}" cy="${sy}" r="6.5" fill="${f !== null ? "#fff6df" : "var(--fg2)"}" opacity="${op}"/>`;
  renderHero(n);
}
function renderHero(n) {
  const { rise, set } = SUN, nx = nextAlarm();
  const T = [
    [`<em style="color:var(--warn)">▲</em>Sunrise`, rise ? hmA(new Date(rise)) : "—"],
    [`<em style="color:#8fd6ff">▼</em>Sunset`, set ? hmA(new Date(set)) : "—"],
    [nx ? "Alarm · in " + dur(nx.at - n) : "Next alarm", nx ? hmA(new Date(nx.at)) : "Off"]
  ];
  const h = T.map(([k, v]) => `<div class="hm"><b>${v}</b><span>${k}</span></div>`).join("");
  if ($("#hGrid").innerHTML !== h) $("#hGrid").innerHTML = h;
}

/* ---------- world map: a dot map with live day and night ---------- */
/* Coarse coastlines as [lon, lat] rings. Drawn as dots, so small errors don't show. */
const LAND = [
  [[-168,66],[-162,70],[-156,71.3],[-140,69.6],[-128,70],[-115,68.5],[-95,72],[-82,73],[-75,68],[-64,60],[-60,55],[-56,52],[-66,45],[-70,43],[-76,38],[-76,35],[-81,31],[-80,25.5],[-82,29],[-84,30],[-90,29],[-97,26],[-97.5,21],[-95,18.5],[-91,18.5],[-87,21.5],[-88,16],[-83,15],[-83,10],[-79,9],[-77.5,8],[-80,7.5],[-86,11],[-92,14.5],[-96,15.8],[-105,19.5],[-109,23],[-112,27],[-114,30],[-117,32.5],[-120.5,34.5],[-124,40],[-124,46],[-123,49],[-128,51],[-133,55],[-138,59],[-147,61],[-153,59],[-158,57],[-164,55],[-160,58.5],[-165,61],[-166,64.5]],
  [[-120,72],[-100,76],[-80,76],[-62,82],[-90,82],[-118,77]],
  [[-55,60],[-43,60],[-37,65],[-22,70],[-20,77],[-17,81],[-30,83.5],[-60,82],[-70,78],[-58,75],[-53,69],[-50,64]],
  [[-59.3,47.6],[-56,51.6],[-53,49.5],[-52.7,47.5],[-55.8,46.9]],
  [[-85,21.8],[-82,23.1],[-77.5,22],[-74.2,20.2],[-77.7,19.9],[-80.5,21.7]],
  [[-74.4,18.6],[-72.8,19.9],[-69.8,19.6],[-68.4,18.6],[-71.3,17.6]],
  [[-80,9],[-75,11],[-71,12],[-62,10.7],[-58,6.5],[-52,5],[-50,1.5],[-44,-2.5],[-35,-5.5],[-35,-9],[-39,-13.5],[-39,-18],[-41,-22],[-48,-25.5],[-48.5,-28],[-53,-33.5],[-57,-35],[-57,-38.5],[-62,-39],[-65,-41],[-64,-43],[-67.5,-46],[-66,-48],[-69,-51],[-68.5,-53],[-71,-54],[-74,-52],[-75,-47],[-73.5,-42],[-73.5,-37],[-71.5,-30],[-70,-18],[-75,-15],[-77,-12],[-79.5,-7.5],[-81,-4.5],[-80,-1],[-80,1],[-78,3],[-77.5,7]],
  [[-9,37],[-9.5,39],[-8.8,42.5],[-1.8,43.4],[-1.2,46],[-4.5,48],[-1.5,48.7],[1.5,50.2],[4,51.5],[5,53.3],[8.5,53.8],[8.5,55.5],[8,57],[10.5,57.7],[10.5,56],[12.5,55.5],[12,54.2],[14,54],[18.5,54.8],[21,55.5],[21,57],[24,57],[24,58.5],[28,59.5],[30,60],[28,60.5],[22.5,60],[21.5,61],[21.5,63],[25,65],[24,65.8],[21.5,65.5],[19,63.5],[17.5,61],[18.8,59.5],[16.5,57],[14,55.5],[13,55.5],[11,58.5],[8,58],[5.5,59],[5,62],[10,64],[14,67.5],[18,69.8],[23,70.5],[28,71],[33,69.5],[41,67],[44,66.5],[53,68.5],[60,69],[60,50],[52,46.5],[47,44],[41.5,41.5],[37.5,44.8],[33.5,44.5],[30,46],[29.5,45],[28.5,43.5],[28,41.5],[26,40.5],[23,40],[24,38],[22,36.5],[21,38.5],[19.5,41.8],[16,43.5],[13.5,45.5],[12.3,45.3],[13.5,43.5],[16,41.5],[18.5,40.2],[16,38],[15.6,40],[12,42],[10,44],[7.5,43.8],[3,43.2],[3.2,41.8],[0,39.5],[-0.5,38],[-2,36.7],[-5.5,36]],
  [[-5.7,50],[1.5,51],[1.7,52.7],[0,53.5],[-1.5,55],[-2,57],[-1.8,57.6],[-4,57.7],[-3,58.6],[-5,58.6],[-6.2,57.5],[-5.5,56],[-4.8,54.8],[-3,54.4],[-3.3,53.4],[-4.6,53.2],[-4.2,52.3],[-5.3,51.8],[-3.5,51.4]],
  [[-6,52],[-6,54],[-7.5,55.2],[-10,54.2],[-10,51.6],[-8,51.6]],
  [[-24,65.5],[-22,66.4],[-16,66.5],[-13.5,65],[-18,63.4],[-22.5,63.8]],
  [[-17,21],[-16,24],[-13,27.6],[-9.8,30],[-9.5,33],[-6,35.8],[-2,35.1],[3,36.8],[10,37.3],[11,35.2],[10,34],[11,33],[15.2,32.3],[20,30.8],[20,32.5],[23,32.6],[29,30.9],[32.3,31.3],[34.2,31.2],[34,27.8],[33,28.5],[32.5,29.9],[35.7,23.9],[37.3,21],[38.5,18],[43.2,12.7],[44,10.5],[51.3,11.8],[51,10.4],[48,4.5],[41.5,-1.8],[39.5,-5],[39.5,-10],[40.5,-15],[35,-22],[35.5,-24],[32.6,-26],[30,-31.3],[26,-33.8],[20,-34.8],[18.3,-33.5],[17,-29],[14.5,-22.5],[11.8,-17],[13.5,-11],[13,-6],[12,-5],[9,-1],[9.6,3.5],[8.5,4.5],[5.5,4.2],[2,6.3],[-2,4.8],[-7.5,4.4],[-12.5,7.5],[-15,10.5],[-17,14.7],[-16.5,19.5]],
  [[49.3,-12],[50.5,-15.5],[47.2,-25],[45,-25.5],[43.5,-22],[44.4,-16.5],[47,-15]],
  [[26.2,40],[26.5,41.7],[29,41.2],[31.5,41.2],[35,42],[38,41],[41.5,41.5],[47,44],[52,46.5],[60,50],[60,69],[66,69.5],[69,73],[73,72.5],[80,73.5],[87,75],[100,78],[113,73.5],[128,73],[140,72.5],[150,71.5],[160,70],[170,70],[180,69],[180,65],[178,64.5],[172,61],[163,60],[162,58],[156,51],[156,57.5],[160,61.5],[154,59.2],[143,59.3],[137,54],[141,52.5],[140.5,48],[135,43.5],[131,42.7],[129.5,41],[127.5,39.5],[129.4,36],[126.5,34.5],[126.2,37.6],[124.5,39.8],[121.5,39],[121.5,40.8],[118,39],[119,37.2],[122.5,37],[120,34.5],[121.8,31],[122,29.8],[119.5,25.5],[116,22.9],[113.5,22.2],[110.5,21],[108.5,21.6],[106.5,20],[105.6,18.5],[108.8,15.5],[109.2,12],[107,10.4],[104.8,8.6],[105,10],[103,10.5],[101,12.7],[100,13.5],[99.2,10],[100.5,7],[103.4,4],[104.2,1.4],[101.3,2.8],[100.3,5.5],[98.3,8],[98.5,13],[97.6,16.5],[94.3,16],[94,19.5],[92.3,21],[91.8,22.6],[90,21.9],[86.9,21.3],[85,19.5],[82.3,16.6],[80.3,15.5],[80.2,13],[79.8,10.3],[77.5,8],[76.5,9.5],[74.8,12.8],[73.4,16],[72.8,19],[72.6,21.5],[70,22.5],[68.5,23.7],[66.6,25.4],[61.6,25.2],[57.5,25.7],[56.4,27.1],[54.5,26.6],[51.5,27.9],[50.1,30],[48,30],[48.5,28.5],[50.8,24.8],[51.6,25.9],[52.6,24.2],[56.4,24.9],[56.3,26.3],[57,24],[59.8,22.4],[58.8,20.4],[55.5,17.5],[52.2,15.6],[45,12.8],[43.3,12.6],[42.7,15.7],[40.8,19.5],[39,21.8],[37,25.5],[35,28],[34.6,29.5],[34.2,31.3],[35.5,33.9],[36,35.8],[36,36.8],[32.5,36.1],[30,36.2],[28,36.7],[27.3,37.6],[26.3,38.5]],
  [[130,31],[131.5,31.5],[132,33.8],[135,33.5],[136.9,34.3],[139.8,35],[140.9,36.9],[141,38.3],[142,39.6],[141.4,41.4],[140,40.6],[139.8,38.3],[136.7,37],[135.5,35.6],[132.6,35.5],[130.9,34],[129.7,33.2]],
  [[140,41.5],[141.5,42.5],[143.3,42],[145.6,43.3],[144,44.2],[141.8,45.4],[141.5,43.4],[139.9,42.6]],
  [[120.1,23],[121,22],[121.9,25],[121.5,25.3],[120.2,23.8]],
  [[79.8,8],[81.2,6.2],[81.9,7.5],[80.2,9.8]],
  [[120,18.5],[122.3,18.4],[122,16],[124,13],[121,13.7],[120.5,14.6]],
  [[122,7],[125.5,9.5],[126.5,7.2],[125.5,5.6],[123.5,7.8]],
  [[109,1.8],[111,2.5],[113,3.2],[116,6.9],[119.2,5.2],[118,2.3],[118.8,1],[117.5,-.5],[116.5,-2.5],[116.3,-3.8],[114.5,-3.7],[111.5,-3],[110,-1.8]],
  [[95.3,5.6],[97.5,5.2],[100.4,2.2],[103.7,-1],[106,-3],[105.8,-5.8],[104.5,-5.8],[101.5,-3],[99,0],[96,3]],
  [[105.2,-6.8],[106.5,-6],[110.5,-6.9],[112.7,-6.9],[114.5,-7.8],[110,-8.2],[106.5,-7.4]],
  [[119,-5.5],[120.5,-5.5],[120.5,-2],[121.5,1],[124.8,1.6],[120,.5],[119.5,-3.5]],
  [[131,-1.5],[134,-1],[138,-1.7],[141,-2.6],[145.8,-4.8],[147.5,-6],[147.8,-8.1],[150,-10.4],[146.5,-8.8],[143.5,-9],[142.5,-9.4],[140.5,-8.5],[138,-8.3],[138.7,-6.5],[135,-4.4],[132.5,-4],[131.9,-2.5]],
  [[113.5,-22],[114,-26.5],[115,-30],[115,-34],[118,-35],[123.5,-33.9],[126,-32.3],[131,-31.5],[134,-32.8],[135.8,-34.8],[138,-34.5],[137.8,-33],[138.5,-35.5],[140,-37.8],[143.5,-38.8],[146.3,-39.1],[149.9,-37.5],[150.8,-34.5],[153.1,-30.5],[153.2,-25.2],[150.8,-22.6],[148.8,-20.3],[146.3,-18.8],[145.4,-14.9],[143.8,-14.3],[142.5,-10.7],[141.6,-12.6],[141.6,-16.5],[140.8,-17.5],[139.2,-17.3],[135.8,-15],[136.8,-12.2],[133,-11.3],[130.3,-12.4],[129.5,-14.9],[127.3,-14],[125,-14.6],[122.2,-17.5],[121.6,-19],[118.5,-20.3],[114.6,-21.8]],
  [[144.6,-40.7],[148.3,-40.9],[148,-43.2],[146,-43.6],[144.7,-41.8]],
  [[172.7,-34.4],[174.3,-35.8],[175.9,-37.5],[178.5,-37.7],[177,-39.3],[176,-41.3],[174.6,-41.3],[175,-39.8],[173.8,-39.2],[174.6,-37],[173,-35.2]],
  [[172.7,-40.5],[174.2,-41.6],[173.3,-43.2],[171.2,-44.4],[169,-46.6],[166.5,-46],[168.3,-44],[170.8,-42.5]]
];
const WATER = [
  [[-95,60],[-85,55],[-79,52],[-80,58],[-77,62],[-88,64],[-94,62]],
  [[47,45],[50,46.5],[53,45],[51,42],[54,40.5],[53.5,37],[50,37],[49,40],[49.5,41.5]]
];
const inRing = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const isLand = (lon, lat) => LAND.some(r => inRing(r, lon, lat)) && !WATER.some(r => inRing(r, lon, lat));
const MAP = { top: 80, bot: -58, dots: null, w: 0 };
function drawMap() {
  const c = $("#mapC"); if (!c) return;
  const w = c.clientWidth, h = c.clientHeight, dpr = devicePixelRatio || 1; if (!w || !h) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const step = 4.4, latSpan = MAP.top - MAP.bot;
  if (!MAP.dots || MAP.w !== w) {
    MAP.w = w; MAP.dots = [];
    for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
      const lon = x / w * 360 - 180, lat = MAP.top - y / h * latSpan;
      if (isLand(lon, lat)) MAP.dots.push([x, y, lon, lat]);
    }
  }
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const fg = getComputedStyle($("#screen")).getPropertyValue("--fg").trim() || "#fff";
  const accent = getComputedStyle($("#screen")).getPropertyValue("--acc").trim() || "#ff6f91";
  const at = now() + R.shift * 60000, sp = sunPos(at);
  // the sun's glow where it's overhead
  const sLat = sp.dec / RAD, sLon = ((sp.ra / RAD - sp.gmst * 15 + 540) % 360) - 180;
  const gx = (sLon + 180) / 360 * w, gy = (MAP.top - sLat) / latSpan * h, g = x.createRadialGradient(gx, gy, 0, gx, gy, h * .9);
  g.addColorStop(0, "rgba(255,214,150,.22)"); g.addColorStop(1, "rgba(255,214,150,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = fg;
  MAP.dots.forEach(([px, py, lon, lat]) => {
    const alt = altFrom(sp, lat, lon);
    x.globalAlpha = alt > 0 ? .82 : alt > -12 ? .2 + (alt + 12) / 12 * .5 : .16;
    x.beginPath(); x.arc(px, py, 1.25, 0, TAU); x.fill();
  });
  x.globalAlpha = 1;
  const pin = (lon, lat, home, label) => {
    const px = (lon + 180) / 360 * w, py = (MAP.top - lat) / latSpan * h;
    x.fillStyle = home ? accent : fg; x.beginPath(); x.arc(px, py, home ? 3.4 : 2.6, 0, TAU); x.fill();
    if (home) { x.strokeStyle = accent; x.globalAlpha = .45; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 7, 0, TAU); x.stroke(); x.globalAlpha = 1; }
    else { x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1; x.stroke(); }
    if (label) { x.font = "650 9px -apple-system,system-ui,sans-serif"; x.fillStyle = fg; x.globalAlpha = .75; x.textAlign = px > w - 60 ? "right" : "left"; x.fillText(label, px + (px > w - 60 ? -6 : 6), py + 3); x.globalAlpha = 1; }
  };
  S.cities.forEach(ci => pin(ci.lon, ci.lat, false, ci.name));
  pin(HOME.lon, HOME.lat, true, "");
}
addEventListener("resize", () => { MAP.dots = null; drawMap(); });

/* ---------- time ruler + city rows with small analog clocks ---------- */
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
  const lim = 24 * 60, upd = () => { drawRuler(); renderWorld(); drawMap(); };
  el.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; el.setPointerCapture(e.pointerId); cancelAnimationFrame(anim); lastH = Math.floor(R.shift / 60); });
  el.addEventListener("pointermove", e => {
    if (!drag) return;
    R.shift = clamp(R.shift - (e.clientX - lx) / R.PX * 60, -lim, lim); lx = e.clientX;
    const hh = Math.floor(R.shift / 60); if (hh !== lastH) { tick(1.1); lastH = hh; }
    upd();
  });
  const end = () => {
    if (!drag) return; drag = false;
    const from = R.shift, to = Math.round(R.shift / 15) * 15, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 220), e2 = 1 - Math.pow(1 - k, 3); R.shift = from + (to - from) * e2; upd(); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", e => { e.preventDefault(); R.shift = clamp(R.shift + (e.deltaX || e.deltaY) * .6, -lim, lim); upd(); }, { passive: false });
  $("#tNow").onclick = () => { R.shift = 0; tick(); upd(); };
})();
function miniClock(h, m, top, bot, night) {
  const a = (h % 12 + m / 60) * 30, b = m * 6, c = night ? "rgba(255,255,255,.85)" : "#fff";
  return `<div class="mclk" style="background:linear-gradient(${top},${bot})"><svg viewBox="0 0 40 40"><line x1="20" y1="20" x2="20" y2="11.5" stroke="${c}" stroke-width="2.6" transform="rotate(${a} 20 20)"/><line x1="20" y1="20" x2="20" y2="7" stroke="${c}" stroke-width="1.8" transform="rotate(${b} 20 20)"/><circle cx="20" cy="20" r="1.8" fill="${c}"/></svg></div>`;
}
function renderWorld() {
  const n = now(), at = n + R.shift * 60000, sh = Math.round(R.shift);
  if (Math.abs(sh) < 1) { $("#tLabel").textContent = "Now"; $("#tDelta").textContent = "drag to plan across time zones"; $("#tNow").style.display = "none"; }
  else { $("#tLabel").textContent = (sh > 0 ? "+" : "−") + dur(Math.abs(sh) * 60000).replace("under a minute", "0 m"); $("#tDelta").textContent = hmA(new Date(at)) + " in Gliwice"; $("#tNow").style.display = "inline-block"; }
  const lkey = localKey(at), loff = -new Date(at).getTimezoneOffset();
  let h = "";
  S.cities.forEach(c => {
    const tz = c.tz;
    const p = tzParts(tz, at), hr = +p.hour % 24, mi = +p.minute, key = p.year + p.month + p.day;
    const diff = (tzOffsetMin(tz, at) - loff) / 60;
    const day = key === lkey ? "Today" : (key > lkey ? "Tomorrow" : "Yesterday");
    const ds = diff === 0 ? "same time" : (diff > 0 ? "+" : "−") + Math.abs(diff) + " h";
    const alt = sunAlt(at, c.lat, c.lon), [tp, bt] = skyFor(alt);
    const awake = hr >= 8 && hr < 22 ? (hr >= 9 && hr < 18 ? `<span class="pill">Work hours</span>` : `<span class="pill dim">Awake</span>`) : `<span class="pill amber">Asleep</span>`;
    h += `<div class="row">${miniClock(hr, mi, tp, bt, alt < 0)}<div class="tx"><b>${esc(c.name)}</b><span>${day}, ${ds} &nbsp;${awake}</span></div><div class="rt">${fmtHM(hr, mi)}${S.h24 ? "" : `<small>${apOf(hr)}</small>`}</div></div>`;
  });
  if (!S.cities.length) h = `<div class="empty">No cities yet. Tap Edit to add any city or town.</div>`;
  if ($("#world").innerHTML !== h) $("#world").innerHTML = h;
}
/* Search any city or town in the world (Open-Meteo geocoding: free, no account). Offline, it falls back to the built-in list. */
const cityKey = c => c.name + "|" + c.tz + "|" + Math.round(c.lat * 10) + "," + Math.round(c.lon * 10);
const cityTime = (tz, n) => { const p = tzParts(tz, n), hr = +p.hour % 24; return fmtHM(hr, +p.minute) + (S.h24 ? "" : `<small>${apOf(hr)}</small>`); };
async function findCities(q) {
  try {
    const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=20&language=en&format=json&name=" + encodeURIComponent(q), { cache: "no-store" });
    const d = await r.json();
    return (d.results || []).filter(x => x.timezone && validTz(x.timezone))
      .map(x => ({ name: x.name, sub: [x.admin1, x.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== x.name).join(", "), tz: x.timezone, lat: x.latitude, lon: x.longitude }));
  } catch (e) {
    const s = q.toLowerCase();
    return CITIES.filter(c => c.name.toLowerCase().includes(s)).map(c => Object.assign({ sub: c.tz.split("/").pop().replace(/_/g, " ") }, c));
  }
}
$("#editCities").onclick = () => {
  openSheet(nav("World clocks", "", "Done") + `<input class="field" id="cq" placeholder="Search any city or town" autocomplete="off" enterkeyhint="search">
    <div class="lab" id="clLab">Your cities</div><div class="cityl" id="cl"></div>`, () => {
    let seq = 0, timer = null;
    const mine = () => {
      const n = now();
      $("#clLab").textContent = "Your cities";
      $("#cl").innerHTML = S.cities.map((c, i) => `<div class="row" data-i="${i}"><div class="tx"><b>${esc(c.name)}</b><span>${esc(c.sub || c.tz.split("/").pop().replace(/_/g, " "))}</span></div><div class="rt" style="font-size:18px">${cityTime(c.tz, n)}</div>
        ${i ? `<button class="tpp" data-up title="Move up">↑</button>` : ""}<button class="xdel" data-x title="Remove">✕</button></div>`).join("")
        || `<div class="empty">Search above to add a city, town or village anywhere in the world.</div>`;
      $$("#cl .row").forEach(r => {
        const i = +r.dataset.i;
        r.querySelector("[data-x]").onclick = () => { S.cities.splice(i, 1); save(); tick(.8); mine(); renderWorld(); drawMap(); };
        const up = r.querySelector("[data-up]"); if (up) up.onclick = () => { const [c] = S.cities.splice(i, 1); S.cities.splice(i - 1, 0, c); save(); tick(); mine(); renderWorld(); };
      });
    };
    const results = list => {
      const n = now();
      $("#clLab").textContent = list.length ? "Results" : "No places found";
      $("#cl").innerHTML = list.map((c, i) => {
        const on = S.cities.some(x => cityKey(x) === cityKey(c));
        return `<div class="row" data-i="${i}"><div class="check ${on ? "on" : ""}">${on ? "✓" : ""}</div><div class="tx"><b>${esc(c.name)}</b><span>${esc(c.sub || "")}</span></div><div class="rt" style="font-size:18px">${cityTime(c.tz, n)}</div></div>`;
      }).join("");
      $$("#cl .row").forEach(r => r.onclick = () => {
        const c = list[r.dataset.i], k = S.cities.findIndex(x => cityKey(x) === cityKey(c));
        if (k >= 0) S.cities.splice(k, 1);
        else { if (S.cities.length >= 20) return toast("Up to 20 cities"); S.cities.push(c); toast(c.name + " added"); }
        save(); tick(); results(list); renderWorld(); drawMap();
      });
    };
    $("#cq").oninput = () => {
      clearTimeout(timer); const q = $("#cq").value.trim();
      if (q.length < 2) { seq++; mine(); return; }
      $("#clLab").textContent = "Searching…";
      timer = setTimeout(async () => { const my = ++seq, list = await findCities(q); if (my === seq) results(list); }, 280);
    };
    mine();
  });
};

/* ---------- alarms ---------- */
const NEXT = {}; let SNOOZES = [];
/* snoozes are saved so they survive Hora being closed */
function saveSnoozes() { try { localStorage.setItem("hora-snz", JSON.stringify(SNOOZES.map(s => ({ at: s.at, id: s.a.id, auto: s.auto || 0 })))); } catch (e) {} schedNative(); }
function addSnooze(s) { SNOOZES.push(s); saveSnoozes(); }
try { SNOOZES = JSON.parse(localStorage.getItem("hora-snz") || "[]").map(s => ({ at: s.at, a: S.alarms.find(a => a.id === s.id), auto: s.auto })).filter(s => s.a); } catch (e) { SNOOZES = []; }
const DAYN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const newAlarm = o => Object.assign({ id: Date.now(), h: 7, m: 0, label: "", days: [0,0,0,0,0,0,0], on: true, sound: "glass", gentle: true, snooze: 9, scene: "sunrise", vib: "pulse", ringFor: 10, after: "snooze" }, o);
function nextAt(a, from) {
  const b = new Date(from), any = a.days.some(Boolean);
  for (let d = 0; d < 8; d++) {
    const c = new Date(b.getFullYear(), b.getMonth(), b.getDate() + d, a.h, a.m, 0, 0);
    if (c.getTime() <= from) continue;
    if (!any || a.days[(c.getDay() + 6) % 7]) return c.getTime();
  }
  return null;
}
/* like nextAt, but steps over a ring the user chose to skip */
function nextRing(a, from) { let t = nextAt(a, from); if (t && a.skip && t === a.skip) t = nextAt(a, t + 1000); return t; }
function recalcAlarms() {
  const n = now();
  S.alarms.forEach(a => { if (a.skip && a.skip < n) a.skip = 0; NEXT[a.id] = a.on ? nextRing(a, n) : null; });
  BEDNEXT = bedtimes(n, 1)[0] || null;
  schedNative();
}
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
const ICN = {
  skip: `<svg viewBox="0 0 24 24"><path d="M5 5l10 7-10 7zM19 5v14"/></svg>`,
  del: `<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>`,
  moon: `<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0"/></svg>`
};
function renderAlarms() {
  const n = now(), nx = nextAlarm();
  $("#aNext").innerHTML = nx ? `<b>${nx.snoozed ? "Snoozed, rings again" : "Alarm"} in ${dur(nx.at - n)}</b><span>${esc(nx.a.label || "Alarm")} · ${whenDay(nx.at)} at ${hmA(new Date(nx.at))}</span>`
    : `<b>No alarms on</b><span>Tap + to add one</span>`;
  renderSleepCard();
  const list = S.alarms.filter(a => !a.sleep).sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
  let h = list.map(a => {
    const d = new Date(2000, 0, 1, a.h, a.m), rep = a.days.some(Boolean);
    const when = a.on && NEXT[a.id] ? "in " + dur(NEXT[a.id] - n) : "Off";
    const days = rep ? DAYN.map((x, i) => `<i class="${a.days[i] ? "on" : ""}">${x[0]}</i>`).join("") : `<span class="once">Once · ${a.on && NEXT[a.id] ? whenDay(NEXT[a.id]) : "not set"}</span>`;
    const skip = a.on && a.skip ? `<span class="pill amber">Skipping ${new Date(a.skip).toLocaleDateString("en-GB", { weekday: "short" })}</span>` : "";
    return `<div class="aw" data-id="${a.id}"><div class="acts">${rep && a.on ? `<button class="skipb" data-act="skip">${ICN.skip}${a.skip ? "Unskip" : "Skip next"}</button>` : ""}<button class="delb" data-act="del">${ICN.del}Delete</button></div>
      <div class="card alarm ${a.on ? "" : "off"}" data-sc="${a.scene || "sunrise"}${a.mv || ""}"><div class="vis"></div><div class="shade"></div>
      <div class="al-top"><div class="at">${hm(d)}${S.h24 ? "" : `<small>${ampm(d)}</small>`}</div><div class="sw-t ${a.on ? "on" : ""}" data-tg></div></div>
      <div class="al-mid"><b>${esc(a.label || "Alarm")}</b><span>${when} · ${esc(soundName(a.sound, a.fileName))}</span></div>
      <div class="al-days">${days}${skip}</div></div></div>`;
  }).join("");
  if (!list.length) h = `<div class="card empty">No alarms yet. Tap + to add one.</div>`;
  if ($("#alarmList").dataset.h === h) return;
  $("#alarmList").innerHTML = h; $("#alarmList").dataset.h = h;
  $$("#alarmList .aw").forEach(wrap => {
    const a = S.alarms.find(x => x.id == wrap.dataset.id), el = wrap.querySelector(".alarm");
    const open = wrap.querySelectorAll(".acts button").length * -84;
    SC.visual(el.querySelector(".vis"), a, { fps: 20, dpr: 1.5 });
    el.querySelector("[data-tg]").onclick = e => {
      e.stopPropagation(); a.on = !a.on; if (!a.on) a.skip = 0; save(); recalcAlarms(); tick(a.on ? 1.2 : .8);
      if (a.on) toast("Rings in " + dur(NEXT[a.id] - now())); renderAlarms();
    };
    // swipe left for Skip next and Delete
    let x0 = null, y0 = 0, dx = 0, base = 0, moved = false;
    el.onpointerdown = e => { x0 = e.clientX; y0 = e.clientY; moved = false; base = parseFloat(el.style.getPropertyValue("--dx")) || 0; };
    el.onpointermove = e => {
      if (x0 === null) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!moved && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { moved = true; el.classList.add("drag"); try { el.setPointerCapture(e.pointerId); } catch (_) {} closeSwipes(wrap); }
      if (moved) { dx = clamp(base + mx, open - 30, 0); el.style.setProperty("--dx", dx + "px"); }
    };
    el.onpointerup = el.onpointercancel = () => {
      if (x0 === null) return; x0 = null; el.classList.remove("drag");
      if (moved) { el.style.setProperty("--dx", (dx < open / 2 ? open : 0) + "px"); if (dx < open / 2) tick(1.1); }
    };
    el.onclick = e => { if (moved) { moved = false; return; } if (parseFloat(el.style.getPropertyValue("--dx"))) { el.style.setProperty("--dx", "0px"); return; } editAlarm(a); };
    wrap.querySelectorAll(".acts button").forEach(b => b.onclick = () => {
      if (b.dataset.act === "skip") {
        if (a.skip) { a.skip = 0; toast("Rings as usual"); }
        else { a.skip = nextAt(a, now()); toast("Skipping " + dayWord(a.skip) + " · next in " + dur(nextRing(a, now()) - now())); }
        save(); recalcAlarms(); tick(1.2); renderAlarms();
      } else deleteAlarm(a);
    });
  });
}
function closeSwipes(except) { $$("#alarmList .aw").forEach(w => { if (w !== except) w.querySelector(".alarm").style.setProperty("--dx", "0px"); }); }
function deleteAlarm(a) {
  const i = S.alarms.indexOf(a); if (i < 0) return;
  S.alarms.splice(i, 1); SNOOZES = SNOOZES.filter(s => s.a !== a); saveSnoozes(); save(); recalcAlarms(); tick(.8); renderAll();
  // the scene photo and sound are only removed once Undo has passed
  const t = setTimeout(() => { SC.media.del(a.id); SC.media.del("snd" + a.id); }, 4500);
  toast("Alarm deleted", "Undo", () => { clearTimeout(t); S.alarms.splice(i, 0, a); save(); recalcAlarms(); renderAll(); });
}
$("#addAlarm").onclick = () => editAlarm(null);

function editAlarm(src) {
  const isNew = !src, d = new Date(now() + 3600000);
  const a = src ? JSON.parse(JSON.stringify(src)) : newAlarm({ h: d.getHours(), m: 0 });
  if (!a.scene) a.scene = "sunrise"; if (!a.vib) a.vib = "pulse"; a.ringFor = a.ringFor || 10; a.after = a.after || "snooze";
  const tiles = Object.entries(SC.SCENES).map(([k, s]) => `<div class="tile ${a.scene === k ? "on" : ""}" data-k="${k}"><div class="vis" style="position:absolute;inset:0"></div><span>${s.name}</span></div>`).join("") +
    `<label class="tile add ${a.scene === "custom" ? "on" : ""}" data-k="custom"><div class="vis" style="position:absolute;inset:0"></div><div class="plus">＋</div><span>Your photo or video</span><input type="file" accept="image/*,video/*" id="eFile"></label>`;
  openSheet(nav(isNew ? "New alarm" : "Edit alarm", "Cancel", "Save") + `
    ${wheel([{ id: "wh", n: 24 }, ":", { id: "wm", n: 60 }])}
    <div class="inline" id="eIn">—</div>
    ${isNew ? `<div class="chips" style="margin-top:12px;justify-content:center">${[[10, "In 10 min"], [30, "30 min"], [60, "1 hour"], [480, "8 hours"]].map(([m, t]) => `<button class="ch" data-in="${m}">${t}</button>`).join("")}</div>` : ""}
    <div class="lab">Label</div><input class="field" id="eLabel" maxlength="30" placeholder="Alarm" value="${esc(a.label)}">
    <div class="lab">Repeat</div>
    <div class="days" id="eDays">${DAYN.map((x, i) => `<div class="d ${a.days[i] ? "on" : ""}" data-i="${i}">${x[0]}</div>`).join("")}</div>
    <div class="quick"><a data-q="wd">Weekdays</a><a data-q="we">Weekends</a><a data-q="all">Every day</a><a data-q="none">Once</a></div>
    <div class="lab">Wake-up scene</div>
    <div class="tiles" id="eTiles">${tiles}</div>
    <div class="lab">Sound</div>
    ${soundGrid(ALARM_SOUNDS, a.sound, a.fileName, "eSound")}
    <div class="lab">Vibration</div>
    <div class="chips" id="eVib">${Object.entries(VIBS).map(([k, v]) => `<button class="ch" data-v="${k}">${v.name}</button>`).join("")}</div>
    <div class="lab">Snooze</div>
    <div class="chips" id="eSnz">${[5, 9, 15].map(m => `<button class="ch" data-m="${m}">${m}<span>min</span></button>`).join("")}<button class="ch" data-m="c">Custom<span id="eSnzC"></span></button></div>
    <div class="snzc" id="eSnzBox"><button class="stp" data-d="-1" aria-label="Shorter">−</button><div class="snzv"><b id="eSnzV">${a.snooze}</b><span>minutes</span></div><button class="stp" data-d="1" aria-label="Longer">+</button>
      <input type="range" class="rng" id="eSnzR" min="1" max="60" step="1" value="${a.snooze}"></div>
    <div class="lab">If you don't answer</div>
    <div class="grp ifno">
      <div class="srow"><span>Ring for</span><div class="chips" id="eFor" style="margin:0;padding:0;flex:1;justify-content:flex-end">${[1, 3, 5, 10, 15, 30].map(m => `<button class="ch" data-m="${m}" style="height:30px;padding:0 10px">${m}<span>m</span></button>`).join("")}</div></div>
      <div class="srow"><span>Then</span><div class="seg" id="eAfter" style="width:170px"><div data-v="snooze">Snooze</div><div data-v="stop">Stop</div></div></div>
      <small id="eIfTxt"></small>
    </div>
    <div class="grp" style="margin-top:12px">
      <div class="srow"><div>Gentle wake<small>Starts quiet, louder over 30 seconds</small></div><div class="sw-t ${a.gentle ? "on" : ""}" id="eGentle"></div></div>
    </div>
    <div class="acts"><button class="btn ghost wide" id="eTest">Preview</button>${isNew ? "" : `<button class="btn danger wide" id="eDel">Delete</button>`}</div>
  `, () => {
    const inl = () => { const t = nextAt(a, now()); $("#eIn").innerHTML = t ? `Rings <b>${dayWord(t)}</b> at ${hmA(new Date(t))}, in <b>${dur(t - now())}</b>` : ""; };
    const setH = bindWheel("wh", a.h, v => { a.h = v; inl(); }), setM = bindWheel("wm", a.m, v => { a.m = v; inl(); });
    $$("[data-in]").forEach(b => b.onclick = () => { const t = new Date(now() + b.dataset.in * 60000); a.h = t.getHours(); a.m = t.getMinutes(); a.days = [0,0,0,0,0,0,0]; setH(a.h); setM(a.m); $$("#eDays .d").forEach(x => x.classList.remove("on")); tick(1.2); inl(); });
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
      $("#eTiles .tile.add .vis").dataset.v = ""; paintTiles(); tick(1.2);
      toast(kept ? (f.type.startsWith("video") ? "Video set for this alarm" : "Photo set for this alarm") : "Set for now, but this browser won't keep it after closing");
    };
    bindSoundGrid("eSound", "snd" + a.id, () => a, v => Object.assign(a, v));
    const paintVib = () => $$("#eVib .ch").forEach(x => x.classList.toggle("on", x.dataset.v === a.vib));
    $$("#eVib .ch").forEach(x => x.onclick = () => { a.vib = x.dataset.v; paintVib(); buzz(a.vib); tick(); });
    paintVib();
    let custom = ![5, 9, 15].includes(a.snooze);
    const paintIf = () => {
      $$("#eFor .ch").forEach(y => y.classList.toggle("on", +y.dataset.m === a.ringFor));
      $$("#eAfter div").forEach(y => y.classList.toggle("on", y.dataset.v === a.after));
      $("#eIfTxt").textContent = a.after === "snooze" ? `Rings for ${a.ringFor} min, then snoozes for ${a.snooze} min. After 3 unanswered snoozes it stops.` : `Rings for ${a.ringFor} min, then stops.`;
    };
    const paintSnz = () => {
      $$("#eSnz .ch").forEach(y => y.classList.toggle("on", y.dataset.m === "c" ? custom : !custom && +y.dataset.m === a.snooze));
      $("#eSnzC").textContent = custom ? " " + a.snooze + " min" : "";
      $("#eSnzBox").classList.toggle("show", custom);
      $("#eSnzV").textContent = a.snooze; $("#eSnzR").value = a.snooze;
      $("#eSnzR").style.setProperty("--p", ((a.snooze - 1) / 59 * 100) + "%"); paintIf();
    };
    $$("#eSnz .ch").forEach(x => x.onclick = () => {
      if (x.dataset.m === "c") { custom = true; if ([5, 9, 15].includes(a.snooze)) a.snooze = 12; } else { custom = false; a.snooze = +x.dataset.m; }
      tick(); paintSnz();
    });
    const nudge = dd => { const v = clamp(a.snooze + dd, 1, 60); if (v !== a.snooze) { a.snooze = v; tick(1.3); paintSnz(); } };
    $$("#eSnzBox .stp").forEach(b => {
      let rep = null;
      b.onpointerdown = () => { nudge(+b.dataset.d); rep = setTimeout(function r() { nudge(+b.dataset.d); rep = setTimeout(r, 70); }, 380); };
      b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearTimeout(rep);
    });
    $("#eSnzR").oninput = e => { a.snooze = +e.target.value; tick(1.3); paintSnz(); };
    $$("#eFor .ch").forEach(x => x.onclick = () => { a.ringFor = +x.dataset.m; tick(); paintIf(); });
    $$("#eAfter div").forEach(x => x.onclick = () => { a.after = x.dataset.v; tick(); paintIf(); });
    paintSnz();
    onSheetClose = stopFile;
    $("#eGentle").onclick = e => { a.gentle = !a.gentle; e.currentTarget.classList.toggle("on"); tick(); };
    $("#eTest").onclick = () => { a.label = $("#eLabel").value.trim(); closeSheet(); ring({ kind: "alarm", title: a.label || "Alarm", sub: "This is a preview", sound: a.sound, key: "snd" + a.id, gentle: a.gentle, vib: a.vib, a, preview: true }); };
    if ($("#eDel")) $("#eDel").onclick = () => { closeSheet(); deleteAlarm(S.alarms.find(x => x.id === a.id)); };
    $("#snR").onclick = () => {
      a.label = $("#eLabel").value.trim(); a.on = true; a.skip = 0;
      const i = S.alarms.findIndex(x => x.id === a.id); if (i >= 0) S.alarms[i] = a; else S.alarms.push(a);
      SNOOZES.forEach(s => { if (s.a.id === a.id) s.a = a; });
      save(); recalcAlarms(); closeSheet(); tick(1.2); toast("Rings in " + dur(NEXT[a.id] - now())); renderAll();
    };
    inl();
  });
}

/* ---------- sleep schedule: one dial sets the bedtime reminder and the wake-up alarm ---------- */
let BEDNEXT = null, BED = null;
const sleepMin = z => ((z.wake - z.bed + 1440) % 1440) || 1440;
/* upcoming bedtimes: worked back from each wake-up day, with the reminder time before it */
function bedtimes(from, count) {
  const z = S.sleep, out = []; if (!z.set || !z.on || !z.remind) return out;
  const w = { h: Math.floor(z.wake / 60), m: z.wake % 60, days: z.days.some(Boolean) ? z.days : [1,1,1,1,1,1,1] };
  let t = from;
  for (let i = 0; i < 10 && out.length < count; i++) {
    const wk = nextAt(w, t); if (!wk) break;
    const bed = wk - sleepMin(z) * 60000, rem = bed - z.remind * 60000;
    if (rem > from) out.push({ bed, rem, wake: wk });
    t = wk + 1000;
  }
  return out;
}
const sleepAlarm = () => S.alarms.find(a => a.id === SLEEP_ID);
/* the wake-up alarm is an ordinary alarm that the Sleep card manages */
function syncSleep() {
  const z = S.sleep; let a = sleepAlarm();
  if (!z.set) { if (a) S.alarms = S.alarms.filter(x => x !== a); return; }
  if (!a) { a = newAlarm({ id: SLEEP_ID, sleep: true, label: "Wake up", vib: "gentle" }); S.alarms.push(a); }
  Object.assign(a, { h: Math.floor(z.wake / 60), m: z.wake % 60, days: z.days.slice(), on: z.on && z.alarm, sound: z.sound, scene: z.scene, label: "Wake up", gentle: true });
}
const SUNI = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const MOONI = `<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;
function renderSleepCard() {
  const z = S.sleep, el = $("#sleepCard");
  let h;
  if (!z.set) h = `<div class="sleepc" id="sOpen"><div class="sic">${MOONI}</div><div class="tx"><b>Sleep schedule</b><span>A bedtime reminder and a gentle wake-up, set from one dial</span></div><button class="btn sm">Set up</button></div>`;
  else {
    const m = sleepMin(z), b = bedtimes(now(), 1)[0], a = sleepAlarm();
    const sub = !z.on ? "Off" : z.remind && b ? "Reminder " + dayWord(b.rem) + " at " + hmA(new Date(b.rem)) : a && NEXT[a.id] ? "Wake-up " + dayWord(NEXT[a.id]) : daysText(z);
    h = `<div class="sleepc" id="sOpen"><div class="sic">${MOONI}</div><div class="tx"><b>Sleep · ${hDur(m * 60000).replace(" 00 m", " h").replace(" h h", " h")}</b><span>${sub}</span></div><div class="sw-t ${z.on ? "on" : ""}" id="sTog"></div></div>
      <div class="sleeprow" style="${z.on ? "" : "opacity:.5"}"><div><span>${MOONI}Bedtime</span><b>${minTxt(z.bed)}</b></div><div><span>${SUNI.replace("<svg", '<svg style="fill:none;stroke:currentColor"')}Wake up</span><b>${minTxt(z.wake)}</b></div></div>`;
  }
  if (el.dataset.h === h) return;
  el.innerHTML = h; el.dataset.h = h;
  $("#sOpen").onclick = e => { if (e.target.closest("#sTog")) return; editSleep(); };
  if ($("#sTog")) $("#sTog").onclick = () => { z.on = !z.on; syncSleep(); save(); recalcAlarms(); tick(z.on ? 1.2 : .8); renderAlarms(); };
}
function editSleep() {
  const z = JSON.parse(JSON.stringify(S.sleep)), C = 2 * Math.PI * 118;
  const ang = mins => mins / 1440 * 360, pt = (deg, r) => [150 + Math.sin(deg * RAD) * r, 150 - Math.cos(deg * RAD) * r];
  let ticks = "";
  for (let i = 0; i < 24; i++) { const [x1, y1] = pt(i * 15, 96), [x2, y2] = pt(i * 15, i % 6 ? 99 : 101); ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--fg2)" stroke-width="${i % 6 ? 1 : 1.8}" stroke-linecap="round"/>`; }
  [[0, S.h24 ? "0" : "12AM"], [6, "6"], [12, S.h24 ? "12" : "12PM"], [18, S.h24 ? "18" : "6"]].forEach(([hh, t]) => { const [x, y] = pt(hh * 15, 82); ticks += `<text x="${x}" y="${y}" fill="var(--fg2)" font-size="12" font-weight="650" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,sans-serif">${t}</text>`; });
  const goals = [6, 7, 7.5, 8, 9];
  openSheet(nav("Sleep", "Cancel", "Save") + `
    <div class="sdial" id="sDial"><svg viewBox="0 0 300 300">
      <defs><linearGradient id="sGr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7cff"/><stop offset="1" stop-color="var(--acc)"/></linearGradient></defs>
      <circle cx="150" cy="150" r="118" fill="none" stroke="var(--card2)" stroke-width="30"/>${ticks}
      <circle id="sArc" cx="150" cy="150" r="118" fill="none" stroke="url(#sGr)" stroke-width="30" stroke-linecap="round"/>
      <g id="kBed"><circle r="13" fill="#1d1a44"/><g transform="translate(-7 -7) scale(.58)" fill="#e9e4ff">${MOONI.replace(/<\/?svg[^>]*>/g, "")}</g></g>
      <g id="kWake"><circle r="13" fill="#3b2410"/><g transform="translate(-7 -7) scale(.58)" fill="none" stroke="#ffcc5c" style="color:#ffcc5c">${SUNI.replace(/<\/?svg[^>]*>/g, "")}</g></g>
    </svg><div class="ctr"><b id="sDur">8 h</b><span id="sGoal"></span></div></div>
    <div class="sleeprow" style="margin:6px 0 4px"><div><span>${MOONI}Bedtime</span><b id="sBed">—</b></div><div><span>${SUNI.replace("<svg", '<svg style="fill:none;stroke:currentColor"')}Wake up</span><b id="sWake">—</b></div></div>
    <div class="lab">Wake-up days</div>
    <div class="days" id="sDays">${DAYN.map((x, i) => `<div class="d ${z.days[i] ? "on" : ""}" data-i="${i}">${x[0]}</div>`).join("")}</div>
    <div class="lab">Sleep goal</div>
    <div class="chips" id="sGoals">${goals.map(g => `<button class="ch" data-g="${g}">${String(g).replace(".5", "½")} h</button>`).join("")}</div>
    <div class="lab">Bedtime reminder</div>
    <div class="chips" id="sRem">${[0, 15, 30, 45, 60].map(m => `<button class="ch" data-m="${m}">${m ? m + " min before" : "Off"}</button>`).join("")}</div>
    <div class="lab">Wake between sleep cycles</div>
    <div class="cycles" id="sCyc"></div>
    <div style="font-size:11.5px;color:var(--fg2);margin:8px 4px 0;line-height:1.45">Tap one to use it as your bedtime. A cycle is about 90 minutes on average, plus 15 minutes to fall asleep. Yours may differ.</div>
    <div class="grp" style="margin-top:18px"><div class="srow"><div>Wake-up alarm<small>Rings gently, with its own scene and sound</small></div><div class="sw-t ${z.alarm ? "on" : ""}" id="sAl"></div></div></div>
    <div id="sAlBox">
      <div class="lab">Wake-up sound</div>${soundGrid(ALARM_SOUNDS, z.sound, "", "sSnd", true)}
      <div class="lab">Wake-up scene</div><div class="chips" id="sScn">${Object.entries(SC.SCENES).map(([k, s]) => `<button class="ch" data-k="${k}">${s.name}</button>`).join("")}</div>
    </div>
    ${S.sleep.set ? `<div class="acts"><button class="btn danger wide" id="sOff">Remove sleep schedule</button></div>` : ""}
  `, () => {
    const paint = () => {
      const m = sleepMin(z), a0 = ang(z.bed);
      $("#sArc").setAttribute("stroke-dasharray", `${(m / 1440 * C).toFixed(1)} ${C}`);
      $("#sArc").setAttribute("transform", `rotate(${a0 - 90} 150 150)`);
      const [bx, by] = pt(a0, 118), [wx, wy] = pt(ang(z.wake), 118);
      $("#kBed").setAttribute("transform", `translate(${bx} ${by})`); $("#kWake").setAttribute("transform", `translate(${wx} ${wy})`);
      $("#sDur").textContent = Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " m" : "");
      const g = z.goal * 60, ok = m >= g;
      $("#sGoal").textContent = ok ? "Meets your " + String(z.goal).replace(".5", "½") + " h goal" : Math.round((g - m)) + " min under your goal";
      $("#sGoal").className = ok ? "ok" : "";
      $("#sBed").textContent = minTxt(z.bed); $("#sWake").textContent = minTxt(z.wake);
      $$("#sGoals .ch").forEach(x => x.classList.toggle("on", +x.dataset.g === z.goal));
      $$("#sRem .ch").forEach(x => x.classList.toggle("on", +x.dataset.m === z.remind));
      $$("#sScn .ch").forEach(x => x.classList.toggle("on", x.dataset.k === z.scene));
      $("#sAlBox").style.display = z.alarm ? "" : "none";
      $("#sCyc").innerHTML = [6, 5, 4].map(c => { const b = (z.wake - c * 90 - 15 + 2880) % 1440; return `<button class="cyc ${b === z.bed ? "best" : ""}" data-b="${b}"><b>${minTxt(b)}</b><span>${c} cycles · ${String(c * 1.5).replace(".5", "½")} h</span></button>`; }).join("");
      $$("#sCyc .cyc").forEach(x => x.onclick = () => { z.bed = +x.dataset.b; tick(1.2); paint(); });
    };
    // drag either end, or the arc itself to move both
    const svg = $("#sDial svg"); let mode = null, last = 0;
    const minsAt = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 300 - 150, y = (e.clientY - r.top) / r.height * 300 - 150; return { m: ((Math.atan2(x, -y) / RAD + 360) % 360) / 360 * 1440, d: Math.hypot(x, y) }; };
    const near = (m, t) => Math.min(Math.abs(m - t), 1440 - Math.abs(m - t));
    svg.addEventListener("pointerdown", e => {
      const p = minsAt(e); if (p.d < 90 || p.d > 150) return;
      const nb = near(p.m, z.bed), nw = near(p.m, z.wake);
      if (Math.min(nb, nw) < 50) mode = nb < nw ? "bed" : "wake";
      else if ((p.m - z.bed + 1440) % 1440 < sleepMin(z)) mode = "both";
      else return;
      last = p.m; svg.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener("pointermove", e => {
      if (!mode) return;
      const p = minsAt(e), snap = v => ((Math.round(v / 5) * 5) % 1440 + 1440) % 1440;
      if (mode === "both") { let dlt = p.m - last; if (dlt > 720) dlt -= 1440; if (dlt < -720) dlt += 1440; const s = Math.round(dlt / 5) * 5; if (s) { z.bed = snap(z.bed + s); z.wake = snap(z.wake + s); last += s; tick(); } }
      else { const v = snap(p.m); if (v !== z[mode] && v !== z[mode === "bed" ? "wake" : "bed"]) { z[mode] = v; tick(v % 60 ? 1 : 1.3); } }
      paint();
    });
    const end = () => { mode = null; };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    $$("#sDays .d").forEach(x => x.onclick = () => { z.days[x.dataset.i] = z.days[x.dataset.i] ? 0 : 1; x.classList.toggle("on"); tick(); });
    $$("#sGoals .ch").forEach(x => x.onclick = () => { z.goal = +x.dataset.g; tick(); paint(); });
    $$("#sRem .ch").forEach(x => x.onclick = () => { z.remind = +x.dataset.m; tick(); paint(); });
    $$("#sScn .ch").forEach(x => x.onclick = () => { z.scene = x.dataset.k; tick(); paint(); });
    $("#sAl").onclick = e => { z.alarm = !z.alarm; e.currentTarget.classList.toggle("on"); tick(); paint(); };
    bindSoundGrid("sSnd", "", () => z, v => Object.assign(z, v));
    onSheetClose = stopFile;
    if ($("#sOff")) $("#sOff").onclick = () => { S.sleep.set = false; syncSleep(); save(); recalcAlarms(); closeSheet(); toast("Sleep schedule removed"); renderAll(); };
    $("#snR").onclick = () => {
      if (!z.days.some(Boolean)) z.days = [1,1,1,1,1,1,1];
      const first = !S.sleep.set;
      S.sleep = Object.assign(z, { set: true, on: first ? true : z.on }); syncSleep(); save(); recalcAlarms(); closeSheet(); tick(1.2);
      const b = bedtimes(now(), 1)[0];
      toast(b ? "Reminder " + dayWord(b.rem) + " at " + hmA(new Date(b.rem)) : "Sleep schedule saved"); renderAll();
    };
    paint();
  });
}

/* ---------- ringing ---------- */
let RING = null, ringIv = null, ringStart = 0, QUEUE = [], ringAuto = null;
function soundLoop(o) {
  // tell Android an alarm is ringing: keep the screen on, raise the volume, and report whether sound really started
  if (NATIVE) setTimeout(() => { if (RING === o) try { NAT.ringing(true, o.sound === "custom" ? !!(AUD && !AUD.paused) : !!(AC && AC.state === "running")); } catch (e) {} }, 900);
  const own = o.sound === "custom", key = own ? "glass" : o.sound;
  const vol = () => o.gentle ? Math.min(1, .12 + (Date.now() - ringStart) / 30000) : .9;
  const vib = o.vib || "pulse", vlen = vibLen(vib);
  let lastV = 0;
  const shake = () => { if (vlen && Date.now() - lastV >= vlen) { buzz(vib); lastV = Date.now(); } };
  // Schedule each phrase on the audio clock so the loop is seamless instead of drifting with timers.
  const synth = () => {
    const a = ac(); if (!a) return;
    let at = a.currentTime + .05;
    const per = loopPeriod(key);
    const pump = () => { while (at < a.currentTime + .6) { playSound(key, vol(), at); at += per; } shake(); };
    pump(); ringIv = setInterval(pump, 150);
  };
  if (own) {
    playFile(o.key, vol(), true).then(ok => {
      if (RING !== o) { stopFile(); return; }
      if (!ok) { synth(); return; }
      ringIv = setInterval(() => { if (AUD) AUD.volume = clamp(vol(), 0, 1); shake(); }, 150);
    });
  } else synth();
  const lim = o.kind === "timer" ? 60000 * (S.timerRingFor || 2) : o.preview ? 15000 : (o.a.ringFor || 10) * 60000;
  o.endsAt = Date.now() + lim;
  ringAuto = setTimeout(() => { if (RING === o) autoEnd(o); }, lim);
  if (document.hidden && S.notify && "Notification" in window && Notification.permission === "granted") { try { new Notification("Hora · " + o.title, { body: o.sub || "", icon: "icons/icon.svg" }); } catch (e) {} }
}
function autoEnd(o) {
  if (o.kind === "alarm" && !o.preview && (o.a.after || "snooze") === "snooze" && (o.auto || 0) < 3) {
    addSnooze({ at: now() + o.a.snooze * 60000, a: o.a, auto: (o.auto || 0) + 1 });
    stopRing(); toast("No answer, snoozed for " + o.a.snooze + " min");
  } else stopRing();
}
function ring(o) {
  if (RING) { QUEUE.push(o); return; }
  RING = o; ringStart = Date.now();
  if (o.kind === "timer") { soundLoop(o); ISL.open = true; renderIsland(); return; }
  $("#rK").textContent = o.preview ? "Alarm preview" : o.auto ? "Alarm · snoozed " + o.auto + "×" : o.a.sleep ? "Good morning" : "Alarm";
  ringTime(); renderWx();
  $("#rL").textContent = o.title; $("#rS").textContent = o.sub || "";
  $("#rB").innerHTML = `<div class="slide" id="rSlide"><div class="chev"><i></i><i></i><i></i></div><span>Slide up to stop</span></div>
    <button class="snz" id="rA"><svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>Snooze · ${o.a.snooze} min</button>
    <div class="rauto" id="rAuto"></div>`;
  const R0 = $("#ring"); R0.classList.add("show"); R0.style.setProperty("--up", 0);
  SC.visual($("#rVis"), o.a, { fps: 50, dpr: 2 });
  soundLoop(o);
  $("#rA").onclick = e => {
    e.stopPropagation();
    if (!o.preview) { addSnooze({ at: now() + o.a.snooze * 60000, a: o.a }); toast("Snoozed until " + hmA(new Date(now() + o.a.snooze * 60000))); }
    tick(.9); stopRing();
  };
  // slide up anywhere above the snooze button
  let y0 = null, up = 0;
  const H = () => R0.clientHeight || 700;
  R0.onpointerdown = e => { if (e.target.closest("#rA")) return; y0 = e.clientY; up = 0; R0.classList.add("drag"); try { R0.setPointerCapture(e.pointerId); } catch (_) {} };
  R0.onpointermove = e => { if (y0 === null) return; up = clamp((y0 - e.clientY) / H(), 0, 1); R0.style.setProperty("--up", up.toFixed(3)); };
  R0.onpointerup = R0.onpointercancel = () => {
    if (y0 === null) return; y0 = null; R0.classList.remove("drag");
    if (up > .28) {
      R0.style.setProperty("--up", 1); tick(1.4);
      setTimeout(() => { stopRing(); if (!o.preview) { const w = wxNow(); toast(w ? "Good morning · " + w.temp + " and " + w.name.toLowerCase() : "Good morning"); } }, 260);
    } else R0.style.setProperty("--up", 0);
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
  if (NATIVE) try { NAT.ringing(false, true); } catch (e) {}
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
  if (BED && Date.now() < BED.until) return { k: "bed", label: "Bedtime at " + hmA(new Date(BED.bed)), full: "Time to wind down", sub: "Bedtime at " + hmA(new Date(BED.bed)) + " · wake up " + hmA(new Date(BED.wake)), t: "in " + Math.max(0, Math.ceil((BED.bed - now()) / 60000)) + "m", p: 1 };
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
  if (ISL.open && d.k !== "alert" && d.k !== "bed" && Date.now() > ISL.until) ISL.open = false;
  el.className = "island act" + (ISL.open ? " open" : "") + (d.k === "alert" || d.k === "bed" ? " alert" : "") + (d.k === "sw" ? " sw" : "") + (d.k === "bed" ? " bed" : "");
  const arc = `${(CI * clamp(d.p, 0, 1)).toFixed(2)} ${CI}`;
  $("#iArc").setAttribute("stroke-dasharray", arc); $("#xArc").setAttribute("stroke-dasharray", arc);
  $("#iL").textContent = d.k === "alert" ? "Done" : d.label; $("#iT").textContent = d.t;
  $("#xL").textContent = d.k === "alert" ? d.label : d.full; $("#xS").textContent = d.sub; $("#xT").textContent = d.t;
  $("#xP").style.width = (d.k === "sw" || d.k === "bed" ? d.p : 1 - d.p) * 100 + "%";
  document.title = d.k === "alert" ? "Done · " + d.label : d.k === "bed" ? "Bedtime · Hora" : d.t + " · " + d.full;
  const play = `<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>`, pause = `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
  const sig = d.k + (d.run ? 1 : 0) + W.run;
  if (sig !== ISL.sig) {
    ISL.sig = sig;
    $("#xB").innerHTML = d.k === "alert" ? `<button class="xb" data-a="plus">+1 min</button><button class="xb" data-a="again">Restart</button><button class="xb or" data-a="stop">Stop</button>`
      : d.k === "bed" ? `<button class="xb" data-a="bedlater">In 15 min</button><button class="xb or" data-a="bedok">Got it</button>`
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
      if ((a === "plus" || a === "again") && t) { const ms = a === "plus" ? 60000 : t.orig || t.total; t.done = false; t.run = true; t.total = ms; t.endAt = now() + ms; S.focus = t.id; }
      if (a === "stop") { S.timers = S.timers.filter(x => x.id !== RING.tid); if (S.focus === RING.tid) S.focus = null; }
      save(); tick(1.2); stopRing(); return;
    }
    if (d.k === "bed") {
      if (a === "bedlater") { BED.until = 0; const later = Object.assign({}, BED); setTimeout(() => { if (!BED || BED.until === 0) { BED = Object.assign(later, { until: Date.now() + 10 * 60000 }); ISL.open = true; renderIsland(); } }, 15 * 60000); }
      BED = null; ISL.open = false; tick(); renderIsland(); return;
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
  else if (d.k !== "alert" && d.k !== "bed") {
    ISL.open = false;
    if (e.target.closest(".xtop")) { if (d.id) S.focus = d.id; go(d.k === "sw" ? "vWatch" : "vTimer"); }
  }
  renderIsland();
};

/* ---------- timers ---------- */
const C1 = 2 * Math.PI * 124;
const PLAY = `<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>`, PAUSE = `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const shortDur = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? h + ":" + pad(m) + (ss ? ":" + pad(ss) : "") : ss ? m + ":" + pad(ss) : m + " min"; };
(function buildDial() {
  let h = "";
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * RAD, big = i % 5 === 0, r1 = big ? 100 : 104, r2 = 109;
    h += `<line class="dtick" x1="${150 + Math.sin(a) * r1}" y1="${150 - Math.cos(a) * r1}" x2="${150 + Math.sin(a) * r2}" y2="${150 - Math.cos(a) * r2}" stroke-width="${big ? 1.6 : 1}" opacity="${big ? .8 : .35}"/>`;
  }
  [0, 15, 30, 45].forEach(m => { const a = m * 6 * RAD; h += `<text x="${150 + Math.sin(a) * 87}" y="${150 - Math.cos(a) * 87}" fill="var(--fg2)" font-size="11" font-weight="600" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,sans-serif">${m}</text>`; });
  $("#dTicks").innerHTML = h;
})();
function renderPresets() {
  const h = S.presets.map((p, i) => `<button class="pre" data-i="${i}"><b>${shortDur(p.ms).replace(" min", "")}</b><span>${esc(p.l)}${p.ms % 60000 || p.ms >= 3600000 ? "" : " · min"}</span></button>`).join("") + `<button class="pre add" id="preAdd" title="Save the current time as a preset">＋</button>`;
  if ($("#presets").dataset.h === h) return;
  $("#presets").innerHTML = h; $("#presets").dataset.h = h;
  $$("#presets .pre[data-i]").forEach(b => b.onclick = () => { const p = S.presets[b.dataset.i]; S.setMs = p.ms; S.setLabel = p.l; S.focus = null; startTimer(); });
  $("#preAdd").onclick = addPreset;
}
function addPreset() {
  const ms = S.setMs || 300000, l = S.setLabel && S.setLabel !== "Timer" ? S.setLabel : "Timer";
  if (S.presets.length >= 12) { toast("Up to 12 presets. Edit to remove one."); return; }
  S.presets.push({ l, ms }); save(); tick(1.2); renderPresets(); toast("Saved " + shortDur(ms) + " as a preset");
}
$("#editPresets").onclick = () => {
  const P = JSON.parse(JSON.stringify(S.presets));
  const body = () => P.map((p, i) => `<div class="row" data-i="${i}"><input class="field" value="${esc(p.l)}" maxlength="16" data-n><div class="stepper"><button data-d="-1">−</button><b>${shortDur(p.ms)}</b><button data-d="1">+</button></div><button class="xdel" data-x>✕</button></div>`).join("") || `<div class="empty">No presets. Tap Add.</div>`;
  openSheet(nav("Presets", "Cancel", "Done") + `<div class="kind" style="text-align:center">Rename them, change their length, or remove ones you don't use</div><div class="pedit" id="pList"></div><div class="acts"><button class="btn ghost wide" id="pAdd">Add preset</button><button class="btn ghost" id="pReset">Reset</button></div>`, () => {
    const draw = () => {
      $("#pList").innerHTML = body();
      $$("#pList .row").forEach(r => {
        const p = P[r.dataset.i];
        r.querySelector("[data-n]").oninput = e => p.l = e.target.value.trim() || "Timer";
        r.querySelectorAll("[data-d]").forEach(b => b.onclick = () => {
          const m = p.ms / 60000, st = m < 10 ? 1 : m < 60 ? 5 : 15, nm = clamp(Math.round(m) + st * b.dataset.d, 1, 600);
          p.ms = nm * 60000; r.querySelector(".stepper b").textContent = shortDur(p.ms); tick();
        });
        r.querySelector("[data-x]").onclick = () => { P.splice(r.dataset.i, 1); tick(.8); draw(); };
      });
    };
    draw();
    $("#pAdd").onclick = () => { if (P.length >= 12) return toast("Up to 12 presets"); P.push({ l: "Timer", ms: 5 * 60000 }); tick(); draw(); };
    $("#pReset").onclick = () => { P.splice(0, P.length, ...JSON.parse(JSON.stringify(PRESETS0))); tick(); draw(); };
    $("#snR").onclick = () => { S.presets = P; save(); closeSheet(); renderPresets(); };
  });
};
const tRem = t => t.run ? Math.max(0, t.endAt - now()) : t.left;
const focused = () => S.timers.find(t => t.id === S.focus && !t.done);
function startTimer() {
  if (S.setMs < 1000) { toast("Drag the ring to set a time"); return; }
  const t = { id: Date.now(), label: S.setLabel || "Timer", total: S.setMs, orig: S.setMs, left: S.setMs, endAt: now() + S.setMs, run: true, done: false };
  S.timers.push(t); S.focus = t.id; S.setLabel = "Timer"; save(); tick(1.3); ISL.open = true; ISL.until = Date.now() + 2800;
  toast(t.label + " · ends " + hmA(new Date(t.endAt))); renderAll();
}
/* exact time: hours, minutes and seconds wheels, plus a name */
function timerWheel() {
  const s0 = Math.round(S.setMs / 1000); let H = Math.floor(s0 / 3600), M = Math.floor(s0 % 3600 / 60), Sx = s0 % 60, name = S.setLabel === "Timer" ? "" : S.setLabel;
  openSheet(nav("New timer", "Cancel", "Start") + wheel([{ id: "th", n: 24, unit: "h" }, { id: "tm", n: 60, unit: "m" }, { id: "ts", n: 60, unit: "s" }]) +
    `<div class="inline" id="tIn"></div><div class="lab">Name</div><input class="field" id="tNm" maxlength="24" placeholder="Timer" value="${esc(name)}">
     <div class="lab">Quick names</div><div class="chips">${["Tea", "Oven", "Laundry", "Workout", "Study", "Parking"].map(x => `<button class="ch" data-q="${x}">${x}</button>`).join("")}</div>
     <div class="acts"><button class="btn ghost wide" id="tSave">Save as preset</button></div>`, () => {
    const upd = () => { const ms = ((H * 60 + M) * 60 + Sx) * 1000; $("#tIn").innerHTML = ms ? `Ends at <b>${hmA(new Date(now() + ms))}</b>` : "Pick a length"; return ms; };
    bindWheel("th", H, v => { H = v; upd(); }); bindWheel("tm", M, v => { M = v; upd(); }); bindWheel("ts", Sx, v => { Sx = v; upd(); });
    $$("[data-q]").forEach(b => b.onclick = () => { $("#tNm").value = b.dataset.q; tick(); });
    const take = () => { const ms = upd(); S.setMs = ms; S.setLabel = $("#tNm").value.trim() || "Timer"; return ms; };
    $("#tSave").onclick = () => { if (!take()) return toast("Pick a length first"); closeSheet(); addPreset(); };
    $("#snR").onclick = () => { if (!take()) return toast("Pick a length first"); S.focus = null; closeSheet(); startTimer(); };
    upd();
  });
}
$("#dBig").onclick = () => { if (!focused()) timerWheel(); };
$("#dEdit").onclick = () => { if (!focused()) timerWheel(); };
$("#tName").onclick = () => {
  const f = focused();
  openSheet(nav("Timer name", "Cancel", "Done") + `<input class="field" id="tNm2" maxlength="24" placeholder="Timer" value="${esc(f ? f.label : S.setLabel === "Timer" ? "" : S.setLabel)}"><div class="chips wrap" style="margin-top:12px">${["Tea", "Oven", "Laundry", "Workout", "Study", "Parking", "Nap"].map(x => `<button class="ch" data-q="${x}">${x}</button>`).join("")}</div>`, () => {
    const inp = $("#tNm2"); inp.focus();
    $$("[data-q]").forEach(b => b.onclick = () => { inp.value = b.dataset.q; tick(); });
    $("#snR").onclick = () => { const v = inp.value.trim() || "Timer", ff = focused(); if (ff) ff.label = v; else S.setLabel = v; save(); closeSheet(); renderAll(); };
  });
};
function renderTimer() {
  const f = focused(), n = now();
  $("#newTimer").style.display = f ? "grid" : "none";
  let p, big, lbl, k = $("#dKnob");
  if (f) {
    const r = tRem(f); p = f.total ? r / f.total : 0; big = clk(r);
    lbl = f.run ? `Ends at <b>${hmA(new Date(f.endAt))}</b>` : `<b>Paused</b>`;
    k.style.display = "none"; $("#dEdit").style.display = "none";
    $("#timerSub").textContent = f.label + " · " + (f.run ? "set for " + dur(f.total) : "paused");
  } else {
    const mins = S.setMs / 60000; p = (mins % 60) / 60 || (mins >= 60 ? 1 : 0); big = clk(S.setMs);
    lbl = S.setMs ? `Would end at <b>${hmA(new Date(n + S.setMs))}</b>` : "Drag the ring";
    k.style.display = ""; $("#dEdit").style.display = "";
    const a = (mins % 60) * 6 * RAD; k.setAttribute("cx", 150 + Math.sin(a) * 124); k.setAttribute("cy", 150 - Math.cos(a) * 124);
    $("#timerSub").textContent = mins >= 60 ? "Each full turn of the ring is an hour" : "Drag the ring, tap the time, or pick a preset";
  }
  $("#tNameV").textContent = f ? f.label : S.setLabel || "Timer";
  const arc = $("#dArc"); arc.setAttribute("stroke-dasharray", `${(C1 * clamp(p, 0, 1)).toFixed(1)} ${C1}`);
  arc.classList.toggle("lap2", !f && S.setMs >= 3600000); arc.classList.toggle("paused", !!f && !f.run);
  $("#dBig").textContent = big; if ($("#dLbl").innerHTML !== lbl) $("#dLbl").innerHTML = lbl;
  const ctl = f
    ? `<button class="cbtn" id="tC">Cancel</button><button class="btn ghost sm" id="tP1">+1 min</button><button class="cbtn ${f.run ? "paused" : "acc"}" id="tP">${f.run ? "Pause" : "Resume"}</button>`
    : `<button class="cbtn" id="tClr" ${S.setMs ? "" : "disabled"}>Clear</button><span></span><button class="cbtn acc" id="tGo" ${S.setMs ? "" : "disabled"}>Start</button>`;
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
  // running list
  const list = S.timers.filter(t => !t.done);
  $("#tListCard").style.display = list.length > (f ? 1 : 0) ? "" : "none";
  $("#tAll").textContent = list.some(t => t.run) ? "Pause all" : "Resume all";
  const lh = list.map(t => {
    const r = tRem(t), pp = t.total ? r / t.total : 0, c = 2 * Math.PI * 13;
    return `<div class="row trow ${t.id === S.focus ? "foc" : ""}" data-id="${t.id}"><svg class="mini" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" stroke="var(--card2)"/><circle cx="17" cy="17" r="13" stroke="${t.run ? "var(--acc)" : "var(--warn)"}" stroke-linecap="round" stroke-dasharray="${(c * pp).toFixed(1)} ${c}" transform="rotate(-90 17 17)"/></svg>
      <div class="tx"><b>${esc(t.label)}</b><span>${t.run ? "Ends " + hmA(new Date(t.endAt)) : "Paused"}</span></div><div class="rt" style="font-size:21px">${clk(r)}</div><button class="tpp" data-pp>${t.run ? PAUSE : PLAY}</button></div>`;
  }).join("");
  if ($("#tList").dataset.h !== lh) {
    $("#tList").innerHTML = lh; $("#tList").dataset.h = lh;
    $$("#tList .trow").forEach(r => {
      r.onclick = () => { S.focus = +r.dataset.id; save(); tick(); renderTimer(); };
      r.querySelector("[data-pp]").onclick = e => { e.stopPropagation(); const t = S.timers.find(x => x.id === +r.dataset.id); if (t) { pauseT(t, t.run); save(); tick(); renderAll(); } };
    });
  }
  renderPresets();
}
function pauseT(t, pause) { if (pause && t.run) { t.left = tRem(t); t.run = false; } else if (!pause && !t.run) { t.endAt = now() + t.left; t.run = true; } }
$("#tAll").onclick = () => { const list = S.timers.filter(t => !t.done), any = list.some(t => t.run); list.forEach(t => pauseT(t, any)); save(); tick(); renderAll(); toast(any ? "All timers paused" : "All timers running"); };
function toggleFocused() { const f = focused(); if (!f) return; pauseT(f, f.run); save(); tick(); renderAll(); }
$("#newTimer").onclick = () => { S.focus = null; S.setMs = S.setMs || 300000; save(); tick(); renderTimer(); };
const paintTSnd = () => $("#tSndN").textContent = soundName(S.timerSound, S.timerFile);
$("#tSnd").onclick = () => {
  openSheet(nav("When it ends", "", "Done") + `<div class="kind" style="text-align:center">Plays when any timer ends. Tap to hear it.</div>${soundGrid(TIMER_SOUNDS, S.timerSound, S.timerFile, "tSndG")}
    <div class="lab">Keep ringing for</div><div class="chips" id="tFor">${[1, 2, 5, 10].map(m => `<button class="ch" data-m="${m}">${m}<span>min</span></button>`).join("")}</div>`, () => {
    bindSoundGrid("tSndG", "sndtimer", () => ({ sound: S.timerSound, fileName: S.timerFile }), v => { if (v.sound) S.timerSound = v.sound; if (v.fileName) S.timerFile = v.fileName; save(); paintTSnd(); });
    const pf = () => $$("#tFor .ch").forEach(x => x.classList.toggle("on", +x.dataset.m === S.timerRingFor));
    $$("#tFor .ch").forEach(x => x.onclick = () => { S.timerRingFor = +x.dataset.m; save(); tick(); pf(); }); pf();
  });
  onSheetClose = stopFile;
};
paintTSnd();
(function dialInput() {
  const svg = $("#dial"); let drag = false, lastA = 0, acc = 0, lastMin = 0;
  const ang = e => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) / RAD; };
  const dist = e => { const r = svg.getBoundingClientRect(); return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / r.width * 300; };
  svg.addEventListener("pointerdown", e => {
    if (focused() || dist(e) < 95) return;   // the middle is for tapping the time
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

/* ---------- stopwatch: analog face with a minute sub-dial, or big digits ---------- */
const W = S.watch;
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
  const P = (cx, cy, a, r) => [cx + Math.sin(a * RAD) * r, cy - Math.cos(a * RAD) * r];
  let h = `<circle cx="150" cy="150" r="146" fill="rgba(255,255,255,.04)" stroke="var(--stroke)"/>`;
  for (let i = 0; i < 240; i++) {
    const a = i * 1.5, five = i % 20 === 0, sec = i % 4 === 0, [x1, y1] = P(150, 150, a, five ? 124 : sec ? 130 : 134), [x2, y2] = P(150, 150, a, 140);
    h += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--fg)" stroke-width="${five ? 2 : sec ? 1.2 : .7}" opacity="${five ? .95 : sec ? .55 : .25}" stroke-linecap="round"/>`;
  }
  for (let s = 5; s <= 60; s += 5) { const [x, y] = P(150, 150, s * 6, 110); h += `<text class="num" x="${x}" y="${y}">${s}</text>`; }
  // minute sub-dial, 0 to 30
  h += `<circle cx="150" cy="96" r="30" fill="none" stroke="var(--stroke)"/>`;
  for (let m = 0; m < 30; m++) { const [x1, y1] = P(150, 96, m * 12, m % 5 ? 26 : 23), [x2, y2] = P(150, 96, m * 12, 28); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--fg)" stroke-width="${m % 5 ? .7 : 1.3}" opacity="${m % 5 ? .4 : .85}"/>`; }
  [[30, 0], [10, 120], [20, 240]].forEach(([n, a]) => { const [x, y] = P(150, 96, a, 16); h += `<text class="snum" x="${x}" y="${y}">${n}</text>`; });
  h += `<line id="swMin" class="hand" x1="150" y1="100" x2="150" y2="72" stroke="var(--acc)" stroke-width="2"/><circle cx="150" cy="96" r="2.5" fill="var(--acc)"/>
    <text id="swTxt" x="150" y="200" fill="var(--fg)" font-family="SF Mono, ui-monospace, Menlo, monospace" font-size="21" text-anchor="middle">0:00.00</text>
    <line id="swLapH" class="hand" x1="150" y1="166" x2="150" y2="16" stroke="#8fd6ff" stroke-width="1.6" style="display:none"/>
    <line id="swSec" class="hand" x1="150" y1="172" x2="150" y2="12" stroke="var(--acc)" stroke-width="2"/>
    <circle cx="150" cy="150" r="5" fill="var(--acc)"/><circle cx="150" cy="150" r="2" fill="var(--sky-top)"/>`;
  $("#swSvg").innerHTML = h;
})();
const toggleFace = () => { S.swAnalog = !S.swAnalog; save(); tick(); renderWatchStatic(); renderWatch(); };
$("#swFace").onclick = toggleFace; $("#swDig").onclick = toggleFace;
function renderWatchStatic() {
  const s = $("#swS"), l = $("#swL"), e = swEl();
  $("#swFace").classList.toggle("hide", !S.swAnalog); $("#swDig").classList.toggle("show", !S.swAnalog);
  s.textContent = W.run ? "Stop" : (e ? "Resume" : "Start"); s.className = "cbtn " + (W.run ? "stop" : "acc");
  l.textContent = W.run || !e ? "Lap" : "Reset"; l.disabled = !W.run && !e;
  const laps = W.laps; $("#lapCard").style.display = laps.length ? "" : "none";
  if (laps.length) {
    const mn = Math.min(...laps), mx = Math.max(...laps);
    const rows = laps.map((v, i) => ({ i, v })).reverse();
    $("#laps").innerHTML = rows.map(r => {
      const cls = laps.length >= 2 && r.v === mn ? "fast" : laps.length >= 2 && r.v === mx ? "slow" : "";
      return `<div class="lap ${cls}"><div class="n">Lap ${r.i + 1}</div><div class="bar"><i style="width:${(r.v / mx * 100).toFixed(1)}%"></i></div><div class="v">${swStr(r.v)}</div></div>`;
    }).join("");
  }
  $("#watchSub").textContent = W.run ? "Running · L for a lap, Space to stop" : e ? "Paused · tap the face to switch" : "Tap the face for " + (S.swAnalog ? "big digits" : "the analog dial");
}
function renderWatch() {
  const e = swEl(), f = swFmt(e), cur = e - lapSum(), sec = (e / 1000) % 60;
  if (S.swAnalog) {
    $("#swSec").setAttribute("transform", `rotate(${sec * 6} 150 150)`);
    $("#swMin").setAttribute("transform", `rotate(${(e / 60000 % 30) * 12} 150 96)`);
    $("#swTxt").textContent = f.main + f.cs;
    const lh = $("#swLapH");
    if (W.laps.length) { lh.style.display = ""; lh.setAttribute("transform", `rotate(${(cur / 1000 % 60) * 6} 150 150)`); } else lh.style.display = "none";
  } else {
    $("#swBig").innerHTML = f.main + `<small>${f.cs}</small>`;
    $("#swLapD").innerHTML = W.laps.length ? `Lap ${W.laps.length + 1} · <b>${swStr(cur)}</b>` : "";
  }
  const pc = $("#swPace");
  if (W.laps.length && W.run) {
    const avg = lapSum() / W.laps.length, dv = (cur - avg) / 1000;
    pc.style.visibility = ""; pc.className = "pill " + (dv <= 0 ? "" : "amber"); pc.textContent = (dv <= 0 ? "Ahead " : "Behind ") + Math.abs(dv).toFixed(1) + " s";
  } else pc.style.visibility = "hidden";
}
/* the tab dots show what's running */
function renderNow() {
  const running = S.timers.some(t => t.run && !t.done);
  $$(".tab").forEach(x => x.classList.toggle("run", (x.dataset.v === "vTimer" && running) || (x.dataset.v === "vWatch" && W.run)));
}

/* ---------- profile ---------- */
function renderSkins() {
  const sk = Object.entries(SKINS).map(([k, s]) => {
    let bg;
    if (k === "live") { const [a, b] = skyFor(sunAlt(now(), HOME.lat, HOME.lon)); bg = `linear-gradient(135deg,${a},${b})`; }
    else bg = `linear-gradient(${s.top},${s.bot})`;
    return `<div class="swc ${S.skin === k ? "on" : ""}" data-k="${k}"><i style="background:${bg}"></i>${s.name}</div>`;
  }).join("");
  if ($("#skins").dataset.h !== sk) {
    $("#skins").innerHTML = sk; $("#skins").dataset.h = sk;
    $$("#skins .swc").forEach(el => el.onclick = () => { S.skin = el.dataset.k; save(); tick(); paintSky(); renderSkins(); drawRuler(); MAP.dots = null; });
  }
  const ac2 = S.skin === "bed" ? `<div style="font-size:12.5px;color:var(--fg2)">Bedside keeps everything red, so it's easy on your eyes at night.</div>`
    : Object.entries(ACCENTS).map(([k, a]) => `<div class="swc round ${S.accent === k ? "on" : ""}" data-k="${k}"><i style="background:${SKINS[S.skin].cls === "light" ? a.d : a.c}"></i>${a.name}</div>`).join("");
  if ($("#accents").dataset.h !== ac2) {
    $("#accents").innerHTML = ac2; $("#accents").dataset.h = ac2;
    $$("#accents .swc").forEach(el => el.onclick = () => { S.accent = el.dataset.k; save(); tick(1.2); paintSky(); renderSkins(); });
  }
}
const TOGS = [
  ["h24", "24-hour clock", "Off shows AM and PM"],
  ["secs", "Show seconds", "On the digital clock"],
  ["weather", "Weather on the clock", "From Open-Meteo: free, anonymous, for Gliwice"],
  ["fahr", "Temperature in °F", "Off shows °C"],
  ["correct", "Correct device drift", "Uses the accuracy check to fix the time on screen"],
  ["wake", "Keep screen awake", "So alarms and timers can ring while Hora is open"],
  ["notify", "Notify when in another tab", "Shows a notification when something rings"],
  ["ticks", "Tactile sounds", "Soft ticks on the dials, wheels and buttons"]
];
function renderFontPick() {
  const pv = "10:42".split("").map(glyphSvg).join("");
  const h = `<div class="fp yb ${S.font === "crust" ? "on" : ""}" data-f="crust" style="grid-column:1 / -1"><div class="pv"><b>10:42</b></div>Crust Cream <span id="ybState"></span></div>
    <div class="fp ${S.font === "line" ? "on" : ""}" data-f="line"><div class="pv">${pv}</div>Hora Line</div>
    <div class="fp ${S.font === "solid" ? "on" : ""}" data-f="solid"><div class="pv"><b>10:42</b></div>Rounded</div>`;
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
function renderToggles() {
  const h = TOGS.filter(([k]) => !(NATIVE && (k === "wake" || k === "notify")) && !(k === "fahr" && !S.weather)).map(([k, t, s]) => `<div class="tog"><div>${t}<small>${s}</small></div><div class="sw-t ${S[k] ? "on" : ""}" data-k="${k}"></div></div>`).join("");
  if ($("#toggles").dataset.h === h) return;
  $("#toggles").innerHTML = h; $("#toggles").dataset.h = h;
  $$("#toggles .sw-t").forEach(el => el.onclick = async () => {
    const k = el.dataset.k; S[k] = !S[k];
    if (k === "notify" && S.notify && "Notification" in window && Notification.permission !== "granted") {
      try { const p = await Notification.requestPermission(); if (p !== "granted") { S.notify = false; toast("Notifications are blocked in the browser"); } } catch (e) { S.notify = false; }
    }
    if (k === "wake") await wake();
    if (k === "correct") { recalcAlarms(); paintBadge(); }
    if (k === "weather") { if (S.weather) loadWeather(true); renderWx(); }
    if (k === "fahr") renderWx();
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

/* ---------- install & shortcuts ---------- */
let INSTALL = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL = e; if (VIEW === "vProfile") renderDefault(); });
addEventListener("appinstalled", () => { INSTALL = null; toast("Hora is on your home screen"); renderDefault(); });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function renderDefault() {
  if (NATIVE) return renderNativeCard();
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), inst = standalone();
  const add = inst ? `<div class="instok">✓ Installed. Hora opens like an app.</div>`
    : INSTALL ? `<button class="btn wide" id="instBtn" style="width:100%;margin-bottom:12px">Add Hora to home screen</button>`
    : `<ol class="steps"><li>${ios ? "Tap <b>Share</b>, then <b>Add to Home Screen</b>." : "Open the browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to home screen</b>."}</li></ol>`;
  const h = add + `<ol class="steps" style="${inst || INSTALL ? "" : "counter-reset:s 1"}">
      <li><b>Move it to your dock</b> where the stock Clock app was, so it's the one you tap.</li>
      <li><b>Long-press the icon</b> for shortcuts: New alarm, Timer and Stopwatch.</li>
      <li>Turn on <b>Keep screen awake</b> above, so alarms can ring overnight.</li>
    </ol>
    <div class="honest" style="margin:4px 0 0">For alarms that ring when the phone is locked, use the <b>Android app</b> from Hora's GitHub page. Browsers can't do that.</div>`;
  if ($("#defBody").innerHTML !== h) {
    $("#defBody").innerHTML = h;
    if ($("#instBtn")) $("#instBtn").onclick = async () => { INSTALL.prompt(); const r = await INSTALL.userChoice.catch(() => ({})); if (r.outcome === "accepted") INSTALL = null; renderDefault(); };
  }
}
/* inside the APK: show whether Android will let alarms ring on time */
function renderNativeCard() {
  let exact = true, batt = true, notif = true, full = true, ver = "";
  try { exact = NAT.exactAllowed(); batt = NAT.batteryIgnored(); notif = NAT.notificationsAllowed(); full = NAT.fullScreenAllowed(); ver = NAT.version(); } catch (e) {}
  const row = (ok, title, sub, act, label) => `<div class="tog"><div>${title}<small>${sub}</small></div>${ok ? `<span class="pill">On</span>` : `<button class="btn sm" data-act="${act}">${label}</button>`}</div>`;
  const h = `<div class="instok">✓ Alarms and timers ring even when Hora is closed or the phone is locked.</div>
    ${row(exact, "Exact alarms", "Lets alarms ring at the exact minute", "exact", "Allow")}
    ${row(batt, "No battery limits", "Stops the phone from putting Hora to sleep", "battery", "Allow")}
    ${row(notif, "Notifications", "Needed for alarms and bedtime reminders", "notif", "Allow")}
    ${row(full, "Full-screen alarms", "Lets an alarm open over the lock screen", "fullscreen", "Allow")}
    <div class="honest" style="margin:10px 0 0"><b>On Oppo phones:</b> also open <b>App settings → Battery</b> and allow <b>background activity</b> and <b>auto launch</b>. Otherwise ColorOS may stop Hora overnight.<br><button class="btn ghost sm" data-act="app" style="margin-top:8px">Open app settings</button></div>
    <div style="font-size:11px;color:var(--fg2);margin-top:10px">Hora for Android ${esc(ver)}</div>`;
  if ($("#defBody").innerHTML !== h) {
    $("#defBody").innerHTML = h;
    $$("#defBody [data-act]").forEach(b => b.onclick = () => { try { NAT.openSettings(b.dataset.act); } catch (e) {} });
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && NATIVE && VIEW === "vProfile") renderNativeCard(); });
function openFromShortcut() {
  const q = new URLSearchParams(location.search).get("tab");
  const map = { alarm: "vAlarm", timer: "vTimer", stopwatch: "vWatch", clock: "vClock" };
  if (q === "newalarm") { go("vAlarm"); setTimeout(() => editAlarm(null), 300); }
  else if (map[q]) go(map[q]);
  if (q && history.replaceState) history.replaceState(null, "", location.pathname);
}

/* ---------- firing ---------- */
/* Each ring has a key like "a3@1729411200000" (alarm 3 due at that moment). The Android app wakes Hora
   with the same key, so whichever notices first rings it and the other is ignored. */
const FIRED = new Set();
const alarmRing = (a, extra = {}) => ring(Object.assign({ kind: "alarm", title: a.label || "Alarm", sub: new Date(now()).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), sound: a.sound, key: "snd" + a.id, gentle: a.gentle, vib: a.vib, a }, extra));
function fireAlarm(a, at) {
  const k = "a" + a.id + "@" + at; if (FIRED.has(k)) return; FIRED.add(k);
  if (!a.days.some(Boolean)) a.on = false;
  NEXT[a.id] = a.on ? nextRing(a, Math.max(now(), at) + 1000) : null; save();
  if (now() - at < 15 * 60000) alarmRing(a);
}
function fireSnooze(s) {
  const k = "s" + s.a.id + "@" + s.at; SNOOZES = SNOOZES.filter(x => x !== s); saveSnoozes();
  if (FIRED.has(k)) return; FIRED.add(k);
  if (now() - s.at < 15 * 60000) alarmRing(s.a, { sub: s.auto ? "Snoozed automatically" : "After snoozing", gentle: false, auto: s.auto || 0 });
}
function fireTimer(t) {
  if (t.done) return;
  t.done = true; t.run = false; t.left = 0; save();
  ring({ kind: "timer", title: t.label + " is done", sub: "Set for " + dur(t.total) + " · finished " + hmA(new Date(t.endAt)), sound: S.timerSound, key: "sndtimer", gentle: false, vib: "pulse", tid: t.id });
}
/* a quiet nudge: a soft bowl and the island, never a full-screen alarm */
function fireBed(b) {
  const k = "b" + SLEEP_ID + "@" + b.rem; BEDNEXT = bedtimes(b.rem + 1000, 1)[0] || null;
  if (FIRED.has(k) || now() - b.rem > 20 * 60000) return; FIRED.add(k);
  BED = Object.assign({}, b, { until: Date.now() + 10 * 60000 }); ISL.open = true;
  if (!NATIVE) playSound("bowl", .45);   // Android has already chimed with its notification
  buzz("gentle"); renderIsland();
}
function check() {
  const n = now();
  S.alarms.forEach(a => { if (a.on && NEXT[a.id] && n >= NEXT[a.id]) fireAlarm(a, NEXT[a.id]); });
  SNOOZES.filter(s => n >= s.at).forEach(fireSnooze);
  S.timers.forEach(t => { if (t.run && !t.done && n >= t.endAt) fireTimer(t); });
  if (BEDNEXT && n >= BEDNEXT.rem) fireBed(BEDNEXT);
}
/* called by the Android app when it wakes Hora for a scheduled ring */
window.horaFire = key => {
  const m = /^([astb])(\d+)@(\d+)$/.exec(key || ""); if (!m) return;
  const kind = m[1], id = +m[2], at = +m[3];
  if (kind === "a") { const a = S.alarms.find(x => x.id === id); if (a && !FIRED.has(key)) fireAlarm(a, at); }
  else if (kind === "s") { const s = SNOOZES.find(x => x.a.id === id && x.at === at); if (s) fireSnooze(s); else { const a = S.alarms.find(x => x.id === id); if (a && !FIRED.has(key) && now() - at < 15 * 60000) { FIRED.add(key); alarmRing(a, { sub: "After snoozing", gentle: false }); } } }
  else if (kind === "b") { const b = bedtimes(at - 1000, 1)[0]; if (b) fireBed(b); }
  else { const t = S.timers.find(x => x.id === id); if (t) fireTimer(t); }
  renderAll();
};

/* ---------- loop ---------- */
let lastMin = -1;
function renderAll() {
  renderFace(); renderNow();
  if (VIEW === "vClock") { renderWorld(); renderSun(); renderWx(); }
  if (VIEW === "vAlarm") renderAlarms();
  if (VIEW === "vTimer") renderTimer();
  if (VIEW === "vWatch") { renderWatchStatic(); renderWatch(); }
  if (VIEW === "vProfile") { renderSkins(); renderFontPick(); renderToggles(); renderDefault(); }
}
setInterval(() => {
  check();
  const m = Math.floor(now() / 60000);
  if (m !== lastMin) {
    lastMin = m; paintSky();
    if (VIEW === "vClock") { renderSun(); drawRuler(); drawMap(); }
    if (VIEW === "vAlarm") renderAlarms();
    if (m % 10 === 0) loadWeather();
  }
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { wake(); check(); renderAll(); loadWeather(); if (Date.now() - SYNCED_AT > 5 * 60000) sync(); } });
addEventListener("resize", drawRuler);

S.timers = S.timers.filter(t => !t.done || t.run);
if (S.focus && !focused()) S.focus = null;
syncSleep(); recalcAlarms(); paintSky(); renderAll(); drawRuler(); renderWatchStatic(); renderWatch(); wake(); openFromShortcut();
requestAnimationFrame(drawMap);
loadWeather(); sync();
})();
