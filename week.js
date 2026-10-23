(() => {
// The week ahead: today and the six days after it, each worked out like Today (real noon sky
// against your chart, the Chinese day, your personal day number and the Mayan day), then summed up
// by area of life, with the moments worth knowing about (Moon phases, planets changing sign,
// Mercury turning).
const {SIGNS, PLANETS} = Chart;
const t = L.t;
// the areas the week is told in, in the order they're shown
const AREAS = ["love","work","money","health","home","social","growth"];
const avg = a => a.reduce((x,y) => x+y, 0) / a.length;

function week(profile, chart, chi, from=new Date()){
  const days = [...Array(7)].map((_, i) => Daily.day(profile, chart, chi, new Date(from.getFullYear(), from.getMonth(), from.getDate() + i), true));
  const best = arr => arr.reduce((b, x, i) => x > arr[b] ? i : b, 0);
  const worst = arr => arr.reduce((b, x, i) => x < arr[b] ? i : b, 0);
  const overall = days.map(d => d.overall);

  // the shape of the week: does it build, wind down, or stay even?
  const first = avg(overall.slice(0,3)), last = avg(overall.slice(4));
  const shape = last - first > 0.25 ? "rise" : first - last > 0.25 ? "fall" : "even";
  const peak = best(overall), dip = worst(overall);

  // the week's main tone: the one most days lean towards
  const count = {};
  days.forEach(d => count[d.consensus.tone] = (count[d.consensus.tone]||0) + 1);
  const tone = Object.entries(count).sort((a,b) => b[1]-a[1])[0][0];

  const areas = AREAS.map(k => {
    const s = days.map(d => d.ratings[k]);
    return {key:k, score:avg(s), best:best(s), low:worst(s), level:avg(s) >= 3.5 ? "high" : avg(s) < 2.7 ? "low" : "mid"};
  });

  // moments: Moon phases, planets entering signs, Mercury turning retrograde or direct
  const moments = [];
  for(let i = 1; i < 7; i++){
    const a = days[i-1], b = days[i];
    const crossed = deg => ((a.phase.elong - deg + 360) % 360) > 300 && ((b.phase.elong - deg + 360) % 360) < 60;
    if(crossed(0)) moments.push({i, k:"newMoon", sign:b.moonSign});
    if(crossed(180)) moments.push({i, k:"fullMoon", sign:b.moonSign});
    if(a.pos.mercury.retro !== b.pos.mercury.retro) moments.push({i, k:b.pos.mercury.retro ? "mercRetro" : "mercDirect"});
  }
  days.forEach((d, i) => { if(i) d.ingress.forEach(g => moments.push({i, k:"ingress", p:g.k, sign:g.sign})); });
  moments.sort((x,y) => x.i - y.i);

  return {days, overall, shape, peak, dip, tone, areas, moments};
}

// sentences for the week, in the current language (until a language has the week, it's told in
// English, weekday names included, so a sentence is never half one language and half another)
const lang = () => Daily.own("weekTitle") ? L.locale() : "en";
// the plain weekday ("Thursday"), and the form that says when ("on Thursday", "tomorrow", "today")
const named = (w, i) => i === 0 ? t("wToday") : w.days[i].date.toLocaleDateString(lang(), {weekday:"long"});
const on = (w, i) => i === 0 ? t("wToday") : i === 1 ? t("wTomorrow") : t("wOn")[w.days[i].date.getDay()];
function headline(w){
  let s = t("wShape." + w.shape, {peak:named(w, w.peak)});
  if(w.dip !== w.peak && w.overall[w.dip] < 3) s += " " + t(w.dip === 0 ? "wDipToday" : "wDip", {day:on(w, w.dip)});
  return s;
}
function moment(w, m){
  const when = on(w, m.i);
  if(m.k === "ingress") return t("wIngress", {when, p:PLANETS[m.p].name, sign:SIGNS[m.sign].name});
  return t("w." + m.k, {when, sign:m.sign !== undefined ? SIGNS[m.sign].name : ""});
}
function areaText(w, a){
  return t(`wArea.${a.key}.${a.level}`) + " " + t(a.level === "low" ? "wBestLow" : "wBest", {day:on(w, a.best)});
}

window.Week = {week, headline, moment, areaText, lang, AREAS};
})();
