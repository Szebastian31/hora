(() => {
// Natal chart: birth time -> UTC, angles, houses, aspects, and how sure we are about each.
const {norm360, sinD, cosD, R2D, D2R} = Astro;
const T_ = "\uFE0E"; // text presentation, so phones don't turn the glyphs into emoji

const SIGNS = [
  {glyph:"♈"+T_, element:"fire",  mode:"cardinal", ruler:"mars"},
  {glyph:"♉"+T_, element:"earth", mode:"fixed",    ruler:"venus"},
  {glyph:"♊"+T_, element:"air",   mode:"mutable",  ruler:"mercury"},
  {glyph:"♋"+T_, element:"water", mode:"cardinal", ruler:"moon"},
  {glyph:"♌"+T_, element:"fire",  mode:"fixed",    ruler:"sun"},
  {glyph:"♍"+T_, element:"earth", mode:"mutable",  ruler:"mercury"},
  {glyph:"♎"+T_, element:"air",   mode:"cardinal", ruler:"venus"},
  {glyph:"♏"+T_, element:"water", mode:"fixed",    ruler:"mars"},
  {glyph:"♐"+T_, element:"fire",  mode:"mutable",  ruler:"jupiter"},
  {glyph:"♑"+T_, element:"earth", mode:"cardinal", ruler:"saturn"},
  {glyph:"♒"+T_, element:"air",   mode:"fixed",    ruler:"saturn"},
  {glyph:"♓"+T_, element:"water", mode:"mutable",  ruler:"jupiter"},
];
L.bind(SIGNS, "signs", ["name"]);
const PLANETS = {
  sun:{glyph:"☉"}, moon:{glyph:"☽"}, mercury:{glyph:"☿"},
  venus:{glyph:"♀"+T_}, mars:{glyph:"♂"+T_}, jupiter:{glyph:"♃"},
  saturn:{glyph:"♄"}, uranus:{glyph:"♅"}, neptune:{glyph:"♆"},
  pluto:{glyph:"♇"}, node:{glyph:"☊"},
  asc:{glyph:"AC"}, mc:{glyph:"MC"},
};
L.bind(PLANETS, "planets", ["name"]);
const ASPECTS = [
  {name:"conjunction", angle:0,   orb:8, glyph:"☌", kind:"blend"},
  {name:"sextile",     angle:60,  orb:5, glyph:"⚹", kind:"easy"},
  {name:"square",      angle:90,  orb:7, glyph:"□", kind:"hard"},
  {name:"trine",       angle:120, orb:7, glyph:"△", kind:"easy"},
  {name:"opposition",  angle:180, orb:8, glyph:"☍", kind:"hard"},
];
// translated aspect name ("trine") and reading verb ("flows easily with"); `name` stays the English key
ASPECTS.forEach(a => Object.defineProperties(a, {
  label:{get(){ return L.t("aspects." + a.name + ".name"); }}, verb:{get(){ return L.t("aspects." + a.name + ".verb"); }}}));

const signOf = lon => Math.floor(norm360(lon)/30);
function fmtDeg(lon, withSign=true){
  const l = norm360(lon), s = signOf(l), within = l - s*30;
  let d = Math.floor(within), m = Math.round((within-d)*60);
  if(m === 60){ d++; m = 0; }
  return `${d}°${String(m).padStart(2,"0")}′` + (withSign ? ` ${SIGNS[s].name}` : "");
}
const angDist = (a,b) => { const d = Math.abs(norm360(a-b)); return d > 180 ? 360-d : d; };

// ---- Time zones. The browser's Intl data includes each zone's full history of summer-time rules,
// so a 1975 Warsaw birth time gets the offset that was really in force that day.
const fmtCache = {};
function tzOffsetMin(utcMs, tz){
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat("en-US", {timeZone:tz, hourCycle:"h23",
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"}));
  const p = {}; for(const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const asUTC = Date.UTC(+p.year, +p.month-1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(utcMs/1000)*1000)/60000);
}
// Local wall-clock time in `tz` -> UTC Date. Flags times that happened twice (clocks went back)
// or never happened (clocks jumped forward).
function localToUTC(y, mo, d, h, mi, tz){
  const wall = Date.UTC(y, mo-1, d, h, mi);
  const offs = [...new Set([tzOffsetMin(wall-43200000, tz), tzOffsetMin(wall, tz), tzOffsetMin(wall+43200000, tz)])];
  const hits = offs.map(o => wall - o*60000).filter(t => tzOffsetMin(t, tz)*60000 === wall - t).sort((a,b)=>a-b);
  if(hits.length >= 1){
    return {date:new Date(hits[0]), offsetMin:(wall-hits[0])/60000, ambiguous: hits.length > 1,
            alt: hits.length > 1 ? new Date(hits[1]) : null, gap:false};
  }
  const t = wall - offs[0]*60000;
  return {date:new Date(t), offsetMin:offs[0], ambiguous:false, alt:null, gap:true};
}
function fmtOffset(min){
  const s = min < 0 ? "−" : "+", a = Math.abs(min);
  return `UTC${s}${Math.floor(a/60)}${a%60 ? ":"+String(a%60).padStart(2,"0") : ""}`;
}

// ---- Angles
function angles(date, lat, lon){
  const ramc = Astro.lstDeg(date, lon), eps = Astro.obliquityDeg(date);
  const mc = norm360(Math.atan2(sinD(ramc), cosD(ramc)*cosD(eps))*R2D);
  const asc = norm360(Math.atan2(cosD(ramc), -(sinD(eps)*Math.tan(lat*D2R) + cosD(eps)*sinD(ramc)))*R2D);
  return {asc, mc, ramc, eps};
}

// ---- Houses
const HOUSE_SYSTEMS = L.bind({placidus:{}, whole:{}, equal:{}, porphyry:{}}, "houseSystems", ["name"]);
function raToLon(ra, eps){ return norm360(Math.atan2(sinD(ra), cosD(ra)*cosD(eps))*R2D); }
function placidusCusp(ramc, eps, lat, fn){
  let lon = raToLon(fn(90, 90), eps);
  for(let i=0;i<30;i++){
    const dec = Math.asin(sinD(eps)*sinD(lon))*R2D;
    const x = Math.tan(lat*D2R)*Math.tan(dec*D2R);
    if(Math.abs(x) >= 1) return null;                 // circumpolar: Placidus breaks down
    const ad = Math.asin(x)*R2D, dsa = 90 + ad, nsa = 90 - ad;
    const next = raToLon(fn(dsa, nsa), eps);
    if(angDist(next, lon) < 1e-7){ lon = next; break; }
    lon = next;
  }
  return lon;
}
function houses(system, ang, lat){
  const {asc, mc, ramc, eps} = ang, c = new Array(12);
  if(system === "whole"){ const s = signOf(asc)*30; for(let i=0;i<12;i++) c[i] = norm360(s + 30*i); return {cusps:c, system}; }
  if(system === "equal"){ for(let i=0;i<12;i++) c[i] = norm360(asc + 30*i); return {cusps:c, system}; }
  if(system === "placidus" && Math.abs(lat) < 66){
    const h11 = placidusCusp(ramc, eps, lat, (dsa)=> ramc + dsa/3);
    const h12 = placidusCusp(ramc, eps, lat, (dsa)=> ramc + 2*dsa/3);
    const h2  = placidusCusp(ramc, eps, lat, (dsa,nsa)=> ramc + 180 - 2*nsa/3);
    const h3  = placidusCusp(ramc, eps, lat, (dsa,nsa)=> ramc + 180 - nsa/3);
    if([h11,h12,h2,h3].every(v => v !== null)){
      c[0]=asc; c[1]=h2; c[2]=h3; c[3]=norm360(mc+180); c[4]=norm360(h11+180); c[5]=norm360(h12+180);
      c[6]=norm360(asc+180); c[7]=norm360(h2+180); c[8]=norm360(h3+180); c[9]=mc; c[10]=h11; c[11]=h12;
      return {cusps:c, system};
    }
  }
  // Porphyry: split each quadrant into three equal parts (also the fallback near the poles)
  const q1 = norm360(asc - mc), q2 = norm360(mc + 180 - asc);
  c[9]=mc; c[10]=norm360(mc+q1/3); c[11]=norm360(mc+2*q1/3);
  c[0]=asc; c[1]=norm360(asc+q2/3); c[2]=norm360(asc+2*q2/3);
  for(let i=0;i<6;i++) c[(i+3)%12] = norm360(c[(i+9)%12] + 180);
  return {cusps:c, system: system === "porphyry" ? "porphyry" : "porphyry-fallback"};
}
function houseOf(lon, cusps){
  for(let i=0;i<12;i++){
    const a = cusps[i], b = cusps[(i+1)%12];
    if(norm360(lon - a) < norm360(b - a)) return i+1;
  }
  return 1;
}

// ---- Aspects between two sets of points
function aspectsBetween(A, B, orbScale=1, same=false){
  const out = [], ka = Object.keys(A), kb = Object.keys(B);
  for(let i=0;i<ka.length;i++){
    for(let j = same ? i+1 : 0; j<kb.length; j++){
      const a = ka[i], b = kb[j];
      if(same && ((a==="asc"&&b==="mc")||(a==="mc"&&b==="asc"))) continue;
      if((a==="node"||b==="node") && same) continue;
      const d = angDist(A[a].lon, B[b].lon);
      for(const asp of ASPECTS){
        const lum = (a==="sun"||a==="moon"||b==="sun"||b==="moon") ? 2 : 0;
        const orb = (asp.orb + lum)*orbScale;
        const diff = Math.abs(d - asp.angle);
        if(diff <= orb){ out.push({a, b, aspect:asp, orb:diff}); break; }
      }
    }
  }
  return out.sort((x,y)=>x.orb - y.orb);
}

// ---- Build the whole natal chart for a profile
// profile: {name, birthName, date:"YYYY-MM-DD", time:"HH:MM"|null, timeMode:"exact"|"approx"|"unknown",
//           timeSpread (min), place:{name, lat, lon, tz}}
function natal(profile, settings){
  const [y,mo,d] = profile.date.split("-").map(Number);
  const known = profile.timeMode !== "unknown" && profile.time;
  const [h,mi] = known ? profile.time.split(":").map(Number) : [12,0];
  const {lat, lon, tz} = profile.place;
  const conv = localToUTC(y, mo, d, h, mi, tz);
  const utc = conv.date;
  const pos = Astro.positions(utc);
  const chart = {utc, conv, pos, timeKnown: !!known, lat, lon, notes:[]};

  if(conv.ambiguous) chart.notes.push({k:"noteTwice", v:{time:profile.time}});
  if(conv.gap) chart.notes.push({k:"noteGap", v:{time:profile.time}});

  if(known){
    chart.angles = angles(utc, lat, lon);
    chart.points = {...pos, asc:{lon:chart.angles.asc}, mc:{lon:chart.angles.mc}};
    chart.houses = houses(settings.houseSystem || "placidus", chart.angles, lat);
    if(chart.houses.system === "porphyry-fallback") chart.notes.push({k:"notePolar"});
    chart.risingCertainty = risingCertainty(utc, lat, lon, profile.timeMode === "approx" ? (profile.timeSpread||30) : 0);
  } else {
    chart.points = {...pos};
    // without a time we use "solar houses": the Sun's sign becomes the first house
    const s = signOf(pos.sun.lon)*30;
    chart.houses = {cusps:[...Array(12)].map((_,i)=>norm360(s+30*i)), system:"solar"};
    chart.risingOptions = risingOptionsForDay(y, mo, d, tz, lat, lon);
  }
  // Moon covers ~13° a day, so without a time it may have changed sign during the day
  if(!known){
    const a = Astro.positions(localToUTC(y,mo,d,0,0,tz).date).moon.lon;
    const b = Astro.positions(localToUTC(y,mo,d,23,59,tz).date).moon.lon;
    if(signOf(a) !== signOf(b)) chart.moonOptions = [signOf(a), signOf(b)];
  }
  chart.houseOfPlanet = {};
  for(const k of Object.keys(pos)) chart.houseOfPlanet[k] = houseOf(pos[k].lon, chart.houses.cusps);
  const pts = {...chart.points}; delete pts.node;
  chart.aspects = aspectsBetween(pts, pts, 1, true);
  chart.balance = balance(chart);
  return chart;
}

// How many minutes until the rising sign changes, in each direction
function risingCertainty(utc, lat, lon, spread){
  const sign = signOf(angles(utc, lat, lon).asc);
  let before = null, after = null;
  for(let m=1;m<=150;m++){
    if(after === null && signOf(angles(new Date(utc.getTime()+m*60000), lat, lon).asc) !== sign) after = m;
    if(before === null && signOf(angles(new Date(utc.getTime()-m*60000), lat, lon).asc) !== sign) before = m;
    if(before !== null && after !== null) break;
  }
  const out = {sign, before, after, spread, alternatives:[]};
  if(spread){
    for(const m of [-spread, spread]){
      const s = signOf(angles(new Date(utc.getTime()+m*60000), lat, lon).asc);
      if(s !== sign && !out.alternatives.includes(s)) out.alternatives.push(s);
    }
  }
  return out;
}
// Every rising sign possible on that date, with the local clock times it was rising
function risingOptionsForDay(y, mo, d, tz, lat, lon){
  const start = localToUTC(y, mo, d, 0, 0, tz).date.getTime(), list = [];
  let cur = null;
  for(let m=0;m<=1440;m+=4){
    const t = new Date(start + m*60000), s = signOf(angles(t, lat, lon).asc);
    if(!cur || cur.sign !== s){ cur = {sign:s, from:m, to:m}; list.push(cur); } else cur.to = m;
  }
  const hm = m => `${String(Math.floor(m/60)%24).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  return list.map(x => ({sign:x.sign, from:hm(x.from), to:hm(Math.min(x.to+4,1439))}));
}

// Element and modality balance (Sun, Moon and Ascendant count double)
function balance(chart){
  const el = {fire:0, earth:0, air:0, water:0}, md = {cardinal:0, fixed:0, mutable:0};
  const w = {sun:2, moon:2, asc:2, mercury:1, venus:1, mars:1, jupiter:1, saturn:1};
  for(const k of Object.keys(w)){
    if(!chart.points[k]) continue;
    const s = SIGNS[signOf(chart.points[k].lon)];
    el[s.element] += w[k]; md[s.mode] += w[k];
  }
  const top = o => Object.entries(o).sort((a,b)=>b[1]-a[1])[0][0];
  return {elements:el, modes:md, element:top(el), mode:top(md)};
}

window.Chart = { SIGNS, PLANETS, ASPECTS, HOUSE_SYSTEMS, signOf, fmtDeg, angDist, tzOffsetMin, localToUTC, fmtOffset,
  angles, houses, houseOf, aspectsBetween, natal };
})();
