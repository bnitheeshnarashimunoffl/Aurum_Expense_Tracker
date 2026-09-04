import { useCallback, useEffect, useMemo, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId } from '../lib/media'
import type { ItemTag, ItemType, Tag } from '../lib/types'

export const TAG_CHANNEL = 'chronicle_tags'

/**
 * The one shared tag vocabulary, plus every attachment of a tag to an item.
 *
 * Both halves load together because they are never useful apart: a tag filter needs
 * the labels to render and the attachments to filter by, and splitting them into
 * two hooks would mean two refresh cycles that can disagree for a frame.
 */
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [itemTags, setItemTagRows] = useState<ItemTag[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [t, it] = await Promise.all([
      supabase.from('chronicle_tags').select('*'),
      supabase.from('chronicle_item_tags').select('*'),
    ])
    setTags(((t.data ?? []) as Tag[]).sort((a, b) => a.label.localeCompare(b.label)))
    setItemTagRows((it.data ?? []) as ItemTag[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe(TAG_CHANNEL, refresh)
  }, [refresh])

  async function done() {
    await refresh()
    notify(TAG_CHANNEL)
  }

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  /** item_id -> its tags, resolved and alphabetised, so a row can render directly. */
  const byItem = useMemo(() => {
    const map = new Map<string, Tag[]>()
    for (const link of itemTags) {
      const tag = tagById.get(link.tag_id)
      if (!tag) continue
      const list = map.get(link.item_id)
      if (list) list.push(tag)
      else map.set(link.item_id, [tag])
    }
    for (const list of map.values()) list.sort((a, b) => a.label.localeCompare(b.label))
    return map
  }, [itemTags, tagById])

  const tagsFor = useCallback((itemId: string): Tag[] => byItem.get(itemId) ?? [], [byItem])

  /** Every item id carrying any of the given tags — the tag filter's whole job. */
  const idsWithAnyTag = useCallback(
    (tagIds: string[]): Set<string> => {
      const wanted = new Set(tagIds)
      const ids = new Set<string>()
      for (const link of itemTags) if (wanted.has(link.tag_id)) ids.add(link.item_id)
      return ids
    },
    [itemTags]
  )

  /**
   * Creates a tag, or returns the existing one if the label is already taken. The
   * unique index is on lower(label), so inserting a case variant would fail with a
   * constraint error — matching locally first turns that into the behaviour the
   * user actually wants: typing "Uni" when "uni" exists picks up "uni".
   */
  async function createTag(label: string): Promise<Tag> {
    const trimmed = label.trim()
    if (!trimmed) throw new Error('Tag needs a name')
    const existing = tags.find((tag) => tag.label.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing

    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('chronicle_tags')
      .insert({ user_id, label: trimmed })
      .select('*')
      .single()
    if (error) throw error
    await done()
    return data as Tag
  }

  async function renameTag(id: string, label: string) {
    const trimmed = label.trim()
    if (!trimmed) throw new Error('Tag needs a name')
    const { error } = await supabase.from('chronicle_tags').update({ label: trimmed }).eq('id', id)
    if (error) throw error
    await done()
  }

  /** Removes the tag everywhere it was used. The items themselves are untouched —
   *  the schema cascades chronicle_item_tags only. */
  async function deleteTag(id: string) {
    const { error } = await supabase.from('chronicle_tags').delete().eq('id', id)
    if (error) throw error
    await done()
  }

  /**
   * Replaces an item's whole tag set in one call. Diffed rather than
   * delete-then-insert so an unchanged tag keeps its row — and so a failure part
   * way through cannot leave the item with no tags at all.
   */
  async function setItemTags(itemType: ItemType, itemId: string, tagIds: string[]) {
    const current = new Set(itemTags.filter((t) => t.item_id === itemId).map((t) => t.tag_id))
    const next = new Set(tagIds)

    const toAdd = tagIds.filter((id) => !current.has(id))
    const toRemove = Array.from(current).filter((id) => !next.has(id))

    if (toAdd.length > 0) {
      const user_id = await currentUserId()
      const { error } = await supabase
        .from('chronicle_item_tags')
        .insert(toAdd.map((tag_id) => ({ user_id, tag_id, item_type: itemType, item_id: itemId })))
      if (error) throw error
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('chronicle_item_tags')
        .delete()
        .eq('item_id', itemId)
        .in('tag_id', toRemove)
      if (error) throw error
    }
    if (toAdd.length > 0 || toRemove.length > 0) await done()
  }

  return { loading, tags, tagsFor, idsWithAnyTag, createTag, renameTag, deleteTag, setItemTags, refresh }
}
