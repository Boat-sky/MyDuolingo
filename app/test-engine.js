// Node test harness for engine.js + data.js
const VOCAB = require('./data.js');
const E = require('./engine.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', name); }
}

// --- data ---
ok(VOCAB.length === 1177, 'vocab has 1177 words');
ok(VOCAB.every(w => w.cn && w.py && w.th && w.en), 'all fields present');
ok(new Set(VOCAB.map(w => w.id)).size === VOCAB.length, 'ids unique');

// --- units ---
const units = E.units(VOCAB);
ok(units.length === Math.ceil(1177 / 10), 'unit count = 118');
ok(units[0].words.length === 10, 'first unit has 10 words');
ok(units[117].words.length === 7, 'last unit has 7 words');
ok(units.flatMap(u => u.words).length === 1177, 'units cover all words');

// --- SRS ---
const now = 1700000000000;
let st = E.applyAnswer(undefined, true, now);
ok(st.hl === 0.25 && st.seen === 1 && st.correct === 1, 'first correct answer initializes state');
ok(E.recallProb(st, now) === 1, 'recall = 1 right after answering');
ok(Math.abs(E.recallProb(st, now + 6 * 3600000) - 0.5) < 1e-9, 'recall = 0.5 after one half-life (6h)');

let st2 = E.applyAnswer(st, true, now + 6 * 3600000);
ok(st2.hl > st.hl * 2, 'half-life grows >2x on hard correct recall');
let st3 = E.applyAnswer(st2, false, now + 86400000);
ok(st3.hl < st2.hl, 'half-life shrinks on wrong answer');
ok(st3.hl >= 1 / 24, 'half-life floor respected');

// cap
let capSt = { hl: 179, last: now, seen: 1, correct: 1, wrong: 0 };
capSt = E.applyAnswer(capSt, true, now + 100 * 86400000);
ok(capSt.hl <= 180, 'half-life cap respected');

// strength
ok(E.strength(undefined, now) === 0, 'unseen word strength 0');
ok(E.strength({ hl: 10, last: now, seen: 1 }, now) === 4, 'fresh word strength 4');

// --- pinyin ---
ok(E.normalizePinyin('diàn chí') === 'dianchi', 'tone marks stripped');
ok(E.normalizePinyin('jiāo / zhí liú diàn yuán guì') === 'jiaozhiliudianyuangui', 'punctuation stripped');
ok(E.checkPinyin('  Dian Chi ', 'dianchi'), 'lenient input check');
ok(!E.checkPinyin('dianche', 'dianchi'), 'wrong pinyin rejected');
ok(E.normalizePinyin('lǜ') === 'lv', 'ü → v');

// every word's pinyin normalizes to non-empty ascii
ok(VOCAB.every(w => /^[a-z]+$/.test(E.normalizePinyin(w.py))), 'all pinyin normalize cleanly');

// --- exercises ---
const rng = E.makeRng(42);
const ex1 = E.buildExercise('cn2th', VOCAB[0], VOCAB, rng);
ok(ex1.choices.length === 4, 'cn2th has 4 choices');
ok(ex1.choices.some(c => c.id === ex1.answerId), 'answer among choices');
ok(new Set(ex1.choices.map(c => c.id)).size === 4, 'choices distinct');
ok(ex1.choices.find(c => c.id === ex1.answerId).label === VOCAB[0].th, 'answer label is thai meaning');

const exL = E.buildExercise('listen', VOCAB[5], VOCAB, rng);
ok(exL.speak === VOCAB[5].cn, 'listen exercise speaks chinese');

const exP = E.buildExercise('pinyin', VOCAB[4], VOCAB, rng); // 电池 diàn chí
ok(exP.answers.length === 1 && exP.answers[0] === 'dianchi', 'pinyin exercise answer normalized');

// --- english mode ---
ok(E.normalizeText('Battery Bank / Battery String') === 'batterybankbatterystring', 'en normalize strips punctuation');
const ba = E.enAnswers('Battery Bank / Battery String');
ok(ba.includes('batterybank') && ba.includes('batterystring'), 'slash variants accepted');
ok(E.checkTyped('battery bank', ba, 'en'), 'en typed variant matches');
ok(E.checkTyped(' Battery-Bank ', ba, 'en'), 'en typed lenient punctuation');
ok(!E.checkTyped('battery', ba, 'en'), 'en partial rejected');
ok(E.enAnswers('AC (Alternating Current)').includes('ac'), 'parenthetical stripped');
ok(E.checkTyped('dian chi', ['dianchi'], 'cn'), 'checkTyped works for pinyin too');

const exEn = E.buildExercise('cn2th', VOCAB[4], VOCAB, rng, 'en');
ok(exEn.prompt === VOCAB[4].en && exEn.lang === 'en', 'en cn2th prompts english word');
ok(exEn.sub === '', 'en prompt has no pinyin sub');
const exEnL = E.buildExercise('listen', VOCAB[4], VOCAB, rng, 'en');
ok(exEnL.speak === VOCAB[4].en, 'en listen speaks english');
const exEnT = E.buildExercise('pinyin', VOCAB[4], VOCAB, rng, 'en');
ok(exEnT.prompt === VOCAB[4].th && exEnT.answers.includes('batteries'), 'en typing: thai prompt, english answer');
const mEn = E.buildMatch(units[0].words, rng, 'en');
ok(mEn.left.every(t => units[0].words.some(w => w.en === t.label)), 'en match left tiles are english');
const lessonEn = E.buildLesson(units[0].words, VOCAB, 5, 'en');
ok(lessonEn.length === 21, 'en lesson also 21 exercises');
ok(lessonEn.every(e => e.lang === 'en'), 'en lesson exercises all tagged en');

// every word yields at least one typable english answer
ok(VOCAB.every(w => E.enAnswers(w.en).length > 0), 'all english entries produce answers');

const m = E.buildMatch(units[0].words, rng);
ok(m.left.length === 5 && m.right.length === 5, 'match has 5 pairs');
ok(new Set(m.left.map(t => t.id)).size === 5, 'match left ids distinct');
ok(m.left.every(t => m.right.some(r => r.id === t.id)), 'left/right ids correspond');

// --- lesson generation ---
const lesson = E.buildLesson(units[0].words, VOCAB, 123);
ok(lesson.length === 21, 'lesson = 20 exercises + 1 match');
ok(lesson.every(e => e && E !== null), 'no null exercises');
ok(lesson.filter(e => e.type === 'match').length === 1, 'exactly one match');
const covered = new Set(lesson.filter(e => e.word).map(e => e.word.id));
ok(units[0].words.every(w => covered.has(w.id)), 'lesson covers all unit words');

// determinism
const lesson2 = E.buildLesson(units[0].words, VOCAB, 123);
ok(JSON.stringify(lesson) === JSON.stringify(lesson2), 'lesson generation deterministic per seed');

// last (short) unit
const lessonShort = E.buildLesson(units[117].words, VOCAB, 7);
ok(lessonShort.length === 15, 'short unit lesson = 14 + 1 match');

// --- practice / mistakes ---
ok(E.buildPractice(VOCAB, {}, now, 1).length === 0, 'practice empty with no history');
const states = {};
for (let i = 0; i < 20; i++) states[i] = { hl: 0.5 + i, last: now - i * 86400000, seen: 1, correct: 1, wrong: 0 };
const prac = E.buildPractice(VOCAB, states, now, 1);
ok(prac.length > 0, 'practice builds session from history');
const pracWords = new Set(prac.filter(e => e.word).map(e => e.word.id));
ok([...pracWords].every(id => id < 20), 'practice only uses seen words');

ok(E.buildMistakes(VOCAB, [], 1).length === 0, 'mistakes empty when none');
const mist = E.buildMistakes(VOCAB, [3, 7, 11], 1);
ok(mist.length > 0, 'mistakes session builds');
ok(mist.filter(e => e.word).every(e => [3, 7, 11].includes(e.word.id)), 'mistakes session limited to mistake words');

// --- streak ---
const day1 = new Date(2026, 6, 19, 10).getTime();
let sk = E.updateStreak(null, day1);
ok(sk.count === 1, 'first day streak 1');
sk = E.updateStreak(sk, day1 + 3600000);
ok(sk.count === 1, 'same day no increment');
sk = E.updateStreak(sk, day1 + 86400000);
ok(sk.count === 2, 'next day increments');
sk = E.updateStreak(sk, day1 + 4 * 86400000);
ok(sk.count === 1, 'gap resets streak');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
