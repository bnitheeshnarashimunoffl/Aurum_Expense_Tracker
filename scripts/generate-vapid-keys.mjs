// Generates the VAPID keypair Web Push needs, and writes it straight into
// .env.local — which is gitignored — rather than printing it.
//
//   npm run vapid
//
// WHY IT WRITES RATHER THAN PRINTS: the private key is the one credential in this
// project that can send notifications to your phone. Printing it puts it in your
// terminal scrollback, your shell history if you paste it back, and anywhere that
// output is later shared. So the private key goes to disk once, and the only
// thing this script says out loud is the PUBLIC key (which ships in the browser
// bundle anyway) and the exact command to copy the private one into Supabase
// without it ever passing through your clipboard.
//
// Re-running it refuses to overwrite existing keys unless you pass --force,
// because rotating VAPID keys invalidates every push subscription already stored
// and every device has to re-subscribe.

import { generateKeyPairSync, createPublicKey } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')
const force = process.argv.includes('--force')

function b64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// P-256, the only curve Web Push allows (RFC 8292 §3.2).
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })
const publicJwk = createPublicKey(privateKey).export({ format: 'jwk' })

// The public key travels as a 65-byte uncompressed point (0x04 ‖ X ‖ Y); the
// private key as the bare 32-byte scalar. Both base64url — the format every
// web-push tool, and supabase/functions/_shared/webpush.ts, expects.
const x = Buffer.from(publicJwk.x, 'base64url')
const y = Buffer.from(publicJwk.y, 'base64url')
const publicKey = b64url(Buffer.concat([Buffer.from([0x04]), x, y]))
const privateScalar = b64url(Buffer.from(jwk.d, 'base64url'))

let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''

if (!force && /^VAPID_PRIVATE_KEY=.+$/m.test(env)) {
  console.error(
    'VAPID keys already exist in .env.local.\n' +
      'Rotating them invalidates every push subscription already stored, and every\n' +
      'device has to turn notifications off and on again. If that is what you want:\n' +
      '  npm run vapid -- --force'
  )
  process.exit(1)
}

function upsert(source, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(source)) return source.replace(pattern, line)
  return `${source.replace(/\s*$/, '')}\n${line}\n`
}

env = upsert(env, 'VITE_VAPID_PUBLIC_KEY', publicKey)
env = upsert(env, 'VAPID_PRIVATE_KEY', privateScalar)
if (!/^VAPID_SUBJECT=.+$/m.test(env)) {
  env = upsert(env, 'VAPID_SUBJECT', 'mailto:you@example.com')
}

writeFileSync(envPath, env.startsWith('\n') ? env.slice(1) : env, 'utf8')

console.log(`
VAPID keypair written to .env.local (gitignored — confirm with: git check-ignore .env.local)

  VITE_VAPID_PUBLIC_KEY  ${publicKey}
  VAPID_PRIVATE_KEY      (written to .env.local, deliberately not printed)
  VAPID_SUBJECT          set it to a real mailto: address you own, in .env.local

NEXT, three things:

1. Set VAPID_SUBJECT in .env.local to a real address you own, and KEEP THE
   "mailto:" PREFIX — it is part of the value, not instructions:

       VAPID_SUBJECT=mailto:your-real-email@example.com      <- correct
       VAPID_SUBJECT=your-real-email@example.com             <- rejected

   RFC 8292 requires this claim to be a URI, and the push services enforce it.
   Apple answers a bare address with 403 {"reason":"BadJwtToken"}, which looks
   exactly like a broken signing key and is thoroughly misleading. An https://
   URL you control works too.

2. Push the private key and subject to Supabase as project secrets. Edge
   Functions do NOT read .env.local, so this step is not optional. Neither
   command below prints the key:

   macOS / Linux / Git Bash:
     supabase secrets set VAPID_PUBLIC_KEY="${publicKey}"
     supabase secrets set VAPID_PRIVATE_KEY="$(grep '^VAPID_PRIVATE_KEY=' .env.local | cut -d= -f2-)"
     supabase secrets set VAPID_SUBJECT="$(grep '^VAPID_SUBJECT=' .env.local | cut -d= -f2-)"

   PowerShell:
     supabase secrets set VAPID_PUBLIC_KEY="${publicKey}"
     supabase secrets set VAPID_PRIVATE_KEY="$((Select-String '^VAPID_PRIVATE_KEY=' .env.local).Line -replace '^VAPID_PRIVATE_KEY=','')"
     supabase secrets set VAPID_SUBJECT="$((Select-String '^VAPID_SUBJECT=' .env.local).Line -replace '^VAPID_SUBJECT=','')"

3. Add VITE_VAPID_PUBLIC_KEY (the value above) to your Vercel project's
   environment variables, alongside VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
   It is a public key; shipping it in the browser bundle is how Web Push works.
`)
