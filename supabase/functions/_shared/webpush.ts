// Web Push — VAPID signing (RFC 8292) and payload encryption (RFC 8291 / 8188),
// written against Web Crypto so it runs on Deno with no dependency at all.
//
// WHY HAND-ROLLED RATHER THAN A LIBRARY: the npm `web-push` package reaches for
// node:crypto and node:https, and the Deno-native ports of it come and go. This
// is ~150 lines of well-specified, fully deterministic crypto that the Supabase
// Edge runtime supports natively, and it means a push send can never break
// because a third-party module moved. Every step below cites the spec section it
// implements so it can be checked against the RFC rather than trusted.
//
// This file never touches the database and never sees a user. It takes a
// subscription and a payload and puts one encrypted message on the wire.

/* -------------------------------------------------------------------------- */
/* base64url                                                                   */
/* -------------------------------------------------------------------------- */

export function b64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function bytesToB64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/* -------------------------------------------------------------------------- */
/* VAPID — RFC 8292                                                            */
/* -------------------------------------------------------------------------- */

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 point. Also shipped to the client. */
  publicKey: string
  /** base64url, 32-byte P-256 scalar. Server-side only, ever. */
  privateKey: string
  /** "mailto:you@example.com" — RFC 8292 requires a contact the push service can use. */
  subject: string
}

/**
 * The VAPID keypair is stored as raw base64url (the format every web-push tool
 * emits), but Web Crypto will only import a P-256 private key as a JWK, so the
 * raw scalar and the public point are reassembled into one here.
 */
async function importVapidKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = b64urlToBytes(keys.publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY is not a 65-byte uncompressed P-256 point. Regenerate with scripts/generate-vapid-keys.mjs.')
  }
  const priv = b64urlToBytes(keys.privateKey)
  if (priv.length !== 32) {
    throw new Error('VAPID_PRIVATE_KEY is not a 32-byte P-256 scalar. Regenerate with scripts/generate-vapid-keys.mjs.')
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: bytesToB64url(priv),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

/**
 * A signed ES256 JWT scoped to the push service's ORIGIN (not the full endpoint
 * — RFC 8292 §2 is explicit that `aud` is the origin), valid for 12 hours.
 */
async function vapidAuthorization(endpoint: string, keys: VapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = bytesToB64url(
    utf8(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      })
    )
  )
  const signingInput = `${header}.${body}`
  const key = await importVapidKey(keys)
  // Web Crypto emits ECDSA signatures as raw r||s, which is exactly what JWS
  // ES256 wants — no DER unwrapping needed.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput))
  )
  return `vapid t=${signingInput}.${bytesToB64url(signature)}, k=${keys.publicKey}`
}

/* -------------------------------------------------------------------------- */
/* Payload encryption — RFC 8291 (aes128gcm)                                   */
/* -------------------------------------------------------------------------- */

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

/** HKDF as RFC 5869, with the single-block expand every step here needs. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm)
  const okm = await hmac(prk, concat(info, new Uint8Array([1])))
  return okm.slice(0, length)
}

export interface PushSubscription {
  endpoint: string
  /** base64url of the client's 65-byte public key. */
  p256dh: string
  /** base64url of the client's 16-byte auth secret. */
  auth: string
}

/**
 * Encrypts one payload for one subscription, producing the exact body layout
 * RFC 8188 §2.1 specifies:
 *     salt(16) | record size(4) | key id length(1) | server public key(65) | ciphertext
 */
async function encryptPayload(subscription: PushSubscription, payload: string): Promise<Uint8Array> {
  const clientPublic = b64urlToBytes(subscription.p256dh)
  const authSecret = b64urlToBytes(subscription.auth)

  // A fresh ephemeral keypair per message — reusing one across sends would let a
  // push service link messages and would break the spec's forward secrecy.
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))

  const clientKey = await crypto.subtle.importKey('raw', clientPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256)
  )

  // RFC 8291 §3.3 — the auth secret is the HKDF salt for the first extract, and
  // the info string binds the derived key to both parties' public keys.
  const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), clientPublic, serverPublic)
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const contentEncryptionKey = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  // 0x02 is the RFC 8188 padding delimiter for the LAST record. Everything here
  // is a single record, so it is always 0x02 and never 0x01.
  const plaintext = concat(utf8(payload), new Uint8Array([2]))

  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext)
  )

  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, 4096, false)

  return concat(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, ciphertext)
}

/* -------------------------------------------------------------------------- */
/* Send                                                                        */
/* -------------------------------------------------------------------------- */

export interface SendResult {
  ok: boolean
  status: number
  /**
   * True when the push service says this subscription is dead (404 Not Found or
   * 410 Gone). The caller deletes the row — that is the whole expired-subscription
   * cleanup story, and it has to be driven from here because this is the only
   * place that learns about it.
   */
  gone: boolean
  detail?: string
}

export async function sendPush(
  subscription: PushSubscription,
  payload: unknown,
  keys: VapidKeys,
  ttlSeconds = 3 * 60 * 60
): Promise<SendResult> {
  let body: Uint8Array
  let authorization: string
  try {
    body = await encryptPayload(subscription, JSON.stringify(payload))
    authorization = await vapidAuthorization(subscription.endpoint, keys)
  } catch (err) {
    // A malformed key is a setup error, not a transient one — say so loudly
    // rather than letting it read as "the push service rejected us".
    return { ok: false, status: 0, gone: false, detail: err instanceof Error ? err.message : String(err) }
  }

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        // A reminder that arrives hours late is worse than one that never
        // arrives, so nothing here is worth queueing for longer than the gap
        // between sends.
        TTL: String(ttlSeconds),
        Urgency: 'normal',
      },
      body,
    })
    if (res.ok) return { ok: true, status: res.status, gone: false }
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    return { ok: false, status: res.status, gone: res.status === 404 || res.status === 410, detail }
  } catch (err) {
    return { ok: false, status: 0, gone: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Reads the VAPID configuration out of the environment, failing with a sentence
 * that names the missing variable and the command that sets it. Deliberately
 * explicit: a silent no-op here would look exactly like "notifications are
 * broken on iOS", which is the one failure mode that must stay distinguishable.
 */
export function vapidFromEnv(env: (key: string) => string | undefined): VapidKeys {
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  const subject = env('VAPID_SUBJECT')
  const missing = [
    !publicKey && 'VAPID_PUBLIC_KEY',
    !privateKey && 'VAPID_PRIVATE_KEY',
    !subject && 'VAPID_SUBJECT',
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase secret(s): ${missing.join(', ')}. Set them with: supabase secrets set ${missing
        .map((name) => `${name}=...`)
        .join(' ')}  (Edge Functions do not read .env.local.)`
    )
  }

  // RFC 8292 §2.1 requires `sub` to be a URI, not a bare address — and the push
  // services enforce it. Apple in particular answers a malformed `sub` with
  // `403 {"reason":"BadJwtToken"}`, which reads exactly like a signature or key
  // problem and sends you hunting through the crypto for a fault that is not
  // there. Checking it here turns an afternoon of misdiagnosis into one sentence
  // naming the actual mistake, which is the whole point of failing loudly.
  if (!/^(mailto:|https:\/\/)/.test(subject!)) {
    throw new Error(
      `VAPID_SUBJECT must be a URI — "mailto:you@example.com" or "https://your.site", not a bare email address. ` +
        `It is currently "${subject}". Fix it with: supabase secrets set VAPID_SUBJECT=mailto:${subject}`
    )
  }

  return { publicKey: publicKey!, privateKey: privateKey!, subject: subject! }
}
