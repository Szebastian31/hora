(() => {
// The building blocks of every reading. The words live in i18n/xx.js; these objects get live,
// translated fields (TRAITS.bold.name, SIGN_TEXT[0].sun…) so every sentence is still tied to
// something real in your chart or today's sky.
const keys = o => Object.fromEntries(o.map(k => [k, {}]));
const twelve = () => [...Array(12)].map(() => ({}));

// The 12 traits shared by every system, used by the "where the systems agree" card
const TRAITS = L.bind(keys(["bold","grounded","curious","caring","proud","precise","harmonious","intense","free","ambitious","visionary","intuitive"]),
  "traits", ["name","text"]);
// each zodiac sign leans towards one trait, in sign order Aries → Pisces
const SIGN_TRAIT = ["bold","grounded","curious","caring","proud","precise","harmonious","intense","free","ambitious","visionary","intuitive"];
const ELEMENT_TRAITS = {fire:["bold","proud"], earth:["grounded","precise"], air:["curious","harmonious"], water:["intuitive","caring"]};

// The five tones of a day, shared by every system for the daily agreement card
const TONES = L.bind({push:{icon:"↗"}, connect:{icon:"⇄"}, create:{icon:"✶"}, steady:{icon:"▦"}, reflect:{icon:"◌"}}, "tones", ["name","text"]);

const SIGN_TEXT = L.bind(twelve(), "signText", ["core","sun","moon","rising","style"]);
const PLANET_TEXT = L.bind(keys(["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","node","asc","mc"]),
  "planetText", ["means","verb"]);
const HOUSE_TEXT = L.bind(twelve(), "houses", ["name","text"]);

window.Texts = {TRAITS, SIGN_TRAIT, ELEMENT_TRAITS, TONES, SIGN_TEXT, PLANET_TEXT, HOUSE_TEXT};
})();
