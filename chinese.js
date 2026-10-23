(() => {
// Chinese astrology: the zodiac animal (by Lunar New Year) and the Four Pillars of Destiny (Ba Zi,
// which uses the solar calendar: the year turns at Lichun, the Sun at 315°, around 4 February).
const {norm360} = Astro;

const STEMS = [
  {name:"Jia", han:"甲", element:"wood",  yang:true},  {name:"Yi",  han:"乙", element:"wood",  yang:false},
  {name:"Bing",han:"丙", element:"fire",  yang:true},  {name:"Ding",han:"丁", element:"fire",  yang:false},
  {name:"Wu",  han:"戊", element:"earth", yang:true},  {name:"Ji",  han:"己", element:"earth", yang:false},
  {name:"Geng",han:"庚", element:"metal", yang:true},  {name:"Xin", han:"辛", element:"metal", yang:false},
  {name:"Ren", han:"壬", element:"water", yang:true},  {name:"Gui", han:"癸", element:"water", yang:false},
];
// stems keep their pinyin name unless a language has its own (Chinese, Japanese and Korean use the characters)
STEMS.forEach((s, i) => { const py = s.name; Object.defineProperty(s, "name", {enumerable:true,
  get(){ const own = L.t("stems"); return Array.isArray(own) ? own[i] : py; }}); });
const ANIMALS = [
  {han:"子", element:"water", traits:["curious","ambitious"]},
  {han:"丑", element:"earth", traits:["grounded","precise"]},
  {han:"寅", element:"wood",  traits:["bold","free"]},
  {han:"卯", element:"wood",  traits:["harmonious","caring"]},
  {han:"辰", element:"earth", traits:["proud","visionary"]},
  {han:"巳", element:"fire",  traits:["intuitive","intense"]},
  {han:"午", element:"fire",  traits:["free","bold"]},
  {han:"未", element:"earth", traits:["intuitive","harmonious"]},
  {han:"申", element:"metal", traits:["curious","free"]},
  {han:"酉", element:"metal", traits:["precise","proud"]},
  {han:"戌", element:"earth", traits:["caring","grounded"]},
  {han:"亥", element:"water", traits:["caring","harmonious"]},
];
L.bind(ANIMALS, "chAnimals", ["name","text"]);
const ELEMENTS = {
  wood: {han:"木", traits:["visionary","caring"]},
  fire: {han:"火", traits:["bold","proud"]},
  earth:{han:"土", traits:["grounded","caring"]},
  metal:{han:"金", traits:["precise","ambitious"]},
  water:{han:"水", traits:["intuitive","curious"]},
};
L.bind(ELEMENTS, "chElements", ["name","text"]);
const PRODUCES = {wood:"fire", fire:"earth", earth:"metal", metal:"water", water:"wood"};
const CONTROLS = {wood:"earth", earth:"water", water:"fire", fire:"metal", metal:"wood"};
const TRINES = [[0,4,8],[1,5,9],[2,6,10],[3,7,11]];

const pillar = n => { n = ((n%60)+60)%60; return {n, stem:STEMS[n%10], branch:ANIMALS[n%12], stemIndex:n%10, branchIndex:n%12}; };

// Lunar New Year: the second new moon after the winter solstice, by the calendar date in China (UTC+8).
// (Correct for almost every year; the rare leap-month exceptions, like 2033, can be a month off.)
const cnyCache = {};
function lunarNewYear(year){
  if(cnyCache[year]) return cnyCache[year];
  const solstice = Astro.sunReaches(270, new Date(Date.UTC(year-1, 11, 1)));
  const nm1 = Astro.nextNewMoon(solstice);
  const nm2 = Astro.nextNewMoon(new Date(nm1.getTime() + 2*86400000));
  const china = new Date(nm2.getTime() + 8*3600000);
  const start = new Date(Date.UTC(china.getUTCFullYear(), china.getUTCMonth(), china.getUTCDate()) - 8*3600000);
  return cnyCache[year] = start;   // midnight in China on New Year's Day, as a UTC instant
}

// Julian Day Number of a calendar date (noon)
const jdn = (y,m,d) => Math.round(Astro.jd(new Date(Date.UTC(y, m-1, d, 12))));
function dayPillar(y,m,d){ return pillar(jdn(y,m,d) + 49); }   // 1 Oct 1949 was a Jia-Zi day

function chinese(profile, chart){
  const [y,m,d] = profile.date.split("-").map(Number);
  const utc = chart.utc;
  // popular zodiac animal: by Lunar New Year
  const lunarYear = utc < lunarNewYear(y) ? y-1 : y;
  const animal = pillar(lunarYear - 4);
  // Ba Zi year: by Lichun
  const lichun = Astro.sunReaches(315, new Date(Date.UTC(y, 0, 10)));
  const solarYear = utc < lichun ? y-1 : y;
  const yp = pillar(solarYear - 4);
  const mIdx = Math.floor(norm360(Astro.sunLon(Astro.centuriesTT(utc)) - 315)/30);   // 0 = Tiger month
  const mStem = ((yp.stemIndex%5)*2 + 2 + mIdx)%10, mBranch = (2 + mIdx)%12;
  const monthP = {stem:STEMS[mStem], branch:ANIMALS[mBranch], stemIndex:mStem, branchIndex:mBranch};
  const dp = dayPillar(y,m,d);
  let hp = null;
  if(chart.timeKnown){
    const hour = +profile.time.split(":")[0];
    const hb = Math.floor(((hour+1)%24)/2), hs = ((dp.stemIndex%5)*2 + hb)%10;
    hp = {stem:STEMS[hs], branch:ANIMALS[hb], stemIndex:hs, branchIndex:hb};
  }
  const pillars = {year:yp, month:monthP, day:dp, hour:hp};
  const count = {wood:0, fire:0, earth:0, metal:0, water:0};
  for(const p of Object.values(pillars)) if(p){ count[p.stem.element]++; count[p.branch.element]++; }
  const sorted = Object.entries(count).sort((a,b)=>b[1]-a[1]);
  return {
    animal: animal.branch, animalIndex: animal.branchIndex, element: animal.stem.element, yang: animal.stem.yang,
    lunarYear, lunarNewYear: lunarNewYear(y), animalDiffersFromBaZi: animal.n !== yp.n,
    pillars, dayMaster: dp.stem, count, strongest: sorted[0][0], missing: sorted.filter(e=>e[1]===0).map(e=>e[0]),
    friends: TRINES.find(t => t.includes(animal.branchIndex)).filter(i => i !== animal.branchIndex),
    clash: (animal.branchIndex + 6)%12,
  };
}

// How today's day pillar meets your Day Master (the "you" in Ba Zi)
function relation(me, today){
  if(me === today) return "companion";
  if(PRODUCES[today] === me) return "support";
  if(PRODUCES[me] === today) return "expression";
  if(CONTROLS[me] === today) return "opportunity";
  return "pressure";
}

window.Chinese = {STEMS, ANIMALS, ELEMENTS, PRODUCES, CONTROLS, pillar, dayPillar, lunarNewYear, chinese, relation};
})();
