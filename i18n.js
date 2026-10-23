(() => {
// Languages, the same way Consensus Weather does it: a saved choice wins, otherwise the phone's
// system language (navigator.language, first two letters), otherwise English. Arabic and Persian
// switch the layout to right-to-left. Each language lives in i18n/xx.js as I18N.xx = {...};
// anything a language doesn't have falls back to English.
const LANG_NAMES = {en:"English",pl:"Polski",de:"Deutsch",uk:"Українська",es:"Español",fr:"Français",ru:"Русский",zh:"中文",ja:"日本語",
  pt:"Português",nl:"Nederlands",it:"Italiano",hi:"हिन्दी",ar:"العربية",el:"Ελληνικά",cs:"Čeština",sv:"Svenska",ko:"한국어",id:"Bahasa Indonesia",
  bn:"বাংলা",tr:"Türkçe",te:"తెలుగు",ro:"Română",hu:"Magyar",fi:"Suomi",no:"Norsk",sk:"Slovenčina",sw:"Kiswahili",fa:"فارسی",da:"Dansk",
  th:"ไทย",vi:"Tiếng Việt",bg:"Български"};
const RTL_LANGS = ["ar","fa"];
const KEY = "augur_lang";
// Intl wants "nb" for Norwegian; everything else uses its own code
const LOCALE = {no:"nb"};
window.I18N = window.I18N || {};

let LANG = (function(){
  try{ const s = localStorage.getItem(KEY); if(s && LANG_NAMES[s]) return s; }catch(e){}
  let n = (navigator.language || "en").slice(0,2).toLowerCase();
  if(n === "nb" || n === "nn") n = "no";   // Norwegian Bokmål / Nynorsk
  return LANG_NAMES[n] ? n : "en";
})();

const dict = () => I18N[LANG] || I18N.en;
function lookup(d, k){ return k.split(".").reduce((o, p) => (o == null ? undefined : o[p]), d); }
// t("key", {vars}): text in the current language, English if missing, the key itself as a last resort
function t(k, vars){
  let v = lookup(dict(), k);
  if(v == null) v = lookup(I18N.en, k);
  if(v == null) return k;
  if(typeof v === "function") return v(vars || {});
  if(typeof v === "string" && vars) for(const p in vars) v = v.split("{" + p + "}").join(vars[p]);
  return v;
}
// ordinal number in the current language ("3rd" in English); languages without a rule just get the number
const ord = n => { const f = dict().ord || (LANG === "en" ? I18N.en.ord : null); return f ? f(n) : String(n); };
// list joining ("A, B and C")
function list(items){
  try{ return new Intl.ListFormat(locale(), {style:"long", type:"conjunction"}).format(items.map(String)); }
  catch(e){ return items.join(", "); }
}
function locale(){ return LOCALE[LANG] || LANG; }

// Gives data objects (signs, totems, numbers…) live, translated fields: item.name reads the
// current language every time, so switching language needs no reload.
function bind(items, key, fields){
  const keys = Array.isArray(items) ? items.map((_, i) => i) : Object.keys(items);
  for(const k of keys){
    for(const f of fields){
      Object.defineProperty(items[k], f, {configurable:true, enumerable:true,
        get(){ const e = lookup(dict(), key + "." + k) ?? lookup(I18N.en, key + "." + k);
               if(e == null) return "";
               if(typeof e === "string") return e;
               return e[f] ?? (lookup(I18N.en, key + "." + k) || {})[f] ?? ""; }});
    }
  }
  return items;
}

// links that sit inside translated sentences
const HTML_VARS = {om:`<a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener">Open-Meteo</a>`};
function apply(){
  document.documentElement.lang = LANG;
  document.documentElement.dir = RTL_LANGS.includes(LANG) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll("[data-i18n-html]").forEach(el => el.innerHTML = t(el.dataset.i18nHtml, HTML_VARS));
  document.querySelectorAll("[data-i18n-ph]").forEach(el => el.placeholder = t(el.dataset.i18nPh));
}
function setLang(l){
  if(!LANG_NAMES[l]) return;
  LANG = l;
  try{ localStorage.setItem(KEY, l); }catch(e){}
  apply();
  window.dispatchEvent(new Event("augur-lang"));
}

window.L = {t, ord, list, bind, apply, setLang, locale, LANG_NAMES, RTL_LANGS, get lang(){ return LANG; }};
})();
