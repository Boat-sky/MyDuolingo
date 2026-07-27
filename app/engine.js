/* engine.js — pure logic: HLR-inspired SRS + session generation.
   No DOM access, so it can be tested with Node. */

const Engine = (() => {
  const UNIT_SIZE = 10;
  const MIN_HL = 1 / 24;      // 1 hour minimum half-life (days)
  const MAX_HL = 180;         // cap half-life at 180 days
  const NEW_HL = 0.25;        // half-life after first correct answer (6h)

  // ---------- word state ----------
  // state per word: { hl: halfLifeDays, last: timestampMs, seen: n, correct: n, wrong: n }

  function recallProb(st, now) {
    if (!st || !st.last) return 0;
    const days = (now - st.last) / 86400000;
    return Math.pow(2, -days / st.hl);
  }

  function applyAnswer(st, isCorrect, now) {
    st = st ? { ...st } : { hl: NEW_HL, last: 0, seen: 0, correct: 0, wrong: 0 };
    st.seen++;
    if (isCorrect) {
      st.correct++;
      // grow more when answered while nearly forgotten (harder retrieval → stronger memory)
      const p = st.last ? recallProb(st, now) : 0;
      const factor = 2 + (1 - p) * 1.5; // 2.0–3.5x
      st.hl = Math.min(MAX_HL, (st.last ? st.hl : NEW_HL) * (st.last ? factor : 1));
    } else {
      st.wrong++;
      st.hl = Math.max(MIN_HL, st.hl * 0.4);
    }
    st.last = now;
    return st;
  }

  // strength 0–4 bars for UI
  function strength(st, now) {
    if (!st || !st.last) return 0;
    const p = recallProb(st, now);
    if (p > 0.9) return 4;
    if (p > 0.7) return 3;
    if (p > 0.5) return 2;
    return 1;
  }

  // ---------- units ----------
  function units(vocab) {
    const out = [];
    for (let i = 0; i < vocab.length; i += UNIT_SIZE) {
      out.push({ index: out.length, words: vocab.slice(i, i + UNIT_SIZE) });
    }
    return out;
  }

  // ---------- session generation ----------
  // seeded RNG so tests are reproducible
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickDistractors(word, pool, n, rng, labelFn) {
    const targetLabel = labelFn(word);
    const cands = shuffle(pool.filter(w => w.id !== word.id && labelFn(w) !== targetLabel), rng);
    return cands.slice(0, n);
  }

  const TYPES = ['cn2th', 'th2cn', 'listen', 'pinyin', 'match'];

  // Build one exercise for a word. `pool` = whole vocab for distractors.
  // lang: 'cn' (Chinese↔base) or 'en' (English↔base).
  // base: 'th' or 'en' — the learner's native/UI language used as the anchor/answer text.
  function buildExercise(type, word, pool, rng, lang = 'cn', base = 'th') {
    if (type === 'match') return null; // built separately from several words
    const F = lang === 'en' ? 'en' : 'cn';
    if (type === 'cn2th') {
      const d = pickDistractors(word, pool, 3, rng, w => w[base]);
      return { type, lang, word, prompt: word[F], sub: lang === 'cn' ? word.py : '',
        choices: shuffle([word, ...d], rng).map(w => ({ id: w.id, label: w[base] })),
        answerId: word.id };
    }
    if (type === 'th2cn') {
      const d = pickDistractors(word, pool, 3, rng, w => w[F]);
      return { type, lang, word, prompt: word[base], sub: '',
        choices: shuffle([word, ...d], rng).map(w => ({ id: w.id, label: w[F], sub: lang === 'cn' ? w.py : '' })),
        answerId: word.id };
    }
    if (type === 'listen') {
      const d = pickDistractors(word, pool, 3, rng, w => w[F]);
      return { type, lang, word, prompt: '', sub: '', speak: word[F],
        choices: shuffle([word, ...d], rng).map(w => ({ id: w.id, label: w[F], sub: w[base] })),
        answerId: word.id };
    }
    if (type === 'pinyin') {
      if (lang === 'en') {
        return { type, lang, word, prompt: word[base], sub: '', answers: enAnswers(word.en) };
      }
      return { type, lang, word, prompt: word.cn, sub: word[base], answers: [normalizePinyin(word.py)] };
    }
    return null;
  }

  function buildMatch(words, rng, lang = 'cn', base = 'th') {
    const F = lang === 'en' ? 'en' : 'cn';
    const pick = shuffle(words, rng).slice(0, Math.min(5, words.length));
    return {
      type: 'match', lang, words: pick,
      left: shuffle(pick.map(w => ({ id: w.id, label: w[F] })), rng),
      right: shuffle(pick.map(w => ({ id: w.id, label: w[base] })), rng),
    };
  }

  // strip tone marks/numbers, spaces, punctuation for lenient pinyin checking
  function normalizePinyin(py) {
    const map = { 'ā':'a','á':'a','ǎ':'a','à':'a','ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i','ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u','ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v' };
    return py.toLowerCase()
      .split('').map(c => map[c] || c).join('')
      .replace(/[^a-z]/g, '');
  }

  function checkPinyin(input, answer) {
    return normalizePinyin(input) === answer;
  }

  // English typed-answer checking: lenient — any "/"-separated variant counts,
  // parentheses and punctuation ignored. e.g. "Battery Bank / Battery String"
  // accepts "battery bank" or "batterystring".
  function normalizeText(s) {
    return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  }

  function enAnswers(en) {
    const variants = en.split('/').map(normalizeText).filter(Boolean);
    const whole = normalizeText(en);
    if (whole && !variants.includes(whole)) variants.push(whole);
    return variants;
  }

  function checkTyped(input, answers, lang) {
    const n = lang === 'cn' ? normalizePinyin(input) : normalizeText(input);
    return !!n && answers.includes(n);
  }

  // A lesson session: mix exercises over the unit's words.
  // Each word appears ~2x with different types; one match exercise included.
  function buildLesson(unitWords, pool, seed, lang = 'cn', base = 'th') {
    const rng = makeRng(seed);
    const exs = [];
    const firstTypes = ['cn2th', 'listen'];
    const secondTypes = ['th2cn', 'pinyin', 'cn2th', 'listen'];
    unitWords.forEach((w, i) => {
      exs.push(buildExercise(firstTypes[i % firstTypes.length], w, pool, rng, lang, base));
    });
    unitWords.forEach((w, i) => {
      exs.push(buildExercise(secondTypes[(i + Math.floor(rng() * 4)) % secondTypes.length], w, pool, rng, lang, base));
    });
    const mixed = shuffle(exs.filter(Boolean), rng);
    // insert match roughly in the middle
    if (unitWords.length >= 3) {
      mixed.splice(Math.floor(mixed.length / 2), 0, buildMatch(unitWords, rng, lang, base));
    }
    return mixed;
  }

  // Practice session: pick weakest words by recall probability.
  function buildPractice(vocab, states, now, seed, count = 10, lang = 'cn', base = 'th') {
    const rng = makeRng(seed);
    const seen = vocab.filter(w => states[w.id] && states[w.id].last);
    if (!seen.length) return [];
    const ranked = seen
      .map(w => ({ w, p: recallProb(states[w.id], now) }))
      .sort((a, b) => a.p - b.p)
      .slice(0, count)
      .map(x => x.w);
    return buildLesson(ranked, vocab, seed ^ 0x9e3779b9, lang, base).filter(Boolean);
  }

  // Mistakes session: words answered wrong most recently/often.
  function buildMistakes(vocab, mistakes, seed, count = 10, lang = 'cn', base = 'th') {
    const words = vocab.filter(w => mistakes.includes(w.id)).slice(0, count);
    if (!words.length) return [];
    return buildLesson(words, vocab, seed, lang, base).filter(Boolean);
  }

  // ---------- streak ----------
  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function updateStreak(streak, now) {
    // streak: { count, lastDay }
    const today = dayKey(now);
    if (!streak || !streak.lastDay) return { count: 1, lastDay: today };
    if (streak.lastDay === today) return streak;
    const yesterday = dayKey(now - 86400000);
    if (streak.lastDay === yesterday) return { count: streak.count + 1, lastDay: today };
    return { count: 1, lastDay: today };
  }

  return { UNIT_SIZE, recallProb, applyAnswer, strength, units, buildLesson, buildPractice,
    buildMistakes, buildMatch, buildExercise, normalizePinyin, checkPinyin, updateStreak,
    normalizeText, enAnswers, checkTyped, dayKey, makeRng, shuffle };
})();

if (typeof module !== 'undefined') module.exports = Engine;
