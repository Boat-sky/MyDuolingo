/* app.js — UI layer. Uses VOCAB (data.js) and Engine (engine.js). */

// ---------- i18n ----------
const STRINGS = {
  pageTitle: { th: 'ฝึกศัพท์จีน Data Center', en: 'Chinese Vocab Trainer' },
  streakTitle: { th: 'สตรีค (วันติดต่อกัน)', en: 'Streak (days in a row)' },
  xpTitle: { th: 'XP รวม', en: 'Total XP' },
  heartsTitle: { th: 'หัวใจ', en: 'Hearts' },
  signIn: { th: 'เข้าสู่ระบบด้วย Google', en: 'Sign in with Google' },
  signOut: { th: 'ออกจากระบบ', en: 'Sign out' },
  langCn: { th: 'ภาษาจีน', en: 'Chinese' },
  langEn: { th: 'ภาษาอังกฤษ', en: 'English' },
  btnPractice: { th: '💪 ฝึกทบทวน (คำที่ใกล้ลืม)', en: '💪 Practice (words fading fast)' },
  btnMistakes: { th: '📕 ทบทวนคำที่ตอบผิด', en: '📕 Review mistakes' },
  btnVocab: { th: '📚 คลังคำศัพท์', en: '📚 Vocabulary' },
  quit: { th: 'ออก', en: 'Quit' },
  continue: { th: 'ต่อไป', en: 'Continue' },
  vocabTitle: { th: 'คลังคำศัพท์', en: 'Vocabulary' },
  vocabSearch: { th: '🔍 ค้นหา: จีน / พินอิน / อังกฤษ / ไทย', en: '🔍 Search: Chinese / pinyin / English' },
  filterLearned: { th: 'เรียนแล้ว', en: 'Learned' },
  filterWeak: { th: 'ใกล้ลืม', en: 'Fading' },
  filterMistakes: { th: 'ตอบผิดค้าง', en: 'Mistakes' },
  filterAll: { th: 'ทั้งหมด', en: 'All' },
  resultsDone: { th: 'จบบทเรียน!', en: 'Lesson complete!' },
  resultsFailed: { th: 'หัวใจหมดแล้ว ลองใหม่นะ', en: 'Out of hearts — try again!' },
  resultsXp: { th: 'XP ที่ได้', en: 'XP earned' },
  resultsAcc: { th: 'ความแม่นยำ', en: 'Accuracy' },
  backHome: { th: 'กลับหน้าหลัก', en: 'Back to home' },
  unitTitle: { th: 'ยูนิต ', en: 'Unit ' },
  strMetaTitle: { th: 'ตอบถูก/เห็นทั้งหมด — ฝึกล่าสุด', en: 'Correct/seen — last practiced' },
  strMetaNew: { th: 'ยังไม่เรียน', en: 'Not learned yet' },
  vocabSummary: { th: 'เรียนแล้ว {n} จาก {total} คำ — แสดง {shown} คำ', en: 'Learned {n} of {total} words — showing {shown}' },
  speakCn: { th: 'ฟังเสียงจีน', en: 'Listen to Chinese' },
  speakEn: { th: 'ฟังเสียงอังกฤษ', en: 'Listen to English' },
  noPracticeWords: { th: 'ยังไม่มีคำที่เคยเรียนในโหมดนี้ — เริ่มยูนิตแรกก่อนนะ!', en: "You haven't learned any words in this mode yet — start the first unit!" },
  noMistakes: { th: 'ไม่มีคำที่ตอบผิดค้างอยู่ เยี่ยมมาก! 🎉', en: 'No pending mistakes — great job! 🎉' },
  insCn2th: { th: 'คำนี้แปลว่าอะไร?', en: 'What does this word mean?' },
  insTh2cnEn: { th: 'เลือกคำภาษาอังกฤษที่ตรงกัน', en: 'Choose the matching Chinese word' },
  insTh2cnCn: { th: 'เลือกคำภาษาจีนที่ตรงกัน', en: 'Choose the matching Chinese word' },
  insListen: { th: 'ฟังแล้วเลือกคำที่ได้ยิน 🔊', en: 'Listen and choose what you heard 🔊' },
  insPinyinEn: { th: 'พิมพ์คำศัพท์ภาษาอังกฤษ', en: 'Type the pinyin' },
  insPinyinCn: { th: 'พิมพ์พินอิน (ไม่ต้องใส่วรรณยุกต์)', en: 'Type the pinyin (no tone marks needed)' },
  insMatch: { th: 'จับคู่คำ', en: 'Match the words' },
  tapToListen: { th: 'กดเพื่อฟังเสียง', en: 'Tap to listen' },
  checkAnswer: { th: 'ตรวจคำตอบ', en: 'Check' },
  pinyinPlaceholderEn: { th: 'เช่น battery', en: 'e.g. dianchi' },
  pinyinPlaceholderCn: { th: 'เช่น dianchi', en: 'e.g. dianchi' },
  matchAllCorrect: { th: 'จับคู่ถูกทั้งหมด! 🎉', en: 'All matched correctly! 🎉' },
  matchWrong: { th: 'ผิด {n} คู่ — ที่ถูกคือ: {fix}', en: 'Wrong {n} — correct: {fix}' },
  correct: { th: 'ถูกต้อง! 🎉', en: 'Correct! 🎉' },
  answerIs: { th: 'คำตอบคือ: {text}', en: 'Answer: {text}' },
  quitConfirm: { th: 'ออกจากบทเรียน? ความคืบหน้าของบทนี้จะหายไป', en: 'Quit the lesson? Progress for this lesson will be lost' },
  syncing: { th: 'กำลังซิงค์…', en: 'Syncing…' },
  synced: { th: 'ซิงค์แล้ว ✓', en: 'Synced ✓' },
  offline: { th: 'ออฟไลน์', en: 'Offline' },
};
const t = (key, vars) => {
  let s = STRINGS[key][S.uiLang];
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
};

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $('lang-toggle-wrap').classList.toggle('hidden', S.uiLang === 'en');
}

// ---------- persistent state ----------
const SAVE_KEY = 'myduolingo-v1';

function emptyLang() { return { words: {}, crowns: {}, mistakes: [], unlocked: 1 }; }

function normalizeState(s) {
  if (!s) s = { xp: 0, streak: { count: 0, lastDay: null } };
  // migrate v1 flat (Chinese-only) save → per-language structure
  if (!s.langs) {
    s.langs = {
      cn: { words: s.words || {}, crowns: s.crowns || {}, mistakes: s.mistakes || [], unlocked: s.unlocked || 1 },
      en: emptyLang(),
    };
    delete s.words; delete s.crowns; delete s.mistakes; delete s.unlocked;
  }
  if (!s.langs.en) s.langs.en = emptyLang();
  if (!s.langs.cn2en) s.langs.cn2en = emptyLang();
  if (!s.mode) s.mode = 'cn';
  if (!s.uiLang) s.uiLang = 'th';
  if (!s.lastMode) s.lastMode = s.mode === 'cn2en' ? 'cn' : s.mode;
  return s;
}
function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) { /* corrupted save — start fresh */ }
  return normalizeState(s);
}
function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  if (typeof Sync !== 'undefined') Sync.schedulePush(S);
}

let S = loadState();
if (typeof Sync !== 'undefined') {
  Sync.init(() => S, merged => {
    S = normalizeState(merged);
    saveState();
    document.documentElement.lang = S.uiLang;
    applyStaticI18n();
    $('ui-lang-th').classList.toggle('active', S.uiLang === 'th');
    $('ui-lang-en').classList.toggle('active', S.uiLang === 'en');
    renderHome();
  });
}
const L = () => S.langs[S.mode];
const base = () => S.mode === 'cn2en' ? 'en' : 'th';
const UNITS = Engine.units(VOCAB);

// ---------- session state ----------
let session = null; // { exercises, index, hearts, correct, total, mode, unitIndex, lang }

// ---------- dom helpers ----------
const $ = id => document.getElementById(id);
function show(screen) {
  ['screen-home', 'screen-lesson', 'screen-results', 'screen-vocab'].forEach(s => $(s).classList.add('hidden'));
  $(screen).classList.remove('hidden');
}

// ---------- TTS ----------
const voices = { cn: null, en: null };
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voices.cn = vs.find(v => /^zh([-_]CN)?/i.test(v.lang)) || vs.find(v => /zh/i.test(v.lang)) || null;
  voices.en = vs.find(v => /^en([-_]US)?/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  return vs.length > 0;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
// resolves once getVoices() has actually populated (or after a timeout, for browsers that never fire onvoiceschanged)
function voicesReady() {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  if (pickVoice()) return Promise.resolve();
  return new Promise(resolve => {
    const onChange = () => { pickVoice(); cleanup(); resolve(); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, 2000);
    function cleanup() {
      speechSynthesis.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
    }
    speechSynthesis.addEventListener('voiceschanged', onChange);
  });
}
function speak(text, lang, retry = true) {
  if (!('speechSynthesis' in window)) return;
  voicesReady().then(() => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    if (voices[lang]) u.voice = voices[lang];
    u.rate = 0.9;
    if (retry) u.onerror = () => speak(text, lang, false);
    speechSynthesis.speak(u);
  });
}
// the word in the target language of an exercise
const targetText = ex => ex.lang === 'en' ? ex.word.en : ex.word.cn;

// ---------- top bar ----------
function renderTopbar() {
  $('stat-streak').textContent = S.streak.count || 0;
  $('stat-xp').textContent = S.xp;
  $('stat-hearts').textContent = session ? session.hearts : 5;
  const signedIn = typeof Sync !== 'undefined' && Sync.currentUser();
  $('btn-signin').classList.toggle('hidden', !!signedIn);
  $('btn-signout').classList.toggle('hidden', !signedIn);
}

// ---------- home ----------
function renderHome() {
  renderTopbar();
  $('lang-cn').classList.toggle('active', S.mode === 'cn');
  $('lang-en').classList.toggle('active', S.mode === 'en');
  $('mistake-count').textContent = L().mistakes.length;
  $('learned-count').textContent = VOCAB.filter(w => isLearned(w.id)).length;
  const path = $('unit-path');
  path.innerHTML = '';
  UNITS.forEach(u => {
    const crowns = L().crowns[u.index] || 0;
    const locked = u.index >= L().unlocked;
    const card = document.createElement('div');
    card.className = 'unit-card' + (locked ? ' locked' : crowns > 0 ? ' done' : ' current');
    const preview = u.words.slice(0, 3).map(w => S.mode === 'en' ? w.en : w.cn).join(' · ');
    card.innerHTML =
      '<div class="unit-badge">' + (locked ? '🔒' : crowns > 0 ? '👑' : (u.index + 1)) + '</div>' +
      '<div class="unit-info">' +
        '<div class="unit-title">' + t('unitTitle') + (u.index + 1) + '</div>' +
        '<div class="unit-words">' + preview + ' …</div>' +
      '</div>' +
      (crowns > 0 ? '<div class="unit-crowns">👑 ' + crowns + '</div>' : '');
    if (!locked) card.onclick = () => startLesson('unit', u.index);
    path.appendChild(card);
  });
  show('screen-home');
}

function setMode(mode) {
  if (S.uiLang === 'en') return; // mode is locked to cn2en while UI language is English
  if (S.mode === mode) return;
  S.mode = mode;
  S.lastMode = mode;
  saveState();
  renderHome();
}

function setUiLang(uiLang) {
  if (S.uiLang === uiLang) return;
  S.uiLang = uiLang;
  S.mode = uiLang === 'en' ? 'cn2en' : S.lastMode;
  document.documentElement.lang = uiLang;
  saveState();
  applyStaticI18n();
  $('ui-lang-th').classList.toggle('active', uiLang === 'th');
  $('ui-lang-en').classList.toggle('active', uiLang === 'en');
  renderHome();
}

// ---------- vocab library ----------
let vocabFilter = 'learned';

const vocabLangs = () => S.mode === 'cn2en' ? ['cn2en'] : ['cn', 'en'];
const stateOf = (lang, id) => S.langs[lang].words[id];
const isLearned = id => vocabLangs().some(lang => { const st = stateOf(lang, id); return st && st.last; });

function formatDate(ts) {
  const d = new Date(ts);
  if (S.uiLang === 'en') return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543);
}

function strengthBars(lang, id) {
  const st = stateOf(lang, id);
  const n = st && st.last ? Engine.strength(st, Date.now()) : 0;
  let bars = '';
  for (let i = 1; i <= 4; i++) bars += '<span class="str-bar' + (i <= n ? ' on' : '') + '"></span>';
  const flag = lang === 'en'
    ? '<span class="lang-badge badge-en">EN</span>'
    : '<span class="lang-badge badge-cn">中</span>';
  const meta = st && st.last
    ? '<span class="str-meta" title="' + t('strMetaTitle') + '">' + st.correct + '/' + st.seen + ' · ' + formatDate(st.last) + '</span>'
    : '<span class="str-meta">' + t('strMetaNew') + '</span>';
  return '<div class="str-row">' + flag + ' <span class="str-bars">' + bars + '</span> ' + meta + '</div>';
}

function vocabMatches(w, q) {
  if (!q) return true;
  const hay = (w.cn + ' ' + w.py + ' ' + w.en + ' ' + w.th).toLowerCase();
  if (hay.includes(q)) return true;
  // also match toneless pinyin typing, e.g. "dianchi"
  return Engine.normalizePinyin(w.py).includes(Engine.normalizeText(q));
}

function passesFilter(w) {
  if (vocabFilter === 'all') return true;
  if (vocabFilter === 'learned') return isLearned(w.id);
  if (vocabFilter === 'mistakes') return vocabLangs().some(lang => S.langs[lang].mistakes.includes(w.id));
  // weak: learned in some track whose strength has dropped to 1–2 bars
  return vocabLangs().some(lang => {
    const st = stateOf(lang, w.id);
    return st && st.last && Engine.strength(st, Date.now()) <= 2;
  });
}

function renderVocabList() {
  const q = $('vocab-search').value.trim().toLowerCase();
  const rows = VOCAB.filter(w => passesFilter(w) && vocabMatches(w, q));
  const learned = VOCAB.filter(w => isLearned(w.id)).length;
  $('vocab-summary').textContent = t('vocabSummary', { n: learned, total: VOCAB.length, shown: rows.length });
  const list = $('vocab-list');
  list.innerHTML = '';
  const cn2en = S.mode === 'cn2en';
  rows.forEach(w => {
    const div = document.createElement('div');
    div.className = 'vocab-row' + (isLearned(w.id) ? '' : ' unseen');
    div.innerHTML =
      '<div class="vocab-main">' +
        '<div class="vocab-line1">' +
          '<span class="vocab-cn">' + w.cn + '</span>' +
          '<button class="vocab-speak" data-lang="cn" title="' + t('speakCn') + '">🔊</button>' +
          '<span class="vocab-py">' + w.py + '</span>' +
        '</div>' +
        '<div class="vocab-line1">' +
          '<span class="vocab-en">' + w.en + '</span>' +
          '<button class="vocab-speak" data-lang="en" title="' + t('speakEn') + '">🔊</button>' +
        '</div>' +
        (cn2en ? '' : '<div class="vocab-th">' + w.th + '</div>') +
      '</div>' +
      '<div class="vocab-str">' + (cn2en ? strengthBars('cn2en', w.id) : strengthBars('cn', w.id) + strengthBars('en', w.id)) + '</div>';
    div.querySelectorAll('.vocab-speak').forEach(b => {
      b.onclick = () => speak(b.dataset.lang === 'cn' ? w.cn : w.en, b.dataset.lang);
    });
    list.appendChild(div);
  });
}

function openVocab() {
  show('screen-vocab');
  renderVocabList();
}

// ---------- lesson flow ----------
function startLesson(mode, unitIndex) {
  const lang = S.mode === 'cn2en' ? 'cn' : S.mode;
  const b = base();
  const seed = (Date.now() & 0x7fffffff) ^ (unitIndex || 0);
  let exercises;
  if (mode === 'unit') {
    exercises = Engine.buildLesson(UNITS[unitIndex].words, VOCAB, seed, lang, b);
  } else if (mode === 'practice') {
    exercises = Engine.buildPractice(VOCAB, L().words, Date.now(), seed, 10, lang, b);
    if (!exercises.length) { alert(t('noPracticeWords')); return; }
  } else { // mistakes
    exercises = Engine.buildMistakes(VOCAB, L().mistakes, seed, 10, lang, b);
    if (!exercises.length) { alert(t('noMistakes')); return; }
  }
  session = { exercises, index: 0, hearts: 5, correct: 0, total: 0, mode, unitIndex, lang, progressLang: S.mode };
  show('screen-lesson');
  renderExercise();
}

function renderExercise() {
  renderTopbar();
  $('lesson-hearts').textContent = session.hearts;
  $('lesson-progress').style.width = (session.index / session.exercises.length * 100) + '%';
  $('feedback').classList.add('hidden');
  $('feedback').classList.remove('good', 'bad');

  const ex = session.exercises[session.index];
  const area = $('exercise-area');
  area.innerHTML = '';

  if (ex.type === 'match') return renderMatch(ex, area);
  if (ex.type === 'pinyin') return renderPinyin(ex, area);
  renderChoice(ex, area);
}

function instruction(ex) {
  const en = ex.lang === 'en';
  return {
    cn2th: t('insCn2th'),
    th2cn: en ? t('insTh2cnEn') : t('insTh2cnCn'),
    listen: t('insListen'),
    pinyin: en ? t('insPinyinEn') : t('insPinyinCn'),
    match: t('insMatch'),
  }[ex.type];
}

function renderChoice(ex, area) {
  const h = document.createElement('div');
  h.className = 'ex-instruction';
  h.textContent = instruction(ex);
  area.appendChild(h);

  if (ex.type === 'listen') {
    const sp = document.createElement('button');
    sp.className = 'speak-btn';
    sp.textContent = '🔊';
    sp.onclick = () => speak(ex.speak, ex.lang);
    area.appendChild(sp);
    speak(ex.speak, ex.lang);
  } else {
    const p = document.createElement('div');
    p.className = 'ex-prompt';
    p.textContent = ex.prompt;
    if (ex.type === 'cn2th') { p.style.cursor = 'pointer'; p.title = t('tapToListen'); p.onclick = () => speak(targetText(ex), ex.lang); }
    area.appendChild(p);
    const s = document.createElement('div');
    s.className = 'ex-sub';
    s.textContent = ex.sub || '';
    area.appendChild(s);
  }

  const box = document.createElement('div');
  box.className = 'choices';
  let selected = null; // choice id
  const buttons = [];
  ex.choices.forEach(c => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = '<div>' + c.label + '</div>' + (c.sub ? '<div class="choice-sub">' + c.sub + '</div>' : '');
    b.onclick = () => {
      if (checkBtn.dataset.done) return;
      selected = c.id;
      buttons.forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      checkBtn.disabled = false;
    };
    buttons.push(b);
    box.appendChild(b);
  });
  area.appendChild(box);

  const checkArea = document.createElement('div');
  checkArea.id = 'check-area';
  const checkBtn = document.createElement('button');
  checkBtn.className = 'btn btn-green';
  checkBtn.textContent = t('checkAnswer');
  checkBtn.disabled = true;
  checkBtn.onclick = () => {
    if (selected === null || checkBtn.dataset.done) return;
    checkBtn.dataset.done = '1';
    checkBtn.disabled = true;
    const ok = selected === ex.answerId;
    buttons.forEach((x, i) => {
      x.disabled = true;
      x.classList.remove('selected');
      if (ex.choices[i].id === ex.answerId) x.classList.add('correct');
      else if (ex.choices[i].id === selected) x.classList.add('wrong');
    });
    finishExercise(ex, ok, answerText(ex));
  };
  checkArea.appendChild(checkBtn);
  area.appendChild(checkArea);
}

function answerText(ex) {
  const b = base();
  if (ex.lang === 'en') return ex.word.en + ' = ' + ex.word[b];
  return ex.word.cn + ' (' + ex.word.py + ') = ' + ex.word[b];
}

function renderPinyin(ex, area) {
  area.innerHTML =
    '<div class="ex-instruction">' + instruction(ex) + '</div>' +
    '<div class="ex-prompt">' + ex.prompt + '</div>' +
    '<div class="ex-sub">' + (ex.sub || '') + '</div>';
  const input = document.createElement('input');
  input.className = 'type-input';
  input.placeholder = ex.lang === 'en' ? t('pinyinPlaceholderEn') : t('pinyinPlaceholderCn');
  input.autocomplete = 'off';
  area.appendChild(input);
  const checkArea = document.createElement('div');
  checkArea.id = 'check-area';
  const btn = document.createElement('button');
  btn.className = 'btn btn-green';
  btn.textContent = t('checkAnswer');
  btn.onclick = check;
  checkArea.appendChild(btn);
  area.appendChild(checkArea);
  input.focus();
  input.onkeydown = e => { if (e.key === 'Enter') check(); };
  function check() {
    if (btn.disabled) return;
    btn.disabled = true;
    input.disabled = true;
    const ok = Engine.checkTyped(input.value, ex.answers, ex.lang);
    const b = base();
    finishExercise(ex, ok, ex.lang === 'en'
      ? ex.word[b] + ' = ' + ex.word.en
      : ex.word.cn + ' = ' + ex.word.py + ' (' + ex.word[b] + ')');
  }
}

function renderMatch(ex, area) {
  area.innerHTML = '<div class="ex-instruction">' + instruction(ex) + '</div>';
  const grid = document.createElement('div');
  grid.className = 'match-grid';
  const colL = document.createElement('div'); colL.className = 'match-col';
  const colR = document.createElement('div'); colR.className = 'match-col';
  grid.appendChild(colL); grid.appendChild(colR);
  area.appendChild(grid);

  let selected = null;      // tile object
  const pairs = [];         // { l: tile, r: tile } — tentative, editable until confirmed
  let done = false;

  function renumber() {
    pairs.forEach((p, i) => { p.l.el.dataset.pair = i + 1; p.r.el.dataset.pair = i + 1; });
  }
  const pairOf = t => pairs.find(p => p.l === t || p.r === t);

  function tile(item, side, col) {
    const t = { el: document.createElement('button'), id: item.id, side };
    t.el.className = 'match-tile';
    t.el.textContent = item.label;
    t.el.onclick = () => {
      if (done) return;
      const pr = pairOf(t);
      if (pr) { // clicking a paired tile un-pairs it so it can be redone
        pairs.splice(pairs.indexOf(pr), 1);
        [pr.l, pr.r].forEach(x => { x.el.classList.remove('paired'); delete x.el.dataset.pair; });
        renumber();
        checkBtn.disabled = true;
        return;
      }
      if (side === 'L') speak(item.label, ex.lang);
      if (selected === t) { t.el.classList.remove('selected'); selected = null; return; }
      if (!selected || selected.side === side) {
        if (selected) selected.el.classList.remove('selected');
        t.el.classList.add('selected');
        selected = t;
        return;
      }
      // opposite sides — form a tentative pair (not judged yet)
      const other = selected;
      selected = null;
      other.el.classList.remove('selected');
      pairs.push(side === 'R' ? { l: other, r: t } : { l: t, r: other });
      t.el.classList.add('paired'); other.el.classList.add('paired');
      renumber();
      checkBtn.disabled = pairs.length !== ex.words.length;
    };
    col.appendChild(t.el);
  }
  ex.left.forEach(i => tile(i, 'L', colL));
  ex.right.forEach(i => tile(i, 'R', colR));

  const checkArea = document.createElement('div');
  checkArea.id = 'check-area';
  const checkBtn = document.createElement('button');
  checkBtn.className = 'btn btn-green';
  checkBtn.textContent = t('checkAnswer');
  checkBtn.disabled = true;
  checkBtn.onclick = () => {
    if (done || pairs.length !== ex.words.length) return;
    done = true;
    checkBtn.disabled = true;
    const wrongWords = [];
    pairs.forEach(p => {
      const good = p.l.id === p.r.id;
      [p.l, p.r].forEach(x => {
        x.el.classList.remove('paired');
        x.el.classList.add(good ? 'matched' : 'wrong');
      });
      if (!good) wrongWords.push(p.l.id);
    });
    ex.words.forEach(w => {
      L().words[w.id] = Engine.applyAnswer(L().words[w.id], !wrongWords.includes(w.id), Date.now());
    });
    const ok = wrongWords.length === 0;
    session.total++;
    if (ok) session.correct++; else loseHeart();
    saveState();
    if (ok) showFeedback(true, t('matchAllCorrect'));
    else {
      const b = base();
      const fix = ex.words.filter(w => wrongWords.includes(w.id))
        .map(w => (ex.lang === 'en' ? w.en : w.cn) + ' = ' + w[b]).join(' , ');
      showFeedback(false, t('matchWrong', { n: wrongWords.length, fix }));
    }
  };
  checkArea.appendChild(checkBtn);
  area.appendChild(checkArea);
}

function loseHeart() {
  session.hearts--;
  $('lesson-hearts').textContent = session.hearts;
  renderTopbar();
}

function finishExercise(ex, ok, text) {
  session.total++;
  if (ok) session.correct++; else loseHeart();
  L().words[ex.word.id] = Engine.applyAnswer(L().words[ex.word.id], ok, Date.now());
  if (!ok) {
    if (!L().mistakes.includes(ex.word.id)) L().mistakes.unshift(ex.word.id);
  } else if (session.mode === 'mistakes') {
    L().mistakes = L().mistakes.filter(id => id !== ex.word.id);
  }
  saveState();
  if (ok && ex.type !== 'listen') speak(targetText(ex), ex.lang);
  showFeedback(ok, ok ? t('correct') : t('answerIs', { text }));
}

function showFeedback(ok, text) {
  const fb = $('feedback');
  fb.classList.remove('hidden');
  fb.classList.add(ok ? 'good' : 'bad');
  $('feedback-text').textContent = text;
  $('btn-continue').focus();
}

function nextExercise() {
  if (session.hearts <= 0) return endLesson(false);
  session.index++;
  if (session.index >= session.exercises.length) return endLesson(true);
  renderExercise();
}

function endLesson(completed) {
  const acc = session.total ? Math.round(session.correct / session.total * 100) : 0;
  let xp = 0;
  if (completed) {
    xp = 10 + Math.round(acc / 10); // 10–20 XP
    S.xp += xp;
    S.streak = Engine.updateStreak(S.streak, Date.now());
    if (session.mode === 'unit') {
      const bucket = S.langs[session.progressLang];
      bucket.crowns[session.unitIndex] = (bucket.crowns[session.unitIndex] || 0) + 1;
      if (session.unitIndex + 1 >= bucket.unlocked) bucket.unlocked = Math.min(UNITS.length, session.unitIndex + 2);
    }
  }
  saveState();
  session = null;
  $('results-emoji').textContent = completed ? (acc >= 90 ? '🏆' : '🎉') : '💔';
  $('results-title').textContent = completed ? t('resultsDone') : t('resultsFailed');
  $('results-xp').textContent = '+' + xp;
  $('results-acc').textContent = acc + '%';
  renderTopbar();
  show('screen-results');
}

// ---------- wiring ----------
$('lang-cn').onclick = () => setMode('cn');
$('lang-en').onclick = () => setMode('en');
$('ui-lang-th').onclick = () => setUiLang('th');
$('ui-lang-en').onclick = () => setUiLang('en');
$('btn-vocab').onclick = openVocab;
$('btn-vocab-back').onclick = renderHome;
$('vocab-search').oninput = renderVocabList;
document.querySelectorAll('.vfilter').forEach(b => {
  b.onclick = () => {
    vocabFilter = b.dataset.f;
    document.querySelectorAll('.vfilter').forEach(x => x.classList.toggle('active', x === b));
    renderVocabList();
  };
});
$('btn-practice').onclick = () => startLesson('practice');
$('btn-mistakes').onclick = () => startLesson('mistakes');
$('btn-continue').onclick = nextExercise;
$('btn-home').onclick = renderHome;
$('btn-quit').onclick = () => {
  if (confirm(t('quitConfirm'))) { session = null; renderHome(); }
};
if (typeof Sync !== 'undefined') {
  $('btn-signin').onclick = () => Sync.signIn();
  $('btn-signout').onclick = () => Sync.signOut();
  Sync.onStatus(status => {
    $('sync-status').textContent = t(status);
    $('sync-status').className = 'sync-status ' + status;
    renderTopbar();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Sync.flushNow(S);
  });
}

document.documentElement.lang = S.uiLang;
applyStaticI18n();
$('ui-lang-th').classList.toggle('active', S.uiLang === 'th');
$('ui-lang-en').classList.toggle('active', S.uiLang === 'en');
renderHome();
