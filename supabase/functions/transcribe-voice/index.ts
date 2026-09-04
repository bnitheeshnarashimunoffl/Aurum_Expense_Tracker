// Chronicle — voice transcription (Supabase Edge Function, Deno).
//
// WHY THIS EXISTS AT ALL: Meridian is a PWA, so anything in the frontend bundle is
// publicly readable. A Groq API key in client code would be a key handed to whoever
// opens devtools. The client therefore never talks to Groq — this function holds
// the key, and it is the only thing in the project that does.
//
// TWO ROUTES IN, since the public release split data away from auth:
//
//   1. {"voice_id": "<uuid>"} — the audio is in THIS project's storage, which is
//      the case for the owner's own account. The function downloads the file
//      under the caller's own JWT, transcribes it, and writes the result onto the
//      row. Durable: the answer lands even if the client is long gone.
//
//   2. multipart/form-data with a `file` part — the audio is in a Supabase project
//      belonging to the user, which this function has never heard of and holds no
//      credentials for. The browser is the only party signed in to both, so it
//      sends the bytes up and writes the transcript back to its own database. The
//      function is a pipe to Groq: it reads nothing and writes nothing.
//
// AUTH: both routes require a valid Meridian JWT. Route 1 forwards it into a
// Supabase client so every read and write runs under that user's Row Level
// Security; route 2 verifies it explicitly with getUser() before spending a Groq
// call. The function never uses the service_role key, so a bug in it cannot reach
// another account's audio. Deploy it WITH jwt verification (the default) so the
// gateway turns anonymous callers away before any of this runs.
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
// sentence they can act on instead of an opaque 413 from someone else's API, and
// caps how much one caller can push through this function in a single request.
const MAX_BYTES = 25 * 1024 * 1024

/**
 * Container formats Whisper can demux, and the ONLY extensions this function will
 * put on a filename.
 *
 * The filename is not cosmetic: Whisper chooses its demuxer from it, and Android
 * records WebM where iOS records MP4, so it has to survive the trip. It is also
 * the one piece of caller-controlled text that ends up inside a multipart header
 * on an outbound request — so it is rebuilt from this list rather than passed
 * through, which makes header injection through a crafted filename impossible.
 */
const ALLOWED_EXTENSIONS = ['webm', 'm4a', 'mp4', 'ogg', 'opus', 'mp3', 'wav', 'flac', 'mpeg', 'mpga']

function safeAudioName(raw: string | null | undefined): string {
  const extension = String(raw ?? '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return ALLOWED_EXTENSIONS.includes(extension ?? '') ? `audio.${extension}` : 'audio.webm'
}

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

/** The one place that talks to Groq. Returns the text, or a sentence about why not. */
async function transcribe(file: Blob, filename: string, groqKey: string): Promise<{ ok: true; text: string } | { ok: false; message: string; status: number }> {
  const form = new FormData()
  form.append('file', file, filename)
  form.append('model', GROQ_MODEL)
  form.append('response_format', 'json')

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
      return { ok: false, message: `${prefix}. ${detail.slice(0, 300)}`, status: 502 }
    }
    const payload = await res.json()
    return { ok: true, text: String(payload?.text ?? '').trim() }
  } catch (err) {
    return { ok: false, message: `Could not reach Groq: ${err instanceof Error ? err.message : String(err)}`, status: 502 }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const groqKey = Deno.env.get('GROQ_API_KEY')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const contentType = req.headers.get('content-type') ?? ''

  /* ------------------------------------------------------------------ */
  /* Route 2 — audio posted up from a project this function cannot reach */
  /* ------------------------------------------------------------------ */
  if (contentType.includes('multipart/form-data')) {
    // Nothing here reads or writes a table, so RLS cannot be what protects it.
    // Verifying the JWT explicitly is: without this, a valid-looking header would
    // be enough to spend the project's Groq quota.
    const { data: caller, error: callerError } = await supabase.auth.getUser()
    if (callerError || !caller?.user) return json({ error: 'Not signed in' }, 401)

    if (!groqKey) {
      return json(
        { error: 'GROQ_API_KEY is not set on this Supabase project. Run: supabase secrets set GROQ_API_KEY=your_key' },
        500
      )
    }

    let file: Blob | null = null
    let filename = 'audio.webm'
    try {
      const form = await req.formData()
      const part = form.get('file')
      if (part instanceof File) {
        file = part
        filename = safeAudioName(part.name)
      } else if (part instanceof Blob) {
        file = part
      }
    } catch {
      return json({ error: 'Could not read the uploaded audio.' }, 400)
    }

    if (!file) return json({ error: 'No audio was attached.' }, 400)
    if (file.size === 0) return json({ error: 'The recording is empty.' }, 400)
    if (file.size > MAX_BYTES) {
      return json({ error: `Recording is ${(file.size / 1024 / 1024).toFixed(1)}MB; Groq's limit is 25MB.` }, 413)
    }

    const result = await transcribe(file, filename, groqKey)
    if (!result.ok) return json({ error: result.message }, result.status)
    return json({ transcript: result.text, source: 'groq' })
  }

  /* ------------------------------------------------------------------ */
  /* Route 1 — the audio is in this project, as it always used to be     */
  /* ------------------------------------------------------------------ */

  let voiceId: string
  try {
    const body = await req.json()
    voiceId = body?.voice_id
    if (typeof voiceId !== 'string' || !voiceId) throw new Error('bad id')
  } catch {
    return json({ error: 'Body must be {"voice_id": "<uuid>"} or a multipart upload' }, 400)
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

  const result = await transcribe(file, safeAudioName(entry.audio_path), groqKey)
  if (!result.ok) return fail(result.message, result.status)

  const { error: saveError } = await supabase
    .from('chronicle_voice')
    .update({
      transcript: result.text,
      transcript_status: 'done',
      transcript_source: 'groq',
      transcript_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', voiceId)

  if (saveError) return fail(`Transcribed, but saving failed: ${saveError.message}`, 500)

  return json({ transcript: result.text, source: 'groq' })
})
