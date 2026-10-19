/* Web Push for the board-push edge function, using only WebCrypto, so it runs
   unchanged in Deno (Supabase Edge) and Node 22 (tools/tests/push-crypto.js).

   - makeKeys():       a VAPID key pair: { pub (base64url, 65-byte point), priv (JWK) }
   - buildPush(sub, payload, keys, subject, opts) -> { url, init } for fetch()
       sub:     { endpoint, p256dh, auth }      as the browser gave them
       payload: string (sw.js reads JSON {title, body, url, tag})
       subject: the VAPID contact, a mailto: or https: URL
       opts:    { ttl = 86400, urgency = 'normal', topic }

   Payload encryption is RFC 8291 (aes128gcm, RFC 8188), one record. The
   Authorization header is RFC 8292 (vapid t=…, k=…).                        */

const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function cat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

export async function makeKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const priv = await subtle.exportKey('jwk', kp.privateKey);
  return { pub: b64u(pub), priv: { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, d: priv.d } };
}

async function vapidJwt(aud, keys, subject) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle.importKey('jwk', { ...keys.priv, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));   // raw r||s, as JWS wants
  return head + '.' + body + '.' + b64u(sig);
}

export async function encrypt(payload, p256dh, authSecret) {
  const uaPub = unb64u(p256dh), auth = unb64u(authSecret);
  if (uaPub.length !== 65 || auth.length !== 16) throw new Error('bad_keys');
  const as = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await subtle.exportKey('raw', as.publicKey));
  const uaKey = await subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = cat(enc.encode(payload), new Uint8Array([2]));   // 0x02: last (only) record, no padding
  if (plain.length + 16 > 4096) throw new Error('too_big');
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);   // record size 4096
  return cat(salt, rs, new Uint8Array([65]), asPub, ct);
}

export async function buildPush(sub, payload, keys, subject, opts = {}) {
  const u = new URL(sub.endpoint);
  const jwt = await vapidJwt(u.origin, keys, subject);
  const headers = {
    'Authorization': `vapid t=${jwt}, k=${keys.pub}`,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'TTL': String(opts.ttl ?? 86400),
    'Urgency': opts.urgency || 'normal'
  };
  if (opts.topic && /^[A-Za-z0-9_-]{1,32}$/.test(opts.topic)) headers['Topic'] = opts.topic;
  return { url: sub.endpoint, init: { method: 'POST', headers, body: await encrypt(payload, sub.p256dh, sub.auth) } };
}
