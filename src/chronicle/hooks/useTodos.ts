import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId } from '../lib/media'
import { successorFields } from '../lib/recurrence'
import { TAG_CHANNEL } from './useTags'
import type { Priority, Recurrence, Todo } from '../lib/types'

const CHANNEL = 'chronicle_todos'

export interface TodoDraft {
  title: string
  notes?: string
  priority?: Priority
  due_date?: string | null
  recurrence?: Recurrence | null
  recurrence_interval?: number | null
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const { data, error: e } = await supabase.from('chronicle_todos').select('*')
    if (e) setError(e.message)
    else {
      setTodos((data ?? []) as Todo[])
      setError(null)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  async function done() {
    await refresh()
    notify(CHANNEL)
  }

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos])

  const open = useMemo(() => todos.filter((t) => !t.is_complete), [todos])
  const completed = useMemo(
    () =>
      todos
        .filter((t) => t.is_complete)
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [todos]
  )

  async function createTodo(draft: TodoDraft): Promise<Todo> {
    const user_id = await currentUserId()
    const { data, error: e } = await supabase
      .from('chronicle_todos')
      .insert({
        user_id,
        title: draft.title.trim(),
        notes: draft.notes?.trim() ?? '',
        priority: draft.priority ?? 'MEDIUM',
        due_date: draft.due_date ?? null,
        recurrence: draft.recurrence ?? null,
        // The schema forbids an interval on a fixed cadence, so it is nulled here
        // rather than trusted from whatever the form last held.
        recurrence_interval: draft.recurrence === 'CUSTOM' ? (draft.recurrence_interval ?? 2) : null,
      })
      .select('*')
      .single()
    if (e) throw e
    await done()
    return data as Todo
  }

  async function updateTodo(id: string, patch: Partial<TodoDraft>) {
    const next: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.title !== undefined) next.title = patch.title.trim()
    if (patch.notes !== undefined) next.notes = patch.notes.trim()
    if (patch.priority !== undefined) next.priority = patch.priority
    if (patch.due_date !== undefined) next.due_date = patch.due_date
    if (patch.recurrence !== undefined) {
      next.recurrence = patch.recurrence
      next.recurrence_interval = patch.recurrence === 'CUSTOM' ? (patch.recurrence_interval ?? 2) : null
    } else if (patch.recurrence_interval !== undefined) {
      next.recurrence_interval = patch.recurrence_interval
    }
    const { error: e } = await supabase.from('chronicle_todos').update(next).eq('id', id)
    if (e) throw e
    await done()
  }

  async function deleteTodo(id: string) {
    const { error: e } = await supabase.from('chronicle_todos').delete().eq('id', id)
    if (e) throw e
    await done()
    // Its links cascade and its tag rows are cleaned by a trigger; the tag hook is
    // holding a now-stale copy of those rows, so tell it to refetch.
    notify(TAG_CHANNEL)
  }

  /**
   * Completes a to-do — and, if it recurs, creates the next occurrence.
   *
   * The completed row stays exactly as it was: the brief requires past occurrences
   * to remain in history rather than the series simply being marked done. The link
   * from the completed row to the one it generated (spawned_todo_id) is what makes
   * un-completing reversible below.
   */
  async function complete(id: string) {
    const todo = byId.get(id)
    if (!todo || todo.is_complete) return
    const now = new Date().toISOString()

    let spawnedId: string | null = null
    const successor = successorFields(todo)
    if (successor) {
      const user_id = await currentUserId()
      const { data, error: e } = await supabase
        .from('chronicle_todos')
        .insert({ user_id, ...successor })
        .select('id')
        .single()
      if (e) throw e
      spawnedId = (data as { id: string }).id

      // Tags and links follow the task, since a recurring to-do is the same task
      // each time — re-attaching its reference material every week would be busywork.
      await copyAttachments(todo.id, spawnedId, user_id)
    }

    const { error: e } = await supabase
      .from('chronicle_todos')
      .update({ is_complete: true, completed_at: now, spawned_todo_id: spawnedId, updated_at: now })
      .eq('id', id)
    if (e) throw e
    await done()
    if (spawnedId) notify(TAG_CHANNEL)
  }

  async function copyAttachments(fromId: string, toId: string, user_id: string) {
    const [tagRows, linkRows] = await Promise.all([
      supabase.from('chronicle_item_tags').select('tag_id').eq('item_type', 'todo').eq('item_id', fromId),
      supabase.from('chronicle_todo_links').select('item_type, item_id').eq('todo_id', fromId),
    ])
    const tags = (tagRows.data ?? []) as { tag_id: string }[]
    if (tags.length > 0) {
      await supabase
        .from('chronicle_item_tags')
        .insert(tags.map((t) => ({ user_id, tag_id: t.tag_id, item_type: 'todo', item_id: toId })))
    }
    const links = (linkRows.data ?? []) as { item_type: string; item_id: string }[]
    if (links.length > 0) {
      await supabase
        .from('chronicle_todo_links')
        .insert(links.map((l) => ({ user_id, todo_id: toId, item_type: l.item_type, item_id: l.item_id })))
    }
  }

  /**
   * Un-completes a to-do, withdrawing the occurrence it generated.
   *
   * Ticking a recurring to-do by accident and untucking it again should leave the
   * list as it was; without this, every mis-tap would leave behind a duplicate
   * occurrence the user has to hunt down. The successor is only withdrawn if it is
   * still untouched (not itself completed) — once it has been acted on it is real
   * history, and deleting it would be destroying work.
   */
  async function uncomplete(id: string) {
    const todo = byId.get(id)
    if (!todo || !todo.is_complete) return

    if (todo.spawned_todo_id) {
      const successor = byId.get(todo.spawned_todo_id)
      if (successor && !successor.is_complete) {
        await supabase.from('chronicle_todos').delete().eq('id', successor.id)
      }
    }

    const { error: e } = await supabase
      .from('chronicle_todos')
      .update({
        is_complete: false,
        completed_at: null,
        spawned_todo_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (e) throw e
    await done()
    notify(TAG_CHANNEL)
  }

  return {
    loading,
    error,
    todos,
    open,
    completed,
    todoById: byId,
    createTodo,
    updateTodo,
    deleteTodo,
    complete,
    uncomplete,
    refresh,
  }
}
