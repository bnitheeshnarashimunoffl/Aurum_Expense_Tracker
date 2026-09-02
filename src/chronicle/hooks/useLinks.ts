import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId } from '../lib/media'
import type { LinkTarget, TodoLink } from '../lib/types'

const CHANNEL = 'chronicle_todo_links'

/**
 * Cross-links between a to-do and the notes / voice entries attached to it.
 *
 * Kept as its own hook because the relationship is read from BOTH ends: a to-do
 * shows what is attached to it, and a note or voice entry shows which to-do it
 * belongs to. One table, two indexes on the same rows.
 */
export function useLinks() {
  const [links, setLinks] = useState<TodoLink[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('chronicle_todo_links').select('*')
    setLinks((data ?? []) as TodoLink[])
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

  const byTodo = useMemo(() => {
    const map = new Map<string, TodoLink[]>()
    for (const link of links) {
      const list = map.get(link.todo_id)
      if (list) list.push(link)
      else map.set(link.todo_id, [link])
    }
    return map
  }, [links])

  /** The reverse direction: which to-dos does this note / voice entry belong to. */
  const byItem = useMemo(() => {
    const map = new Map<string, TodoLink[]>()
    for (const link of links) {
      const list = map.get(link.item_id)
      if (list) list.push(link)
      else map.set(link.item_id, [link])
    }
    return map
  }, [links])

  const linksForTodo = useCallback((todoId: string): TodoLink[] => byTodo.get(todoId) ?? [], [byTodo])
  const todoIdsForItem = useCallback(
    (itemId: string): string[] => (byItem.get(itemId) ?? []).map((l) => l.todo_id),
    [byItem]
  )

  async function link(todoId: string, itemType: LinkTarget, itemId: string) {
    const user_id = await currentUserId()
    // The unique constraint makes a repeat attach a no-op rather than a duplicate row.
    const { error } = await supabase
      .from('chronicle_todo_links')
      .upsert({ user_id, todo_id: todoId, item_type: itemType, item_id: itemId }, { onConflict: 'todo_id,item_type,item_id' })
    if (error) throw error
    await done()
  }

  /** Unlinking only removes the link row — the note or recording itself stays. */
  async function unlink(linkId: string) {
    const { error } = await supabase.from('chronicle_todo_links').delete().eq('id', linkId)
    if (error) throw error
    await done()
  }

  return { loading, links, linksForTodo, todoIdsForItem, link, unlink, refresh }
}
