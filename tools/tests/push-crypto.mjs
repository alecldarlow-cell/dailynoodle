#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Web Push encryption and VAPID signing used by the board-push edge function
   (toolchain/edge/board-push/webpush.js), checked from the receiving side.

     node tools/tests/push-crypto.mjs
     ECE_DIR=/path/with/node_modules node tools/tests/push-crypto.mjs   # also cross-check with http_ece

   Plays the browser: makes a subscription key pair, has webpush.js encrypt a
   message for it, then decrypts it the way a browser does (RFC 8291) and, if
   ECE_DIR points at an install of the http_ece package (npm i http_ece), with
   that independent implementation too. Checks the VAPID header's JWT is
   signed by the published key, aimed at the push service and not expired.
--------------------------------------------------------------------------- */
import { createRequire } from 'module';
import nodeCrypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const W = await import(path.join(here, '..', '..', 'toolchain', 'edge', 'board-push', 'webpush.js'));
const subtle = globalThis.crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

// The "browser": a P-256 key pair and a 16-byte auth secret.
const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const uaPub = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', p256dh: W.b64u(uaPub), auth: W.b64u(auth) };

const keys = await W.makeKeys();
ok(W.unb64u(keys.pub).length === 65 && keys.priv.d && keys.priv.kty === 'EC', 'makeKeys: 65-byte public point and a private JWK');

const msg = JSON.stringify({ title: 'Jo beat your Mini', body: '0:41 — your move ✏️', url: '/board.html?p=mini', tag: 'mini' });
const { url, init } = await W.buildPush(sub, msg, keys, 'https://dailynoodle.co.uk', { topic: 'mini' });
ok(url === sub.endpoint && init.method === 'POST', 'posts to the subscription endpoint');
ok(init.headers['Content-Encoding'] === 'aes128gcm' && init.headers.TTL === '86400' && init.headers.Topic === 'mini', 'headers: aes128gcm, TTL, Topic');

// --- decrypt as the browser does (RFC 8291 / 8188) ---
async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
const body = init.body;
const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
const asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
ok(rs === 4096 && idlen === 65 && asPub[0] === 4, 'header: record size 4096, 65-byte sender key');
const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPub, ...asPub]);
const ikm = await hkdf(auth, shared, info, 32);
const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
let plain = null;
try {
  const k = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
} catch (e) {}
ok(plain && plain[plain.length - 1] === 2 && dec.decode(plain.slice(0, -1)) === msg, 'browser-side decrypt gives the message back (last-record delimiter 0x02)');

// --- independent implementation, if installed ---
if (process.env.ECE_DIR) {
  const req = createRequire(path.join(process.env.ECE_DIR, 'x.js'));
  const ece = req('http_ece');
  const ecdh = nodeCrypto.createECDH('prime256v1');
  const jwk = await subtle.exportKey('jwk', ua.privateKey);
  ecdh.setPrivateKey(Buffer.from(W.unb64u(jwk.d)));
  let out = '';
  try { out = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ecdh, authSecret: W.b64u(auth) }).toString('utf8'); } catch (e) { out = 'ERR ' + e.message; }
  ok(out === msg, 'http_ece (independent implementation) decrypts it too' + (out === msg ? '' : ' — ' + out));
} else console.log('SKIP http_ece cross-check (set ECE_DIR)');

// --- VAPID ---
const m = init.headers.Authorization.match(/^vapid t=([^,]+), k=([A-Za-z0-9_-]+)$/);
ok(!!m && m[2] === keys.pub, 'Authorization: vapid t=<jwt>, k=<public key>');
const [h, c, s] = m[1].split('.');
const claims = JSON.parse(dec.decode(W.unb64u(c)));
ok(JSON.parse(dec.decode(W.unb64u(h))).alg === 'ES256', 'JWT alg ES256');
ok(claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'https://dailynoodle.co.uk' && claims.exp > Date.now() / 1000 && claims.exp <= Date.now() / 1000 + 86400, 'JWT aud = push service origin, sub = site, exp within 24 h');
const pubKey = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.priv.x, y: keys.priv.y }, format: 'jwk' });
ok(nodeCrypto.verify('sha256', Buffer.from(h + '.' + c), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(W.unb64u(s))), 'JWT signature verifies against the published key');
ok(Buffer.from(W.unb64u(keys.pub)).equals(Buffer.concat([Buffer.from([4]), Buffer.from(W.unb64u(keys.priv.x)), Buffer.from(W.unb64u(keys.priv.y))])), 'published key matches the private key');

let tooBig = false; try { await W.buildPush(sub, 'x'.repeat(5000), keys, 'https://dailynoodle.co.uk'); } catch (e) { tooBig = e.message === 'too_big'; }
ok(tooBig, 'refuses a message over one 4 KB record');

console.log(`\npush-crypto: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
