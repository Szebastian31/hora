(() => {
// Daily quotes, in the current language. Everything is old enough to be in the public domain, and
// only quotes with a known source are included (no internet misattributions). There is one quote for
// each date of the year, 1 January to 31 December with 29 February too, so every date has its own
// quote and seasonal ones (New Year, spring, the solstices, Halloween, Christmas) land on their day.
// Everyone sees the same quote on the same day.
function dayOfYear(date){
  // counted in a leap year, so 1 March is always day 60 and 29 February keeps a quote of its own
  return Math.round((Date.UTC(2024, date.getMonth(), date.getDate()) - Date.UTC(2024, 0, 1)) / 86400000);
}
function quoteFor(date){
  const en = I18N.en.quotes, own = L.t("quotes");
  let list = en, i = dayOfYear(date);
  if(Array.isArray(own) && own.length === en.length) list = own;
  else if(Array.isArray(own) && own.length){
    // a language that hasn't got the whole year yet keeps rotating through the quotes it has
    const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())/86400000);
    list = own; i = ((dayNumber*37) % own.length + own.length) % own.length;
  }
  return {text:list[i][0], by:list[i][1]};
}

window.Quotes = {quoteFor, dayOfYear};
})();
