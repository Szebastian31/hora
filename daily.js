(() => {
// Today's reading, built from the real sky at noon today measured against your birth chart.
// The sentences come from the current language (i18n/xx.js); the astrology decides which ones.
const {norm360} = Astro;
const {SIGNS, PLANETS, signOf, angDist, houseOf} = Chart;
const {HOUSE_TEXT, TONES} = Texts;
const t = L.t;

const NATAL = ["sun","moon","mercury","venus","mars","asc","mc"];          // natal points transits are read against
const ORB = {moon:4, sun:2.5, mercury:2.5, venus:2.5, mars:2.5, jupiter:1.5, saturn:1.5};
const COLOUR = {wood:"#5fb36b", fire:"#e0605a", earth:"#e2c15b", metal:"#e8e4d8", water:"#4a78d6"};
// every area of life a day or a week is scored on (1–5); Today shows the first four
const AREAS = ["love","work","energy","mood","money","health","home","social","growth"];

const phaseName = e => t("phases")[Math.floor(norm360(e + 22.5)/45)%8];

function transits(pos, natalPts){
  const out = [];
  for(const tp of Object.keys(ORB)){
    for(const n of NATAL){
      if(!natalPts[n]) continue;
      const d = angDist(pos[tp].lon, natalPts[n].lon);
      for(const a of Chart.ASPECTS){
        const orb = Math.abs(d - a.angle);
        if(orb <= ORB[tp]){ out.push({t:tp, n, aspect:a, orb, weight:(ORB[tp]-orb)/ORB[tp] * (tp === "moon" ? 0.8 : 1)}); break; }
      }
    }
  }
  return out.sort((a,b)=>b.weight - a.weight);
}

// lite: skip the written reading (the week view works out seven days and only needs the numbers)
function day(profile, chart, chi, now=new Date(), lite=false){
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0);
  const pos = Astro.positions(noon);
  const before = Astro.positions(new Date(noon.getTime()-12*3600000)), after = Astro.positions(new Date(noon.getTime()+12*3600000));
  const dp = Chinese.dayPillar(now.getFullYear(), now.getMonth()+1, now.getDate());
  const per = Numerology.personal(profile, now);
  const phase = Astro.moonPhase(noon);
  const d = {
    date:noon, pos, phase, phaseName:phaseName(phase.elong),
    moonSign:signOf(pos.moon.lon), sunSign:signOf(pos.sun.lon),
    moonHouse:houseOf(pos.moon.lon, chart.houses.cusps),
    wheelMoon:Native.totemOf(pos.sun.lon),
    dayPillar:dp, relation:Chinese.relation(chi.dayMaster.element, dp.stem.element),
    clash: dp.branchIndex === chi.clash, myAnimal:chi.animal.name,
    maya:Mayan.today(noon),
    personalDay:per.personalDay, personalMonth:per.personalMonth, personalYear:per.personalYear,
    transits:transits(pos, chart.points),
    retro:["mercury","venus","mars","jupiter","saturn"].filter(k => pos[k].retro),
    ingress:Astro.BODIES.filter(k => k !== "node" && k !== "moon" && signOf(before[k].lon) !== signOf(after[k].lon)).map(k => ({k, sign:signOf(after[k].lon)})),
    colourHex:COLOUR[dp.stem.element], colourName:t("luckColours." + dp.stem.element),
  };
  d.consensus = Consensus.daily(d);
  d.ratings = ratings(d);
  d.overall = AREAS.reduce((a,k) => a + d.ratings[k], 0) / AREAS.length;
  if(!lite){
    d.reading = reading(d);
    d.lucky = Numerology.reduce(d.personalDay + now.getDate() + (d.moonHouse||1), false);
  }
  return d;
}

function ratings(d){
  const r = Object.fromEntries(AREAS.map(k => [k, 3]));
  const add = (k, v) => r[k] += v;
  for(const x of d.transits.slice(0,6)){
    const s = (x.aspect.kind === "easy" ? 1 : x.aspect.kind === "hard" ? -1 : 0.5) * x.weight;
    if(x.t === "venus" || x.n === "venus") add("love", s*1.5);
    if(x.t === "moon") add("mood", s*1.5);
    if(x.t === "mars" || x.t === "sun") add("energy", s*1.5);
    if(x.t === "saturn" || x.t === "jupiter" || x.n === "mc" || x.t === "mercury") add("work", s*1.5);
    if(x.t === "venus" || x.t === "jupiter") add("money", s);
    if(x.t === "mars" || x.t === "saturn" || x.n === "asc") add("health", s);
    if(x.n === "moon" || x.t === "moon") add("home", s);
    if(x.t === "mercury" || x.t === "venus" || x.n === "mercury") add("social", s);
    if(x.t === "jupiter" || x.t === "saturn" || x.n === "sun") add("growth", s);
  }
  const h = d.moonHouse;
  if([5,7].includes(h)) add("love", 1);
  if([6,10].includes(h)) add("work", 1);
  if([2,8].includes(h)) add("money", 1);
  if([1,6].includes(h)) add("health", 0.8);
  if(h === 4) add("home", 1.2);
  if([3,7,11].includes(h)) add("social", 1);
  if([9,12].includes(h)) add("growth", 1);
  if([1,5,9].includes(h) || SIGNS[d.moonSign].element === "fire") add("energy", 0.7);
  if([12,8,4].includes(h)) add("energy", -0.5);
  if(d.phase.elong > 160 && d.phase.elong < 200) add("mood", -0.3);   // full moon: big feelings
  if(d.clash){ add("mood", -0.7); add("health", -0.3); }
  if(d.relation === "support"){ add("mood", 0.5); add("health", 0.3); }
  if(d.relation === "opportunity"){ add("work", 0.5); add("money", 0.4); }
  if(d.relation === "companion") add("social", 0.5);
  // the personal day number nudges the area it's about
  add({1:"growth", 2:"love", 3:"social", 4:"work", 5:"energy", 6:"home", 7:"mood", 8:"money", 9:"growth"}[d.personalDay], 0.4);
  for(const k in r) r[k] = Math.max(1, Math.min(5, Math.round(r[k])));
  return r;
}

// does the current language have the new, conversational reading? (others keep the earlier one
// until they are translated, so a reading never comes out half in English)
const own = k => (I18N[L.lang] || I18N.en)[k] !== undefined;

function reading(d){
  return own("dTone") ? readingNow(d) : readingClassic(d);
}

// A few connected paragraphs: how the day feels and where the Moon puts your attention, the one or
// two things the sky is doing to your chart, then what the day is good for and what to go easy on.
function readingNow(d){
  const p = [];
  const tone = d.consensus.tone, mood = t("moods")[d.moonSign];
  p.push(`${t("dTone." + tone, {mood})} ${t("dMoon", {sign:SIGNS[d.moonSign].name, focus:HOUSE_TEXT[d.moonHouse-1].text})}`);
  const seen = new Set(), sky = [];
  for(const x of d.transits){
    if(seen.size >= 2) break;
    if(seen.has(x.t) || x.t === "moon") continue;
    seen.add(x.t);
    sky.push(t(`dSky.${x.aspect.kind}.${x.t}`, {about:t("dAbout." + x.n)}));
  }
  if(d.retro.includes("mercury")) sky.push(t("dMercury"));
  if(sky.length) p.push(sky.join(" "));
  // the two best areas of the day, and the weakest one if it's really low
  const order = ["love","work","energy","mood","money","social"].sort((a,b) => d.ratings[b] - d.ratings[a]);
  const good = order.filter(k => d.ratings[k] >= 4).slice(0,2);
  if(!good.length) good.push({push:"energy", connect:"social", create:"mood", steady:"work", reflect:"mood"}[tone]);
  const low = order[order.length-1];
  let tip = `<b>${t("dGood")}</b> ${L.list(good.map(k => t("goodFor." + k)))}.`;
  if(d.ratings[low] <= 2) tip += ` <b>${t("dEasy")}</b> ${t("goEasy." + low)}.`;
  p.push(tip);
  for(const g of d.ingress) p.push(t("dIngress", {p:PLANETS[g.k].name, sign:SIGNS[g.sign].name}));
  return p;
}

function readingClassic(d){
  const p = [];
  const tone = TONES[d.consensus.tone];
  p.push(`<b>${tone.name}.</b> ${tone.text}`);
  p.push(t("readMoon", {sign:SIGNS[d.moonSign].name, mood:t("moods")[d.moonSign], n:d.moonHouse, nth:L.ord(d.moonHouse), focus:HOUSE_TEXT[d.moonHouse-1].text}));
  const seen = new Set();
  for(const x of d.transits){
    if(seen.size >= 2) break;
    if(seen.has(x.t)) continue;
    seen.add(x.t);
    p.push(t("readTransit", {t:PLANETS[x.t].name, verb:x.aspect.verb, aspect:x.aspect.label, n:PLANETS[x.n].name,
      gift:t(`gift.${x.aspect.kind}.${x.t}`), noun:t("natalNoun." + x.n)}));
  }
  if(d.retro.includes("mercury")) p.push(t("readMercury"));
  for(const g of d.ingress) p.push(t("readIngress", {p:PLANETS[g.k].name, sign:SIGNS[g.sign].name}));
  return p;
}

window.Daily = {day, phaseName, reading, own, AREAS};
})();
