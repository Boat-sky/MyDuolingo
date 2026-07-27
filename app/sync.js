/* sync.js — optional Supabase cloud sync + Google login. Loaded after engine.js, before app.js. */

const SUPABASE_URL = 'https://yljjalncemnuqkhrnhyw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rmcMGw2wWBg5A3qUyT87LA_bI4ACdvV';

const Sync = (() => {
  const configured = !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');
  if (!configured) {
    return {
      onStatus() {}, currentUser: () => null,
      signIn: async () => {}, signOut: async () => {},
      init: async (_local, _apply) => {}, schedulePush() {}, flushNow: async () => {},
    };
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let session = null;
  let pushTimer = null;
  let statusCb = () => {};
  let pulling = false;

  function onStatus(cb) { statusCb = cb; }
  function currentUser() { return session ? session.user : null; }

  async function signIn() {
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }
  async function signOut() { await client.auth.signOut(); }

  async function init(localState, applyMergedState) {
    client.auth.onAuthStateChange(async (event, sess) => {
      session = sess;
      if (event === 'SIGNED_IN') {
        statusCb('syncing');
        applyMergedState(await pullAndMerge(localState()));
        statusCb('synced');
      } else if (event === 'SIGNED_OUT') {
        statusCb('offline');
      }
    });
    const { data: { session: initial } } = await client.auth.getSession();
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
      const { data, error } = await client
        .from('user_state').select('state').eq('user_id', session.user.id).maybeSingle();
      if (error || !data) return local;
      return mergeState(local, data.state);
    } finally {
      pulling = false;
    }
  }

  function schedulePush(state) {
    if (!session || pulling) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushNow(state), 2000);
  }

  async function pushNow(state) {
    if (!session) return;
    statusCb('syncing');
    const { error } = await client
      .from('user_state').upsert({ user_id: session.user.id, state }, { onConflict: 'user_id' });
    statusCb(error ? 'offline' : 'synced');
  }

  function flushNow(state) {
    clearTimeout(pushTimer);
    return pushNow(state);
  }

  // ---------- merge ----------
  function mergeState(local, cloud) {
    const merged = {
      xp: Math.max(local.xp, cloud.xp),
      streak: mergeStreak(local.streak, cloud.streak),
      mode: local.mode,
      langs: {
        cn: mergeLang(local.langs.cn, cloud.langs.cn),
        en: mergeLang(local.langs.en, cloud.langs.en),
      },
    };
    return merged;
  }

  function mergeStreak(local, cloud) {
    if (local.lastDay === cloud.lastDay) {
      return local.count >= cloud.count ? local : cloud;
    }
    return (local.lastDay || '') > (cloud.lastDay || '') ? local : cloud;
  }

  function mergeLang(local, cloud) {
    const unlocked = Math.max(local.unlocked, cloud.unlocked);

    const crowns = {};
    for (const unitIndex of new Set([...Object.keys(local.crowns), ...Object.keys(cloud.crowns)])) {
      crowns[unitIndex] = Math.max(local.crowns[unitIndex] || 0, cloud.crowns[unitIndex] || 0);
    }

    const mistakes = [...new Set([...local.mistakes, ...cloud.mistakes])];

    const words = {};
    for (const wordId of new Set([...Object.keys(local.words), ...Object.keys(cloud.words)])) {
      const lw = local.words[wordId], cw = cloud.words[wordId];
      words[wordId] = (lw && cw) ? (lw.last >= cw.last ? lw : cw) : (lw || cw);
    }

    return { unlocked, crowns, mistakes, words };
  }

  return { onStatus, currentUser, signIn, signOut, init, schedulePush, flushNow };
})();
