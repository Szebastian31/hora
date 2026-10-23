(() => {
// Astronomy: everything calculated on-device. Based on Caelum's astro.js, extended for astrology:
// a more precise Moon (sign changes need it), Uranus–Pluto, the lunar nodes, longitudes of date
// (tropical zodiac) and speeds, so we can tell when a planet is retrograde.
const D2R = Math.PI/180, R2D = 180/Math.PI;
const norm360 = a => ((a%360)+360)%360;
const sinD = a => Math.sin(a*D2R), cosD = a => Math.cos(a*D2R);

// Julian Day (UT) from a JS Date
function jd(date){ return date.getTime()/86400000 + 2440587.5; }

// ΔT = TT − UT in seconds (Espenak & Meeus polynomials). Planets move in TT; clocks run in UT.
function deltaT(year){
  let t;
  if(year >= 2005 && year < 2050){ t = year-2000; return 62.92 + 0.32217*t + 0.005589*t*t; }
  if(year >= 1986){ t = year-2000; return 63.86 + 0.3345*t - 0.060374*t*t + 0.0017275*t**3 + 0.000651814*t**4 + 0.00002373599*t**5; }
  if(year >= 1961){ t = year-1975; return 45.45 + 1.067*t - t*t/260 - t**3/718; }
  if(year >= 1941){ t = year-1950; return 29.07 + 0.407*t - t*t/233 + t**3/2547; }
  if(year >= 1920){ t = year-1920; return 21.20 + 0.84493*t - 0.076100*t*t + 0.0020936*t**3; }
  if(year >= 1900){ t = year-1900; return -2.79 + 1.494119*t - 0.0598939*t*t + 0.0061966*t**3 - 0.000197*t**4; }
  const u = (year-1820)/100; return -20 + 32*u*u;
}
// Julian centuries since J2000 in Terrestrial Time
function centuriesTT(date){
  const y = date.getUTCFullYear() + date.getUTCMonth()/12;
  return (jd(date) + deltaT(y)/86400 - 2451545.0)/36525;
}

// Greenwich / local sidereal time in degrees (uses UT)
function gmstDeg(date){
  const d = jd(date) - 2451545.0, T = d/36525;
  return norm360(280.46061837 + 360.98564736629*d + 0.000387933*T*T);
}
function lstDeg(date, lon){ return norm360(gmstDeg(date) + lon); }
function obliquityDeg(date){ const T = centuriesTT(date); return 23.439291 - 0.0130042*T - 1.64e-7*T*T; }

// ---- Sun (Meeus ch. 25, apparent longitude, ~0.01°)
function sunLon(T){
  const L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T;
  const M = 357.52911 + 35999.05029*T - 0.0001537*T*T;
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*sinD(M) + (0.019993 - 0.000101*T)*sinD(2*M) + 0.000289*sinD(3*M);
  const omega = 125.04 - 1934.136*T;
  return norm360(L0 + C - 0.00569 - 0.00478*sinD(omega));
}

// ---- Moon (Meeus ch. 47, the 24 largest longitude terms, ~0.02°)
const MOON_LON = [ // [D, M, M', F, coefficient]
  [0,0,1,0,6.288774],[2,0,-1,0,1.274027],[2,0,0,0,0.658314],[0,0,2,0,0.213618],[0,1,0,0,-0.185116],
  [0,0,0,2,-0.114332],[2,0,-2,0,0.058793],[2,-1,-1,0,0.057066],[2,0,1,0,0.053322],[2,-1,0,0,0.045758],
  [0,1,-1,0,-0.040923],[1,0,0,0,-0.034720],[0,1,1,0,-0.030383],[2,0,0,-2,0.015327],[0,0,1,2,-0.012528],
  [0,0,1,-2,0.010980],[4,0,-1,0,0.010675],[0,0,3,0,0.010034],[4,0,-2,0,0.008548],[2,1,-1,0,-0.007888],
  [2,1,0,0,-0.006766],[1,0,-1,0,-0.005163],[1,1,0,0,0.004987],[2,-1,1,0,0.004036]
];
function moonLonLat(T){
  const Lp = 218.3164477 + 481267.88123421*T - 0.0015786*T*T;
  const D  = 297.8501921 + 445267.1114034*T - 0.0018819*T*T;
  const M  = 357.5291092 + 35999.0502909*T - 0.0001536*T*T;
  const Mp = 134.9633964 + 477198.8675055*T + 0.0087414*T*T;
  const F  = 93.2720950 + 483202.0175233*T - 0.0036539*T*T;
  const E = 1 - 0.002516*T;
  let lon = Lp;
  for(const [d,m,mp,f,c] of MOON_LON){
    const k = Math.abs(m) === 1 ? E : 1;
    lon += c*k*sinD(d*D + m*M + mp*Mp + f*F);
  }
  const lat = 5.128122*sinD(F) + 0.280602*sinD(Mp+F) + 0.277693*sinD(Mp-F) + 0.173237*sinD(2*D-F);
  return [norm360(lon), lat];
}
// mean lunar node (Rahu / North Node); the South Node (Ketu) is opposite
function meanNode(T){ return norm360(125.04452 - 1934.136261*T + 0.0020708*T*T); }

// ---- Planets: Keplerian elements (JPL approximate, 1800–2050), J2000 ecliptic, + rate per century
const ELEM = {
  mercury:[[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],
  venus:[[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],
  earth:[[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0]],
  mars:[[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],
  jupiter:[[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],
  saturn:[[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]],
  uranus:[[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503],[-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589]],
  neptune:[[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664]],
  pluto:[[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684],[-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482]],
};
function helio(name, T){
  const [e0, r] = ELEM[name];
  const [a,e,I,L,w,O] = e0.map((v,i)=>v + r[i]*T);
  const M = norm360(L - w)*D2R, om = (w - O)*D2R, Ir = I*D2R, Or = O*D2R;
  let E = M + e*Math.sin(M);
  for(let i=0;i<8;i++) E = E - (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
  const xp = a*(Math.cos(E) - e), yp = a*Math.sqrt(1-e*e)*Math.sin(E);
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Or), sO = Math.sin(Or), cI = Math.cos(Ir), sI = Math.sin(Ir);
  return [
    (co*cO - so*sO*cI)*xp + (-so*cO - co*sO*cI)*yp,
    (co*sO + so*cO*cI)*xp + (-so*sO + co*cO*cI)*yp,
    (so*sI)*xp + (co*sI)*yp
  ];
}
// general precession in longitude, J2000 ecliptic -> ecliptic of date
function precessLon(T){ return 1.3969713*T + 0.0003086*T*T; }
function planetLonLat(name, T){
  const p = helio(name,T), e = helio("earth",T);
  const x = p[0]-e[0], y = p[1]-e[1], z = p[2]-e[2];
  const dist = Math.hypot(x,y,z);
  // light-time: we see the planet where it was dist*8.3 minutes ago
  const Tl = T - dist*0.0057755/36525;
  const p2 = helio(name,Tl);
  const x2 = p2[0]-e[0], y2 = p2[1]-e[1], z2 = p2[2]-e[2];
  const lon = norm360(Math.atan2(y2,x2)*R2D + precessLon(T));
  const lat = Math.asin(z2/Math.hypot(x2,y2,z2))*R2D;
  return [lon, lat, dist];
}

const BODIES = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","node"];

function bodyLon(name, T){
  if(name === "sun") return sunLon(T);
  if(name === "moon") return moonLonLat(T)[0];
  if(name === "node") return meanNode(T);
  return planetLonLat(name, T)[0];
}

// All positions (tropical ecliptic longitude of date) with daily speed and retrograde flag
function positions(date){
  const T = centuriesTT(date), dT = 0.5/36525;
  const out = {};
  for(const b of BODIES){
    const lon = bodyLon(b, T);
    let speed = norm360(bodyLon(b, T+dT) - bodyLon(b, T-dT) + 180) - 180;  // degrees per day
    out[b] = {lon, speed, retro: speed < 0 && b !== "node"};
  }
  out.moon.lat = moonLonLat(T)[1];
  return out;
}

// Moon phase: 0 new, 180 full; illuminated fraction
function moonPhase(date){
  const T = centuriesTT(date);
  const elong = norm360(moonLonLat(T)[0] - sunLon(T));
  return {elong, illum:(1 - cosD(elong))/2, waxing: elong < 180};
}

// Time (Date) when the Sun reaches a given longitude, searching forward from `from`
function sunReaches(target, from){
  // first jump forward, then refine in either direction
  let t = from.getTime() + norm360(target - sunLon(centuriesTT(from)))/0.98564736*86400000;
  for(let i=0;i<8;i++){
    const diff = norm360(target - sunLon(centuriesTT(new Date(t))) + 180) - 180;
    t += diff/0.98564736*86400000;
    if(Math.abs(diff) < 1e-5) break;
  }
  return new Date(t);
}

// Next new moon (elongation 0) after `from`
function nextNewMoon(from){
  let t = from.getTime() + 86400000*((360 - moonPhase(from).elong)/12.19);
  for(let i=0;i<10;i++){
    const e = moonPhase(new Date(t)).elong;
    const err = e > 180 ? e-360 : e;
    t -= err/12.19*86400000;
    if(Math.abs(err) < 1e-4) break;
  }
  return new Date(t);
}

window.Astro = { D2R, R2D, norm360, sinD, cosD, jd, centuriesTT, gmstDeg, lstDeg, obliquityDeg,
  positions, moonPhase, sunReaches, nextNewMoon, sunLon, BODIES };
})();
