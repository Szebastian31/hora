/* Hora wake-up scenes: painted, slowly moving canvases, plus the user's own photos, videos and sounds kept in IndexedDB.
   Each scene paints its still parts once into cached layers and only animates light, mist and motion on top. */
(() => {
const TAU = Math.PI * 2;
const rng = seed => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const lin = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
function rad(x, cx, cy, r, stops, r0 = 0) {
  const g = x.createRadialGradient(cx, cy, r0, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
}
/* a soft elliptical glow: the building block for mist, clouds, bokeh and light */
function blob(x, cx, cy, rx, ry, rgb, a, mid = .45) {
  if (rx <= 0 || ry <= 0) return;
  x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.5, `rgba(${rgb},${a * mid})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
}
function vignette(x, w, h, a = .38) {
  const g = x.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .35, w / 2, h * .45, Math.max(w, h) * .85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); x.fillStyle = g; x.fillRect(0, 0, w, h);
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`;
};
/* a natural skyline: five octaves of seeded waves, rougher on nearer layers */
function ridgeAt(u, base, amp, seed, rough = 1) {
  const r = rng(seed), f = [1.1, 2.6, 5.3, 11.7, 23.1], m = [1, .5, .22 * rough, .09 * rough, .04 * rough];
  let y = 0; for (let k = 0; k < 5; k++) y += m[k] * Math.sin(u * f[k] * Math.PI + r() * TAU);
  return base - amp * y / 1.85;
}
function ridge(x, w, h, base, amp, seed, rough = 1) {
  x.beginPath(); x.moveTo(-4, h + 4);
  for (let i = 0; i <= 120; i++) { const u = i / 120; x.lineTo(u * w, h * ridgeAt(u, base, amp, seed, rough)); }
  x.lineTo(w + 4, h + 4); x.closePath();
}
/* a ridge covered in tiered pine trees */
function pines(c, w, h, base, amp, seed, col, size, gap = .55) {
  ridge(c, w, h, base, amp, seed, .5); c.fillStyle = col; c.fill();
  const r = rng(seed * 7 + 3);
  for (let xx = -size; xx < w + size; xx += size * gap * (.45 + r())) {
    const y = h * ridgeAt(xx / w, base, amp, seed, .5) + size * .35, th = size * (1.5 + r() * 1.7), tw = size * (.38 + r() * .2);
    c.beginPath(); c.moveTo(xx, y - th);
    const R = [], T = 5;
    for (let k = 1; k <= T; k++) { const yy = y - th + th * k / T, ww = tw * (.25 + .75 * k / T); R.push([ww, yy]); if (k < T) R.push([ww * .45, yy - th * .02]); }
    R.forEach(([dx, yy]) => c.lineTo(xx + dx, yy));
    c.lineTo(xx + tw * .07, y + size * .4); c.lineTo(xx - tw * .07, y + size * .4);
    R.reverse().forEach(([dx, yy]) => c.lineTo(xx - dx, yy));
    c.closePath(); c.fill();
  }
}
/* still layers are painted once per size and reused every frame */
const CACHE = new Map();
function layer(key, w, h, d, fn) {
  const k = key + "|" + Math.round(w) + "x" + Math.round(h) + "@" + d;
  let c = CACHE.get(k);
  if (!c) {
    c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * d)); c.height = Math.max(1, Math.round(h * d));
    const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); fn(x, w, h);
    CACHE.set(k, c); if (CACHE.size > 70) CACHE.delete(CACHE.keys().next().value);
  }
  return c;
}
const put = (x, c, w, h) => x.drawImage(c, 0, 0, w, h);
/* a seamless horizontal band (mist, clouds) that drifts sideways; paint draws each item through rep() */
function band(x, key, w, h, d, top, hgt, t, sp, paint) {
  const c = layer(key, w * 2, h * hgt, d, (m, W, H) => paint(m, w, H, f => { f(-w); f(0); f(w); }));
  const o = ((t * sp * (w / 390)) % w + w) % w;
  x.drawImage(c, -o, h * top, w * 2, h * hgt);
}
function mist(x, key, w, h, d, top, hgt, t, sp, rgb, a, n = 16) {
  band(x, key, w, h, d, top, hgt, t, sp, (m, P, H, rep) => {
    const r = rng(key.length * 131 + n);
    for (let i = 0; i < n; i++) { const cx = r() * P, cy = H * (.3 + r() * .4), rx = P * (.12 + r() * .16), ry = H * (.2 + r() * .22), aa = a * (.5 + r() * .5); rep(o => blob(m, cx + o, cy, rx, ry, rgb, aa, .55)); }
  });
}
function sun(x, cx, cy, core, glow, k, warm = "255,228,190") {
  x.save(); x.globalCompositeOperation = "screen";
  rad(x, cx, cy, glow, [[0, `rgba(${warm},${.5 + .08 * k})`], [.18, "rgba(255,170,130,.22)"], [.5, "rgba(200,100,140,.07)"], [1, "rgba(0,0,0,0)"]]);
  rad(x, cx, cy, core * 2.2, [[0, "rgba(255,250,235,.9)"], [.35, "rgba(255,236,205,.45)"], [1, "rgba(255,226,180,0)"]]);
  rad(x, cx, cy, core, [[0, "#fffef9"], [.7, "rgba(255,250,236,.98)"], [1, "rgba(255,240,210,0)"]]);
  x.restore();
}

const SCENES = {
  sunrise: { name: "Daybreak", draw(x, w, h, t, d) {
    put(x, layer("sr-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#141a4a"], [.26, "#3a3a7e"], [.44, "#8d5a8c"], [.57, "#e48a7a"], [.65, "#ffbf8e"], [.71, "#ffe3bd"], [1, "#ffe9cc"]]); c.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 12; i++) { const y = h * (.12 + r() * .36), lit = y / h; blob(c, w * r(), y, w * (.25 + r() * .45), h * (.006 + r() * .014), lit > .3 ? "255,186,160" : "196,150,210", .22 + r() * .25, .7); }
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .06);
    sun(x, w * .5, h * (.655 - .012 * k), Math.min(w, h) * .07, Math.max(w, h) * .75, k);
    put(x, layer("sr-hills", w, h, d, c => {
      [[.70, .05, "#c88596", 2], [.75, .07, "#956285", 3], [.81, .08, "#62416f", 5], [.88, .07, "#352650", 8], [.95, .05, "#170f2a", 13]].forEach(([b, a, col, seed], i) => {
        ridge(c, w, h, b, a, seed, 1 + i * .2); c.fillStyle = lin(c, h * (b - a), h, [[0, col], [1, shade(col, -.3)]]); c.fill();
        c.fillStyle = lin(c, h * (b - a * 1.2), h * (b + .06), [[0, "rgba(255,206,180,0)"], [.6, `rgba(255,206,180,${.24 - i * .045})`], [1, "rgba(255,206,180,0)"]]); c.fillRect(0, h * (b - a * 1.2), w, h * (a * 1.2 + .06));
      });
      vignette(c, w, h, .3);
    }), w, h);
    mist(x, "sr-m1", w, h, d, .7, .14, t, 3, "255,214,200", .22);
    mist(x, "sr-m2", w, h, d, .8, .14, t, -5, "240,190,200", .16);
  } },
  mist: { name: "Misty pines", draw(x, w, h, t, d) {
    put(x, layer("mp-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#1d3a4f"], [.35, "#5f8a93"], [.55, "#c8c3ad"], [.66, "#f2d7b6"], [1, "#f6e3c8"]]); c.fillRect(0, 0, w, h);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .05);
    sun(x, w * .68, h * .5, Math.min(w, h) * .055, Math.max(w, h) * .6, k, "255,236,206");
    const L = [[.56, .03, "#9fb1aa", 4, 7], [.63, .04, "#73908e", 9, 9], [.71, .05, "#4a6b6c", 14, 12], [.8, .05, "#2a4547", 21, 16], [.9, .05, "#132527", 29, 22]];
    L.forEach(([b, a, col, seed, size], i) => {
      put(x, layer("mp-l" + i, w, h, d, c => pines(c, w, h, b, a, seed, col, size * w / 390)), w, h);
      if (i < 4) mist(x, "mp-m" + i, w, h, d, b - .02, .12, t, (i % 2 ? -1 : 1) * (2 + i * 1.5), "236,232,220", .3 - i * .04, 14);
    });
    put(x, layer("mp-v", w, h, d, c => vignette(c, w, h, .32)), w, h);
  } },
  clouds: { name: "Cloud sea", draw(x, w, h, t, d) {
    put(x, layer("cs-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#1f3b78"], [.3, "#5277b8"], [.5, "#d7a9b5"], [.58, "#ffd2a6"], [1, "#ffe3c2"]]); c.fillRect(0, 0, w, h);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .05);
    sun(x, w * .3, h * .55, Math.min(w, h) * .06, Math.max(w, h) * .8, k);
    const deck = (key, top, hgt, sp, lit, dark, sc, n) => band(x, key, w, h, d, top, hgt, t, sp, (m, P, H, rep) => {
      const r = rng(key.length * 97 + n);
      for (let i = 0; i < n; i++) {
        const cx = r() * P, cy = H * (.35 + r() * .5), rx = P * (.05 + r() * .09) * sc, ry = rx * (.5 + r() * .25);
        rep(o => { blob(m, cx + o, cy + ry * .35, rx * 1.05, ry, dark, .55, .7); blob(m, cx + o - rx * .1, cy - ry * .1, rx * .9, ry * .8, lit, .9, .75); });
      }
    });
    deck("cs-far", .55, .14, 1.5, "255,214,196", "190,140,170", .7, 40);
    deck("cs-mid", .62, .2, 3.5, "255,226,210", "160,120,160", 1, 34);
    deck("cs-near", .74, .3, 7, "255,236,224", "120,96,140", 1.5, 26);
    put(x, layer("cs-v", w, h, d, c => vignette(c, w, h, .26)), w, h);
  } },
  lake: { name: "Alpine lake", draw(x, w, h, t, d) {
    const hz = .6, land = layer("al-land", w, h * hz, d, (c, W, H) => {
      c.fillStyle = lin(c, 0, H, [[0, "#22376d"], [.5, "#6d86b8"], [.82, "#f0bfa8"], [1, "#ffdcc0"]]); c.fillRect(0, 0, W, H);
      rad(c, W * .62, H * .92, Math.max(W, H) * .7, [[0, "rgba(255,226,190,.55)"], [.3, "rgba(255,190,160,.15)"], [1, "rgba(0,0,0,0)"]]);
      // snowy peaks: lit faces and shadowed faces
      ridge(c, W, H, .62, .32, 41, 1.4); c.fillStyle = lin(c, H * .3, H, [[0, "#f3e6ea"], [.25, "#b8a8c8"], [.6, "#6a6a9a"], [1, "#4a4f7d"]]); c.fill();
      ridge(c, W, H, .7, .26, 43, 1.6); c.fillStyle = lin(c, H * .45, H, [[0, "#9b8fb5"], [1, "#3b3f68"]]); c.fill();
      pines(c, W, H, .97, .04, 47, "#1a2440", 11 * W / 390);
    });
    x.drawImage(land, 0, 0, w, h * hz);
    // reflection: the same picture flipped, broken into gently moving strips
    const s = w / 390, step = Math.max(2, 3 * s), y0 = h * hz;
    x.save(); x.fillStyle = "#1a2647"; x.fillRect(0, y0, w, h - y0);
    for (let y = 0; y < h - y0; y += step) {
      const f = y / (h - y0), src = (h * hz) * (1 - Math.min(1, y / (h * hz))), dx = Math.sin(y / (6 * s) + t * 1.2) * (1 + f * 5) * s;
      x.globalAlpha = .62 - f * .35; x.drawImage(land, 0, Math.max(0, src / (h * hz) * land.height - 1), land.width, step / (h * hz) * land.height + 1, dx, y0 + y, w, step + .5);
    }
    x.globalAlpha = 1;
    x.fillStyle = lin(x, y0, h, [[0, "rgba(255,226,200,.18)"], [.25, "rgba(40,50,90,.1)"], [1, "rgba(8,10,30,.6)"]]); x.fillRect(0, y0, w, h - y0);
    x.restore();
    mist(x, "al-m", w, h, d, hz - .05, .1, t, 2, "255,230,220", .3);
    put(x, layer("al-v", w, h, d, c => vignette(c, w, h, .3)), w, h);
  } },
  ocean: { name: "Tide", draw(x, w, h, t, d) {
    const s = w / 390, hz = h * .58;
    put(x, layer("td-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, hz, [[0, "#121a4e"], [.4, "#4f4a8c"], [.72, "#de8f86"], [.92, "#ffcf9e"], [1, "#ffe6bf"]]); c.fillRect(0, 0, w, hz);
      const r = rng(19);
      for (let i = 0; i < 10; i++) { const y = hz * (.25 + r() * .6); blob(c, w * r(), y, w * (.2 + r() * .4), h * (.008 + r() * .016), y / hz > .6 ? "255,170,150" : "150,110,190", .3 + r() * .25, .7); }
      c.fillStyle = lin(c, hz, h, [[0, "#7c6496"], [.12, "#463f7c"], [.5, "#1d2252"], [1, "#080b26"]]); c.fillRect(0, hz, w, h - hz);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .07);
    sun(x, w / 2, hz + 1, Math.min(w, h) * .07, h * .55, k);
    x.save(); x.globalCompositeOperation = "screen";
    const col = x.createLinearGradient(0, 0, w, 0); col.addColorStop(0, "rgba(255,200,160,0)"); col.addColorStop(.5, "rgba(255,200,160,.26)"); col.addColorStop(1, "rgba(255,200,160,0)");
    x.fillStyle = col; x.beginPath(); x.moveTo(w * .44, hz); x.lineTo(w * .56, hz); x.lineTo(w * .86, h); x.lineTo(w * .14, h); x.fill();
    // glitter on the swell: short bright dashes that twinkle in rows
    x.globalCompositeOperation = "lighter"; x.lineCap = "round";
    const r = rng(23);
    for (let k2 = 0; k2 < 70; k2++) {
      const f = k2 / 69, y = hz + 2 + Math.pow(f, 1.8) * (h - hz), spread = w * (.02 + .3 * f);
      for (let j = 0; j < 3; j++) {
        const xx = w / 2 + (r() - .5) * 2 * spread, a = Math.max(0, Math.sin(t * 1.6 + k2 * 1.3 + j * 2.1)) * (1 - f * .5), len = (3 + 20 * f) * s;
        if (a < .05) continue;
        x.strokeStyle = `rgba(255,226,190,${a * .75})`; x.lineWidth = (.7 + 1.6 * f) * s;
        x.beginPath(); x.moveTo(xx - len / 2, y); x.lineTo(xx + len / 2, y); x.stroke();
      }
    }
    x.restore();
    x.lineCap = "round";
    for (let k2 = 0; k2 < 16; k2++) {
      const f = k2 / 15, y = hz + Math.pow(f, 1.9) * (h - hz);
      x.strokeStyle = `rgba(255,236,230,${.03 + .03 * f})`; x.lineWidth = (.8 + f * 1.4) * s; x.beginPath();
      for (let xx = 0; xx <= w; xx += 8 * s) x.lineTo(xx, y + Math.sin(xx / w * (10 - f * 4) + t * (.5 + f) + k2) * (1 + k2 * .5) * s);
      x.stroke();
    }
    mist(x, "td-m", w, h, d, .52, .1, t, 2, "255,214,200", .2);
    put(x, layer("td-v", w, h, d, c => vignette(c, w, h, .32)), w, h);
  } },
  lagoon: { name: "Lagoon", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("lg-base", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#0b5d78"], [.35, "#12a1a6"], [.7, "#4fd0be"], [1, "#a8ecd8"]]); c.fillRect(0, 0, w, h);
      const r = rng(61);
      for (let i = 0; i < 9; i++) blob(c, w * r(), h * (.5 + r() * .5), w * (.2 + r() * .3), h * (.06 + r() * .08), "246,226,180", .25 + r() * .2, .6);   // sandbanks
      for (let i = 0; i < 6; i++) blob(c, w * r(), h * r() * .6, w * (.25 + r() * .3), h * (.08 + r() * .1), "6,60,96", .35, .6);                    // deep channels
    }), w, h);
    // caustics: light nets that drift and shimmer
    x.save(); x.globalCompositeOperation = "lighter"; x.lineCap = "round"; x.lineJoin = "round";
    for (let L = 0; L < 2; L++) {
      x.strokeStyle = `rgba(220,255,250,${L ? .1 : .16})`; x.lineWidth = (L ? 2.4 : 1.3) * s;
      const cell = (L ? 64 : 42) * s, ph = t * (L ? .35 : .55);
      for (let gy = -1; gy * cell < h + cell; gy++) {
        x.beginPath();
        for (let gx = -1; gx * cell < w + cell; gx++) {
          const px = gx * cell + Math.sin(gy * 1.7 + ph + gx * .9) * cell * .35, py = gy * cell + Math.cos(gx * 1.3 + ph * 1.2 + gy) * cell * .35;
          gx === -1 ? x.moveTo(px, py) : x.quadraticCurveTo(px - cell * .5, py + Math.sin(ph + gx) * cell * .3, px, py);
        }
        x.stroke();
      }
    }
    x.restore();
    // sun glints on the surface
    x.save(); x.globalCompositeOperation = "lighter";
    const r = rng(67);
    for (let i = 0; i < 40; i++) { const a = Math.max(0, Math.sin(t * 2 + i * 1.9)); if (a > .6) blob(x, w * r(), h * r(), 4 * s, 4 * s, "255,255,240", (a - .6) * 1.8, .3); else { r(); r(); } }
    x.restore();
    put(x, layer("lg-v", w, h, d, c => { c.fillStyle = lin(c, 0, h, [[0, "rgba(0,20,40,.35)"], [.4, "rgba(0,20,40,0)"]]); c.fillRect(0, 0, w, h); vignette(c, w, h, .28); }), w, h);
  } },
  dunes: { name: "Dunes", draw(x, w, h, t, d) {
    put(x, layer("dn-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#26346f"], [.3, "#8a6ea0"], [.48, "#eaa385"], [.58, "#ffd6a2"], [1, "#ffe8c6"]]); c.fillRect(0, 0, w, h);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .06);
    sun(x, w * .7, h * (.565 - .01 * k), Math.min(w, h) * .055, Math.max(w, h) * .65, k);
    put(x, layer("dn-sand", w, h, d, c => {
      [[.62, .02, "#e9a77b", "#c98060", 5], [.69, .035, "#dc8d60", "#a85c41", 7], [.79, .05, "#bd6a42", "#7f3d2b", 9], [.92, .06, "#8c432a", "#4d1f15", 12]].forEach(([b, a, c0, c1, seed], i) => {
        ridge(c, w, h, b, a, seed, .35); c.fillStyle = lin(c, h * (b - a), h * (b + .14), [[0, c0], [1, c1]]); c.fill();
        // the lit crest of each dune
        c.save(); ridge(c, w, h, b, a, seed, .35); c.clip();
        c.fillStyle = lin(c, h * (b - a * 1.5), h * (b + .03), [[0, "rgba(255,230,196,.5)"], [1, "rgba(255,230,196,0)"]]); c.fillRect(0, 0, w, h); c.restore();
        c.fillStyle = lin(c, h * (b - .03), h * (b + .03), [[0, "rgba(255,220,190,0)"], [.5, `rgba(255,220,190,${.22 - i * .04})`], [1, "rgba(255,220,190,0)"]]); c.fillRect(0, h * (b - .03), w, h * .06);
      });
      const s = w / 390; c.strokeStyle = "rgba(255,224,186,.09)"; c.lineWidth = s;
      for (let k2 = 0; k2 < 12; k2++) { const y = h * (.88 + k2 * .011); c.beginPath(); for (let xx = 0; xx <= w; xx += 8 * s) c.lineTo(xx, y + Math.sin(xx / w * 9 + k2) * 3 * s); c.stroke(); }
      vignette(c, w, h, .28);
    }), w, h);
    mist(x, "dn-m", w, h, d, .6, .1, t, 6, "255,214,180", .16);   // blown sand haze
  } },
  lavender: { name: "Lavender", draw(x, w, h, t, d) {
    put(x, layer("lv-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#3b3f86"], [.3, "#9c86c4"], [.48, "#f1b9b0"], [.56, "#ffdcb4"], [1, "#ffe3c0"]]); c.fillRect(0, 0, w, h);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .05), hz = .58;
    sun(x, w * .38, h * (hz - .005), Math.min(w, h) * .06, Math.max(w, h) * .7, k);
    put(x, layer("lv-field", w, h, d, c => {
      ridge(c, w, h, hz, .015, 71, .3); c.fillStyle = "#7d6aa6"; c.fill();
      c.fillStyle = lin(c, h * hz, h, [[0, "#6f5a9e"], [.4, "#53407e"], [1, "#2a1f45"]]); c.fillRect(0, h * (hz + .01), w, h);
      // rows of lavender running to the vanishing point
      const vx = w * .45, vy = h * hz, rows = 22;
      for (let i = 0; i <= rows; i++) {
        const u = (i / rows - .5) * 3.2, x1 = vx + u * w;
        const g = c.createLinearGradient(0, vy, 0, h); g.addColorStop(0, "rgba(160,120,220,.0)"); g.addColorStop(.25, "rgba(170,130,230,.55)"); g.addColorStop(1, "rgba(190,140,255,.9)");
        c.fillStyle = g; c.beginPath(); c.moveTo(vx, vy); c.lineTo(x1 - w * .035, h); c.lineTo(x1 + w * .035, h); c.closePath(); c.fill();
      }
      // lit tops near the viewer
      const r = rng(73), s = w / 390;
      for (let i = 0; i < 420; i++) { const yy = h * (hz + .1 + Math.pow(r(), .7) * (1 - hz - .1)), f = (yy / h - hz) / (1 - hz), xx = w * r(); blob(c, xx, yy, (1 + f * 3) * s, (2 + f * 6) * s, r() < .5 ? "214,170,255" : "255,196,230", .35 + f * .3, .5); }
      vignette(c, w, h, .3);
    }), w, h);
    mist(x, "lv-m", w, h, d, hz - .04, .1, t, 2.5, "255,214,220", .22);
  } },
  aurora: { name: "Aurora", draw(x, w, h, t, d) {
    const s = w / 390, H = h * .74;
    put(x, layer("au-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, H, [[0, "#01030c"], [.55, "#061330"], [1, "#0d2a48"]]); c.fillRect(0, 0, w, H);
      const r = rng(11);
      for (let i = 0; i < 220; i++) { const z = r() < .06 ? 1.6 : .4 + r() * .8; c.fillStyle = `rgba(225,235,255,${.3 + r() * .6})`; c.beginPath(); c.arc(w * r(), H * r() * .9, z * s, 0, TAU); c.fill(); }
      blob(c, w * .3, H * .3, w * .9, H * .12, "120,140,220", .07, .6);   // a faint milky way
    }), w, h);
    // curtains: many thin vertical rays whose tops wave and fade
    const curtain = mirror => {
      x.save(); x.globalCompositeOperation = "lighter";
      [["90,255,175", .38, 0], ["60,220,255", .46, 2], ["170,120,255", .3, 4]].forEach(([c, b, p], k) => {
        const step = Math.max(2, w / 160);
        for (let xx = 0; xx < w; xx += step) {
          const u = xx / w, base = H * (b + .08 * Math.sin(u * 3.2 + t * .16 + p) + .03 * Math.sin(u * 8.5 - t * .27 + p));
          const len = H * (.18 + .14 * (.5 + .5 * Math.sin(u * 4.6 + t * .35 + p * 2))), a = Math.max(0, .1 + .12 * Math.sin(u * 11 + t * .6 + p)) * (mirror ? .3 : 1);
          if (a < .01) continue;
          const g = x.createLinearGradient(0, base, 0, base - len);
          g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.08, `rgba(${c},${a})`); g.addColorStop(.45, `rgba(${c},${a * .45})`); g.addColorStop(1, `rgba(${k === 2 ? "255,120,200" : c},0)`);
          x.fillStyle = g; x.fillRect(xx, base - len, step + .6, len);
        }
      });
      x.restore();
    };
    curtain(false);
    put(x, layer("au-land", w, h, d, c => {
      ridge(c, w, h, .74, .07, 83, 1.5); c.fillStyle = "#040915"; c.fill();
      c.fillStyle = lin(c, H, h, [[0, "#0a1a30"], [1, "#01040b"]]); c.fillRect(0, H, w, h - H);
      pines(c, w, h, .745, .015, 89, "#02050d", 9 * w / 390, .8);
    }), w, h);
    x.save(); x.beginPath(); x.rect(0, H + 4 * s, w, h - H); x.clip(); x.translate(0, H * 2 + 8 * s); x.scale(1, -1); curtain(true); x.restore();
    x.strokeStyle = "rgba(170,255,220,.06)"; x.lineWidth = s;
    for (let k = 0; k < 8; k++) { const y = H + h * (.04 + k * .025); x.beginPath(); x.moveTo(w * (.1 + .05 * Math.sin(t * .5 + k)), y); x.lineTo(w * (.9 - .05 * Math.sin(t * .4 + k)), y); x.stroke(); }
    put(x, layer("au-v", w, h, d, c => vignette(c, w, h, .36)), w, h);
  } },
  snow: { name: "Snowfall", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("sn-base", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#1c2b52"], [.4, "#5b6f9e"], [.62, "#c9bfd4"], [.7, "#f0d8d0"], [1, "#e9eef7"]]); c.fillRect(0, 0, w, h);
      rad(c, w * .5, h * .63, Math.max(w, h) * .6, [[0, "rgba(255,222,200,.5)"], [1, "rgba(255,222,200,0)"]]);
      [[.66, .03, "#a6aac6", 3, 8], [.73, .04, "#7c84a8", 6, 11], [.82, .05, "#4c5680", 10, 15]].forEach(([b, a, col, seed, size]) => pines(c, w, h, b, a, seed, col, size * w / 390, .6));
      ridge(c, w, h, .9, .03, 13, .4); c.fillStyle = lin(c, h * .86, h, [[0, "#f4f6fb"], [1, "#c9d2e6"]]); c.fill();   // snowy ground
      vignette(c, w, h, .26);
    }), w, h);
    mist(x, "sn-m", w, h, d, .62, .14, t, 2, "240,236,246", .3);
    // three depths of flakes: far are small and slow, near are big and soft
    x.save(); x.globalCompositeOperation = "lighter";
    [[90, .5, 1.1, .1, 3], [50, 1, 2, .2, 8], [16, 2.4, 4.2, .35, 16]].forEach(([n, sp, sz, a, sway], L) => {
      const r = rng(101 + L);
      for (let i = 0; i < n; i++) {
        const x0 = r(), y0 = r(), ph = r() * TAU, v = sp * (.7 + r() * .6);
        const y = ((y0 + t * v * .025) % 1.1 - .05) * h, xx = (x0 * w + Math.sin(t * .6 + ph) * sway * s + w) % w;
        blob(x, xx, y, sz * s, sz * s, "255,255,255", a * 2.2, .6);
      }
    });
    x.restore();
  } },
  fireflies: { name: "Fireflies", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("ff-base", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#0d1a3a"], [.45, "#2b3a6b"], [.62, "#a6708a"], [.7, "#e7a17e"], [1, "#2a2a3a"]]); c.fillRect(0, 0, w, h);
      const r = rng(5); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.3 + r() * .5})`; c.fillRect(w * r(), h * r() * .4, s, s); }
      pines(c, w, h, .7, .04, 31, "#2e2a4a", 14 * w / 390, .7);
      ridge(c, w, h, .8, .05, 37, .8); c.fillStyle = "#1a1a2c"; c.fill();
      // tall grass in the foreground
      const g = rng(41); c.strokeStyle = "#0c0d16"; c.lineCap = "round";
      for (let i = 0; i < 260; i++) { const gx = w * g(), gy = h * (.86 + g() * .16), len = h * (.05 + g() * .09), bend = (g() - .5) * 18 * s; c.lineWidth = (.8 + g() * 1.4) * s; c.beginPath(); c.moveTo(gx, gy); c.quadraticCurveTo(gx + bend * .3, gy - len * .6, gx + bend, gy - len); c.stroke(); }
      c.fillStyle = lin(c, h * .86, h, [[0, "rgba(10,10,18,0)"], [.4, "#0a0b14"]]); c.fillRect(0, h * .86, w, h * .14);
      vignette(c, w, h, .34);
    }), w, h);
    mist(x, "ff-m", w, h, d, .72, .12, t, 1.5, "200,170,200", .18);
    x.save(); x.globalCompositeOperation = "lighter";
    const r = rng(53);
    for (let i = 0; i < 34; i++) {
      const bx = r(), by = .55 + r() * .4, ph = r() * TAU, sp = .2 + r() * .3;
      const fx = (bx + .05 * Math.sin(t * sp + ph) + .02 * Math.sin(t * sp * 2.7 + ph)) * w, fy = (by + .03 * Math.cos(t * sp * 1.3 + ph)) * h;
      const glow = Math.pow(Math.max(0, Math.sin(t * (.8 + sp) + ph * 3)), 3);
      if (glow < .02) continue;
      blob(x, fx, fy, 14 * s, 14 * s, "255,226,120", .25 * glow, .35);
      blob(x, fx, fy, 2.4 * s, 2.4 * s, "255,250,200", glow, .8);
    }
    x.restore();
  } },
  city: { name: "City dawn", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("ct-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#151d4a"], [.35, "#4b4f8f"], [.55, "#dc8f8a"], [.64, "#ffcb9a"], [1, "#ffdcb0"]]); c.fillRect(0, 0, w, h);
      const r = rng(17); for (let i = 0; i < 8; i++) blob(c, w * r(), h * (.15 + r() * .35), w * (.3 + r() * .4), h * .012, "255,180,170", .3, .7);
    }), w, h);
    const k = .5 + .5 * Math.sin(t * .06);
    sun(x, w * .62, h * .6, Math.min(w, h) * .06, Math.max(w, h) * .7, k);
    const skyline = (key, base, hmin, hmax, col, wins, seed) => layer(key, w, h, d, c => {
      const r = rng(seed); let xx = -5 * s;
      while (xx < w) {
        const bw = (14 + r() * 30) * s, bh = h * (hmin + r() * (hmax - hmin)), top = h * base - bh;
        c.fillStyle = col; c.fillRect(xx, top, bw, h - top);
        if (r() < .25) c.fillRect(xx + bw * .45, top - 14 * s, 1.5 * s, 14 * s);   // antenna
        if (wins) for (let wy = top + 6 * s; wy < h * base; wy += 7 * s) for (let wx = xx + 3 * s; wx < xx + bw - 4 * s; wx += 5.5 * s) if (r() < .16) { c.fillStyle = `rgba(255,${200 + r() * 40 | 0},140,${.5 + r() * .5})`; c.fillRect(wx, wy, 2.2 * s, 3 * s); c.fillStyle = col; }
        xx += bw + r() * 4 * s;
      }
    });
    put(x, skyline("ct-far", .72, .08, .2, "#8c6f94", false, 3), w, h);
    mist(x, "ct-m1", w, h, d, .6, .14, t, 2, "255,200,190", .25);
    put(x, skyline("ct-mid", .8, .1, .3, "#4a3d66", true, 7), w, h);
    mist(x, "ct-m2", w, h, d, .7, .14, t, -3, "230,170,190", .18);
    put(x, skyline("ct-near", .92, .14, .42, "#1c1630", true, 13), w, h);
    put(x, layer("ct-v", w, h, d, c => { c.fillStyle = lin(c, h * .9, h, [[0, "rgba(10,8,20,0)"], [1, "#0a0814"]]); c.fillRect(0, h * .9, w, h * .1); vignette(c, w, h, .32); }), w, h);
    // a plane's blinking light crossing slowly
    const px = ((t * 6 * s) % (w * 1.6)) - w * .3, py = h * .22 + Math.sin(t * .05) * 10 * s;
    if (Math.sin(t * 6) > .6) blob(x, px, py, 4 * s, 4 * s, "255,120,120", .9, .5);
    blob(x, px, py, 1.2 * s, 1.2 * s, "255,255,255", .9, .8);
  } },
  orbit: { name: "Orbit", draw(x, w, h, t, d) {
    const s = w / 390, M = Math.max(w, h), R = w * 1.3, cx = w * .5, cy = h * .76 + R;
    const ang = -Math.PI / 2 + .16 * Math.sin(t * .035), px = cx + Math.cos(ang) * R, py = cy + Math.sin(ang) * R;
    put(x, layer("ob-sky", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#010208"], [.6, "#050a1e"], [1, "#081233"]]); c.fillRect(0, 0, w, h);
      const r = rng(29); for (let i = 0; i < 260; i++) { const z = r() < .05 ? 1.5 : .35 + r() * .7; c.fillStyle = `rgba(220,230,255,${.25 + r() * .6})`; c.beginPath(); c.arc(w * r(), h * r() * .8, z * s, 0, TAU); c.fill(); }
      blob(c, w * .75, h * .25, w * .6, h * .15, "120,90,200", .1, .6);
    }), w, h);
    put(x, layer("ob-planet", w, h, d, c => {
      const at = c.createRadialGradient(cx, cy, R * .97, cx, cy, R * 1.1);
      at.addColorStop(0, "rgba(70,140,255,0)"); at.addColorStop(.2, "rgba(100,170,255,.6)"); at.addColorStop(.5, "rgba(70,120,255,.18)"); at.addColorStop(1, "rgba(40,80,255,0)");
      c.fillStyle = at; c.beginPath(); c.arc(cx, cy, R * 1.1, 0, TAU); c.fill();
      c.fillStyle = lin(c, cy - R, cy - R * .7, [[0, "#0d1b40"], [1, "#02040c"]]); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
      const r = rng(37); for (let i = 0; i < 30; i++) blob(c, w * r(), cy - R + h * (.01 + r() * .12), w * (.1 + r() * .3), h * .006, "90,130,220", .12, .6);   // cloud bands
      c.restore();
    }), w, h);
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); rad(x, px, py, R * .6, [[0, "rgba(130,180,255,.32)"], [.4, "rgba(60,100,200,.1)"], [1, "rgba(0,0,0,0)"]]); x.restore();
    const rim = x.createLinearGradient(px - w * .9, 0, px + w * .9, 0);
    rim.addColorStop(0, "rgba(160,200,255,0)"); rim.addColorStop(.5, "rgba(230,242,255,.95)"); rim.addColorStop(1, "rgba(160,200,255,0)");
    x.strokeStyle = rim; x.lineWidth = 1.8 * s; x.beginPath(); x.arc(cx, cy, R, ang - .5, ang + .5); x.stroke();
    x.save(); x.globalCompositeOperation = "lighter";
    const b = .8 + .2 * Math.sin(t * .3);
    rad(x, px, py, M * .5, [[0, `rgba(255,236,214,${.5 * b})`], [.12, "rgba(255,190,150,.16)"], [1, "rgba(0,0,0,0)"]]);
    rad(x, px, py, 14 * s, [[0, "#ffffff"], [.4, "rgba(255,250,240,.9)"], [1, "rgba(255,240,220,0)"]]);
    const st = x.createLinearGradient(0, 0, w, 0); st.addColorStop(0, "rgba(255,240,225,0)"); st.addColorStop(.5, `rgba(255,244,232,${.65 * b})`); st.addColorStop(1, "rgba(255,240,225,0)");
    x.fillStyle = st; x.fillRect(0, py - .8 * s, w, 1.6 * s);
    x.restore();
    put(x, layer("ob-v", w, h, d, c => vignette(c, w, h, .3)), w, h);
  } },
  nebula: { name: "Nebula", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("nb-base", w, h, d, c => {
      c.fillStyle = "#03030c"; c.fillRect(0, 0, w, h);
      const r = rng(43), C = ["255,90,160", "120,90,255", "60,190,255", "255,150,90"];
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 70; i++) { const u = r(), cx = w * (.1 + .8 * u + (r() - .5) * .3), cy = h * (.2 + .6 * (1 - u) * .8 + (r() - .5) * .3); blob(c, cx, cy, w * (.08 + r() * .25), h * (.04 + r() * .12), C[(r() * 4) | 0], .1 + r() * .1, .5); }
      c.globalCompositeOperation = "source-over";
      for (let i = 0; i < 40; i++) blob(c, w * r(), h * r(), w * (.03 + r() * .1), h * (.02 + r() * .06), "3,3,12", .5, .7);   // dust lanes
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(255,255,255,${.2 + r() * .7})`; c.beginPath(); c.arc(w * r(), h * r(), (.3 + r() * .8) * s, 0, TAU); c.fill(); }
    }), w, h);
    x.save(); x.globalCompositeOperation = "lighter";
    const r = rng(47);
    for (let i = 0; i < 6; i++) { const cx = w * r(), cy = h * r(), p = r() * TAU, a = .5 + .5 * Math.sin(t * .8 + p); blob(x, cx, cy, 22 * s, 22 * s, "200,220,255", .12 * a, .3); blob(x, cx, cy, 2 * s, 2 * s, "255,255,255", .6 + .4 * a, .8); }
    blob(x, w * (.5 + .1 * Math.sin(t * .03)), h * (.45 + .06 * Math.cos(t * .04)), w * .5, h * .25, "255,120,180", .08 + .03 * Math.sin(t * .2), .5);
    x.restore();
    put(x, layer("nb-v", w, h, d, c => vignette(c, w, h, .4)), w, h);
  } },
  bloom: { name: "Bloom", draw(x, w, h, t) {
    const M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#170b2a"], [1, "#250f2f"]]); x.fillRect(0, 0, w, h);
    x.save(); x.globalCompositeOperation = "screen";
    [["255,112,84", .32, .3, .6, .07, .05, 0], ["255,182,88", .72, .64, .55, .05, .08, 1.7], ["160,86,255", .76, .22, .62, .06, .04, 3.1], ["58,132,255", .2, .8, .58, .045, .06, 4.4], ["255,84,160", .55, .92, .5, .08, .05, 5.6]].forEach(([c, cx, cy, r, fx, fy, p]) => {
      const px = (cx + .2 * Math.sin(t * fx + p)) * w, py = (cy + .15 * Math.cos(t * fy + p * 1.3)) * h;
      blob(x, px, py, r * M * (.92 + .08 * Math.sin(t * .11 + p)), r * M * .8, c, .85, .4);
    });
    x.restore();
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "rgba(255,255,255,.08)"); g.addColorStop(.45, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.04)");
    x.fillStyle = g; x.fillRect(0, 0, w, h); vignette(x, w, h, .3);
  } },
  silk: { name: "Silk", draw(x, w, h, t) {
    const s = w / 390;
    x.fillStyle = lin(x, 0, h, [[0, "#070a22"], [.6, "#140f38"], [1, "#1d0f2c"]]); x.fillRect(0, 0, w, h);
    x.save(); x.globalCompositeOperation = "screen";
    blob(x, w * .55, h * .5, Math.max(w, h) * .55, Math.max(w, h) * .45, "255,110,170", .22);
    x.globalCompositeOperation = "lighter"; x.lineWidth = 1.1 * s;
    const ribbon = (N, cy, amp, sp, hue0, span, alpha, off) => {
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), e = Math.sin(u * Math.PI);
        x.strokeStyle = `hsla(${(hue0 + u * span) % 360},90%,${62 + 10 * e}%,${alpha * (.25 + e)})`; x.beginPath();
        for (let j = 0; j <= 48; j++) {
          const v = j / 48, xx = v * w * 1.1 - w * .05;
          const y = h * (cy + amp * Math.sin(v * 2.4 + t * .22 * sp + u * 1.4 + off) + amp * .45 * Math.sin(v * 5.3 - t * .15 * sp + u * 2.8 + off) + (u - .5) * .2 * (.6 + .4 * Math.sin(v * 3 + t * .1)));
          j ? x.lineTo(xx, y) : x.moveTo(xx, y);
        }
        x.stroke();
      }
    };
    ribbon(60, .5, .14, 1, 320, 110, .2, 0); ribbon(34, .63, .1, .8, 180, 70, .12, 2.2);
    x.restore(); vignette(x, w, h, .35);
  } },
  glass: { name: "Liquid glass", draw(x, w, h, t, d) {
    const s = w / 390, M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#0d1440"], [.5, "#233a8a"], [1, "#5a3a8a"]]); x.fillRect(0, 0, w, h);
    x.save(); x.globalCompositeOperation = "screen";
    blob(x, w * (.3 + .1 * Math.sin(t * .05)), h * .3, M * .5, M * .4, "90,200,255", .45);
    blob(x, w * (.75 + .1 * Math.cos(t * .04)), h * .7, M * .5, M * .4, "255,120,180", .4);
    x.restore();
    // glass orbs: a tinted body, a bright rim, a soft highlight and a caustic underneath
    const r = rng(59);
    for (let i = 0; i < 7; i++) {
      const R = M * (.06 + r() * .12), p = r() * TAU, sp = .05 + r() * .06;
      const ox = w * (.15 + .7 * r()) + Math.sin(t * sp + p) * 30 * s, oy = h * (.1 + .8 * r()) + Math.cos(t * sp * 1.3 + p) * 40 * s;
      x.save(); x.beginPath(); x.arc(ox, oy, R, 0, TAU); x.clip();
      x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(ox - R, oy - R, R * 2, R * 2);
      rad(x, ox + R * .3, oy + R * .45, R * 1.1, [[0, "rgba(255,200,240,.28)"], [1, "rgba(255,200,240,0)"]]);
      rad(x, ox - R * .35, oy - R * .4, R * .7, [[0, "rgba(255,255,255,.5)"], [.4, "rgba(255,255,255,.12)"], [1, "rgba(255,255,255,0)"]]);
      x.restore();
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.2 * s; x.beginPath(); x.arc(ox, oy, R, 0, TAU); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 1.6 * s; x.beginPath(); x.arc(ox, oy, R * .92, Math.PI * 1.1, Math.PI * 1.45); x.stroke();
    }
    vignette(x, w, h, .3);
  } },
  petals: { name: "Petals", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("pt-base", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#f6c7d4"], [.5, "#fbe0e2"], [1, "#fff1ea"]]); c.fillRect(0, 0, w, h);
      const r = rng(71);
      for (let i = 0; i < 26; i++) blob(c, w * r(), h * r() * .5, w * (.08 + r() * .14), w * (.06 + r() * .1), r() < .5 ? "236,140,170" : "250,190,205", .35, .55);   // out-of-focus blossom
      // a branch from the corner
      c.strokeStyle = "#5a3a40"; c.lineCap = "round";
      [[-.05, .02, .45, .2, 7], [.22, .12, .42, .32, 4], [.3, .16, .62, .1, 3]].forEach(([x1, y1, x2, y2, lw]) => { c.lineWidth = lw * s; c.beginPath(); c.moveTo(w * x1, h * y1); c.quadraticCurveTo(w * (x1 + x2) / 2, h * (y1 + y2) / 2 + 20 * s, w * x2, h * y2); c.stroke(); });
      for (let i = 0; i < 40; i++) { const u = r(); blob(c, w * (.05 + u * .55), h * (.04 + r() * .26), (5 + r() * 6) * s, (5 + r() * 6) * s, "255,214,224", .9, .8); }
      vignette(c, w, h, .14);
    }), w, h);
    // falling petals that tumble
    const r = rng(73);
    for (let i = 0; i < 26; i++) {
      const x0 = r(), y0 = r(), v = .3 + r() * .5, ph = r() * TAU, sz = (4 + r() * 5) * s;
      const y = ((y0 + t * v * .02) % 1.15 - .08) * h, xx = ((x0 + t * .006 * v) % 1) * w + Math.sin(t * .7 + ph) * 22 * s, rot = t * (.6 + v) + ph, flip = Math.cos(t * 1.4 + ph);
      x.save(); x.translate(xx, y); x.rotate(rot); x.scale(1, .35 + .65 * Math.abs(flip));
      x.fillStyle = flip > 0 ? "rgba(255,190,208,.92)" : "rgba(244,160,186,.92)";
      x.beginPath(); x.moveTo(0, -sz); x.bezierCurveTo(sz * .9, -sz * .6, sz * .7, sz * .7, 0, sz); x.bezierCurveTo(-sz * .7, sz * .7, -sz * .9, -sz * .6, 0, -sz); x.fill();
      x.restore();
    }
  } },
  rain: { name: "Rain", draw(x, w, h, t, d) {
    const s = w / 390;
    put(x, layer("rn-base", w, h, d, c => {
      c.fillStyle = lin(c, 0, h, [[0, "#10142e"], [.55, "#261f42"], [1, "#3a2742"]]); c.fillRect(0, 0, w, h);
      const r = rng(31), warm = ["255,190,120", "255,140,150", "130,170,255", "255,220,160"];
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 34; i++) blob(c, w * r(), h * r(), w * (.03 + r() * .1), w * (.03 + r() * .1), warm[(r() * 4) | 0], .22 + r() * .15, .75);   // city lights out of focus
      c.globalCompositeOperation = "source-over";
      c.fillStyle = "rgba(20,25,50,.25)"; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) { const dx = w * r(), dy = h * r(), rr = (.6 + r() * 2.8) * s; blob(c, dx, dy, rr, rr * 1.1, "255,255,255", .14, .9); c.fillStyle = "rgba(255,255,255,.45)"; c.beginPath(); c.arc(dx - rr * .3, dy - rr * .35, rr * .26, 0, TAU); c.fill(); }
      vignette(c, w, h, .36);
    }), w, h);
    const r = rng(37);
    for (let i = 0; i < 18; i++) {
      const x0 = r(), y0 = r(), v = .05 + r() * .12, rr = (1.8 + r() * 2.2) * s, p = r() * TAU;
      const dy = (((y0 + t * v) % 1.2) - .1) * h, dx = x0 * w + Math.sin(t * .8 + p) * 2 * s, len = rr * 14;
      const g = x.createLinearGradient(0, dy - len, 0, dy); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.16)");
      x.strokeStyle = g; x.lineWidth = rr * .7; x.lineCap = "round"; x.beginPath(); x.moveTo(dx, dy - len); x.lineTo(dx, dy); x.stroke();
      blob(x, dx, dy, rr * 1.1, rr * 1.35, "255,255,255", .3, .8);
      x.fillStyle = "rgba(255,255,255,.6)"; x.beginPath(); x.arc(dx - rr * .3, dy - rr * .4, rr * .3, 0, TAU); x.fill();
    }
  } }
};
/* old scene names keep working */
const ALIAS = { forest: "mist", clouds: "clouds" };
const sceneKey = k => SCENES[k] ? k : (ALIAS[k] || "sunrise");

/* film grain, shared by every scene via CSS */
(() => {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 140;
    const x = c.getContext("2d"), im = x.createImageData(140, 140), r = rng(5);
    for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0);
    document.documentElement.style.setProperty("--grain", `url(${c.toDataURL()})`);
  } catch (e) {}
})();

/* one loop draws every mounted canvas at its own frame rate */
const LIVE = new Map();
function mount(cv, scene, o = {}) { LIVE.set(cv, { scene: sceneKey(scene), fps: o.fps || 24, dpr: o.dpr || 1.5, last: 0 }); }
function loop(ms) {
  const t = ms / 1000;
  LIVE.forEach((o, cv) => {
    if (!cv.isConnected) { LIVE.delete(cv); return; }
    if (!cv.offsetParent || ms - o.last < 1000 / o.fps) return;
    o.last = ms;
    const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(devicePixelRatio || 1, o.dpr);
    if (!w || !h) return;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    try { SCENES[o.scene].draw(x, w, h, t + 40, d); } catch (e) {}
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
/* own photos, videos and sounds */
let dbp = null;
const db = () => dbp || (dbp = new Promise((res, rej) => {
  if (!("indexedDB" in window)) return rej(new Error("no idb"));
  const r = indexedDB.open("hora", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("media");
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction("media", mode), q = fn(t.objectStore("media")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
const URLS = {};
const media = {
  async put(id, blob) {
    if (URLS[id]) URL.revokeObjectURL(URLS[id].url);
    URLS[id] = { url: URL.createObjectURL(blob), type: blob.type };
    try { await tx("readwrite", s => s.put(blob, "m" + id)); return true; } catch (e) { return false; }
  },
  async get(id) {
    if (URLS[id]) return URLS[id];
    try { const b = await tx("readonly", s => s.get("m" + id)); if (b) { URLS[id] = { url: URL.createObjectURL(b), type: b.type }; return URLS[id]; } } catch (e) {}
    return null;
  },
  peek: id => URLS[id] || null,
  async del(id) { if (URLS[id]) { URL.revokeObjectURL(URLS[id].url); delete URLS[id]; } try { await tx("readwrite", s => s.delete("m" + id)); } catch (e) {} }
};

function visual(box, a, o = {}) {
  const want = a.scene === "custom" ? "custom:" + a.id : sceneKey(a.scene);
  if (box.dataset.v === want && box.firstChild) return;
  box.dataset.v = want; box.innerHTML = "";
  const canvas = k => { const c = document.createElement("canvas"); box.appendChild(c); mount(c, k, o); };
  if (a.scene === "custom") {
    const m = media.peek(a.id);
    if (m) { box.appendChild(mediaEl(m)); return; }
    media.get(a.id).then(m2 => { if (box.dataset.v !== want) return; box.innerHTML = ""; m2 ? box.appendChild(mediaEl(m2)) : canvas("sunrise"); });
    return;
  }
  canvas(want);
}
function mediaEl(m) {
  let el;
  if (m.type.startsWith("video")) { el = document.createElement("video"); el.src = m.url; el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true; el.setAttribute("playsinline", ""); el.play && el.play().catch(() => {}); }
  else { el = document.createElement("img"); el.src = m.url; el.alt = ""; el.className = "kb"; }
  return el;
}

window.HoraScenes = { SCENES, mount, media, visual, sceneKey };
})();
