/* Hora wake-up scenes: animated canvases, plus the user's own photos, videos and sounds kept in IndexedDB. */
(() => {
const TAU = Math.PI * 2;
const rng = seed => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const lin = (x, y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
function rad(x, cx, cy, r, stops, r0 = 0) {
  const g = x.createRadialGradient(cx, cy, r0, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function vignette(x, w, h, a = .38) {
  const g = x.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .35, w / 2, h * .45, Math.max(w, h) * .85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); x.fillStyle = g; x.fillRect(0, 0, w, h);
}
function ridge(x, w, h, base, amp, ph, f = [1.3, 3.1, 7.3], m = [1, .45, .12]) {
  x.beginPath(); x.moveTo(-2, h + 2);
  for (let i = 0; i <= 64; i++) {
    const u = i / 64, y = base - amp * (m[0] * Math.sin(u * f[0] * TAU * .5 + ph) + m[1] * Math.sin(u * f[1] * TAU * .5 + ph * 1.7 + 1) + m[2] * Math.sin(u * f[2] * TAU * .5 + ph * 2.3 + 2));
    x.lineTo(u * w, h * y);
  }
  x.lineTo(w + 2, h + 2); x.closePath();
}

const D = {};
(() => {
  let r = rng(11);
  D.stars = Array.from({ length: 170 }, () => ({ x: r(), y: r() * .75, z: r() < .08 ? 1.7 : .45 + r() * .8, p: r() * TAU }));
  D.peaks = Array.from({ length: 30 }, (_, i) => ({ x: i / 29, y: .055 + r() * .05 + (i % 4 === 0 ? .03 : 0) }));
  r = rng(23); D.glit = Array.from({ length: 60 * 3 }, () => r());
  r = rng(31); const warm = ["255,190,120", "255,140,150", "130,170,255", "255,220,160"];
  D.bokeh = Array.from({ length: 26 }, () => ({ x: r(), y: r(), rr: .03 + r() * .09, c: warm[(r() * 4) | 0], p: r() * TAU }));
  D.drops = Array.from({ length: 90 }, () => ({ x: r(), y: r(), rr: .6 + r() * 2.6 }));
  D.fall = Array.from({ length: 16 }, () => ({ x: r(), y: r(), v: .05 + r() * .12, rr: 1.8 + r() * 2, p: r() * TAU }));
})();
const STRIP = {};
function strip(rgb, tip) {
  const k = rgb + tip; if (STRIP[k]) return STRIP[k];
  const c = document.createElement("canvas"); c.width = 1; c.height = 128;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(.06, `rgba(${rgb},1)`); g.addColorStop(.3, `rgba(${rgb},.55)`); g.addColorStop(.7, `rgba(${tip},.22)`); g.addColorStop(1, `rgba(${tip},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 1, 128); return (STRIP[k] = c);
}

const SCENES = {
  sunrise: { name: "Daybreak", draw(x, w, h, t) {
    const s = w / 390, k = .5 + .5 * Math.sin(t * .07), M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#0d1240"], [.3, "#2f3274"], [.5, "#8c5582"], [.62, "#e88a76"], [.72, "#ffc896"], [1, "#fff0d8"]]); x.fillRect(0, 0, w, h);
    const sx = w * .5, sy = h * (.68 - .03 * k);
    x.save(); x.globalCompositeOperation = "screen";
    rad(x, sx, sy, M * .8, [[0, "rgba(255,226,186,.6)"], [.22, "rgba(255,168,128,.28)"], [.55, "rgba(180,90,140,.1)"], [1, "rgba(0,0,0,0)"]]);
    rad(x, sx, sy, Math.min(w, h) * .13, [[0, "#fffdf6"], [.55, "rgba(255,246,222,.95)"], [1, "rgba(255,236,200,0)"]]);
    const fl = x.createLinearGradient(0, 0, w, 0); fl.addColorStop(0, "rgba(255,230,200,0)"); fl.addColorStop(.5, `rgba(255,236,210,${.45 + .15 * k})`); fl.addColorStop(1, "rgba(255,230,200,0)");
    x.fillStyle = fl; x.fillRect(0, sy - 1.2 * s, w, 2.4 * s);
    x.restore();
    const L = [[.715, .012, "#d9918f", "#b77587", .3], [.75, .02, "#9a6283", "#7c4f78", .5], [.80, .028, "#5e3e6a", "#46305a", .75], [.875, .03, "#2f2244", "#231a36", 1.05], [.955, .022, "#150f24", "#0d0918", 1.5]];
    L.forEach(([b, a, c0, c1, sp], i) => {
      ridge(x, w, h, b, a, t * .012 * sp + i * 1.9);
      x.fillStyle = lin(x, h * (b - a * 1.6), h, [[0, c0], [.5, c1], [1, c1]]); x.fill();
      if (i < 4) { x.fillStyle = lin(x, h * (b - .02), h * (b + .05), [[0, "rgba(255,214,190,0)"], [.55, `rgba(255,214,190,${.16 - i * .03 + .04 * Math.sin(t * .2 + i)})`], [1, "rgba(255,214,190,0)"]]); x.fillRect(0, h * (b - .02), w, h * .07); }
    });
    vignette(x, w, h, .3);
  } },
  bloom: { name: "Bloom", draw(x, w, h, t) {
    const M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#140a26"], [1, "#22102e"]]); x.fillRect(0, 0, w, h);
    const B = [["255,112,84", .32, .3, .55, .07, .05, 0], ["255,182,88", .7, .62, .5, .05, .08, 1.7], ["160,86,255", .75, .22, .6, .06, .04, 3.1], ["58,132,255", .2, .78, .55, .045, .06, 4.4], ["255,84,160", .55, .9, .45, .08, .05, 5.6]];
    x.save(); x.globalCompositeOperation = "screen";
    B.forEach(([c, cx, cy, r, fx, fy, p]) => {
      const px = (cx + .22 * Math.sin(t * fx + p)) * w, py = (cy + .16 * Math.cos(t * fy + p * 1.3)) * h, rr = r * M * (.92 + .08 * Math.sin(t * .11 + p));
      rad(x, px, py, rr, [[0, `rgba(${c},.9)`], [.4, `rgba(${c},.42)`], [.75, `rgba(${c},.08)`], [1, `rgba(${c},0)`]]);
    });
    x.restore();
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "rgba(255,255,255,.07)"); g.addColorStop(.45, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.03)");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    vignette(x, w, h, .32);
  } },
  silk: { name: "Silk", draw(x, w, h, t) {
    const s = w / 390;
    x.fillStyle = lin(x, 0, h, [[0, "#070a22"], [.6, "#140f38"], [1, "#1d0f2c"]]); x.fillRect(0, 0, w, h);
    x.save(); x.globalCompositeOperation = "screen";
    rad(x, w * .55, h * .5, Math.max(w, h) * .55, [[0, "rgba(255,110,170,.22)"], [1, "rgba(255,110,170,0)"]]);
    x.globalCompositeOperation = "lighter"; x.lineWidth = 1.1 * s;
    const ribbon = (N, cy, amp, sp, hue0, hueSpan, alpha, off) => {
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), env = Math.sin(u * Math.PI);
        x.strokeStyle = `hsla(${(hue0 + u * hueSpan) % 360},90%,${62 + 10 * env}%,${alpha * (.25 + env)})`;
        x.beginPath();
        for (let j = 0; j <= 44; j++) {
          const v = j / 44, xx = v * w * 1.1 - w * .05;
          const y = h * (cy + amp * Math.sin(v * 2.4 + t * .22 * sp + u * 1.4 + off) + amp * .45 * Math.sin(v * 5.3 - t * .15 * sp + u * 2.8 + off) + (u - .5) * .2 * (.6 + .4 * Math.sin(v * 3 + t * .1)));
          j ? x.lineTo(xx, y) : x.moveTo(xx, y);
        }
        x.stroke();
      }
    };
    ribbon(54, .5, .14, 1, 320, 110, .2, 0);
    ribbon(30, .62, .1, .8, 180, 70, .12, 2.2);
    x.restore();
    vignette(x, w, h, .35);
  } },
  orbit: { name: "Orbit", draw(x, w, h, t) {
    const s = w / 390, M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#010208"], [.6, "#050a1e"], [1, "#081233"]]); x.fillRect(0, 0, w, h);
    D.stars.forEach(st => { x.fillStyle = `rgba(220,230,255,${(.4 + .4 * Math.sin(t * 1.3 + st.p)) * .85})`; x.fillRect(st.x * w, st.y * h * .9, st.z * s * 1.2, st.z * s * 1.2); });
    const R = w * 1.25, cx = w * .5, cy = h * .74 + R, ang = -Math.PI / 2 + .18 * Math.sin(t * .04), px = cx + Math.cos(ang) * R, py = cy + Math.sin(ang) * R;
    const at = x.createRadialGradient(cx, cy, R * .97, cx, cy, R * 1.12);
    at.addColorStop(0, "rgba(70,140,255,0)"); at.addColorStop(.25, "rgba(90,160,255,.55)"); at.addColorStop(.5, "rgba(70,120,255,.18)"); at.addColorStop(1, "rgba(40,80,255,0)");
    x.fillStyle = at; x.beginPath(); x.arc(cx, cy, R * 1.12, 0, TAU); x.fill();
    x.fillStyle = lin(x, cy - R, cy - R * .6, [[0, "#0a1636"], [1, "#02040c"]]); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip();
    rad(x, px, py, R * .7, [[0, "rgba(120,170,255,.35)"], [.4, "rgba(60,100,200,.12)"], [1, "rgba(0,0,0,0)"]]);
    x.restore();
    const rim = x.createLinearGradient(px - w * .9, 0, px + w * .9, 0);
    rim.addColorStop(0, "rgba(160,200,255,0)"); rim.addColorStop(.5, "rgba(225,240,255,.95)"); rim.addColorStop(1, "rgba(160,200,255,0)");
    x.strokeStyle = rim; x.lineWidth = 1.8 * s; x.beginPath(); x.arc(cx, cy, R, ang - .5, ang + .5); x.stroke();
    x.save(); x.globalCompositeOperation = "lighter";
    const b = .8 + .2 * Math.sin(t * .3);
    rad(x, px, py, M * .5, [[0, `rgba(255,236,214,${.55 * b})`], [.15, "rgba(255,190,150,.18)"], [1, "rgba(0,0,0,0)"]]);
    rad(x, px, py, 16 * s, [[0, "#ffffff"], [.4, "rgba(255,250,240,.9)"], [1, "rgba(255,240,220,0)"]]);
    const st = x.createLinearGradient(0, 0, w, 0); st.addColorStop(0, "rgba(255,240,225,0)"); st.addColorStop(.5, `rgba(255,244,232,${.7 * b})`); st.addColorStop(1, "rgba(255,240,225,0)");
    x.fillStyle = st; x.fillRect(0, py - .9 * s, w, 1.8 * s);
    x.fillStyle = `rgba(255,244,232,${.25 * b})`; x.fillRect(px - .6 * s, py - h * .12, 1.2 * s, h * .24);
    x.restore();
    vignette(x, w, h, .3);
  } },
  ocean: { name: "Tide", draw(x, w, h, t) {
    const s = w / 390, hz = h * .57;
    x.fillStyle = lin(x, 0, hz, [[0, "#141c52"], [.45, "#5d4f8e"], [.78, "#e6967f"], [1, "#ffd6a8"]]); x.fillRect(0, 0, w, hz);
    x.save(); x.globalCompositeOperation = "screen";
    rad(x, w / 2, hz, h * .5, [[0, "rgba(255,220,180,.75)"], [.3, "rgba(255,170,140,.25)"], [1, "rgba(0,0,0,0)"]]);
    rad(x, w / 2, hz + 2 * s, Math.min(w, h) * .085, [[0, "#fffaf0"], [.6, "rgba(255,244,220,.95)"], [1, "rgba(255,236,200,0)"]]);
    x.restore();
    x.fillStyle = lin(x, hz, h, [[0, "#8a6a92"], [.18, "#4a3f78"], [.6, "#1f2150"], [1, "#0a0d2a"]]); x.fillRect(0, hz, w, h - hz);
    x.save(); x.globalCompositeOperation = "screen";
    const col = x.createLinearGradient(0, 0, w, 0); col.addColorStop(0, "rgba(255,200,160,0)"); col.addColorStop(.5, "rgba(255,200,160,.22)"); col.addColorStop(1, "rgba(255,200,160,0)");
    x.fillStyle = col; x.beginPath(); x.moveTo(w * .46, hz); x.lineTo(w * .54, hz); x.lineTo(w * .82, h); x.lineTo(w * .18, h); x.fill();
    x.restore();
    x.lineCap = "round";
    for (let k = 0; k < 18; k++) {
      const f = k / 17, y = hz + Math.pow(f, 1.9) * (h - hz);
      x.strokeStyle = `rgba(255,255,255,${.035 + .025 * f})`; x.lineWidth = (.8 + f) * s; x.beginPath();
      for (let xx = 0; xx <= w; xx += 8 * s) x.lineTo(xx, y + Math.sin(xx / w * 12 + t * (.6 + f) + k) * (1 + k * .4) * s);
      x.stroke();
    }
    x.save(); x.globalCompositeOperation = "lighter";
    for (let k = 0; k < 60; k++) {
      const f = k / 59, y = hz + 2 + Math.pow(f, 1.9) * (h - hz), spread = w * (.02 + .24 * f);
      for (let j = 0; j < 3; j++) {
        const xx = w / 2 + (D.glit[k * 3 + j] - .5) * 2 * spread * (.75 + .25 * Math.sin(t * .6 + k)), len = (3 + 18 * f) * s;
        const a = Math.max(0, Math.sin(t * 1.8 + k * 1.3 + j * 2.1)) * (1 - f * .5);
        x.strokeStyle = `rgba(255,226,190,${a * .7})`; x.lineWidth = (.8 + 1.6 * f) * s;
        x.beginPath(); x.moveTo(xx - len / 2, y); x.lineTo(xx + len / 2, y); x.stroke();
      }
    }
    x.restore();
    x.fillStyle = lin(x, hz - h * .03, hz + h * .03, [[0, "rgba(255,220,200,0)"], [.5, "rgba(255,220,200,.25)"], [1, "rgba(255,220,200,0)"]]); x.fillRect(0, hz - h * .03, w, h * .06);
    vignette(x, w, h, .32);
  } },
  dunes: { name: "Dunes", draw(x, w, h, t) {
    const s = w / 390, M = Math.max(w, h);
    x.fillStyle = lin(x, 0, h, [[0, "#22306e"], [.3, "#7d6aa0"], [.5, "#e7a083"], [.6, "#ffd2a0"], [1, "#ffe6c4"]]); x.fillRect(0, 0, w, h);
    const sy = h * (.57 - .015 * Math.sin(t * .06));
    x.save(); x.globalCompositeOperation = "screen";
    rad(x, w * .68, sy, M * .6, [[0, "rgba(255,232,190,.7)"], [.25, "rgba(255,190,140,.22)"], [1, "rgba(0,0,0,0)"]]);
    rad(x, w * .68, sy, Math.min(w, h) * .07, [[0, "#fffdf5"], [.6, "rgba(255,248,226,.95)"], [1, "rgba(255,240,210,0)"]]);
    x.restore();
    const L = [[.63, .02, "#e8a479", "#c97c5c", .2], [.7, .035, "#d98a5e", "#a75a40", .35], [.8, .05, "#b8653f", "#7e3c2a", .55], [.93, .06, "#8a4129", "#4e2016", .8]];
    L.forEach(([b, a, c0, c1, sp], i) => {
      ridge(x, w, h, b, a, t * .01 * sp + i * 2.4, [1.1, 2.3, 4.7], [1, .35, .08]);
      x.fillStyle = lin(x, h * (b - a * 1.4), h * (b + .12), [[0, c0], [1, c1]]); x.fill();
      x.fillStyle = lin(x, h * (b - .025), h * (b + .04), [[0, "rgba(255,226,190,0)"], [.5, `rgba(255,226,190,${.2 - i * .04})`], [1, "rgba(255,226,190,0)"]]); x.fillRect(0, h * (b - .025), w, h * .065);
    });
    x.strokeStyle = "rgba(255,220,180,.08)"; x.lineWidth = s;
    for (let k = 0; k < 9; k++) { const y = h * (.9 + k * .012); x.beginPath(); for (let xx = 0; xx <= w; xx += 10 * s) x.lineTo(xx, y + Math.sin(xx / w * 9 + k + t * .05) * 3 * s); x.stroke(); }
    vignette(x, w, h, .28);
  } },
  aurora: { name: "Aurora", draw(x, w, h, t) {
    const s = w / 390, H = h * .76;
    x.fillStyle = lin(x, 0, H, [[0, "#01030c"], [.55, "#061330"], [1, "#0b2442"]]); x.fillRect(0, 0, w, H);
    D.stars.forEach(st => { if (st.y > .7) return; x.fillStyle = `rgba(255,255,255,${(.4 + .4 * Math.sin(t * 1.5 + st.p)) * .8})`; x.fillRect(st.x * w, st.y * H, st.z * s * 1.2, st.z * s * 1.2); });
    const step = Math.max(2.5, w / 140);
    const lights = mirror => {
      x.save(); x.globalCompositeOperation = "lighter";
      [["80,255,170", "255,120,200", .36], ["60,220,255", "160,120,255", .44], ["140,255,190", "255,160,220", .52]].forEach(([c, tip, b], k) => {
        const im = strip(c, tip);
        for (let xx = 0; xx < w; xx += step) {
          const u = xx / w, yy = H * (b + .07 * Math.sin(u * 3.6 + t * .18 + k * 2) + .03 * Math.sin(u * 9 - t * .31 + k));
          const len = H * (.22 + .12 * Math.sin(u * 5 + t * .4 + k * 3)), a = Math.max(0, .14 + .1 * Math.sin(u * 10 + t * .7 + k)) * (mirror ? .35 : 1);
          x.globalAlpha = a; x.drawImage(im, xx, yy - len, step + .5, len);
        }
      });
      x.globalAlpha = 1; x.restore();
    };
    lights(false);
    x.fillStyle = "#030712"; x.beginPath(); x.moveTo(0, H);
    D.peaks.forEach(p => x.lineTo(p.x * w, H - p.y * h)); x.lineTo(w, H); x.fill();
    x.fillStyle = lin(x, H, h, [[0, "#0a1a30"], [1, "#01040b"]]); x.fillRect(0, H, w, h - H);
    x.save(); x.beginPath(); x.rect(0, H, w, h - H); x.clip(); x.translate(0, H * 2); x.scale(1, -1); lights(true); x.restore();
    x.fillStyle = "#020610"; x.beginPath(); x.moveTo(0, H);
    D.peaks.forEach(p => x.lineTo(p.x * w, H + p.y * h * .35)); x.lineTo(w, H); x.fill();
    x.strokeStyle = "rgba(170,255,220,.07)"; x.lineWidth = s;
    for (let k = 0; k < 8; k++) { const y = H + h * (.03 + k * .025); x.beginPath(); x.moveTo(w * (.1 + .05 * Math.sin(t * .5 + k)), y); x.lineTo(w * (.9 - .05 * Math.sin(t * .4 + k)), y); x.stroke(); }
    vignette(x, w, h, .35);
  } },
  rain: { name: "Rain", draw(x, w, h, t) {
    const s = w / 390;
    x.fillStyle = lin(x, 0, h, [[0, "#10142e"], [.55, "#261f42"], [1, "#3a2742"]]); x.fillRect(0, 0, w, h);
    x.save(); x.globalCompositeOperation = "lighter";
    D.bokeh.forEach(b => {
      const r = b.rr * Math.max(w, h * .6), bx = (b.x + .015 * Math.sin(t * .15 + b.p)) * w, by = b.y * h, a = .14 + .1 * Math.sin(t * .5 + b.p);
      rad(x, bx, by, r, [[0, `rgba(${b.c},${a})`], [.7, `rgba(${b.c},${a * .5})`], [1, `rgba(${b.c},0)`]]);
    });
    x.restore();
    x.fillStyle = "rgba(20,25,50,.2)"; x.fillRect(0, 0, w, h);
    D.drops.forEach(d => {
      const dx = d.x * w, dy = d.y * h, r = d.rr * s;
      x.fillStyle = "rgba(255,255,255,.08)"; x.beginPath(); x.arc(dx, dy, r, 0, TAU); x.fill();
      x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.arc(dx - r * .3, dy - r * .35, r * .28, 0, TAU); x.fill();
    });
    D.fall.forEach(d => {
      const dy = (((d.y + t * d.v) % 1.2) - .1) * h, dx = d.x * w + Math.sin(t * .8 + d.p) * 2 * s, r = d.rr * s, len = r * 14;
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = r * .7; x.lineCap = "round";
      x.beginPath(); x.moveTo(dx, dy - len); x.lineTo(dx, dy); x.stroke();
      x.fillStyle = "rgba(255,255,255,.2)"; x.beginPath(); x.ellipse(dx, dy, r, r * 1.25, 0, 0, TAU); x.fill();
      x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(dx - r * .3, dy - r * .4, r * .3, 0, TAU); x.fill();
    });
    vignette(x, w, h, .35);
  } }
};
const ALIAS = { forest: "silk", clouds: "bloom" };
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
    try { SCENES[o.scene].draw(x, w, h, t + 40); } catch (e) {}
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
