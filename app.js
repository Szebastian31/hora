(() => {
// App state, first-open form, birthplace search, saving, navigation, language and the Profile screen.
const {$, esc, sheet, closeSheet, toast, buzz} = UI;
const t = L.t;
const KEY = "augur.v1";
const DEFAULTS = {houseSystem:"placidus", skin:"night"};
const S = {profile:null, settings:{...DEFAULTS}, view:"today"};
const todayKey = () => new Date().toDateString();

// ---- storage: everything stays in this phone's local storage
function load(){
  try{ const d = JSON.parse(localStorage.getItem(KEY) || "null"); if(d){ S.profile = d.profile; S.settings = {...DEFAULTS, ...d.settings}; } }catch(e){}
}
// (private browsing can block storage; Augur still works, it just won't remember you)
function save(){ try{ localStorage.setItem(KEY, JSON.stringify({profile:S.profile, settings:S.settings})); }catch(e){} }
function saveSettings(){ save(); }

// ---- calculations
function compute(){
  S.chart = Chart.natal(S.profile, S.settings);
  S.wheel = Native.native(S.chart);
  S.chi = Chinese.chinese(S.profile, S.chart);
  S.num = Numerology.numerology(S.profile);
  S.egy = Egyptian.egyptian(S.profile);
  S.maya = Mayan.mayan(S.profile);
  S.nat = Consensus.natal(S.profile, S.chart, S.wheel, S.chi, S.num, S.egy, S.maya);
  S.day = Daily.day(S.profile, S.chart, S.chi);
  S.week = Week.week(S.profile, S.chart, S.chi);
  S.dayKey = todayKey();
}
function renderAll(){
  try{
    compute();
    UI.renderToday(S); UI.renderWeek(S); UI.renderMe(S); Systems.render(S); renderProfile();
  }catch(e){
    console.error(e);
    $("#v-today").innerHTML = `<div class="card"><h2>${t("errTitle")}</h2><p class="dim small">${esc(t("errBody", {msg:e.message}))}</p></div>`;
  }
}

// ---- navigation
function go(view, sub){
  S.view = view;
  document.querySelectorAll("main > .view").forEach(v => v.classList.remove("on"));
  $("#v-" + view).classList.add("on");
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  if(view === "systems" && sub) Systems.render(S, sub);
  UI.toTop();
}
function showApp(){
  $("#onboard").classList.remove("on"); $("#nav").style.display = "";
  renderAll(); go(S.view || "today");
}
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => { go(b.dataset.v); buzz("8"); });
$("#sheet").addEventListener("click", e => { if(e.target.id === "sheet") closeSheet(); });

// Android back button
window.augurBack = () => {
  if(closeSheet()) return true;
  if(editing){ editing = false; showApp(); return true; }
  if(S.profile && S.view !== "today"){ go("today"); return true; }
  return false;
};
// a new day may have started while the app sat in the background
window.augurResume = () => { if(S.profile && !editing && S.dayKey !== todayKey()) renderAll(); };
document.addEventListener("visibilitychange", () => { if(!document.hidden) window.augurResume(); });

// ---- language (same list and behaviour as Consensus Weather)
function langSheet(){
  const cur = L.lang;
  sheet(`<h2>${t("language")}</h2><div class="card" style="padding:6px 8px">${Object.entries(L.LANG_NAMES).map(([k,n]) =>
    `<button class="langrow${k===cur?" on":""}" data-l="${k}" dir="auto"><span>${n}</span>${k===cur?"<b>✓</b>":""}</button>`).join("")}</div>`);
  document.querySelectorAll("#sheet [data-l]").forEach(b => b.onclick = () => { L.setLang(b.dataset.l); buzz(); });
}
window.addEventListener("augur-lang", () => {
  closeSheet();
  $("#f-lang").textContent = L.LANG_NAMES[L.lang];
  setTimeMode(timeMode);
  showChosen();
  if(editing) $("#f-go").textContent = t("saveChanges");
  if(S.profile && !editing){ renderAll(); go(S.view); }
});
$("#f-lang").onclick = langSheet;

// ---- first-open form
let place = null, timeMode = "exact", editing = false;
function setTimeMode(m){
  timeMode = m;
  document.querySelectorAll("#f-timemode button").forEach(b => b.classList.toggle("on", b.dataset.v === m));
  $("#f-timerow").style.display = m === "unknown" ? "none" : "flex";
  $("#f-spread").style.display = m === "approx" ? "block" : "none";
  $("#f-timehint").textContent = t(m === "unknown" ? "hintUnknown" : m === "approx" ? "hintApprox" : "hintExact");
  [...$("#f-spread").options].forEach(o => o.textContent = +o.value < 60 ? t("spreadMin", {n:o.value}) : t("spreadHour", {n:o.value/60}));
}
document.querySelectorAll("#f-timemode button").forEach(b => b.onclick = () => setTimeMode(b.dataset.v));

function showChosen(){
  $("#f-chosen").innerHTML = place ? `<div class="chosen"><div class="grow"><b>${esc(place.name)}</b>
      <div class="tiny faint">${Math.abs(place.lat).toFixed(2)}°${place.lat>=0?"N":"S"} ${Math.abs(place.lon).toFixed(2)}°${place.lon>=0?"E":"W"} · ${esc(place.tz)}</div></div>
      <button type="button" class="link" id="f-clear">${t("change")}</button></div>` : "";
  if(place) $("#f-clear").onclick = () => { place = null; showChosen(); $("#f-place").value = ""; $("#f-place").focus(); };
}

let searchT, searchN = 0;
$("#f-place").addEventListener("input", e => {
  clearTimeout(searchT);
  const q = e.target.value.trim();
  if(q.length < 2){ $("#f-results").innerHTML = ""; return; }
  searchT = setTimeout(() => searchPlace(q), 350);
});
async function searchPlace(q){
  const n = ++searchN;
  try{
    // place names come back in the app's language where Open-Meteo has them
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${L.locale().slice(0,2)}&format=json`);
    const data = await r.json();
    if(n !== searchN) return;
    const res = (data.results || []).filter(x => x.timezone);
    $("#f-results").innerHTML = res.length ? res.map((x,i) => `<button type="button" data-i="${i}" dir="auto">${esc(x.name)}<small>${esc([x.admin1, x.country].filter(Boolean).join(", "))}</small></button>`).join("")
      : `<button type="button" disabled>${t("noPlaces")}<small>${t("noPlacesSub")}</small></button>`;
    $("#f-results").querySelectorAll("button[data-i]").forEach(b => b.onclick = () => {
      const x = res[+b.dataset.i];
      place = {name:[x.name, x.admin1, x.country].filter(Boolean).join(", "), lat:x.latitude, lon:x.longitude, tz:x.timezone};
      $("#f-results").innerHTML = ""; $("#f-place").value = ""; showChosen(); buzz();
    });
  }catch(err){
    if(n === searchN) $("#f-results").innerHTML = `<button type="button" disabled>${t("netErr")}<small>${t("netErrSub")}</small></button>`;
  }
}

// manual coordinates for offline use
$("#f-manual").onclick = () => {
  const box = $("#f-manualbox"); box.style.display = box.style.display === "none" ? "block" : "none";
  const sel = $("#f-tz");
  if(!sel.options.length){
    let zones = []; try{ zones = Intl.supportedValuesOf("timeZone"); }catch(e){ zones = ["Europe/Warsaw","Europe/London","America/New_York","Asia/Kolkata","Asia/Shanghai","UTC"]; }
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    sel.innerHTML = zones.map(z => `<option${z===mine?" selected":""}>${z}</option>`).join("");
  }
};
function manualPlace(){
  const lat = parseFloat($("#f-lat").value.replace(",",".")), lon = parseFloat($("#f-lon").value.replace(",","."));
  if(isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {name:`${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, tz:$("#f-tz").value};
}

$("#form").addEventListener("submit", e => {
  e.preventDefault();
  const birthName = $("#f-birthname").value.trim().replace(/\s+/g," ");
  const date = $("#f-date").value;
  const p = place || ($("#f-manualbox").style.display !== "none" ? manualPlace() : null);
  if(!birthName) return toast(t("errName"));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || new Date(date) > new Date()) return toast(t("errDate"));
  if(timeMode !== "unknown" && !$("#f-time").value) return toast(t("errTime"));
  if(!p) return toast(t("errPlace"));
  S.profile = {birthName, name:$("#f-name").value.trim().replace(/\s+/g," "), date, timeMode,
    time: timeMode === "unknown" ? null : $("#f-time").value, timeSpread: timeMode === "approx" ? +$("#f-spread").value : 0, place:p};
  save(); editing = false; buzz("14,40,14");
  S.view = "today"; showApp();
});

function openForm(){
  editing = !!S.profile;
  $("#nav").style.display = "none";
  document.querySelectorAll("main > .view").forEach(v => v.classList.remove("on"));
  $("#onboard").classList.add("on");
  const p = S.profile;
  if(p){
    $("#f-birthname").value = p.birthName; $("#f-name").value = p.name || ""; $("#f-date").value = p.date;
    setTimeMode(p.timeMode); if(p.time) $("#f-time").value = p.time; if(p.timeSpread) $("#f-spread").value = p.timeSpread;
    place = p.place; showChosen();
    $("#f-go").textContent = t("saveChanges");
    if(!$("#f-cancel")){
      const c = document.createElement("button"); c.type = "button"; c.className = "btn ghost"; c.id = "f-cancel"; c.dataset.i18n = "cancel"; c.textContent = t("cancel"); c.style.marginTop = "8px";
      c.onclick = () => { editing = false; showApp(); };
      $("#f-go").after(c);
    }
  }
  $("#f-date").max = new Date().toISOString().slice(0,10);
  UI.toTop();
}

// ---- Profile & settings
function renderProfile(){
  const p = S.profile, st = S.settings;
  const opt = (obj, cur) => Object.entries(obj).map(([k,v]) => `<option value="${k}"${k===cur?" selected":""}>${typeof v === "string" ? v : v.name}</option>`).join("");
  const version = window.AugurNative ? AugurNative.version() : "web";
  const time = p.timeMode === "unknown" ? t("timeUnknown") : UI.timeFmt(p.time) + (p.timeMode === "approx" ? " " + t("spreadMin", {n:p.timeSpread}) : "");
  const link = (href, name) => `<a class="gold" href="${href}" target="_blank" rel="noopener">${name}</a>`;
  $("#v-profile").innerHTML = `
    <div class="top"><div><div class="date">${t("settings")}</div><h1>${t("profile")}</h1></div></div>
    <div class="card tap" id="p-edit"><div class="label"><span>${t("birthDetails")}</span><span class="gold">${t("edit")}</span></div>
      <p><b>${esc(p.birthName)}</b>${p.name && p.name !== p.birthName ? ` <span class="dim">${esc(t("nowName", {name:p.name}))}</span>` : ""}</p>
      <p class="small dim">${UI.dateFmt(new Date(p.date+"T12:00"))} · ${time} · ${esc(p.place.name)}</p></div>
    <div class="card">
      <div class="field" style="margin-top:0"><label>${t("language")}</label><button class="langbtn" id="p-lang" dir="auto"><span>${L.LANG_NAMES[L.lang]}</span><span class="chev"></span></button></div>
      <div class="field"><label>${t("houseSystem")}</label><select id="s-house">${opt(Chart.HOUSE_SYSTEMS, st.houseSystem)}</select></div>
      <div class="field" style="margin-bottom:0"><label>${t("look")}</label><select id="s-skin">${opt(t("skins"), st.skin)}</select></div>
    </div>
    <div class="card small"><div class="label">${t("privacy")}</div>
      <p>${t("privacy1")}</p>
      <p class="dim">${t("privacy2")}</p>
      <button class="btn danger" id="p-delete" style="margin-top:8px">${t("deleteAll")}</button></div>
    <div class="card small"><div class="label">${t("accuracy")}</div>
      <p>${t("accuracy1")}</p>
      <p class="dim">${t("accuracy2")}</p></div>
    <div class="card small"><div class="label">${t("family")}</div>
      <p>${t("family1", {cw:link("https://github.com/Szebastian31/Consensus_Weather", "Consensus Weather"),
        ca:link("https://szebastian31.github.io/caelum/", "Caelum"), ho:link("https://szebastian31.github.io/hora/", "Hora")})}</p>
      <p class="faint tiny">${esc(t("versionLine", {v:version}))}</p></div>`;
  $("#p-edit").onclick = openForm;
  $("#p-lang").onclick = langSheet;
  const bind = (id, key) => $(id).onchange = e => { S.settings[key] = e.target.value; save(); applySkin(); renderAll(); go("profile"); toast(t("saved")); };
  bind("#s-house","houseSystem"); bind("#s-skin","skin");
  $("#p-delete").onclick = () => {
    sheet(`<h2>${t("deleteQ")}</h2><p class="dim">${t("deleteBody")}</p>
      <button class="btn danger" id="p-really">${t("deleteBtn")}</button><button class="btn ghost" style="margin-top:8px" id="p-keep">${t("keepData")}</button>`);
    $("#p-keep").onclick = closeSheet;
    $("#p-really").onclick = () => { try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); };
  };
}
function applySkin(){ $("#screen").className = "screen " + (S.settings.skin === "night" ? "" : S.settings.skin); }

// ---- start
L.apply();
$("#f-lang").textContent = L.LANG_NAMES[L.lang];
setTimeMode("exact");
load(); applySkin(); UI.starfield();
addEventListener("resize", () => UI.starfield());
if(S.profile) showApp();
else { $("#onboard").classList.add("on"); $("#f-date").max = new Date().toISOString().slice(0,10); }

// offline copy for the web version (the Android app already has the files built in)
if("serviceWorker" in navigator && location.protocol === "https:" && location.hostname !== "appassets.androidplatform.net"){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

// load a profile directly (used by the demo)
function useProfile(p){ S.profile = p; save(); S.view = "today"; showApp(); }

window.App = {go, saveSettings, useProfile, state:S};
})();
