// Chronicle — voice transcription (Supabase Edge Function, Deno).
//
// WHY THIS EXISTS AT ALL: Meridian is a PWA, so anything in the frontend bundle is
// publicly readable. A Groq API key in client code would be a key handed to whoever
// opens devtools. The client therefore never talks to Groq — it uploads audio to
// Supabase Storage, calls this function, and this function holds the key.
//
// AUTH: the caller's JWT is forwarded straight into the Supabase client below, so
// every read and write here runs under that user's Row Level Security. That is
// deliberate — this function never uses the service_role key, so a bug in it cannot
// reach another account's audio. The only secret it holds is GROQ_API_KEY.
//
// Deploy:  supabase functions deploy transcribe-voice
// Secret:  supabase secrets set GROQ_API_KEY=...
//   (Edge Functions do NOT read the repo's .env.local — see SETUP.md.)
//
// This file is Deno, not part of the Vite app: tsconfig.json only includes `src`,
// so `npm run build` neither type-checks nor bundles it.

// @ts-nocheck — Deno globals and the esm.sh import are resolved by the Supabase
// Edge runtime, not by this repo's TypeScript config.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'
const BUCKET = 'chronicle'
// Groq's free tier rejects audio over 25MB. Catching it here gives the user a
// sentence they can act on instead of an opaque 413 from someone else's API.
const MAX_BYTES = 25 * 1024 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  let voiceId: string
  try {
    const body = await req.json()
    voiceId = body?.voice_id
    if (typeof voiceId !== 'string' || !voiceId) throw new Error('bad id')
  } catch {
    return json({ error: 'Body must be {"voice_id": "<uuid>"}' }, 400)
  }

  // RLS means a row for another account simply does not come back.
  const { data: entry, error: loadError } = await supabase
    .from('chronicle_voice')
    .select('id, audio_path')
    .eq('id', voiceId)
    .single()

  if (loadError || !entry) return json({ error: 'Voice entry not found' }, 404)

  /**
   * Records the failure on the row itself before answering. The client may well be
   * gone by now — the user can close the app the moment recording stops — so the
   * durable "this one needs a retry" state has to be written here, not left to
   * whoever happens to still be listening.
   */
  async function fail(message: string, status: number) {
    await supabase
      .from('chronicle_voice')
      .update({
        transcript_status: 'failed',
        transcript_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voiceId)
    return json({ error: message }, status)
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) {
    // Explicit, not silent: the brief requires the missing-key case to say so.
    return fail(
      'GROQ_API_KEY is not set on this Supabase project. Run: supabase secrets set GROQ_API_KEY=your_key',
      500
    )
  }

  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(entry.audio_path)
  if (downloadError || !file) return fail(`Could not read the audio file: ${downloadError?.message ?? 'missing'}`, 404)
  if (file.size > MAX_BYTES) {
    return fail(`Recording is ${(file.size / 1024 / 1024).toFixed(1)}MB; Groq's limit is 25MB.`, 413)
  }

  const form = new FormData()
  // The extension matters — Whisper picks its demuxer from the filename.
  form.append('file', file, entry.audio_path.split('/').pop() || 'audio.webm')
  form.append('model', GROQ_MODEL)
  form.append('response_format', 'json')

  let transcript: string
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    })
    if (!res.ok) {
      const detail = await res.text()
      // 429 is the free tier's recurring rate limit rather than a broken setup, so
      // it is worth naming: the retry affordance in the UI is the right response.
      const prefix = res.status === 429 ? 'Groq rate limit reached' : `Groq returned ${res.status}`
      return fail(`${prefix}. ${detail.slice(0, 300)}`, 502)
    }
    const payload = await res.json()
    transcript = (payload?.text ?? '').trim()
  } catch (err) {
    return fail(`Could not reach Groq: ${err instanceof Error ? err.message : String(err)}`, 502)
  }

  const { error: saveError } = await supabase
    .from('chronicle_voice')
    .update({
      transcript,
      transcript_status: 'done',
      transcript_source: 'groq',
      transcript_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', voiceId)

  if (saveError) return fail(`Transcribed, but saving failed: ${saveError.message}`, 500)

  return json({ transcript, source: 'groq' })
})
