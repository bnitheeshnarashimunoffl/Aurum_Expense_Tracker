/**
 * Works out WHY a user's Supabase project is not answering — specifically,
 * whether it has been paused.
 *
 * WHY THIS IS THE ONE FAILURE MERIDIAN DIAGNOSES. Everywhere else the app
 * deliberately refuses to guess at a connection error, because a stranger cannot
 * act on "PGRST301" and the honest advice is always the same sentence. Pausing is
 * different on every count: Supabase suspends a free project after roughly a week
 * with no traffic, which describes almost everyone who tries an app and does not
 * open it daily; the user has done nothing wrong; and the fix is one button in
 * their own dashboard. Staying silent about the single most likely cause, when it
 * is also the most fixable, is not restraint — it is just unhelpful.
 *
 * HOW CONFIDENT THIS CAN BE. Supabase answers a request to a paused project from
 * its own gateway rather than from the project, with a distinctive status (540 in
 * every case seen, sometimes 503) and usually the word "paused" in the body. When
 * that response is readable, this says so outright.
 *
 * It is often NOT readable. A gateway error page is not obliged to carry the CORS
 * headers a cross-origin fetch needs, and when it does not, the browser refuses to
 * show the response at all and the fetch simply rejects — indistinguishable, from
 * in here, from being offline or from a project that has been deleted. So
 * `unreachable` is a real and expected outcome, and the UI treats it as "most
 * likely paused" rather than pretending to certainty it does not have.
 */

export type ProjectHealth =
  /** The device has no network at all. Nothing to do with their project. */
  | 'offline'
  /** Confirmed paused: the gateway said so in a response we could read. */
  | 'paused'
  /** No usable answer. Most likely paused, possibly deleted, possibly a bad URL. */
  | 'unreachable'
  /** The project answered. Whatever is wrong is not that it is down. */
  | 'reachable'

/** Statuses Supabase's gateway uses for a suspended project. 540 is its own invention. */
const PAUSED_STATUSES = new Set([540, 503])

/** Long enough for a cold gateway, short enough that nobody watches a spinner. */
const PROBE_TIMEOUT_MS = 8000

export async function probeProject(url: string, anonKey: string): Promise<ProjectHealth> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    // The REST root, which answers without touching any table — so this cannot be
    // confused with a schema problem, and costs the user's project nothing.
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (PAUSED_STATUSES.has(response.status)) return 'paused'

    // Some gateway responses come back 200 with an explanatory page rather than
    // the API's own JSON. Reading the body is cheap and settles it.
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      if (/paus(ed|ing)/i.test(body)) return 'paused'
      // 401 and 404 both mean the project is up and talking — an anon request to
      // the REST root is expected to be refused, not served.
      if (response.status === 401 || response.status === 404) return 'reachable'
      return 'unreachable'
    }

    return 'reachable'
  } catch {
    // Aborted, DNS gone, or — most often — a gateway error page the browser would
    // not let us read for want of CORS headers. All of them land here, which is
    // exactly why the copy for this case hedges.
    return 'unreachable'
  } finally {
    clearTimeout(timer)
  }
}

/** Where to send someone to press Restore. Their project, their dashboard. */
export function dashboardUrl(projectRef: string): string {
  return projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : 'https://supabase.com/dashboard'
}
