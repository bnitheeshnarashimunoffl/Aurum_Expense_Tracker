// Meridian — send one test notification to the caller's own devices.
//
// Separate from push-dispatch on purpose. The dispatcher is privileged (service
// role, cron secret, reads every user's data); this one is the opposite in every
// respect: it forwards the caller's own JWT into the Supabase client, so it can
// only ever see and push to the subscriptions Row Level Security says are theirs.
// The only secret it holds is the VAPID private key, which has to live server-side.
//
// It exists because notifications are the hardest thing in this app to verify by
// eye — especially on iOS, where an uninstalled PWA fails completely silently.
// The Notifications settings screen calls this, and a notification arriving is
// the proof that the whole chain works: subscription stored, VAPID keys valid,
// service worker awake.
//
// Deploy:  supabase functions deploy push-test
// Secrets: shares VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT with push-dispatch.

// @ts-nocheck — Deno globals and the esm.sh import are resolved by the Supabase
// Edge runtime, not by this repo's TypeScript config.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { sendPush, vapidFromEnv } from '../_shared/webpush.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let vapid
  try {
    vapid = vapidFromEnv((key) => Deno.env.get(key))
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  // RLS means this can only ever return the caller's own devices.
  const { data: subscriptions, error } = await supabase
    .from('meridian_push_subscriptions')
    .select('endpoint, p256dh, auth')
  if (error) return json({ error: `Could not read your subscriptions: ${error.message}` }, 500)
  if (!subscriptions || subscriptions.length === 0) {
    return json({ error: 'No devices are subscribed yet. Turn notifications on first.' }, 404)
  }

  const payload = {
    title: 'Meridian is listening',
    body: 'That is the whole chain working — you will get the real ones on time.',
    url: '/settings',
    tag: 'meridian-test',
  }

  let delivered = 0
  const failures: string[] = []
  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, payload, vapid)
    if (result.ok) {
      delivered++
    } else if (result.gone) {
      // Same cleanup rule as the dispatcher: the push service is authoritative
      // about a subscription being dead, so act on it the moment it says so.
      await supabase.from('meridian_push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      failures.push('One device had expired and has been removed.')
    } else {
      // Say WHOSE error this is. The bare `${status}: ${body}` this used to
      // report was indistinguishable from a Supabase auth failure — an Apple
      // rejection reading `403: {"reason":"BadJwtToken"}` looks for all the
      // world like the Edge Function itself refusing the caller's JWT, and cost
      // two wrong diagnoses before anyone looked at the VAPID subject. The push
      // service is a third party; label it as one.
      failures.push(`Push service rejected it (${result.status}): ${result.detail ?? 'unknown error'}`)
    }
  }

  if (delivered === 0) {
    // De-duplicated: several stale subscriptions all failing the same way is one
    // problem reported once, not the same sentence repeated per dead device.
    const unique = [...new Set(failures)]
    const suffix = subscriptions.length > 1 ? ` (${subscriptions.length} device subscriptions tried)` : ''
    return json({ error: (unique.join(' ') || 'Could not reach any device.') + suffix }, 502)
  }
  return json({ delivered, failures: [...new Set(failures)] })
})
