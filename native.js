(() => {
// Native American astrology: the Medicine Wheel published by Sun Bear and Wabun Wind (1980),
// the version most "Native American zodiac" sites use. Your birth totem comes from the Sun's
// position at birth (each "moon" of the wheel starts at a solstice, equinox or the points between),
// so it's exact even if you were born on a cusp.
//
// Index = tropical sign (0 = Aries). Names and texts are in i18n/xx.js ("totems"); popular sites
// sometimes swap a few animals, and `alt` keeps those names.
const TOTEMS = L.bind([
  {icon:"🦅", hex:"#f2c14e", from:[3,21], to:[4,19], traits:["bold","ambitious"]},
  {icon:"🦫", hex:"#5b8fd6", from:[4,20], to:[5,20], traits:["grounded","precise"]},
  {icon:"🦌", hex:"#9fd3a5", from:[5,21], to:[6,20], traits:["curious","harmonious"]},
  {icon:"🐦", hex:"#ec8fa8", from:[6,21], to:[7,22], traits:["caring","intuitive"]},
  {icon:"🐟", hex:"#d9534f", from:[7,23], to:[8,22], traits:["proud","bold"]},
  {icon:"🐻", hex:"#8e6cc4", from:[8,23], to:[9,22], traits:["precise","grounded"]},
  {icon:"🐦‍⬛", hex:"#a0714f", from:[9,23], to:[10,23], traits:["harmonious","curious"]},
  {icon:"🐍", hex:"#e88a3c", from:[10,24], to:[11,21], traits:["intense","intuitive"]},
  {icon:"🫎", hex:"#4a4a5a", from:[11,22], to:[12,21], traits:["free","visionary"]},
  {icon:"🪿", hex:"#e8ecf2", from:[12,22], to:[1,19], traits:["ambitious","grounded"]},
  {icon:"🦦", hex:"#c4cad4", from:[1,20], to:[2,18], traits:["visionary","free"]},
  {icon:"🐺", hex:"#3fb5a8", from:[2,19], to:[3,20], traits:["intuitive","caring"]},
], "totems", ["animal","alt","moon","plant","mineral","colour","text"]);
// "21 Mar – 19 Apr", in the current language
const md = ([m,d]) => new Date(2001, m-1, d).toLocaleDateString(L.locale(), {day:"numeric", month:"short"});
TOTEMS.forEach(t => Object.defineProperty(t, "dates", {get(){ return `${md(t.from)} – ${md(t.to)}`; }}));

// four elemental clans (one per element, three totems each)
const CLANS = L.bind({fire:{icon:"⚡", traits:["bold"]}, earth:{icon:"🐢", traits:["grounded"]},
  air:{icon:"🦋", traits:["curious"]}, water:{icon:"🐸", traits:["intuitive"]}}, "clans", ["name","text"]);
for(const el in CLANS) Object.defineProperty(CLANS[el], "element", {get(){ return L.t("elementsCap." + el); }});
// four spirit keepers of the directions; each rules three moons
const DIRECTIONS = L.bind([
  {keeper:"Wabun", traits:["bold"]}, {keeper:"Shawnodese", traits:["caring"]},
  {keeper:"Mudjekeewis", traits:["intense"]}, {keeper:"Waboose", traits:["precise"]},
], "directions", ["name","text"]);
// sign index -> direction (Aries–Gemini East, Cancer–Virgo South, Libra–Sagittarius West, Capricorn–Pisces North)
const dirOf = i => DIRECTIONS[Math.floor(i/3)];
const clanOf = i => CLANS[Chart.SIGNS[i].element];

function totemOf(sunLon){
  const i = Chart.signOf(sunLon), t = TOTEMS[i];
  return {index:i, totem:t, traits:t.traits, hex:t.hex, clan:clanOf(i), direction:dirOf(i),
    get animal(){ return t.animal; }, get alt(){ return t.alt; }, get moon(){ return t.moon; }, get plant(){ return t.plant; },
    get mineral(){ return t.mineral; }, get colour(){ return t.colour; }, get text(){ return t.text; }, get dates(){ return t.dates; }};
}

function native(chart){
  const t = totemOf(chart.points.sun.lon);
  const within = Astro.norm360(chart.points.sun.lon) % 30;
  t.cusp = within < 1 ? (t.index + 11) % 12 : within > 29 ? (t.index + 1) % 12 : null;
  // totems that share your clan, and the one opposite you on the wheel
  t.kin = [0,1,2,3,4,5,6,7,8,9,10,11].filter(i => i !== t.index && Chart.SIGNS[i].element === Chart.SIGNS[t.index].element);
  t.opposite = (t.index + 6) % 12;
  return t;
}

window.Native = {TOTEMS, CLANS, DIRECTIONS, totemOf, native};
})();
