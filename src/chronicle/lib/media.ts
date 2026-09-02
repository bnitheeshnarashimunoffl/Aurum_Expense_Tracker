import { supabase } from '@/lib/supabase'

/**
 * Storage helpers for Chronicle's two kinds of file: voice audio and images
 * embedded in notes. Both live in one private bucket, `chronicle`, under the
 * owner's user id — which is what the storage RLS policy keys off, so the path
 * prefix is load-bearing, not just tidy.
 */

export const BUCKET = 'chronicle'
const SIGNED_URL_TTL = 60 * 60

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not signed in')
  return data.user.id
}

export async function uploadAudio(blob: Blob, extension: string): Promise<string> {
  const uid = await currentUserId()
  const path = `${uid}/audio/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function uploadImage(file: File): Promise<string> {
  const uid = await currentUserId()
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${uid}/images/${crypto.randomUUID()}.${extension || 'jpg'}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  if (error) return null
  return data?.signedUrl ?? null
}

async function signedUrlMap(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (paths.length === 0) return map
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl)
  }
  return map
}

export async function removeFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

/* ------------------------------------------------------------------------- */
/* Images inside note HTML                                                    */
/* ------------------------------------------------------------------------- */

/**
 * The bucket is private, so an embedded image can only be displayed through a
 * signed URL — and a signed URL expires. Storing one inside the note body would
 * therefore write an image that works today and 404s next week.
 *
 * So the storage path is the source of truth, kept in `data-path`, and `src` is
 * treated as disposable: dehydrate() puts the path back into src before saving,
 * hydrate() swaps in a fresh signed URL each time the note is opened. Anything
 * without a data-path (an image pasted in by URL) is left alone.
 */
const PATH_ATTR = 'data-path'

function parse(html: string): Document {
  return new DOMParser().parseFromString(html || '', 'text/html')
}

export async function hydrateNoteImages(html: string): Promise<string> {
  if (!html.includes('<img')) return html
  const doc = parse(html)
  const images = Array.from(doc.querySelectorAll('img'))
  const paths = images.map((img) => img.getAttribute(PATH_ATTR)).filter((p): p is string => Boolean(p))
  if (paths.length === 0) return html

  const urls = await signedUrlMap(Array.from(new Set(paths)))
  for (const img of images) {
    const path = img.getAttribute(PATH_ATTR)
    if (!path) continue
    const url = urls.get(path)
    // A path that will not sign (deleted from the bucket, say) keeps its node so the
    // note structure is preserved rather than silently losing a paragraph's worth of
    // content — the broken image is the honest signal.
    if (url) img.setAttribute('src', url)
  }
  return doc.body.innerHTML
}

export function dehydrateNoteImages(html: string): string {
  if (!html.includes('<img')) return html
  const doc = parse(html)
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const path = img.getAttribute(PATH_ATTR)
    if (path) img.setAttribute('src', path)
  }
  return doc.body.innerHTML
}

/** Every storage path referenced by a note body — used to clean up on delete. */
export function imagePathsIn(html: string): string[] {
  if (!html.includes('<img')) return []
  const doc = parse(html)
  return Array.from(doc.querySelectorAll('img'))
    .map((img) => img.getAttribute(PATH_ATTR))
    .filter((p): p is string => Boolean(p))
}

/**
 * The plain-text mirror stored alongside the HTML so global search can match note
 * content without every reader parsing markup. Emits one line per block, and skips
 * any block that contains another so a task-list item (li > div > p) is not counted
 * twice.
 */
const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre'

export function htmlToText(html: string): string {
  if (!html) return ''
  const doc = parse(html)
  const lines: string[] = []
  for (const el of Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR))) {
    if (el.querySelector(BLOCK_SELECTOR)) continue
    const text = el.textContent?.replace(/\s+/g, ' ').trim()
    if (text) lines.push(text)
  }
  if (lines.length === 0) {
    const fallback = doc.body.textContent?.replace(/\s+/g, ' ').trim()
    return fallback ?? ''
  }
  return lines.join('\n')
}
