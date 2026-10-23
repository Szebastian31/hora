(() => {
// Egyptian astrology: the twelve gods of the popular "Egyptian zodiac". Each god rules two to four
// stretches of the year, so it comes from the calendar date alone. This is a modern system (there is
// no sign of it in ancient texts); i18n/xx.js ("egyptNote") says so in the app.
//
// Index order: Nile, Amun-Ra, Mut, Geb, Osiris, Isis, Thoth, Horus, Anubis, Seth, Bastet, Sekhmet.
// `days` are [month, first day, last day]; `match` are the gods each one gets on best with.
const GODS = L.bind([
  {days:[[1,1,7],[6,19,28],[9,1,7],[11,18,26]], match:[1,9],  traits:["intuitive","free"],     hex:"#5fa8d6"},
  {days:[[1,8,21],[2,1,11]],                    match:[0,7],  traits:["ambitious","proud"],    hex:"#e8b04a"},
  {days:[[1,22,31],[9,8,22]],                   match:[1,6],  traits:["caring","grounded"],    hex:"#c98a7a"},
  {days:[[2,12,29],[8,20,31]],                  match:[7,9],  traits:["grounded","intuitive"], hex:"#7aa36a"},
  {days:[[3,1,10],[11,27,30],[12,1,18]],        match:[5,6],  traits:["bold","intense"],       hex:"#4f9a8a"},
  {days:[[3,11,31],[10,18,29],[12,19,31]],      match:[4,6],  traits:["caring","bold"],        hex:"#9a7ad6"},
  {days:[[4,1,19],[11,8,17]],                   match:[10,5], traits:["curious","precise"],    hex:"#6a8fd6"},
  {days:[[4,20,30],[5,1,7],[8,12,19]],          match:[10,3], traits:["bold","ambitious"],     hex:"#e07a4a"},
  {days:[[5,8,27],[6,29,30],[7,1,13]],          match:[10,5], traits:["intense","intuitive"],  hex:"#3a3a4a"},
  {days:[[5,28,31],[6,1,18],[9,28,30],[10,1,2]],match:[3,0],  traits:["ambitious","free"],     hex:"#b0473c"},
  {days:[[7,14,28],[9,23,27],[10,3,17]],        match:[11,7], traits:["harmonious","intuitive"],hex:"#d6a85f"},
  {days:[[7,29,31],[8,1,11],[10,30,31],[11,1,7]],match:[3,10],traits:["precise","ambitious"],  hex:"#d9603b"},
], "gods", ["name","title","text","gift","shadow"]);

const md = (m, d) => new Date(2001, m-1, d).toLocaleDateString(L.locale(), {day:"numeric", month:"short"});
const monthEnd = m => [31,29,31,30,31,30,31,31,30,31,30,31][m-1];
// "1 Jan – 7 Jan, 19 Jun – 28 Jun…"; a range that ends on the last of a month and carries on
// from the 1st of the next is shown as one
GODS.forEach(g => Object.defineProperty(g, "dates", {get(){
  const out = [];
  for(const [m,a,b] of g.days){
    const prev = out[out.length-1];
    if(prev && a === 1 && prev.to[0] === m-1 && prev.to[1] === monthEnd(m-1)) prev.to = [m,b];
    else out.push({from:[m,a], to:[m,b]});
  }
  return out.map(r => `${md(...r.from)} – ${md(...r.to)}`);
}}));

function godOf(month, day){
  const i = GODS.findIndex(g => g.days.some(([m,a,b]) => m === month && day >= a && day <= b));
  return i < 0 ? 0 : i;
}

function egyptian(profile){
  const [, m, d] = profile.date.split("-").map(Number);
  const index = godOf(m, d), god = GODS[index];
  return {index, god, traits:god.traits, match:god.match};
}

window.Egyptian = {GODS, godOf, egyptian};
})();
