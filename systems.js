(() => {
// Systems tab: one page per system. Each opens with the headline (who you are in that system),
// then the one or two things worth seeing, and folds the tables and background into sections
// you open when you want them.
const {SIGNS, PLANETS, signOf, fmtDeg, HOUSE_SYSTEMS} = Chart;
const {SIGN_TEXT, PLANET_TEXT, HOUSE_TEXT} = Texts;
const {$, esc, sheet, dateFmt} = UI;
const t = L.t;
let current = "western";
const TABS = [["western","sysWestern"],["native","sysNative"],["chinese","sysChinese"],["numerology","sysNumerology"],["egyptian","sysEgyptian"],["mayan","sysMayan"]];

function render(S, which){
  if(which) current = which;
  const body = {western, native, chinese, numerology, egyptian, mayan}[current](S);
  $("#v-systems").innerHTML = `<div class="top"><div><div class="date">${Daily.own("sixWays") ? t("sixWays") : t("fourWays")}</div><h1>${t("systemsTitle")}</h1></div></div>
    <div class="tabs">${TABS.map(([k,n])=>`<button data-k="${k}" class="${k===current?"on":""}">${t(n)}</button>`).join("")}</div>${body}`;
  document.querySelectorAll("#v-systems .tabs button").forEach(b => b.onclick = () => { render(S, b.dataset.k); UI.buzz("8"); UI.toTop(); });
  document.querySelectorAll("#v-systems [data-planet]").forEach(el => el.onclick = () => planetSheet(S, el.dataset.planet));
  document.querySelectorAll("#v-systems [data-num]").forEach(el => el.onclick = () => numberSheet(S, el.dataset.num));
  document.querySelectorAll("#v-systems [data-totem]").forEach(el => el.onclick = () => totemSheet(+el.dataset.totem));
  document.querySelectorAll("#v-systems [data-god]").forEach(el => el.onclick = () => godSheet(+el.dataset.god));
  // centre the chosen tab by scrolling the tab row only (scrollIntoView would also scroll the
  // screen behind it sideways and cut the page off); measured on screen so it works right-to-left too
  const row = document.querySelector("#v-systems .tabs"), on = row && row.querySelector(".on");
  if(on){
    const r = row.getBoundingClientRect(), b = on.getBoundingClientRect();
    row.scrollLeft += (b.left + b.width/2) - (r.left + r.width/2);
  }
}

// shared pieces: the headline card, a row of fact chips, and a section that folds open
const hero = (kicker, art, title, sub, text) => `<div class="card sys-hero">${art ? `<div class="sys-art">${art}</div>` : ""}
    <div class="kicker">${kicker}</div><h2 class="sys-title">${title}</h2>${sub ? `<p class="sys-sub">${sub}</p>` : ""}
    ${text ? `<p class="serif-p">${text}</p>` : ""}</div>`;
const chips = items => `<div class="chips">${items.filter(Boolean).map(([k, v]) => `<div class="chip"><span>${k}</span><b>${v}</b></div>`).join("")}</div>`;
const fold = (title, hint, inner, open=false) => `<details class="card fold"${open ? " open" : ""}><summary><span>${title}</span>${hint ? `<span class="hint">${hint}</span>` : ""}</summary><div class="fold-in">${inner}</div></details>`;

// ---- Western
function western(S){
  const ch = S.chart, p = ch.points, bal = ch.balance;
  const sun = signOf(p.sun.lon), moon = signOf(p.moon.lon);
  const rows = Astro.BODIES.concat(ch.timeKnown ? ["asc","mc"] : []).map(k => `<tr class="tap" data-planet="${k}"><td class="g">${PLANETS[k].glyph}</td>
      <td>${PLANETS[k].name}${p[k].retro ? " ℞" : ""}</td><td>${SIGNS[signOf(p[k].lon)].glyph} ${SIGNS[signOf(p[k].lon)].name}</td>
      <td class="r faint small">${k==="asc"||k==="mc" ? fmtDeg(p[k].lon,false) : t("houseN", {n:ch.houseOfPlanet[k]})}</td></tr>`).join("");
  const asp = ch.aspects.filter(a => a.orb < 6).slice(0,14).map(a => `<tr><td class="g">${a.aspect.glyph}</td><td>${PLANETS[a.a].name} · ${a.aspect.label} · ${PLANETS[a.b].name}</td><td class="r">${a.orb.toFixed(1)}°</td></tr>`).join("");
  const tot = Object.values(bal.elements).reduce((a,b)=>a+b,0);
  const balance = `<div class="elbar">${Object.entries(bal.elements).map(([e,v]) => `<i style="flex:${v}; background:var(--${e})" title="${t("elementsCap." + e)}"></i>`).join("")}</div>
    <div class="ellegend">${Object.entries(bal.elements).map(([e,v]) => `<span><i style="background:var(--${e})"></i>${t("elementsCap." + e)} ${Math.round(v/tot*100)}%</span>`).join("")}</div>`;
  const sysName = ch.houses.system === "solar" ? t("solarHouses") : ch.houses.system === "porphyry-fallback" ? t("porphyryFallback") : HOUSE_SYSTEMS[ch.houses.system].name;
  return `${hero(t("sysWestern"), "", `${SIGNS[sun].glyph} ${SIGNS[sun].name}`, t("westSub", {moon:ch.moonOptions ? t("moonUnsure") : SIGNS[moon].name, rising:ch.timeKnown ? SIGNS[signOf(p.asc.lon)].name : t("needsTime")}), SIGN_TEXT[sun].core)}
    <div class="card">${Draw.wheel(ch)}<p class="tiny faint" style="text-align:center">${t("tropical")} · ${sysName}${ch.timeKnown ? "" : " · " + t("noonNote")}</p></div>
    <div class="card"><div class="label">${t("elementsTitle")}</div>${balance}<p class="small dim" style="margin-top:10px">${t("balanceLine", {el:t("elements." + bal.element), mode:t("modes." + bal.mode)})}</p></div>
    ${fold(t("planetsTitle"), t("tapMeaning"), `<table class="list">${rows}</table>`, true)}
    ${fold(t("mainAspects"), "", asp ? `<table class="list">${asp}</table>` : `<p class="small dim">${t("noClose")}</p>`)}
    ${ch.timeKnown ? fold(t("houseCusps"), "", `<table class="list">${ch.houses.cusps.map((c,i)=>`<tr><td class="g">${i+1}</td><td>${HOUSE_TEXT[i].name}</td><td class="r">${fmtDeg(c)}</td></tr>`).join("")}</table>`) : ""}`;
}
function planetSheet(S, k){
  const ch = S.chart, pl = ch.points[k], s = signOf(pl.lon), T = PLANET_TEXT[k];
  const h = k === "asc" || k === "mc" ? null : ch.houseOfPlanet[k];
  sheet(`<h2>${PLANETS[k].glyph} ${t("planetIn", {planet:PLANETS[k].name, sign:SIGNS[s].name})}</h2>
    <p class="dim">${t("planetShows", {planet:PLANETS[k].name, means:T.means})}</p>
    <div class="card reading"><p>${t("planetStyle", {verb:T.verb, style:SIGN_TEXT[s].style})}</p><p class="small dim">${SIGN_TEXT[s].core}</p>
    ${h && ch.timeKnown ? `<p class="small">${t("inHouse", {n:h, nth:L.ord(h), text:HOUSE_TEXT[h-1].text})}</p>` : ""}
    ${pl.retro ? `<p class="small">${t("retroBorn")}</p>` : ""}</div>
    <p class="tiny faint">${fmtDeg(pl.lon)}${pl.speed !== undefined ? ` · ${t("movingDay", {n:Math.abs(pl.speed).toFixed(2)})}` : ""}</p>`);
}

// ---- Native American (Sun Bear's Medicine Wheel)
function native(S){
  const n = S.wheel, T = Native.TOTEMS;
  return `${hero(t("birthTotem"), `<span class="emoji">${n.totem.icon}</span>`, n.animal, `${n.moon} · ${n.dates}`, n.text)}
    ${n.cusp !== null ? `<div class="warn">${t("cuspNote", {animal:T[n.cusp].animal})}</div>` : ""}
    ${chips([[t("plant"), n.plant], [t("mineral"), n.mineral], [t("colour"), `<i class="sw" style="background:${n.hex}"></i>${n.colour}`]])}
    <div class="card pair">
      <div><div class="label">${t("clanTitle")}</div><h3>${n.clan.name}</h3><p class="small dim">${n.clan.text}</p></div>
      <div><div class="label">${t("keeperTitle")}</div><h3>${n.direction.name} <span class="faint small">${n.direction.keeper}</span></h3><p class="small dim">${n.direction.text}</p></div>
    </div>
    <div class="card">${Draw.medicineWheel(n.index)}
      <p class="small tap" data-totem="${n.opposite}" style="margin-top:6px">${t("acrossText", {animal:T[n.opposite].animal})}</p></div>
    ${fold(t("allMoons"), t("clanKin", {list:L.list(n.kin.map(i=>T[i].animal))}), `<table class="list">
      ${[9,10,11,0,1,2,3,4,5,6,7,8].map(i => `<tr class="tap" data-totem="${i}"${i===n.index?' style="color:var(--gold)"':""}><td class="g">${T[i].icon}</td><td>${T[i].animal}</td><td class="r small">${T[i].dates}</td></tr>`).join("")}</table>`)}
    ${fold(t("aboutSystem"), "", `<p class="small dim">${t("nativeNote")}</p>`)}`;
}
function totemSheet(i){
  const tt = Native.totemOf(i*30 + 15);
  sheet(`<h2>${tt.totem.icon} ${tt.animal}${tt.alt ? ` <span class="faint">(${tt.alt})</span>` : ""}</h2><p class="dim">${tt.moon} · ${tt.dates}</p>
    <div class="card reading"><p>${tt.text}</p></div>
    <p class="small">${t("clanOf", {clan:tt.clan.name, el:tt.clan.element})} · ${tt.direction.name}, ${tt.direction.keeper} · ${tt.plant} · ${tt.mineral} · ${tt.colour}</p>`);
}

// ---- Chinese
function chinese(S){
  const c = S.chi, E = Chinese.ELEMENTS;
  const pil = (lab, p) => p ? `<div class="p"><div class="lab">${t(lab)}</div><div class="han el-${p.stem.element}">${p.stem.han}</div><div class="han el-${p.branch.element}">${p.branch.han}</div>
      <div class="tiny">${p.stem.name} · ${p.branch.name}</div></div>`
    : `<div class="p"><div class="lab">${t(lab)}</div><div class="han faint">?</div><div class="han faint">?</div><div class="tiny faint">${t("needsTimeLow")}</div></div>`;
  const tot = Object.values(c.count).reduce((a,b)=>a+b,0);
  const col = e => `var(--${e==="water"?"wateri":e})`;
  const balance = `<div class="elbar">${Object.entries(c.count).filter(([,v])=>v).map(([e,v]) => `<i style="flex:${v}; background:${col(e)}"></i>`).join("")}</div>
    <div class="ellegend">${Object.entries(c.count).map(([e,v]) => `<span class="${v?"":"faint"}"><i style="background:${col(e)}"></i>${E[e].name} ${Math.round(v/tot*100)}%</span>`).join("")}</div>`;
  return `${hero(t("zodiacAnimal"), `<span class="han-big">${c.animal.han}</span>`, t("chAnimalEl", {el:E[c.element].name, animal:c.animal.name}),
      `${t(c.yang ? "yangYear" : "yinYear")} ${t("elAdds", {el:E[c.element].name, text:E[c.element].text})}`, c.animal.text)}
    ${chips([[t("bestWith"), L.list(c.friends.map(i=>Chinese.ANIMALS[i].name))], [t("clashWith"), Chinese.ANIMALS[c.clash].name]])}
    ${c.animalDiffersFromBaZi ? `<div class="warn">${t("baziDiffers")}</div>` : ""}
    <div class="card"><div class="label">${t("fourPillars")}</div><div class="pillars">${pil("pHour",c.pillars.hour)}${pil("pDay",c.pillars.day)}${pil("pMonth",c.pillars.month)}${pil("pYear",c.pillars.year)}</div>
      <p class="small" style="margin-top:12px">${t("dayMasterText", {e:c.dayMaster.element, dm:`${c.dayMaster.name} ${E[c.dayMaster.element].name}`, yy:t(c.dayMaster.yang ? "yang" : "yin"), text:E[c.dayMaster.element].text})}</p></div>
    <div class="card"><div class="label">${t("elBalance")}</div>${balance}
      <p class="small dim" style="margin-top:10px">${t("strongest", {el:E[c.strongest].name})}${c.missing.length ? t("missing", {list:L.list(c.missing.map(e=>E[e].name))}) : ""}</p></div>
    ${fold(t("aboutSystem"), "", `<p class="small dim">${t("pillarsNote")}</p><p class="small dim">${t("lny", {y:S.profile.date.slice(0,4), date:dateFmt(c.lunarNewYear, {day:"numeric", month:"long", year:"numeric", timeZone:"Asia/Shanghai"})})}</p>`)}`;
}

// ---- Numerology
function numerology(S){
  const n = S.num, N = Numerology.NUMBERS;
  const box = (k, v, lab) => v ? `<button type="button" class="nb tap" data-num="${k}"><div class="v">${v}</div><div class="k">${t(lab)}</div></button>` : "";
  const name = S.profile.birthName || S.profile.name;
  const letters = Numerology.letters(name);
  return `${hero(t("lifePath"), `<span class="num-big">${n.lifePath}</span>`, N[n.lifePath].title, t("lpNote"), N[n.lifePath].text)}
    <div class="numbers">${box("expression",n.expression,"nExpression")}${box("soul",n.soul,"nSoul")}${box("personality",n.personality,"nPersonality")}
      ${box("birthday",n.birthday,"nBirthday")}${box("maturity",n.maturity,"nMaturity")}${box("currentName",n.currentName,"nCurrentName")}</div>
    ${Numerology.readable(name) ? "" : `<div class="warn">${t("latinNote")}</div>`}
    <div class="card"><div class="label">${t("cyclesNow")}</div>
      <p>${t("pyLine", {n:n.personalYear, title:N[n.personalYear].title, year:new Date().getFullYear()})}</p>
      <p class="small dim">${t("monthDay", {m:n.personalMonth, d:n.personalDay, text:Numerology.CYCLE[n.personalDay].text})}</p></div>
    ${letters.length ? fold(t("nameNumbers"), "", `<div class="row wrap" style="gap:4px">${letters.map(x=>`<span class="pill" style="${x.vowel?"color:var(--gold)":""}">${x.c} ${x.v}</span>`).join("")}</div>
      <p class="tiny faint" style="margin-top:8px">${t("nameNote")}</p>`) : ""}`;
}
function numberSheet(S, k){
  const v = S.num[k], N = Numerology.NUMBERS[v];
  sheet(`<h2>${v} · ${N.title}</h2><p class="dim">${t("numShows", {what:t("numWhat." + k)})}</p><div class="card reading"><p>${N.text}</p></div>`);
}

// ---- Egyptian
function egyptian(S){
  const e = S.egy, g = e.god, G = Egyptian.GODS;
  return `<div class="card sys-hero egypt-hero">
      <div class="cart-wrap">${Draw.cartouche(g.name, g.hex)}</div>
      <div class="grow"><div class="kicker">${t("yourGod")}</div><h2 class="sys-title">${g.name}</h2><p class="sys-sub">${g.title}</p></div></div>
    <div class="card reading"><p>${g.text}</p></div>
    <div class="card pair">
      <div><div class="label">${t("godGift")}</div><p class="small">${g.gift}</p></div>
      <div><div class="label">${t("godShadow")}</div><p class="small">${g.shadow}</p></div>
    </div>
    ${chips([[t("godDays"), g.dates.join(" · ")], [t("bestWith"), L.list(e.match.map(i => `<span class="tap" data-god="${i}">${G[i].name}</span>`))]])}
    ${fold(t("allGods"), "", `<table class="list">${G.map((x, i) => `<tr class="tap" data-god="${i}"${i===e.index?' style="color:var(--gold)"':""}><td><i class="sw" style="background:${x.hex}"></i>${x.name}</td><td class="small dim">${x.title}</td></tr>`).join("")}</table>`)}
    ${fold(t("aboutSystem"), "", `<p class="small dim">${t("egyptNote")}</p>`)}`;
}
function godSheet(i){
  const g = Egyptian.GODS[i];
  sheet(`<h2>${g.name}</h2><p class="dim">${g.title}</p><div class="card reading"><p>${g.text}</p></div>
    <p class="small"><b>${t("godGift")}:</b> ${g.gift}</p><p class="small"><b>${t("godShadow")}:</b> ${g.shadow}</p>
    <p class="tiny faint">${g.dates.join(" · ")}</p>`);
}

// ---- Mayan
function mayan(S){
  const m = S.maya, tr = m.traditional, ds = m.dreamspell, Sg = Mayan.SIGNS;
  const dsName = t("dsName", {colour:t("dsColours")[ds.colour], tone:ds.tone.name, seal:ds.nawal.seal});
  const or = (lab, i) => `<div class="chip"><span>${t(lab)}</span><b>${Sg[i].seal}</b></div>`;
  return `${hero(t("yourNawal"), `<span class="maya-art" style="color:${tr.colour}">${Draw.mayaNumber(tr.number, 64)}</span>`,
      `${tr.number} ${tr.nawal.kiche}`, `${tr.nawal.meaning} · ${tr.nawal.yuc}`, tr.nawal.text)}
    <div class="card"><div class="label">${t("mayaToneTitle", {n:tr.number})}</div><h3>${tr.tone.name}</h3><p class="small dim">${tr.tone.text}</p></div>
    <div class="card"><div class="label"><span>${t("dreamspell")}</span><span>${t("kin", {n:ds.kin})}</span></div>
      <h3>${dsName}</h3>
      ${m.same ? `<p class="small dim">${t("dsSame")}</p>` : `<p class="small dim">${t("dsDiffers", {trad:`${tr.number} ${tr.nawal.kiche}`})}</p>`}
      <div class="chips" style="margin:12px 0 0">${or("dsGuide", ds.oracle.guide)}${or("dsAnalog", ds.oracle.analog)}${or("dsAntipode", ds.oracle.antipode)}${or("dsOccult", ds.oracle.occult)}</div>
      <p class="tiny faint" style="margin-top:8px">${t("dsOracleNote")}</p></div>
    ${fold(t("allNawales"), "", `<table class="list">${Sg.map((x, i) => `<tr${i===tr.sign?' style="color:var(--gold)"':""}><td class="g"><i class="sw" style="background:${Mayan.COLOURS[i%4]}"></i></td><td>${x.kiche} <span class="faint small">${x.yuc}</span></td><td class="small dim">${x.meaning}</td></tr>`).join("")}</table>`)}
    ${fold(t("aboutSystem"), "", `<p class="small dim">${t("mayaNote")}</p>`)}`;
}

window.Systems = {render};
})();
