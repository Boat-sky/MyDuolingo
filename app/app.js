/* app.js — UI layer. Uses VOCAB (data.js) and Engine (engine.js). */

// ---------- persistent state ----------
const SAVE_KEY = 'myduolingo-v1';

function emptyLang() { return { words: {}, crowns: {}, mistakes: [], unlocked: 1 }; }

function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) { /* corrupted save — start fresh */ }
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
  if (!s.mode) s.mode = 'cn';
  return s;
}
function saveState() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }

let S = loadState();
const L = () => S.langs[S.mode];
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
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
  if (voices[lang]) u.voice = voices[lang];
  u.rate = 0.9;
  speechSynthesis.speak(u);
}
// the word in the target language of an exercise
const targetText = ex => ex.lang === 'en' ? ex.word.en : ex.word.cn;

// ---------- top bar ----------
function renderTopbar() {
  $('stat-streak').textContent = S.streak.count || 0;
  $('stat-xp').textContent = S.xp;
  $('stat-hearts').textContent = session ? session.hearts : 5;
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
        '<div class="unit-title">ยูนิต ' + (u.index + 1) + '</div>' +
        '<div class="unit-words">' + preview + ' …</div>' +
      '</div>' +
      (crowns > 0 ? '<div class="unit-crowns">👑 ' + crowns + '</div>' : '');
    if (!locked) card.onclick = () => startLesson('unit', u.index);
    path.appendChild(card);
  });
  show('screen-home');
}

function setMode(mode) {
  if (S.mode === mode) return;
  S.mode = mode;
  saveState();
  renderHome();
}

// ---------- vocab library ----------
let vocabFilter = 'learned';

const stateOf = (lang, id) => S.langs[lang].words[id];
const isLearned = id => {
  const c = stateOf('cn', id), e = stateOf('en', id);
  return (c && c.last) || (e && e.last);
};

function thaiDate(ts) {
  const d = new Date(ts);
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543);
}

function strengthBars(lang, id) {
  const st = stateOf(lang, id);
  const n = st && st.last ? Engine.strength(st, Date.now()) : 0;
  let bars = '';
  for (let i = 1; i <= 4; i++) bars += '<span class="str-bar' + (i <= n ? ' on' : '') + '"></span>';
  const flag = lang === 'cn'
    ? '<span class="lang-badge badge-cn">中</span>'
    : '<span class="lang-badge badge-en">EN</span>';
  const meta = st && st.last
    ? '<span class="str-meta" title="ตอบถูก/เห็นทั้งหมด — ฝึกล่าสุด">' + st.correct + '/' + st.seen + ' · ' + thaiDate(st.last) + '</span>'
    : '<span class="str-meta">ยังไม่เรียน</span>';
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
  if (vocabFilter === 'mistakes') return S.langs.cn.mistakes.includes(w.id) || S.langs.en.mistakes.includes(w.id);
  // weak: learned in some language whose strength has dropped to 1–2 bars
  return ['cn', 'en'].some(lang => {
    const st = stateOf(lang, w.id);
    return st && st.last && Engine.strength(st, Date.now()) <= 2;
  });
}

function renderVocabList() {
  const q = $('vocab-search').value.trim().toLowerCase();
  const rows = VOCAB.filter(w => passesFilter(w) && vocabMatches(w, q));
  const learned = VOCAB.filter(w => isLearned(w.id)).length;
  $('vocab-summary').textContent =
    'เรียนแล้ว ' + learned + ' จาก ' + VOCAB.length + ' คำ — แสดง ' + rows.length + ' คำ';
  const list = $('vocab-list');
  list.innerHTML = '';
  rows.forEach(w => {
    const div = document.createElement('div');
    div.className = 'vocab-row' + (isLearned(w.id) ? '' : ' unseen');
    div.innerHTML =
      '<div class="vocab-main">' +
        '<div class="vocab-line1">' +
          '<span class="vocab-cn">' + w.cn + '</span>' +
          '<button class="vocab-speak" data-lang="cn" title="ฟังเสียงจีน">🔊</button>' +
          '<span class="vocab-py">' + w.py + '</span>' +
        '</div>' +
        '<div class="vocab-line1">' +
          '<span class="vocab-en">' + w.en + '</span>' +
          '<button class="vocab-speak" data-lang="en" title="ฟังเสียงอังกฤษ">🔊</button>' +
        '</div>' +
        '<div class="vocab-th">' + w.th + '</div>' +
      '</div>' +
      '<div class="vocab-str">' + strengthBars('cn', w.id) + strengthBars('en', w.id) + '</div>';
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
  const lang = S.mode;
  const seed = (Date.now() & 0x7fffffff) ^ (unitIndex || 0);
  let exercises;
  if (mode === 'unit') {
    exercises = Engine.buildLesson(UNITS[unitIndex].words, VOCAB, seed, lang);
  } else if (mode === 'practice') {
    exercises = Engine.buildPractice(VOCAB, L().words, Date.now(), seed, 10, lang);
    if (!exercises.length) { alert('ยังไม่มีคำที่เคยเรียนในโหมดนี้ — เริ่มยูนิตแรกก่อนนะ!'); return; }
  } else { // mistakes
    exercises = Engine.buildMistakes(VOCAB, L().mistakes, seed, 10, lang);
    if (!exercises.length) { alert('ไม่มีคำที่ตอบผิดค้างอยู่ เยี่ยมมาก! 🎉'); return; }
  }
  session = { exercises, index: 0, hearts: 5, correct: 0, total: 0, mode, unitIndex, lang };
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
    cn2th: 'คำนี้แปลว่าอะไร?',
    th2cn: en ? 'เลือกคำภาษาอังกฤษที่ตรงกัน' : 'เลือกคำภาษาจีนที่ตรงกัน',
    listen: 'ฟังแล้วเลือกคำที่ได้ยิน 🔊',
    pinyin: en ? 'พิมพ์คำศัพท์ภาษาอังกฤษ' : 'พิมพ์พินอิน (ไม่ต้องใส่วรรณยุกต์)',
    match: 'จับคู่คำ',
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
    setTimeout(() => speak(ex.speak, ex.lang), 300);
  } else {
    const p = document.createElement('div');
    p.className = 'ex-prompt';
    p.textContent = ex.prompt;
    if (ex.type === 'cn2th') { p.style.cursor = 'pointer'; p.title = 'กดเพื่อฟังเสียง'; p.onclick = () => speak(targetText(ex), ex.lang); }
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
  checkBtn.textContent = 'ตรวจคำตอบ';
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
  if (ex.lang === 'en') return ex.word.en + ' = ' + ex.word.th;
  return ex.word.cn + ' (' + ex.word.py + ') = ' + ex.word.th;
}

function renderPinyin(ex, area) {
  area.innerHTML =
    '<div class="ex-instruction">' + instruction(ex) + '</div>' +
    '<div class="ex-prompt">' + ex.prompt + '</div>' +
    '<div class="ex-sub">' + (ex.sub || '') + '</div>';
  const input = document.createElement('input');
  input.className = 'type-input';
  input.placeholder = ex.lang === 'en' ? 'เช่น battery' : 'เช่น dianchi';
  input.autocomplete = 'off';
  area.appendChild(input);
  const checkArea = document.createElement('div');
  checkArea.id = 'check-area';
  const btn = document.createElement('button');
  btn.className = 'btn btn-green';
  btn.textContent = 'ตรวจคำตอบ';
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
    finishExercise(ex, ok, ex.lang === 'en'
      ? ex.word.th + ' = ' + ex.word.en
      : ex.word.cn + ' = ' + ex.word.py + ' (' + ex.word.th + ')');
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
  checkBtn.textContent = 'ตรวจคำตอบ';
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
    if (ok) showFeedback(true, 'จับคู่ถูกทั้งหมด! 🎉');
    else {
      const fix = ex.words.filter(w => wrongWords.includes(w.id))
        .map(w => (ex.lang === 'en' ? w.en : w.cn) + ' = ' + w.th).join(' , ');
      showFeedback(false, 'ผิด ' + wrongWords.length + ' คู่ — ที่ถูกคือ: ' + fix);
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
  showFeedback(ok, ok ? 'ถูกต้อง! 🎉' : 'คำตอบคือ: ' + text);
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
      const lang = S.langs[session.lang];
      lang.crowns[session.unitIndex] = (lang.crowns[session.unitIndex] || 0) + 1;
      if (session.unitIndex + 1 >= lang.unlocked) lang.unlocked = Math.min(UNITS.length, session.unitIndex + 2);
    }
  }
  saveState();
  session = null;
  $('results-emoji').textContent = completed ? (acc >= 90 ? '🏆' : '🎉') : '💔';
  $('results-title').textContent = completed ? 'จบบทเรียน!' : 'หัวใจหมดแล้ว ลองใหม่นะ';
  $('results-xp').textContent = '+' + xp;
  $('results-acc').textContent = acc + '%';
  renderTopbar();
  show('screen-results');
}

// ---------- wiring ----------
$('lang-cn').onclick = () => setMode('cn');
$('lang-en').onclick = () => setMode('en');
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
  if (confirm('ออกจากบทเรียน? ความคืบหน้าของบทนี้จะหายไป')) { session = null; renderHome(); }
};

renderHome();
