# Supabase Cloud Sync + Google Login for MyDuolingo

## Context

MyDuolingo is currently a fully static, browser-only vocab app (`app/index.html`, `app.js`, `engine.js`, `data.js`, `style.css` — no bundler, no npm, no server). All progress (XP, streak, per-word spaced-repetition stats, unit crowns, mistake list) lives only in the browser's `localStorage`, keyed as `myduolingo-v1`. The user wants to play on their phone lying down as well as at their desk, with progress carried across devices. That requires two things: a publicly reachable URL (separate, later task — explicitly out of scope for this plan) and a shared backend so progress isn't siloed per-browser. The user chose Supabase (managed Postgres + Auth) over self-hosting, and confirmed: **Google login only** for auth, and **detailed field-by-field merge** (not last-write-wins) the first time a device with existing local progress signs in and finds cloud data already present. This plan covers only the sync/login feature — responsive CSS and hosting deploy are deliberately deferred to separate follow-up work.

## 1. Supabase project setup (manual, one-time, done by the user in the dashboard — not code)

> **หมายเหตุ UI ใหม่ (2026):** Supabase เปลี่ยนหน้า API Keys ใหม่ — คำว่า "anon key" เดิมตอนนี้เรียกว่า **"Publishable key"** (ขึ้นต้นด้วย `sb_publishable_...`) ใช้แทนกันได้เลย ส่วน **Project URL อยู่หน้าเดียวกัน** (Settings → API) แค่คนละ section กับ Publishable key เท่านั้น — ไม่ต้องไปหาใน Settings → General (จะไม่เจอ)

1. สร้างโปรเจกต์ที่ supabase.com/dashboard
2. ไปที่ไอคอนเฟือง **Project Settings → API** (แถบซ้าย ในภาพคือเมนู "API Keys"):
   - **Project URL**: อยู่บนสุดของหน้า API เดียวกัน (เหนือ section "Publishable key" / "Legacy anon, service_role API keys") — ถ้ามองไม่เห็นให้เลื่อนหน้าขึ้นไปด้านบนสุด หรือดูที่แท็บ **"Data API"** ใต้หัวข้อ Integrations ในเมนูซ้าย ก็จะมี Project URL แสดงไว้เช่นกัน
   - รูปแบบจะเป็น `https://<project-ref>.supabase.co` — `<project-ref>` คือรหัสโปรเจกต์เฉพาะ (ไม่ใช่ตัวเดียวกับใน publishable key)
   - **Publishable key** (`sb_publishable_...`): คัดลอกจาก section "Publishable key" ในแท็บ "Publishable and secret API keys" — ใช้แทน `anon key` เดิมได้เลย ปลอดภัยที่จะฝังในโค้ดฝั่ง client
   - **ห้ามใช้ Secret key** (`sb_secret_...`) ในโค้ดฝั่งเว็บเด็ดขาด — อันนั้นคือของแทน `service_role` เดิม มีสิทธิ์เต็ม ต้องใช้แค่ฝั่ง server เท่านั้น
3. Authentication → Providers → Google: เปิดใช้งาน โดยต้องมี Google Cloud OAuth Client ID/Secret ก่อน แล้วนำ callback URL ของ Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`) ไปใส่เป็น authorized redirect URI ใน Google Cloud Console
4. Authentication → URL Configuration: เพิ่ม URL ที่ใช้ตอนพัฒนา (เช่น local Live Server) และ URL จริงตอน deploy ใส่ใน **Redirect URLs**
5. SQL Editor: รัน SQL schema + RLS จาก Section 2
6. นำ Project URL + Publishable key ไปใส่ใน `app/sync.js` (Section 3) แทนที่ `SUPABASE_URL` และ `SUPABASE_ANON_KEY`

## 2. Database schema + RLS

One row per user holding the entire state blob as JSONB — matches `S`'s nested, evolving shape (`langs.cn/en.words` keyed by arbitrary word ids, `crowns` keyed by unit index) without needing a normalized schema or per-word round trips. The app never needs to query into individual words server-side, so JSONB costs nothing here.

```sql
create table public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_state_touch
before update on public.user_state
for each row execute function public.touch_updated_at();

alter table public.user_state enable row level security;

create policy "select own state" on public.user_state
  for select using ( (select auth.uid()) = user_id );

create policy "insert own state" on public.user_state
  for insert with check ( (select auth.uid()) = user_id );

create policy "update own state" on public.user_state
  for update using ( (select auth.uid()) = user_id )
             with check ( (select auth.uid()) = user_id );
-- no delete policy needed
```

The anon key is safe to ship client-side: RLS enforces per-row ownership via `auth.uid()` regardless of who holds the key.

## 3. New file: `app/sync.js`

Load order in `index.html` (currently lines 76–78, `data.js` → `engine.js` → `app.js`):

```html
<script src="data.js"></script>
<script src="engine.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js"></script>
<script src="app.js"></script>
```

`sync.js` is self-contained (no dependency on `Engine`/`VOCAB`), exposes a global `Sync` object:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Sync = (() => {
  let session = null, pushTimer = null, statusCb = () => {}, pulling = false;

  function onStatus(cb) { statusCb = cb; }
  function currentUser() { return session ? session.user : null; }
  async function signIn() { await supabaseClient.auth.signInWithOAuth({ provider: 'google' }); }
  async function signOut() { await supabaseClient.auth.signOut(); }

  async function init(localState, applyMergedState) {
    supabaseClient.auth.onAuthStateChange(async (event, sess) => {
      session = sess;
      if (event === 'SIGNED_IN') {
        statusCb('syncing');
        applyMergedState(await pullAndMerge(localState()));
        statusCb('synced');
      } else if (event === 'SIGNED_OUT') {
        statusCb('offline');
      }
    });
    const { data: { session: initial } } = await supabaseClient.auth.getSession();
    session = initial;
    if (initial) {
      statusCb('syncing');
      applyMergedState(await pullAndMerge(localState()));
      statusCb('synced');
    } else {
      statusCb('offline');
    }
  }

  async function pullAndMerge(local) {
    pulling = true;
    try {
      const { data, error } = await supabaseClient
        .from('user_state').select('state').eq('user_id', session.user.id).maybeSingle();
      if (error || !data) return local;
      return mergeState(local, data.state);
    } finally { pulling = false; }
  }

  function schedulePush(state) {
    if (!session || pulling) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushNow(state), 2000);
  }

  async function pushNow(state) {
    if (!session) return;
    statusCb('syncing');
    const { error } = await supabaseClient
      .from('user_state').upsert({ user_id: session.user.id, state }, { onConflict: 'user_id' });
    statusCb(error ? 'offline' : 'synced');
  }

  function flushNow(state) { clearTimeout(pushTimer); return pushNow(state); }

  function mergeState(local, cloud) { /* see Section 4 */ }

  return { onStatus, currentUser, signIn, signOut, init, schedulePush, flushNow };
})();
```

Guard against missing config: if `SUPABASE_URL`/`SUPABASE_ANON_KEY` are still placeholders, skip `createClient` and make `Sync`'s methods no-ops so the app keeps working offline-only without crashing.

### Hooks into existing `app.js`

- **After `let S = loadState();` (line 29)**, add:
  ```js
  Sync.init(() => S, merged => { S = merged; saveState(); renderHome(); });
  ```
- **`saveState()` (line 27)** — the single choke point for all 4 existing call sites (lines 104, 421, 448, 481) — becomes:
  ```js
  function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    if (typeof Sync !== 'undefined') Sync.schedulePush(S);
  }
  ```
  No other change needed at the 4 call sites themselves.
- **Topbar wiring** (near `renderTopbar()` at line 67, and the wiring block at lines 492–510): add sign-in/out handlers and status updates:
  ```js
  $('btn-signin').onclick = () => Sync.signIn();
  $('btn-signout').onclick = () => Sync.signOut();
  Sync.onStatus(status => {
    $('sync-status').textContent = { syncing: 'กำลังซิงค์…', synced: 'ซิงค์แล้ว ✓', offline: 'ออฟไลน์' }[status];
    $('sync-status').className = 'sync-status ' + status;
  });
  ```
  `renderTopbar()` also toggles sign-in vs sign-out visibility based on `Sync.currentUser()`.
- **Flush on backgrounding** — add near the bottom of `app.js` (after line 512):
  ```js
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Sync.flushNow(S);
  });
  ```

## 4. Merge algorithm (field-by-field, run once on first sign-in per session when cloud data exists)

```
function mergeState(local, cloud):
    merged.xp = max(local.xp, cloud.xp)                     # xp only ever increments (app.js:473)

    # streak.count is NOT monotonic (resets on missed days), so max(count) alone is wrong.
    # lastDay is a lexically-sortable "YYYY-MM-DD" string (Engine.dayKey) — compare directly.
    if local.streak.lastDay == cloud.streak.lastDay:
        merged.streak = (local.streak.count >= cloud.streak.count) ? local.streak : cloud.streak
    else:
        merged.streak = (local.streak.lastDay > cloud.streak.lastDay) ? local.streak : cloud.streak

    merged.mode = local.mode   # keep whichever this device was actively using

    for lang in ['cn', 'en']:
        merged.langs[lang] = mergeLang(local.langs[lang], cloud.langs[lang])


function mergeLang(localLang, cloudLang):
    out.unlocked = max(localLang.unlocked, cloudLang.unlocked)   # only ever grows (app.js:478)

    out.crowns = {}
    for unitIndex in union(keys(localLang.crowns), keys(cloudLang.crowns)):
        out.crowns[unitIndex] = max(localLang.crowns[unitIndex] or 0, cloudLang.crowns[unitIndex] or 0)
        # crowns[i] only ever increments (app.js:477)

    # mistakes is only unshifted/filtered (app.js:444/446) — union is the safe direction
    # (worst case: user re-reviews an already-fixed mistake once more, no data loss)
    out.mistakes = dedupe(localLang.mistakes concat cloudLang.mistakes)

    # each word-state is a full-replacement snapshot from Engine.applyAnswer (app.js:416,442),
    # NOT additive — summing seen/correct/wrong would double-count. Keep whichever side's
    # record has the more recent `last` timestamp.
    out.words = {}
    for wordId in union(keys(localLang.words), keys(cloudLang.words)):
        lw = localLang.words[wordId]; cw = cloudLang.words[wordId]
        out.words[wordId] = (lw && cw) ? (lw.last >= cw.last ? lw : cw) : (lw or cw)

    return out
```

After merging, `app.js` assigns `S = merged; saveState();` — the existing localStorage write plus the new `Sync.schedulePush` call re-syncs the merged result back up, so local and cloud converge.

**Known accepted tradeoff**: if both devices are used offline concurrently (no login/sync in between), `max(xp)` will drop whichever device's increment was smaller rather than summing both — acceptable for a solo personal project without real-time concurrent-editing conflict resolution.

## 5. UI additions

**`index.html`** — inside `#topbar` (lines 12–16), add:
```html
<span id="sync-status" class="sync-status offline">ออฟไลน์</span>
<button id="btn-signin" class="btn-account">เข้าสู่ระบบด้วย Google</button>
<button id="btn-signout" class="btn-account hidden">ออกจากระบบ</button>
```

**`style.css`** — near the `.stat` rule (line 29), add:
```css
.sync-status { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; color: #fff; }
.sync-status.offline { background: var(--gray-dark); }
.sync-status.syncing { background: var(--blue); }
.sync-status.synced  { background: var(--green); }
.btn-account {
  border: none; border-radius: 10px; padding: 6px 12px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit; background: var(--blue); color: #fff;
}
```
Also add `flex-wrap: wrap; row-gap: 6px;` to the existing `#topbar` rule (lines 24–28) so the new elements don't overflow on narrow widths — `#topbar` is already `display: flex`, this is the minimal change needed, not a full responsive pass (that's separate follow-up work).

## 6. Config/secrets

Anon key is meant to be public; RLS is the real security boundary (Section 2). `SUPABASE_URL`/`SUPABASE_ANON_KEY` constants live at the top of `sync.js`; the user fills them in after finishing the dashboard setup. `service_role` key is never used client-side.

## 7. Debounce/timing

- **2000ms debounce** after each `saveState()`, via `setTimeout`/`clearTimeout` inside `Sync.schedulePush` — coalesces bursts (e.g. rapid practice-mode answers) without adding latency to the synchronous exercise flow.
- **Flush on `visibilitychange` → `hidden`**, not `beforeunload`: mobile backgrounding (switching apps) doesn't reliably fire `beforeunload`, and browsers don't guarantee pending async work completes in that handler. `visibilitychange` catches both tab-switch and mobile-backgrounding, and localStorage already has the data regardless if the process is killed before the flush completes.

## 8. Verification plan

1. Sign in with Google, confirm redirect back to the app and `sync-status` goes syncing → synced; sign-in button swaps to sign-out.
2. In Supabase Table Editor, confirm one `user_state` row exists matching the browser's `localStorage['myduolingo-v1']`.
3. **Two-profile test** (simulates two devices, same Google account): Profile A completes a lesson and syncs; Profile B (incognito/second Chrome profile) signs in and should immediately show Profile A's crowns/xp via the pull-merge; Profile B does a different unit and syncs; back in Profile A, reload (triggers `getSession`/pull again) and confirm both units' progress now shows (union).
4. Mark different words wrong in each profile, confirm merged `mistakes` shows the union in the vocab library's "ตอบผิดค้าง" filter.
5. With DevTools Network set to Offline, complete a lesson — confirm no UI lag (localStorage still instant), `sync-status` reflects offline, then restore network and confirm the next debounced push or visibility-triggered flush succeeds.
6. RLS sanity check: query `user_state` via REST with only the anon key and no user JWT — should return zero rows, confirming policies are active.
7. Note for the user: Supabase free-tier projects auto-pause after 7 days idle — first sync after a long break may need a manual "resume" in the dashboard; this is a known limitation, not something to code around.

### Files touched
- `app/sync.js` (new)
- `app/app.js` (lines 27, 29, 67, 492–512 area)
- `app/index.html` (lines 12–16, 76–78)
- `app/style.css` (lines 24–29 area)

### Status
Implemented — see the files above. Remaining step is user-side: create the Supabase project, run the SQL, and fill in `SUPABASE_URL`/`SUPABASE_ANON_KEY` at the top of `app/sync.js`.
