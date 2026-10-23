(() => {
// "Where the systems agree": like Consensus Weather averaging forecast models, each system votes
// for traits (about you) or a tone (about today), and Augur shows where they line up.
// Reasons are written in the current language when the chart is worked out.
const {TRAITS, SIGN_TRAIT, ELEMENT_TRAITS} = Texts;
const t = L.t;
const signName = i => Chart.SIGNS[i].name;

function system(key){
  const s = {key, get name(){ return t(key); }, score:{}, why:{}};
  s.add = (trait, w, reason) => {
    s.score[trait] = (s.score[trait]||0) + w;
    (s.why[trait] = s.why[trait] || []).push(reason);
  };
  return s;
}
// the top 3 traits of a system (ties at third place included)
function top(s){
  const list = Object.entries(s.score).sort((a,b)=>b[1]-a[1]);
  if(!list.length) return [];
  const cut = list[Math.min(2, list.length-1)][1];
  return list.filter(x => x[1] >= cut).map(x => x[0]);
}

function natal(profile, chart, nat, chi, num, egy, maya){
  const W = system("sysWestern"), V = system("sysNative"), C = system("sysChinese"), N = system("sysNumerology");
  const E = system("sysEgyptian"), M = system("sysMayan");
  const sg = k => Chart.signOf(chart.points[k].lon);
  const chEl = e => Chinese.ELEMENTS[e].name;

  W.add(SIGN_TRAIT[sg("sun")], 3, t("rsSun", {sign:signName(sg("sun"))}));
  if(chart.moonOptions) chart.moonOptions.forEach(s => W.add(SIGN_TRAIT[s], 1, t("rsMoonMaybe", {sign:signName(s)})));
  else W.add(SIGN_TRAIT[sg("moon")], 2, t("rsMoon", {sign:signName(sg("moon"))}));
  if(chart.timeKnown) W.add(SIGN_TRAIT[sg("asc")], 2, t("rsRising", {sign:signName(sg("asc"))}));
  for(const k of ["mercury","venus","mars"]) W.add(SIGN_TRAIT[sg(k)], 0.5, t("rsPlanet", {planet:Chart.PLANETS[k].name, sign:signName(sg(k))}));
  for(const tr of ELEMENT_TRAITS[chart.balance.element]) W.add(tr, 1, t("rsElement", {el:t("elements." + chart.balance.element)}));

  for(const tr of nat.traits) V.add(tr, 2, t("rsTotem", {animal:nat.animal}));
  for(const tr of nat.clan.traits) V.add(tr, 1.5, t("rsClan", {clan:nat.clan.name}));
  for(const tr of nat.direction.traits) V.add(tr, 1, t("rsDir", {dir:nat.direction.name, keeper:nat.direction.keeper}));

  for(const tr of chi.animal.traits) C.add(tr, 2, t("rsYear", {el:chEl(chi.element), animal:chi.animal.name}));
  for(const tr of Chinese.ELEMENTS[chi.dayMaster.element].traits) C.add(tr, 1.5, t("rsDayMaster", {stem:chi.dayMaster.name, el:chEl(chi.dayMaster.element)}));
  for(const tr of Chinese.ELEMENTS[chi.strongest].traits) C.add(tr, 1, t("rsStrong", {el:chEl(chi.strongest)}));

  const NUM = Numerology.NUMBERS;
  for(const tr of NUM[num.lifePath].traits) N.add(tr, 2, t("rsLife", {n:num.lifePath}));
  if(num.expression) for(const tr of NUM[num.expression].traits) N.add(tr, 1.5, t("rsExpr", {n:num.expression}));
  if(num.soul) for(const tr of NUM[num.soul].traits) N.add(tr, 1, t("rsSoul", {n:num.soul}));
  const bday = +profile.date.slice(8,10);
  for(const tr of NUM[Numerology.reduce(num.birthday,false)].traits) N.add(tr, 0.5, t("rsBorn", {n:bday, nth:L.ord(bday)}));

  // the god of your birthday leans two ways, its best matches a little
  for(const tr of egy.traits) E.add(tr, 2, t("rsGod", {god:egy.god.name}));
  for(const g of egy.match) for(const tr of Egyptian.GODS[g].traits) E.add(tr, 0.4, t("rsGodMatch", {god:Egyptian.GODS[g].name}));

  // Mayan: the traditional day sign leads, the Dreamspell seal adds to it
  const tr0 = maya.traditional, ds = maya.dreamspell;
  for(const tr of tr0.nawal.traits) M.add(tr, 2, t("rsNawal", {n:tr0.number, sign:tr0.nawal.kiche}));
  for(const tr of ds.nawal.traits) M.add(tr, 1, t("rsSeal", {seal:ds.nawal.seal, kin:ds.kin}));

  const systems = [W,V,C,N,E,M];
  const tops = systems.map(top);
  const votes = Object.keys(TRAITS).map(trait => {
    const who = systems.filter((s,i) => tops[i].includes(trait));
    const strength = systems.reduce((a,s) => a + (s.score[trait]||0)/Math.max(...Object.values(s.score)), 0);
    return {trait, count:who.length, systems:who.map(s=>s.name), why:who.map(s => `${s.name}: ${s.why[trait].join(", ")}`), strength};
  }).sort((a,b) => b.count - a.count || b.strength - a.strength);

  // a trait one system puts first that most others don't see at all
  let disagreement = null;
  systems.forEach(s => {
    if(disagreement) return;
    const first = Object.entries(s.score).sort((a,b)=>b[1]-a[1])[0][0];
    const absent = systems.filter(o => o !== s && !o.score[first]);
    if(absent.length >= 2) disagreement = {trait:first, system:s.name, why:s.why[first].join(", "), absent:absent.map(o=>o.name)};
  });

  return {votes, agreed:votes.filter(v=>v.count >= 2).slice(0,5), disagreement, of:systems.length};
}

// ---- Today's tone. The Medicine Wheel and the Egyptian gods describe who you are, not single days,
// so they don't vote here.
const HOUSE_TONE = [null,"push","steady","connect","reflect","create","steady","connect","reflect","push","steady","connect","reflect"];
const RELATION_TONE = {companion:"connect", support:"reflect", expression:"create", opportunity:"push", pressure:"steady"};

function daily(day){
  const votes = [];
  votes.push({system:t("sysWestern"), tone:HOUSE_TONE[day.moonHouse],
    why:t("voteWestern", {sign:signName(day.moonSign), n:day.moonHouse, nth:L.ord(day.moonHouse), house:Texts.HOUSE_TEXT[day.moonHouse-1].name})});
  votes.push({system:t("sysChinese"), tone:RELATION_TONE[day.relation],
    why:t("voteChinese", {stem:day.dayPillar.stem.name, animal:day.dayPillar.branch.name, text:t("relation." + day.relation)})
      + (day.clash ? t("voteClash", {animal:day.myAnimal}) : "")});
  votes.push({system:t("sysNumerology"), tone:Numerology.CYCLE[day.personalDay].tone,
    why:t("voteNumerology", {n:day.personalDay, text:Numerology.CYCLE[day.personalDay].text})});
  votes.push({system:t("sysMayan"), tone:day.maya.nawal.tone,
    why:t("voteMayan", {n:day.maya.number, sign:day.maya.nawal.kiche, text:day.maya.nawal.day})});
  const count = {};
  votes.forEach(v => count[v.tone] = (count[v.tone]||0) + 1);
  const ranked = Object.entries(count).sort((a,b)=>b[1]-a[1]);
  const [tone, n] = ranked[0];
  // all three different: lead with the Moon, which moves fastest and changes the day most
  const lead = n === 1 ? votes[0].tone : tone;
  return {votes, tone:lead, count:n, of:votes.length};
}

window.Consensus = {natal, daily};
})();
