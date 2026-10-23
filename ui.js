(() => {
// Screens: Today and Me, plus shared helpers (sheet, toast, share, starfield).
const {SIGNS, PLANETS, signOf, fmtDeg} = Chart;
const {TRAITS, TONES, SIGN_TEXT} = Texts;
const t = L.t;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sg = i => SIGNS[i];
const dateFmt = (d, o={day:"numeric", month:"long", year:"numeric"}) => d.toLocaleDateString(L.locale(), o);
const timeFmt = hm => { const [h,m] = hm.split(":").map(Number); return new Date(2001,0,1,h,m).toLocaleTimeString(L.locale(), {hour:"2-digit", minute:"2-digit"}); };

// ---- helpers
function sheet(html){ $("#sheet-body").innerHTML = html; $("#sheet").classList.add("on"); $("#sheet .panel").scrollTop = 0; }
function closeSheet(){ const on = $("#sheet").classList.contains("on"); $("#sheet").classList.remove("on"); return on; }
let toastT;
function toast(msg){ const el = $("#toast"); el.textContent = msg; el.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(()=>el.style.display="none", 2200); }
function buzz(p="12"){ try{ window.AugurNative ? AugurNative.vibrate(p) : navigator.vibrate && navigator.vibrate(p.split(",").map(Number)); }catch(e){} }
async function share(text){
  if(window.AugurNative) return AugurNative.share(text);
  if(navigator.share){ try{ await navigator.share({text}); }catch(e){} return; }
  try{ await navigator.clipboard.writeText(text); toast(t("copied")); }catch(e){}
}
function dots(n, of=4){ return `<span class="dots">${[...Array(of)].map((_,i)=>`<i class="${i<n?"on":""}"></i>`).join("")}</span>`; }
const orList = items => items.join(t("or"));

// a quiet starfield behind everything (seeded, so it's the same every time)
function starfield(){
  const c = $("#stars"), x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio||1);
  c.width = c.clientWidth*dpr; c.height = c.clientHeight*dpr;
  let s = 11; const r = () => (s = (s*16807)%2147483647)/2147483647;
  for(let i=0;i<120;i++){
    x.globalAlpha = 0.12 + r()*0.6; x.fillStyle = r() < 0.12 ? "#ffd9b0" : "#ffffff";
    x.beginPath(); x.arc(r()*c.width, r()*c.height*0.7, (0.35 + r()*1.0)*dpr, 0, 7); x.fill();
  }
}
const toTop = () => { const m = $("#main"); if(m) m.scrollTop = 0; };

// the agreement ring: one arc per system, lit when it agrees with the day's tone
function agreeRing(votes, tone){
  const n = votes.length, gap = 10, R = 74, C = 2*Math.PI*R, seg = C/n - gap;
  let s = `<svg viewBox="0 0 180 180" class="ring"><defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffe6b4"/><stop offset=".5" stop-color="#ffbf96"/><stop offset="1" stop-color="#ff93ac"/></linearGradient></defs>`;
  s += `<circle cx="90" cy="90" r="${R}" class="ring-track"/>`;
  votes.forEach((v,i) => {
    s += `<circle cx="90" cy="90" r="${R}" class="ring-seg ${v.tone === tone ? "on" : ""}" stroke-dasharray="${seg.toFixed(1)} ${(C-seg).toFixed(1)}"
      stroke-dashoffset="${(-(i*C/n) + C/4 - gap/2).toFixed(1)}"/>`;
  });
  return s + `</svg>`;
}

// ---- Today
function renderToday(S){
  const d = S.day, c = d.consensus, tone = TONES[c.tone], q = Quotes.quoteFor(new Date());
  const first = (S.profile.name || S.profile.birthName).split(" ")[0];
  const hour = new Date().getHours();
  const g = t(hour < 5 ? "goodNight" : hour < 12 ? "goodMorning" : hour < 18 ? "goodAfternoon" : "goodEvening");
  const voteRows = c.votes.map(v => `<div class="vote"><div class="sys">${v.system}</div><div class="grow">
      <div class="t ${v.tone===c.tone?"match":""}">${TONES[v.tone].name}</div><div class="small dim">${esc(v.why)}</div></div></div>`).join("");
  const R = d.ratings, rat = (k, lab) => `<div class="r"><span>${t(lab)}</span><div class="bar"><i style="width:${R[k]*20}%"></i></div><span class="small">${R[k]}</span></div>`;
  const verdict = c.count === c.of ? (Daily.own("verdictEvery") ? t("verdictEvery") : t("verdictSome", {n:c.count, m:c.of})) : c.count >= 2 ? t("verdictSome", {n:c.count, m:c.of}) : t("verdictNone");
  const sun = sg(signOf(S.chart.points.sun.lon)), wm = d.wheelMoon, w = S.week;
  $("#v-today").innerHTML = `
    <div class="top"><div><div class="date">${dateFmt(new Date(), {weekday:"long", day:"numeric", month:"long"})}</div><h1>${esc(t("hello", {g, name:first}))}</h1></div>
      <div class="badge"><i></i>${d.phaseName}</div></div>

    <div class="hero tap" id="t-cons">
      <div class="ringwrap">${agreeRing(c.votes, c.tone)}
        <div class="ring-in"><div class="ring-n">${c.count}<small>/${c.of}</small></div><div class="ring-l">${t("agree")}</div></div></div>
      <div class="kicker">${t("agreeToday")}</div>
      <div class="tone">${tone.name}</div>
      <p class="tone-t">${tone.text}</p>
      <p class="tiny faint">${verdict} <span id="t-more">${t("tapVotes")}</span></p>
    </div>
    <div class="card" id="t-votes" style="display:none">${voteRows}</div>

    <div class="card reading">
      <div class="label"><span>${t("yourDay")}</span><span>${sun.glyph} ${sun.name}</span></div>
      ${d.reading.map(p=>`<p>${p}</p>`).join("")}
      <div class="row" style="margin-top:12px"><button class="btn small ghost" id="t-share">${t("share")}</button></div>
    </div>

    <div class="card tap week-teaser" id="t-week">
      <div class="label"><span>${t("weekAhead")}</span><span class="chev"></span></div>
      ${weekStrip(w, false)}
      <p class="small dim" style="margin-top:10px">${Week.headline(w)}</p>
    </div>

    <div class="grid2">
      <div class="card ratings" style="margin:0"><div class="label">${t("todaysStars")}</div>${rat("love","rLove")}${rat("work","rWork")}${rat("energy","rEnergy")}${rat("mood","rMood")}</div>
      <div class="card luck" style="margin:0"><div class="label">${t("forLuck")}</div>
        <div class="lucky">${d.lucky}</div><div class="tiny faint">${t("luckyNumber")}</div>
        <div class="row" style="margin-top:10px"><i class="sw" style="background:${d.colourHex}"></i><span class="small">${d.colourName}</span></div>
      </div>
    </div>

    <div class="card quote-card"><div class="label">${t("quoteOfDay")}</div><div class="quote">${esc(q.text)}</div><div class="by">${esc(q.by)}</div></div>

    <div class="card tap" id="t-sky">
      <div class="label"><span>${t("todaysSky")}</span><span class="chev"></span></div>
      <table class="list">
        <tr><td class="g">☉</td><td>${t("sunIn", {sign:sg(d.sunSign).name})}</td><td class="r">${fmtDeg(d.pos.sun.lon,false)}</td></tr>
        <tr><td class="g">☽</td><td>${t("moonIn", {sign:sg(d.moonSign).name})}</td><td class="r">${t("lit", {n:Math.round(d.phase.illum*100)})}</td></tr>
        <tr><td class="g">◍</td><td>${wm.moon} <span class="faint">(${wm.animal})</span></td><td class="r small">${t("wheelShort")}</td></tr>
        <tr><td class="g">${d.dayPillar.stem.han}${d.dayPillar.branch.han}</td><td>${t("dayPillar", {stem:d.dayPillar.stem.name, animal:d.dayPillar.branch.name})}</td><td class="r el-${d.dayPillar.stem.element}">${Chinese.ELEMENTS[d.dayPillar.stem.element].name}</td></tr>
        <tr><td class="g">${Draw.mayaNumber(d.maya.number, 18)}</td><td>${d.maya.number} ${d.maya.nawal.kiche} <span class="faint">(${d.maya.nawal.meaning})</span></td><td class="r small">${t("sysMayan")}</td></tr>
        ${d.retro.length ? `<tr><td class="g">℞</td><td>${t("retrograde", {list:L.list(d.retro.map(k=>PLANETS[k].name))})}</td><td></td></tr>` : ""}
      </table>
    </div>`;
  $("#t-cons").onclick = () => { const v = $("#t-votes"), on = v.style.display === "none"; v.style.display = on ? "block" : "none"; $("#t-more").textContent = t(on ? "tapHide" : "tapVotes"); buzz(); };
  $("#t-share").onclick = () => share(`${dateFmt(new Date())}, ${tone.name}\n\n${d.reading.map(p=>p.replace(/<[^>]+>/g,"")).join("\n\n")}\n\n“${q.text}” — ${q.by}\n\n${t("fromAugur")}`);
  $("#t-sky").onclick = () => skySheet(S);
  $("#t-week").onclick = () => { App.go("week"); buzz("8"); };
}

// ---- Week
// seven small columns, one per day: the bar is how good the day looks overall, the dot its tone
function weekStrip(w, tappable){
  return `<div class="wstrip">${w.days.map((d, i) => {
    const h = Math.round((d.overall - 1) / 4 * 100);
    return `<button class="wday${i === w.peak ? " peak" : ""}${i === 0 ? " now" : ""}"${tappable ? ` data-day="${i}"` : ""} type="button">
      <span class="wd">${d.date.toLocaleDateString(L.locale(), {weekday:"narrow"})}</span>
      <span class="wbar"><i style="height:${Math.max(12, h)}%"></i></span>
      <span class="wn">${d.date.getDate()}</span></button>`;
  }).join("")}</div>`;
}
function renderWeek(S){
  const w = S.week, tone = TONES[w.tone];
  const first = w.days[0].date, last = w.days[6].date;
  const range = `${dateFmt(first, {day:"numeric", month:"short"})} – ${dateFmt(last, {day:"numeric", month:"short"})}`;
  const areaRows = w.areas.map(a => `<div class="area">
      <div class="area-h"><b>${t("area." + a.key)}</b>${dots(Math.round(a.score), 5)}</div>
      <p class="small dim">${Week.areaText(w, a)}</p></div>`).join("");
  const moments = w.moments.slice(0,5).map(m => `<li>${Week.moment(w, m)}</li>`).join("");
  $("#v-week").innerHTML = `
    <div class="top"><div><div class="date">${range}</div><h1>${t("weekTitle")}</h1></div></div>
    <div class="card week-hero">
      <div class="kicker">${t("weekEnergy")}</div>
      <div class="tone">${tone.name}</div>
      <p class="tone-t">${Week.headline(w)}</p>
      ${weekStrip(w, true)}
      <p class="tiny faint" style="margin-top:8px;text-align:center">${t("weekTap")}</p>
    </div>
    ${moments ? `<div class="card"><div class="label">${t("weekMoments")}</div><ul class="moments">${moments}</ul></div>` : ""}
    <div class="card"><div class="label">${t("weekAreas")}</div>${areaRows}</div>
    <p class="tiny faint" style="margin:4px 4px 0">${t("weekNote")}</p>`;
  document.querySelectorAll("#v-week [data-day]").forEach(b => b.onclick = () => { daySheet(S, +b.dataset.day); buzz("8"); });
}
// one day of the week, told like Today
function daySheet(S, i){
  const d = i === 0 ? S.day : Daily.day(S.profile, S.chart, S.chi, S.week.days[i].date);
  const R = d.ratings, rat = (k, lab) => `<div class="r"><span>${t(lab)}</span><div class="bar"><i style="width:${R[k]*20}%"></i></div><span class="small">${R[k]}</span></div>`;
  sheet(`<div class="kicker">${dateFmt(d.date, {weekday:"long", day:"numeric", month:"long"})}</div>
    <h2>${TONES[d.consensus.tone].name}</h2>
    <div class="card reading">${d.reading.map(p=>`<p>${p}</p>`).join("")}</div>
    <div class="card ratings">${rat("love","rLove")}${rat("work","rWork")}${rat("energy","rEnergy")}${rat("mood","rMood")}</div>`);
}

function skySheet(S){
  const d = S.day, wm = d.wheelMoon;
  const rows = Astro.BODIES.map(k => `<tr><td class="g">${PLANETS[k].glyph}</td><td>${PLANETS[k].name}${d.pos[k].retro?" ℞":""}</td>
    <td class="r">${fmtDeg(d.pos[k].lon)}</td><td class="r faint small">${t("houseN", {n:Chart.houseOf(d.pos[k].lon, S.chart.houses.cusps)})}</td></tr>`).join("");
  const tr = d.transits.slice(0,8).map(x => `<tr><td class="g">${x.aspect.glyph}</td><td>${t("transitRow", {t:PLANETS[x.t].name, aspect:x.aspect.label, n:PLANETS[x.n].name})}</td><td class="r">${x.orb.toFixed(1)}°</td></tr>`).join("");
  sheet(`<h2>${t("todaysSky")}</h2><p class="small dim">${t("skyNote")}</p>
    <div class="card"><table class="list">${rows}</table></div>
    <h3>${t("transitsTitle")}</h3><div class="card">${tr ? `<table class="list">${tr}</table>` : `<p class="dim small">${t("noAspectsToday")}</p>`}</div>
    <h3>${t("wheelTitle")}</h3><div class="card small"><p>${t(wm.index === S.wheel.index ? "wheelTodayOwn" : "wheelToday", {moon:wm.moon, animal:wm.animal})}</p></div>
    <h3>${t("sysNumerology")}</h3><div class="card small"><p>${t("personalLine", {y:d.personalYear, m:d.personalMonth, d:d.personalDay})}</p><p class="dim">${Numerology.CYCLE[d.personalDay].text}</p></div>`);
}

// ---- Me
function bigThree(S){
  const ch = S.chart, p = ch.points;
  const cell = (what, sign, extra="") => `<div class="cell"><div class="what">${what}</div><div class="glyph">${sg(sign).glyph}</div><div class="sign">${sg(sign).name}</div>${extra}</div>`;
  const moon = ch.moonOptions ? `<div class="cell"><div class="what">${t("moon")}</div><div class="glyph">${ch.moonOptions.map(i=>sg(i).glyph).join("/")}</div><div class="sign">${orList(ch.moonOptions.map(i=>sg(i).name))}</div><div class="tiny faint">${t("changedSign")}</div></div>`
    : cell(t("moon"), signOf(p.moon.lon), `<div class="tiny faint">${fmtDeg(p.moon.lon,false)}</div>`);
  let rising;
  if(ch.timeKnown){
    const rc = ch.risingCertainty;
    const note = rc.alternatives.length ? `<div class="tiny faint">${t("orSigns", {list:orList(rc.alternatives.map(i=>sg(i).name))})}</div>`
      : Math.min(rc.before||999, rc.after||999) < 20 ? `<div class="tiny faint">${t("nearChange")}</div>` : `<div class="tiny faint">${fmtDeg(p.asc.lon,false)}</div>`;
    rising = cell(t("rising"), signOf(p.asc.lon), note);
  } else rising = `<div class="cell"><div class="what">${t("rising")}</div><div class="glyph">?</div><div class="sign">${t("needsTime")}</div><div class="tiny faint">${t("possible", {n:ch.risingOptions.length})}</div></div>`;
  return `<div class="grid3 big3">${cell(t("sun"), signOf(p.sun.lon), `<div class="tiny faint">${fmtDeg(p.sun.lon,false)}</div>`)}${moon}${rising}</div>`;
}

function renderMe(S){
  const ch = S.chart, nat = S.nat, p = ch.points, w = S.wheel, chi = S.chi;
  const traitRows = nat.agreed.map((v,i) => `<div class="trait tap" data-i="${i}"><div class="n">${v.count}/${nat.of}</div><div class="grow">
      <div><b>${TRAITS[v.trait].name}</b> ${dots(v.count, nat.of)}</div><div class="small dim">${TRAITS[v.trait].text}</div>
      <div class="tiny faint">${v.systems.join(" · ")}</div></div></div>`).join("");
  const dis = nat.disagreement;
  const sunS = signOf(p.sun.lon), moonS = signOf(p.moon.lon);
  let certainty = "";
  if(ch.timeKnown){
    const rc = ch.risingCertainty, risingS = signOf(p.asc.lon);
    if(rc.alternatives.length) certainty = `<div class="warn">${t("warnSpread", {n:rc.spread, list:orList(rc.alternatives.map(i=>sg(i).name)), sign:sg(risingS).name})}</div>`;
    else if(rc.after !== null && rc.after < 20) certainty = `<div class="warn">${t("warnAfter", {sign:sg((risingS+1)%12).name, n:rc.after})}</div>`;
    else if(rc.before !== null && rc.before < 20) certainty = `<div class="warn">${t("warnBefore", {sign:sg((risingS+11)%12).name, n:rc.before})}</div>`;
  } else {
    certainty = `<div class="warn">${t("warnNoTime")}<br>${ch.risingOptions.map(o=>`<b>${sg(o.sign).name}</b> ${timeFmt(o.from)}–${timeFmt(o.to)}`).join(" · ")}</div>`;
  }
  const chEl = e => Chinese.ELEMENTS[e].name;
  // one tile per system on Me, each opening its page in Systems
  const mini = (key, name, mark, head, sub) => `<button class="sys-tile tap" type="button" data-go="${key}">
      <span class="sys-mark">${mark}</span><span class="sys-name">${t(name)}</span>
      <span class="mini-h">${head}</span><span class="small dim">${sub}</span></button>`;
  const born = t(ch.timeKnown ? "bornLineTime" : "bornLine", {date:dateFmt(new Date(S.profile.date+"T12:00")), time:ch.timeKnown ? timeFmt(S.profile.time) : "", place:esc(S.profile.place.name)});
  $("#v-me").innerHTML = `
    <div class="top"><div><div class="date">${t("yourChart")}</div><h1>${esc(S.profile.name || S.profile.birthName)}</h1></div></div>
    ${bigThree(S)}
    ${certainty}
    ${ch.notes.map(n=>`<div class="warn">${esc(t(n.k, n.v))}</div>`).join("")}

    <div class="card">
      <div class="label"><span>${t("agreeYou")}</span></div>
      ${traitRows}
      ${dis ? `<div class="vote" style="margin-top:4px"><div class="sys">${t("oddOne")}</div><div class="grow small">${t("oddText", {trait:TRAITS[dis.trait].name, system:dis.system, why:esc(dis.why), others:L.list(dis.absent)})}</div></div>` : ""}
    </div>

    <div class="card reading">
      <div class="label">${t("inShort")}</div>
      <p><b>${t("sunInB", {sign:sg(sunS).name})}</b> ${SIGN_TEXT[sunS].sun}</p>
      ${ch.moonOptions ? `<p><b>${t("moonInB", {sign:orList(ch.moonOptions.map(i=>sg(i).name))})}</b> ${t("moonMaybe")}</p>` : `<p><b>${t("moonInB", {sign:sg(moonS).name})}</b> ${SIGN_TEXT[moonS].moon}</p>`}
      ${ch.timeKnown ? `<p><b>${t("risingB", {sign:sg(signOf(p.asc.lon)).name})}</b> ${SIGN_TEXT[signOf(p.asc.lon)].rising}</p>` : ""}
    </div>

    <div class="sysgrid">
      ${mini("western", "sysWestern", "☉", t("mostly", {el:t("elements." + ch.balance.element)}), t("modeLead", {mode:t("modes." + ch.balance.mode)}))}
      ${mini("native", "sysNative", w.totem.icon, w.animal, t("clanDir", {clan:w.clan.name, dir:w.direction.name}))}
      ${mini("chinese", "sysChinese", chi.animal.han, t("chAnimalEl", {el:chEl(chi.element), animal:chi.animal.name}), t("dayMasterLine", {stem:chi.dayMaster.name, el:chEl(chi.dayMaster.element)}))}
      ${mini("numerology", "sysNumerology", S.num.lifePath, t("lifePathN", {n:S.num.lifePath}), Numerology.NUMBERS[S.num.lifePath].title)}
      ${mini("egyptian", "sysEgyptian", Draw.ankh(22), S.egy.god.name, S.egy.god.title)}
      ${mini("mayan", "sysMayan", Draw.mayaNumber(S.maya.traditional.number, 22), `${S.maya.traditional.number} ${S.maya.traditional.nawal.kiche}`, S.maya.traditional.nawal.meaning)}
    </div>

    <p class="tiny faint" style="margin-top:16px">${born}
      ${ch.timeKnown ? t("utcLine", {utc:ch.utc.toISOString().slice(0,16).replace("T"," "), off:Chart.fmtOffset(ch.conv.offsetMin), tz:esc(S.profile.place.tz)}) : ""}</p>`;
  document.querySelectorAll("#v-me .trait").forEach(el => el.onclick = () => {
    const v = nat.agreed[+el.dataset.i];
    sheet(`<h2>${TRAITS[v.trait].name}</h2><p class="dim">${TRAITS[v.trait].text}</p><div class="card">${v.why.map(x=>`<p class="small">${esc(x)}</p>`).join("")}</div>
      <p class="tiny faint">${t("traitNote")}</p>`);
  });
  document.querySelectorAll("#v-me [data-go]").forEach(el => el.onclick = () => App.go("systems", el.dataset.go));
}

window.UI = {$, esc, sheet, closeSheet, toast, buzz, share, starfield, toTop, renderToday, renderWeek, renderMe, dateFmt, timeFmt, dots};
})();
