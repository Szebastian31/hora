(() => {
// Numerology (Pythagorean): numbers from your birth date and the full name you were given at birth.
const VAL = {}; "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c,i)=> VAL[c] = i%9 + 1);
const MASTERS = [11,22,33];
const VOWELS = new Set(["A","E","I","O","U"]);

const NUMBERS = {
  1: {traits:["bold","ambitious"]},
  2: {traits:["harmonious","caring"]},
  3: {traits:["curious","proud"]},
  4: {traits:["grounded","precise"]},
  5: {traits:["free","curious"]},
  6: {traits:["caring","harmonious"]},
  7: {traits:["intuitive","precise"]},
  8: {traits:["ambitious","intense"]},
  9: {traits:["visionary","caring"]},
  11:{traits:["intuitive","visionary"]},
  22:{traits:["ambitious","grounded"]},
  33:{traits:["caring","visionary"]},
};
L.bind(NUMBERS, "numbers", ["title","text"]);
// what a Personal Day / Month / Year number is good for
const CYCLE = {
  1:{tone:"push"},
  2:{tone:"connect"},
  3:{tone:"create"},
  4:{tone:"steady"},
  5:{tone:"push"},
  6:{tone:"connect"},
  7:{tone:"reflect"},
  8:{tone:"steady"},
  9:{tone:"reflect"},
};
L.bind(CYCLE, "cycle", ["text"]);

const digits = n => String(n).split("").reduce((a,b)=>a + +b, 0);
function reduce(n, keepMaster=true){
  while(n > 9 && !(keepMaster && MASTERS.includes(n))) n = digits(n);
  return n;
}
// Cyrillic and Greek names are read in their usual Latin spelling, as numerologists do
const TRANSLIT = {
  а:"a",б:"b",в:"v",г:"g",ґ:"g",д:"d",е:"e",ё:"e",є:"ye",ж:"zh",з:"z",и:"i",і:"i",ї:"yi",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
  у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  α:"a",β:"v",γ:"g",δ:"d",ε:"e",ζ:"z",η:"i",θ:"th",ι:"i",κ:"k",λ:"l",μ:"m",ν:"n",ξ:"x",ο:"o",π:"p",ρ:"r",σ:"s",ς:"s",τ:"t",υ:"y",φ:"f",χ:"ch",ψ:"ps",ω:"o",
};
// Bulgarian names use the official Bulgarian spelling (\u044a is "a", \u0449 is "sht")
const BG = {\u044a:"a", \u0449:"sht"};
const tr = s => s.replace(/[\u0370-\u03ff\u0400-\u04ff]/g, c => (L.lang === "bg" && BG[c]) || (TRANSLIT[c] ?? c));
function clean(name){
  // Cyrillic first (so й stays "y"), then strip accents, then Greek letters that had accents
  return tr(tr((name||"").normalize("NFC").toLowerCase()).normalize("NFD").replace(/[\u0300-\u036f]/g,""))
    .replace(/ł/g,"l").replace(/ß/g,"ss").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/đ/g,"d")
    .replace(/ı/g,"i").replace(/œ/g,"oe").replace(/ð/g,"d").replace(/þ/g,"th")
    .toUpperCase().replace(/[^A-Z]/g," ");
}
// can this name be read at all? (other scripts need the name typed in Latin letters)
const readable = name => /[A-Z]/.test(clean(name));
// Y counts as a vowel when it has no vowel next to it (as in "Lynn"), otherwise as a consonant
function letters(name){
  const s = clean(name), out = [];
  for(let i=0;i<s.length;i++){
    const c = s[i]; if(c === " ") continue;
    let vowel = VOWELS.has(c);
    if(c === "Y") vowel = !VOWELS.has(s[i-1]||"") && !VOWELS.has(s[i+1]||"");
    out.push({c, v:VAL[c], vowel});
  }
  return out;
}
const sumOf = arr => arr.reduce((a,x)=>a + x.v, 0);

function numerology(profile, today=new Date()){
  const [y,m,d] = profile.date.split("-").map(Number);
  const lifePath = reduce(reduce(m) + reduce(d) + reduce(digits(y)));
  const lt = letters(profile.birthName || profile.name);
  const expression = lt.length ? reduce(sumOf(lt)) : null;
  const soul = lt.length ? reduce(sumOf(lt.filter(x=>x.vowel))) : null;
  const personality = lt.length ? reduce(sumOf(lt.filter(x=>!x.vowel))) : null;
  const birthday = reduce(d);
  const maturity = expression ? reduce(reduce(lifePath + expression)) : null;
  const cur = profile.name && profile.birthName && clean(profile.name) !== clean(profile.birthName) ? reduce(sumOf(letters(profile.name))) : null;
  return {lifePath, expression, soul, personality, birthday, maturity, currentName:cur, ...personal(profile, today)};
}
// the cycles that change: personal year (from 1 January), month and day
function personal(profile, date){
  const [, m, d] = profile.date.split("-").map(Number);
  const year = reduce(reduce(m) + reduce(d) + reduce(digits(date.getFullYear())), false);
  const month = reduce(year + date.getMonth() + 1, false);
  const day = reduce(month + date.getDate(), false);
  return {personalYear:year, personalMonth:month, personalDay:day};
}

window.Numerology = {NUMBERS, CYCLE, reduce, letters, readable, numerology, personal};
})();
