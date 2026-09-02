// A 4-digit PIN only has 10,000 possible values, so hashing it buys very little
// against real brute force — it's here as basic hygiene (never store the raw PIN),
// not as the app's security boundary. The actual boundary is Supabase auth + RLS;
// this PIN is deliberate UI friction to slow down accidental past-day edits, not a
// second authentication factor.
function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return toHex(bytes.buffer)
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return toHex(digest)
}
