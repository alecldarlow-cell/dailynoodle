/* Words no generated Mini or Doku may use (shared by tools/pinwheel-regen.js and
   tools/tests/content.js, which fails a forthcoming Doku holding one; 24 Oct 2026). */
const BLOCKED = ["anal","anus","arse","bastard","bitch","boob","boobs","cunt","cunts","dick","dicks","dildo","fuck","fucks","heroin","homo","jihad","meth","nazi","nazis","negro","nude","nudes","opium","orgy","penis","pimp","porn","porno","pussy","rape","raped","rapes","semen","sex","sexy","sperm","twat","whore"];
const SENSITIVE = ["ass","bra","coke","crack","damn","hell","jew","jews","slave","suck","sucks","tit","tits"];
// weak fill: Roman numerals, month/day/unit abbreviations, foreign function words
const VETO = ["non","abuse","pic","anti","amino","rep","xxx","iii","vii","viii","xiii","aaa","abc",
  "jan","feb","apr","jun","jul","aug","sep","sept","oct","nov","dec","mon","tue","wed","thu","fri",
  "sec","cos","est","las","das","neo","eds","hes","pac","pos","rom","alt","tho","med","mil","col","chi","calif","exec",
  "armor","color","colors","favor","labor","humor","honor","odor","rumor","tumor","valor","vapor","arbor",
  "meter","liter","fiber","plow","cozy","mold","molds","gray","center","theater","jewelry",
  "asses","feces","horny","urine","bowel","sexes","moron","lynch","trump","pepsi","cisco","omaha","iowa","unix",
  "crore","malik","mecca","torah","islam","hindu","hindi","iraqi","saudi","tamil","malay","norse","shiva","sunni","imam","urdu","erie",
  "thai","rome","york","japan","yang","afro","frat","feds","gaga","asap","nato","xmas","sync","exec","spec","sept","docs","bots","offs",
  "coco","duff","sire","mater","prima","synod","assay","basal","nodes","ionic","lymph","sinus","toxin","dandy","limbo","aides","overs",
  "arab","arabs","aryan","turk","turks","brits","scots","danes","amish","gays","dyke","queer","slut","shia","sunni","sikh","jihad",
  // 19 Oct 2026 (Mini clue pass): US spelling, slang, a unit symbol, breakfast test
  "edema","eon","eons","gonna","wanna","gotta","mol","balls","sera","lea","rad","aging","hath","thine","thou","thee"];
// 24 Oct 2026 (Doku veto audit): non-words without their apostrophe, brands, jargon, unkind words
VETO.push("cant","anon","stein","tesla","yahoo","lieu","renal","obese","idiot","swine");
module.exports = { BLOCKED, SENSITIVE, VETO };
