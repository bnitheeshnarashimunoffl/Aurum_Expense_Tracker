import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { subscribe, notify } from '@/lib/sync'
import { buildTree, type CategoryNode } from '../lib/tree'
import type { VigilCategory, VigilSubject, VigilSubtopic } from '../lib/types'

export function useTopics() {
  const [categories, setCategories] = useState<VigilCategory[]>([])
  const [subjects, setSubjects] = useState<VigilSubject[]>([])
  const [subtopics, setSubtopics] = useState<VigilSubtopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const [c, s, t] = await Promise.all([
      supabase.from('vigil_categories').select('*'),
      supabase.from('vigil_subjects').select('*'),
      supabase.from('vigil_subtopics').select('*'),
    ])
    const failure = c.error ?? s.error ?? t.error
    if (failure) setError(failure.message)
    else {
      setCategories((c.data ?? []) as VigilCategory[])
      setSubjects((s.data ?? []) as VigilSubject[])
      setSubtopics((t.data ?? []) as VigilSubtopic[])
      setError(null)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe('vigil_topics', refresh)
  }, [refresh])

  /** Parent progress is derived here, never stored — see lib/tree.ts. */
  const tree: CategoryNode[] = useMemo(
    () => buildTree(categories, subjects, subtopics),
    [categories, subjects, subtopics]
  )

  async function currentUserId(): Promise<string> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('Not signed in')
    return data.user.id
  }

  const nextPosition = (items: { position: number }[]) =>
    items.reduce((max, i) => Math.max(max, i.position), -1) + 1

  async function addCategory(label: string) {
    const user_id = await currentUserId()
    const { error: e } = await supabase
      .from('vigil_categories')
      .insert({ user_id, label, position: nextPosition(categories) })
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  async function addSubject(categoryId: string, label: string) {
    const user_id = await currentUserId()
    const siblings = subjects.filter((s) => s.category_id === categoryId)
    const { error: e } = await supabase
      .from('vigil_subjects')
      .insert({ user_id, category_id: categoryId, label, position: nextPosition(siblings) })
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  async function addSubtopic(subjectId: string, label: string) {
    const user_id = await currentUserId()
    const siblings = subtopics.filter((t) => t.subject_id === subjectId)
    const { error: e } = await supabase
      .from('vigil_subtopics')
      .insert({ user_id, subject_id: subjectId, label, position: nextPosition(siblings), completed: false })
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  /**
   * The single write path for every check in the tree. Checking one subtopic, a
   * whole subject, or a whole category all come through here as "set these leaf
   * ids to this value" — the downward cascade is just a longer id list, and the
   * upward cascade needs no write at all because parents are derived.
   *
   * Applied locally first so the rings start animating on the same frame as the tap.
   */
  const setSubtopicsCompleted = useCallback(async (ids: string[], completed: boolean) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const before = subtopics
    setSubtopics((prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, completed } : t)))
    const { error: e } = await supabase.from('vigil_subtopics').update({ completed }).in('id', ids)
    if (e) {
      setSubtopics(before)
      throw e
    }
    notify('vigil_topics')
  }, [subtopics])

  async function deleteCategory(id: string) {
    // Subjects and subtopics fall with it via ON DELETE CASCADE in the schema.
    const { error: e } = await supabase.from('vigil_categories').delete().eq('id', id)
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  async function deleteSubject(id: string) {
    const { error: e } = await supabase.from('vigil_subjects').delete().eq('id', id)
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  async function deleteSubtopic(id: string) {
    const { error: e } = await supabase.from('vigil_subtopics').delete().eq('id', id)
    if (e) throw e
    await refresh()
    notify('vigil_topics')
  }

  return {
    tree,
    loading,
    error,
    refresh,
    addCategory,
    addSubject,
    addSubtopic,
    setSubtopicsCompleted,
    deleteCategory,
    deleteSubject,
    deleteSubtopic,
  }
}
