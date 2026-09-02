import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { sortSlots } from '../lib/schedule'
import type { ClassPreset, ScheduleBlock, Term, TimeSlot } from '../lib/types'

/**
 * Every read in Loom comes through these hooks, and every one of them reads
 * IndexedDB rather than the network — which is what makes the module work with
 * no connection. Dexie's liveQuery re-runs them automatically whenever a local
 * write lands, including writes applied by a background sync pull, so the UI
 * stays current without any manual refresh plumbing.
 */

export function useTerms(): Term[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.terms.filter((t) => !t.deleted).toArray()
    return all.sort((a, b) => b.start_date.localeCompare(a.start_date))
  }, [])
}

export function useActiveTerm(): Term | null | undefined {
  return useLiveQuery(async () => {
    const found = await db.terms.filter((t) => !t.deleted && t.is_active === 1).toArray()
    return found[0] ?? null
  }, [])
}

export function useTerm(termId: string | undefined): Term | null | undefined {
  return useLiveQuery(async () => {
    if (!termId) return null
    return (await db.terms.get(termId)) ?? null
  }, [termId])
}

export function usePresets(termId: string | undefined): ClassPreset[] | undefined {
  return useLiveQuery(async () => {
    if (!termId) return []
    const rows = await db.presets.where('term_id').equals(termId).toArray()
    return rows.filter((p) => !p.deleted).sort((a, b) => a.title.localeCompare(b.title))
  }, [termId])
}

export function useSlots(termId: string | undefined): TimeSlot[] | undefined {
  return useLiveQuery(async () => {
    if (!termId) return []
    const rows = await db.slots.where('term_id').equals(termId).toArray()
    return sortSlots(rows.filter((s) => !s.deleted))
  }, [termId])
}

export function useBlocks(termId: string | undefined): ScheduleBlock[] | undefined {
  return useLiveQuery(async () => {
    if (!termId) return []
    const rows = await db.blocks.where('term_id').equals(termId).toArray()
    return rows.filter((b) => !b.deleted).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  }, [termId])
}

/** Preset lookup by id, so a grid cell can resolve its class without a scan. */
export function presetMap(presets: ClassPreset[] | undefined): Map<string, ClassPreset> {
  return new Map((presets ?? []).map((p) => [p.id, p]))
}
