(() => {
// Mayan astrology: the 260-day sacred calendar (Tzolk'in in Yucatec, Cholq'ij in K'iche'), where
// each day pairs a number from 1 to 13 with one of 20 day signs (nawales).
//
// It is counted two ways, and they usually give a different day for the same birthday:
// - Traditional: the unbroken count still kept by K'iche' daykeepers in Guatemala, anchored with the
//   standard GMT correlation (Julian Day 584283 = 4 Ajpu, the Long Count's zero date). 21 Dec 2012
//   comes out as 4 Ajpu, as it should.
// - Dreamspell: José Argüelles' 1987 system, used by most popular sites. It skips 29 February so the
//   count lines up with the Gregorian year; anchored on 26 July 2013 = Kin 164 (Yellow Galactic Seed).
//
// Index = day sign, 0 = Imox (Imix, Red Dragon) … 19 = Ajpu (Ajaw, Yellow Sun). Names and texts are
// in i18n/xx.js ("nawales", "mayaTones"); `tone` is what the day sign brings to a day.
const SIGNS = L.bind([
  {kiche:"Imox",     yuc:"Imix",     traits:["intuitive","caring"],   tone:"reflect"},
  {kiche:"Iq'",      yuc:"Ik'",      traits:["curious","free"],       tone:"create"},
  {kiche:"Aq'ab'al", yuc:"Ak'b'al",  traits:["visionary","intuitive"],tone:"push"},
  {kiche:"K'at",     yuc:"K'an",     traits:["precise","grounded"],   tone:"steady"},
  {kiche:"Kan",      yuc:"Chikchan", traits:["intense","bold"],       tone:"push"},
  {kiche:"Kame",     yuc:"Kimi",     traits:["intuitive","harmonious"],tone:"reflect"},
  {kiche:"Kej",      yuc:"Manik'",   traits:["ambitious","grounded"], tone:"steady"},
  {kiche:"Q'anil",   yuc:"Lamat",    traits:["proud","visionary"],    tone:"create"},
  {kiche:"Toj",      yuc:"Muluk",    traits:["caring","harmonious"],  tone:"reflect"},
  {kiche:"Tz'i'",    yuc:"Ok",       traits:["caring","precise"],     tone:"connect"},
  {kiche:"B'atz'",   yuc:"Chuwen",   traits:["curious","proud"],      tone:"create"},
  {kiche:"E",        yuc:"Eb'",      traits:["free","curious"],       tone:"push"},
  {kiche:"Aj",       yuc:"B'en",     traits:["caring","ambitious"],   tone:"connect"},
  {kiche:"I'x",      yuc:"Ix",       traits:["intense","intuitive"],  tone:"reflect"},
  {kiche:"Tz'ikin",  yuc:"Men",      traits:["visionary","ambitious"],tone:"connect"},
  {kiche:"Ajmaq",    yuc:"Kib'",     traits:["curious","intense"],    tone:"reflect"},
  {kiche:"No'j",     yuc:"Kab'an",   traits:["visionary","precise"],  tone:"steady"},
  {kiche:"Tijax",    yuc:"Etz'nab'", traits:["precise","bold"],       tone:"push"},
  {kiche:"Kawoq",    yuc:"Kawak",    traits:["caring","harmonious"],  tone:"connect"},
  {kiche:"Ajpu",     yuc:"Ajaw",     traits:["bold","proud"],         tone:"push"},
], "nawales", ["meaning","text","day","seal"]);
const TONES = L.bind([...Array(13)].map(() => ({})), "mayaTones", ["name","text"]);
// the four directions each day sign belongs to, in turn: east (red), north (white), west (black/blue), south (yellow)
const COLOURS = ["#d9534f","#aeb6c4","#4a5aa8","#e0ad3a"];

const mod = (a, n) => ((a % n) + n) % n;
// Julian Day Number of a Gregorian date
function jdn(y, m, d){
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12*a - 3;
  return d + Math.floor((153*mm + 2)/5) + 365*yy + Math.floor(yy/4) - Math.floor(yy/100) + Math.floor(yy/400) - 32045;
}

function traditional(y, m, d){
  const n = jdn(y, m, d) - 584283;
  const sign = mod(n + 19, 20), number = mod(n + 3, 13) + 1;
  return {sign, number, nawal:SIGNS[sign], tone:TONES[number-1], colour:COLOURS[sign % 4]};
}

// Dreamspell counts 365 days a year; 29 February shares 28 February's kin
const CUM = [0,31,59,90,120,151,181,212,243,273,304,334];
const noLeap = (y, m, d) => y*365 + CUM[m-1] + (m === 2 && d === 29 ? 28 : d);
const ANCHOR = noLeap(2013, 7, 26);
// the oracle: guide (by tone), analog, antipode and occult, counting the seals 1–20
const GUIDE = [0,0,12,4,-4,8,0,12,4,-4,8,0,12,4];
function dreamspell(y, m, d){
  const kin = mod(163 + noLeap(y, m, d) - ANCHOR, 260) + 1;
  const seal = (kin - 1) % 20, number = (kin - 1) % 13 + 1, s = seal + 1;
  const at = v => mod(v - 1, 20);
  return {kin, seal, number, nawal:SIGNS[seal], tone:TONES[number-1], colour:seal % 4,
    oracle:{guide:at(s + GUIDE[number]), analog:at(19 - s), antipode:at(s + 10), occult:at(21 - s)}};
}

function mayan(profile){
  const [y, m, d] = profile.date.split("-").map(Number);
  const tr = traditional(y, m, d), ds = dreamspell(y, m, d);
  return {traditional:tr, dreamspell:ds, same:tr.sign === ds.seal && tr.number === ds.number,
    traits:[...tr.nawal.traits]};
}
const today = (date) => traditional(date.getFullYear(), date.getMonth()+1, date.getDate());

window.Mayan = {SIGNS, TONES, COLOURS, traditional, dreamspell, mayan, today};
})();
