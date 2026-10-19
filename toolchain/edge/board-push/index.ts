/* ==========================================================================
   board-push — Supabase Edge Function (digi project), 19 Oct 2026
   --------------------------------------------------------------------------
   Sends Web Push notifications to board players' subscribed browsers.
   Deployed with verify_jwt off: it does its own checks below.

   POST {action:'key'}                    -> {key}  the public push (VAPID) key.
        Made on first call; the private half stays in board.settings 'vapid'.
   POST {action:'test', player}           -> {sent, failed, gone, subs}
        One fixed test message to that player's own subscriptions, at most
        once a minute. Used by the hidden panel on board.html?push=test.
   POST {action:'send', players, title, body, url, tag}   (service role only)
        The real sender for later leaderboard notifications. Refused while
        board.settings 'push'.send is false, which it is (switched off).

   Source of truth: toolchain/edge/board-push/ in the dailynoodle repo.
   Test: node tools/tests/push-crypto.mjs (encryption and signing).
   ========================================================================== */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeKeys, buildPush } from './webpush.js';

const SITE = 'https://dailynoodle.co.uk';
const SUBJECT = SITE;   // VAPID contact sent to push services: the site, not an email address
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headers(req: Request) {
  const o = req.headers.get('origin') || '';
  const allow = o === SITE || /^http:\/\/localhost(:\d+)?$/.test(o) ? o : SITE;
  return {
    'Access-Control-Allow-Origin': allow, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}
const reply = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: headers(req) });

let keysP: Promise<any> | null = null;
function keys() {
  if (!keysP) keysP = (async () => {
    let { data, error } = await db.rpc('board_push_vapid');
    if (error) throw error;
    if (!data) {
      const k = await makeKeys();
      ({ data, error } = await db.rpc('board_push_vapid', { p_pub: k.pub, p_priv: k.priv }));   // first writer wins
      if (error) throw error;
    }
    return data;
  })().catch(e => { keysP = null; throw e; });
  return keysP;
}

async function sendTo(players: string[], msg: Record<string, string>, opts: Record<string, unknown>) {
  const k = await keys();
  const { data: subs, error } = await db.rpc('board_push_targets', { p_players: players });
  if (error) throw error;
  let sent = 0, failed = 0, gone = 0;
  await Promise.all((subs || []).map(async (s: any) => {
    let ok = false, isGone = false;
    try {
      const { url, init } = await buildPush(s, JSON.stringify(msg), k, SUBJECT, opts);
      const r = await fetch(url, init);
      ok = r.status >= 200 && r.status < 300;
      isGone = r.status === 404 || r.status === 410;
      if (!ok) console.log('push refused', r.status, new URL(url).host, (await r.text()).slice(0, 200));
      else await r.body?.cancel();
    } catch (e) { console.log('push failed', String(e)); }
    if (ok) sent++; else failed++;
    if (isGone) gone++;
    await db.rpc('board_push_result', { p_id: s.id, p_ok: ok, p_gone: isGone });
  }));
  return { sent, failed, gone, subs: (subs || []).length };
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: headers(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'method' });
  let b: any;
  try { b = await req.json(); } catch { return reply(req, 400, { error: 'bad_json' }); }
  try {
    if (b.action === 'key') return reply(req, 200, { key: (await keys()).pub });

    if (b.action === 'test') {
      if (!UUID.test(String(b.player || ''))) return reply(req, 400, { error: 'bad_player' });
      const { data: allowed, error } = await db.rpc('board_push_test_ok', { p_player: b.player });
      if (error) throw error;
      if (!allowed) return reply(req, 429, { error: 'wait_or_none' });   // tested in the last minute, or no subscription
      return reply(req, 200, await sendTo([b.player],
        { title: 'The Daily Noodle', body: 'Test notification: this phone can get notifications.', url: '/board.html', tag: 'test' },
        { ttl: 600, topic: 'test' }));
    }

    if (b.action === 'send') {
      if (!SERVICE || req.headers.get('authorization') !== 'Bearer ' + SERVICE) return reply(req, 403, { error: 'forbidden' });
      const { data: cfg, error } = await db.rpc('board_push_cfg');
      if (error) throw error;
      if (!cfg || cfg.send !== true) return reply(req, 409, { error: 'off' });
      const players = (Array.isArray(b.players) ? b.players : []).filter((p: unknown) => UUID.test(String(p))).slice(0, 500);
      const url = /^\/[^\s]*$/.test(String(b.url || '')) ? String(b.url) : '/';
      const tag = /^[A-Za-z0-9_-]{1,32}$/.test(String(b.tag || '')) ? String(b.tag) : undefined;
      if (!players.length || !b.title) return reply(req, 400, { error: 'bad_send' });
      return reply(req, 200, await sendTo(players, { title: clip(b.title, 80), body: clip(b.body, 200), url, tag: tag || '' }, { topic: tag }));
    }

    return reply(req, 400, { error: 'bad_action' });
  } catch (e) {
    console.error('board-push', e);
    return reply(req, 500, { error: 'server' });
  }
});
