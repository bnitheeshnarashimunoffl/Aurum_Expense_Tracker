import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { todayISO } from '@/lib/format'
import { useTodos } from '../hooks/useTodos'
import { useNotes } from '../hooks/useNotes'
import { useVoice } from '../hooks/useVoice'
import { useTags } from '../hooks/useTags'
import { useLinks } from '../hooks/useLinks'
import { useRecorder } from '../hooks/useRecorder'
import { useAutoLock, useSecretPin } from '../hooks/useSecretPin'
import { searchAll } from '../lib/search'
import { CaptureButton, SearchField, TabBar, type ChronicleTab } from '../components/HomeChrome'
import { NoteRow, SectionHeading, TodoRow, VoiceRow } from '../components/ListRows'
import { EmptyState, TagChip } from '../components/Primitives'
import SearchResults from '../components/SearchResults'
import NoteEditor from '../components/LazyNoteEditor'
import TodoSheet from '../components/TodoSheet'
import NewTodoSheet from '../components/NewTodoSheet'
import VoiceSheet from '../components/VoiceSheet'
import ChronicleSheet from '../components/ChronicleSheet'
import TagPicker from '../components/TagPicker'
import RecordingBar from '../components/RecordingBar'
import SecretSection from '../components/SecretSection'
import QuillIcon from '../components/QuillIcon'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'
import type { ItemType, Priority, Todo } from '../lib/types'

const TAB_KEY = 'chronicle.tab'
const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ChronicleHome() {
  const todos = useTodos()
  const notes = useNotes(false)
  const voice = useVoice()
  const tagStore = useTags()
  const links = useLinks()
  const recorder = useRecorder()
  const secret = useSecretPin()

  /** The brief asks for the last tab to be remembered between visits. */
  const [tab, setTab] = useState<ChronicleTab>(() => {
    const stored = localStorage.getItem(TAB_KEY)
    return stored === 'notes' || stored === 'voice' ? stored : 'todos'
  })
  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab)
  }, [tab])

  const [query, setQuery] = useState('')
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [todoSort, setTodoSort] = useState<'due' | 'priority'>('due')
  const [showCompleted, setShowCompleted] = useState(false)

  const [openTodoId, setOpenTodoId] = useState<string | null>(null)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [openVoiceId, setOpenVoiceId] = useState<string | null>(null)
  const [newTodoOpen, setNewTodoOpen] = useState(false)
  const [tagSheet, setTagSheet] = useState<{ type: ItemType; id: string } | null>(null)

  const [recorderVisible, setRecorderVisible] = useState(false)
  const [savingRecording, setSavingRecording] = useState(false)

  const [secretMode, setSecretMode] = useState<'setup' | 'unlocked' | null>(null)
  const lock = useCallback(() => setSecretMode(null), [])
  useAutoLock(secretMode !== null, lock)

  /* --------------------------------------------------------------------- */
  /* Secret entry — the search field is the door                            */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    const candidate = query.trim()
    if (!candidate || secretMode) return
    let cancelled = false

    if (secret.isBootstrap(candidate)) {
      setQuery('')
      setSecretMode('setup')
      return
    }
    // Checked on every keystroke rather than on submit: there is no submit, because
    // a "go" button next to the search field would be the advertisement the brief
    // says this entrance must not have.
    void secret.verify(candidate).then((ok) => {
      if (ok && !cancelled) {
        setQuery('')
        setSecretMode('unlocked')
      }
    })
    return () => {
      cancelled = true
    }
  }, [query, secret, secretMode])

  /* --------------------------------------------------------------------- */
  /* Filtering                                                              */
  /* --------------------------------------------------------------------- */
  const allowedIds = useMemo(
    () => (activeTagIds.length > 0 ? tagStore.idsWithAnyTag(activeTagIds) : null),
    [activeTagIds, tagStore]
  )
  const passes = useCallback((id: string) => allowedIds === null || allowedIds.has(id), [allowedIds])

  const searching = query.trim().length > 0
  const hits = useMemo(
    () =>
      searchAll({
        query,
        todos: todos.todos,
        notes: notes.notes,
        voice: voice.entries,
        allowedIds,
      }),
    [query, todos.todos, notes.notes, voice.entries, allowedIds]
  )

  /* --------------------------------------------------------------------- */
  /* To-do grouping                                                         */
  /* --------------------------------------------------------------------- */
  const today = todayISO()
  const openTodos = useMemo(() => todos.open.filter((t) => passes(t.id)), [todos.open, passes])
  const completedTodos = useMemo(() => todos.completed.filter((t) => passes(t.id)), [todos.completed, passes])

  const todoGroups = useMemo(() => {
    const byPriorityThenTitle = (a: Todo, b: Todo) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title)
    // Undated last: something with no date is not more urgent than something due today.
    const byDueThenPriority = (a: Todo, b: Todo) =>
      (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31') ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]

    if (todoSort === 'priority') {
      return (['HIGH', 'MEDIUM', 'LOW'] as Priority[])
        .map((priority) => ({
          key: priority,
          label: priority === 'HIGH' ? 'High' : priority === 'MEDIUM' ? 'Medium' : 'Low',
          items: openTodos.filter((t) => t.priority === priority).sort(byDueThenPriority),
        }))
        .filter((group) => group.items.length > 0)
    }

    const weekEnd = shiftDays(today, 7)
    return [
      { key: 'overdue', label: 'Overdue', items: openTodos.filter((t) => t.due_date && t.due_date < today) },
      { key: 'today', label: 'Today', items: openTodos.filter((t) => t.due_date === today) },
      {
        key: 'week',
        label: 'Next 7 days',
        items: openTodos.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekEnd),
      },
      { key: 'later', label: 'Later', items: openTodos.filter((t) => t.due_date && t.due_date > weekEnd) },
      { key: 'none', label: 'No date', items: openTodos.filter((t) => !t.due_date) },
    ]
      .map((group) => ({ ...group, items: group.items.sort(byPriorityThenTitle) }))
      .filter((group) => group.items.length > 0)
  }, [openTodos, todoSort, today])

  const visibleNotes = useMemo(() => notes.notes.filter((n) => passes(n.id)), [notes.notes, passes])
  const visibleVoice = useMemo(() => voice.entries.filter((v) => passes(v.id)), [voice.entries, passes])

  /* --------------------------------------------------------------------- */
  /* Actions                                                                */
  /* --------------------------------------------------------------------- */
  const openTodo = openTodoId ? (todos.todoById.get(openTodoId) ?? null) : null
  const openNote = notes.notes.find((n) => n.id === openNoteId) ?? null
  const openVoice = voice.entries.find((v) => v.id === openVoiceId) ?? null

  async function handleCapture() {
    if (tab === 'todos') return setNewTodoOpen(true)
    if (tab === 'notes') {
      const note = await notes.createNote()
      setOpenNoteId(note.id)
      return
    }
    setRecorderVisible(true)
    await recorder.start()
  }

  async function stopRecording() {
    const finished = await recorder.stop()
    setRecorderVisible(false)
    if (!finished) return
    setSavingRecording(true)
    try {
      // The entry lands at the top of the list with a pending transcript; the brief
      // requires transcription not to block, so nothing is awaited past the save.
      await voice.saveRecording(finished)
    } finally {
      setSavingRecording(false)
    }
  }

  function toggleTagFilter(tagId: string) {
    setActiveTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]))
  }

  function openHit(type: ItemType, id: string) {
    if (type === 'todo') setOpenTodoId(id)
    else if (type === 'note') setOpenNoteId(id)
    else setOpenVoiceId(id)
  }

  async function toggleItemTag(type: ItemType, itemId: string, tagId: string) {
    const current = tagStore.tagsFor(itemId).map((t) => t.id)
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    await tagStore.setItemTags(type, itemId, next)
  }

  const counts: Record<ChronicleTab, number> = {
    todos: openTodos.length,
    notes: visibleNotes.length,
    voice: visibleVoice.length,
  }

  /* --------------------------------------------------------------------- */

  return (
    <div className="px-5 pb-36">
      {/* pr-14 keeps the wordmark clear of the fixed sun-exit button. */}
      <header className="flex items-baseline gap-2.5 pb-4 pr-14 pt-6">
        <h1 className="font-chronicle text-[27px] font-semibold leading-none text-ivory">Chronicle</h1>
      </header>

      <SearchField value={query} onChange={setQuery} />

      <div className="pt-3">
        <TabBar active={tab} onChange={setTab} counts={counts} />
      </div>

      {/* Filter row — tag filtering applies to every tab; sorting is only meaningful
          for to-dos, so it only appears there. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
        {tab === 'todos' && !searching && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ivoryDim">Sort</span>
            {(['due', 'priority'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={todoSort === mode}
                onClick={() => setTodoSort(mode)}
                className={`min-h-[32px] rounded-full px-2.5 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  todoSort === mode ? 'text-ivory underline decoration-gold decoration-2 underline-offset-4' : 'text-ivoryDim'
                }`}
              >
                {mode === 'due' ? 'Due date' : 'Priority'}
              </button>
            ))}
          </div>
        )}

        {tagStore.tags.length > 0 && !searching && (
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="min-h-[32px] rounded-full text-[12px] text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {activeTagIds.length > 0 ? `Tags · ${activeTagIds.length}` : 'Filter by tag'}
          </button>
        )}
        {activeTagIds.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTagIds([])}
            className="min-h-[32px] rounded-full text-[12px] text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Clear
          </button>
        )}
      </div>

      {showFilters && !searching && tagStore.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2.5">
          {tagStore.tags.map((tag) => (
            <TagChip
              key={tag.id}
              label={tag.label}
              active={activeTagIds.includes(tag.id)}
              onClick={() => toggleTagFilter(tag.id)}
            />
          ))}
        </div>
      )}

      <div id="chronicle-panel" role="tabpanel" aria-labelledby={`chronicle-tab-${tab}`}>
        {searching ? (
          <SearchResults
            query={query}
            hits={hits}
            tags={tagStore.tags}
            activeTagIds={activeTagIds}
            onToggleTag={toggleTagFilter}
            onOpen={openHit}
          />
        ) : tab === 'todos' ? (
          <TodoPanel />
        ) : tab === 'notes' ? (
          <NotePanel />
        ) : (
          <VoicePanel />
        )}
      </div>

      <CaptureButton tab={tab} onCapture={() => void handleCapture()} />

      {/* ---- Overlays ---- */}
      <NewTodoSheet
        open={newTodoOpen}
        onClose={() => setNewTodoOpen(false)}
        onCreate={async (draft) => {
          await todos.createTodo(draft)
        }}
      />

      <TodoSheet
        todo={openTodo}
        open={Boolean(openTodo)}
        onClose={() => setOpenTodoId(null)}
        allTags={tagStore.tags}
        selectedTags={openTodo ? tagStore.tagsFor(openTodo.id) : []}
        onToggleTag={(tagId) => openTodo && void toggleItemTag('todo', openTodo.id, tagId)}
        onCreateTag={async (label) => {
          if (!openTodo) return
          const tag = await tagStore.createTag(label)
          await tagStore.setItemTags('todo', openTodo.id, [...tagStore.tagsFor(openTodo.id).map((t) => t.id), tag.id])
        }}
        onSave={async (patch) => {
          if (openTodo) await todos.updateTodo(openTodo.id, patch)
        }}
        onDelete={async () => {
          if (!openTodo) return
          await todos.deleteTodo(openTodo.id)
          setOpenTodoId(null)
        }}
        links={openTodo ? links.linksForTodo(openTodo.id) : []}
        notes={notes.notes}
        voice={voice.entries}
        onAttach={async (itemType, itemId) => {
          if (openTodo) await links.link(openTodo.id, itemType, itemId)
        }}
        onUnlink={links.unlink}
        onOpenLinked={(itemType, itemId) => {
          setOpenTodoId(null)
          if (itemType === 'note') setOpenNoteId(itemId)
          else setOpenVoiceId(itemId)
        }}
        onCreateLinkedNote={async () => {
          if (!openTodo) return
          const note = await notes.createNote()
          await links.link(openTodo.id, 'note', note.id)
          setOpenTodoId(null)
          setOpenNoteId(note.id)
        }}
      />

      {openNote && (
        <NoteEditor
          note={openNote}
          tags={tagStore.tagsFor(openNote.id)}
          onSave={(patch) => notes.saveNote(openNote.id, patch)}
          onDelete={async () => {
            await notes.deleteNote(openNote.id)
            setOpenNoteId(null)
          }}
          onClose={() => setOpenNoteId(null)}
          onEditTags={() => setTagSheet({ type: 'note', id: openNote.id })}
          linkedTodoTitles={links
            .todoIdsForItem(openNote.id)
            .map((id) => todos.todoById.get(id)?.title)
            .filter((t): t is string => Boolean(t))}
        />
      )}

      <VoiceSheet
        entry={openVoice}
        open={Boolean(openVoice)}
        onClose={() => setOpenVoiceId(null)}
        allTags={tagStore.tags}
        selectedTags={openVoice ? tagStore.tagsFor(openVoice.id) : []}
        onToggleTag={(tagId) => openVoice && void toggleItemTag('voice', openVoice.id, tagId)}
        onCreateTag={async (label) => {
          if (!openVoice) return
          const tag = await tagStore.createTag(label)
          await tagStore.setItemTags('voice', openVoice.id, [...tagStore.tagsFor(openVoice.id).map((t) => t.id), tag.id])
        }}
        onRename={async (title) => {
          if (openVoice) await voice.renameEntry(openVoice.id, title)
        }}
        onSaveTranscript={async (transcript) => {
          if (openVoice) await voice.saveTranscript(openVoice.id, transcript)
        }}
        onRetry={async () => {
          if (openVoice) await voice.retryTranscription(openVoice.id)
        }}
        onDelete={async () => {
          if (!openVoice) return
          await voice.deleteEntry(openVoice.id)
          setOpenVoiceId(null)
        }}
        linkedTodoTitles={
          openVoice
            ? links
                .todoIdsForItem(openVoice.id)
                .map((id) => todos.todoById.get(id)?.title)
                .filter((t): t is string => Boolean(t))
            : []
        }
      />

      <ChronicleSheet open={Boolean(tagSheet)} onClose={() => setTagSheet(null)} title="Tags">
        {tagSheet && (
          <TagPicker
            all={tagStore.tags}
            selected={tagStore.tagsFor(tagSheet.id)}
            onToggle={(tagId) => void toggleItemTag(tagSheet.type, tagSheet.id, tagId)}
            onCreate={async (label) => {
              const tag = await tagStore.createTag(label)
              await tagStore.setItemTags(tagSheet.type, tagSheet.id, [
                ...tagStore.tagsFor(tagSheet.id).map((t) => t.id),
                tag.id,
              ])
            }}
          />
        )}
      </ChronicleSheet>

      <AnimatePresence>
        {(recorderVisible || savingRecording) && (
          <RecordingBar
            state={recorder.state}
            elapsed={recorder.elapsed}
            saving={savingRecording}
            onStop={() => void stopRecording()}
            onCancel={() => {
              recorder.cancel()
              setRecorderVisible(false)
            }}
          />
        )}
      </AnimatePresence>

      {secretMode && (
        <SecretSection mode={secretMode} onLock={lock} onReady={() => setSecretMode('unlocked')} />
      )}

      {/* Never over the Secret Notes section, and — see src/onboarding/steps.ts —
          it does not mention that section exists. */}
      <ModuleWalkthrough module="chronicle" ready={!todos.loading && secretMode === null} />
    </div>
  )

  /* --------------------------------------------------------------------- */
  /* Panels — closures over the state above, so they stay next to it        */
  /* --------------------------------------------------------------------- */

  function TodoPanel() {
    if (todos.loading) return <ListSkeleton />
    if (todos.open.length === 0 && todos.completed.length === 0) {
      return (
        <EmptyState
          icon={<QuillIcon size={40} />}
          title="Nothing on the list"
          body="Chronicle keeps what you have to do next to what you wrote about it. Start with one thing."
        />
      )
    }
    if (openTodos.length === 0 && completedTodos.length === 0) {
      return <EmptyState title="No matches" body="Nothing carries the tags you filtered by." />
    }

    return (
      <div>
        {todoGroups.map((group) => (
          <section key={group.key}>
            <SectionHeading count={group.items.length}>{group.label}</SectionHeading>
            {group.items.map((todo) => (
              <div key={todo.id} style={{ borderBottom: '1px solid var(--chr-rule)' }}>
                <TodoRow
                  todo={todo}
                  tags={tagStore.tagsFor(todo.id)}
                  linkCount={links.linksForTodo(todo.id).length}
                  onToggle={() => void todos.complete(todo.id)}
                  onOpen={() => setOpenTodoId(todo.id)}
                />
              </div>
            ))}
          </section>
        ))}

        {completedTodos.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              aria-expanded={showCompleted}
              className="flex w-full items-center gap-3 pb-1 pt-7 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="font-chronicle text-[13px] font-medium tracking-wide text-ivoryDim">Completed</span>
              <span className="text-[11.5px] tabular-nums text-ivoryDim/70">{completedTodos.length}</span>
              <span className="h-px flex-1" style={{ background: 'var(--chr-rule)' }} />
              <span className="text-[11.5px] text-ivoryDim">{showCompleted ? 'Hide' : 'Show'}</span>
            </button>
            {showCompleted &&
              completedTodos.map((todo) => (
                <div key={todo.id} style={{ borderBottom: '1px solid var(--chr-rule)' }}>
                  <TodoRow
                    todo={todo}
                    tags={tagStore.tagsFor(todo.id)}
                    linkCount={links.linksForTodo(todo.id).length}
                    onToggle={() => void todos.uncomplete(todo.id)}
                    onOpen={() => setOpenTodoId(todo.id)}
                  />
                </div>
              ))}
          </section>
        )}
      </div>
    )
  }

  function NotePanel() {
    if (notes.loading) return <ListSkeleton />
    if (notes.notes.length === 0) {
      return (
        <EmptyState
          icon={<QuillIcon size={40} />}
          title="No notes yet"
          body="Anything worth keeping — a thought, a list, a page of working out. Notes and memos are the same thing here."
        />
      )
    }
    if (visibleNotes.length === 0) {
      return <EmptyState title="No matches" body="No note carries the tags you filtered by." />
    }
    return (
      <div className="pt-2">
        {visibleNotes.map((note) => (
          <div key={note.id} style={{ borderBottom: '1px solid var(--chr-rule)' }}>
            <NoteRow note={note} tags={tagStore.tagsFor(note.id)} onOpen={() => setOpenNoteId(note.id)} />
          </div>
        ))}
      </div>
    )
  }

  function VoicePanel() {
    if (voice.loading) return <ListSkeleton />
    if (voice.entries.length === 0) {
      return (
        <EmptyState
          icon={<QuillIcon size={40} />}
          title="Nothing recorded"
          body="Tap the microphone and talk. Chronicle saves the audio first and writes the transcript after, so nothing is lost if the transcription fails."
        />
      )
    }
    if (visibleVoice.length === 0) {
      return <EmptyState title="No matches" body="No recording carries the tags you filtered by." />
    }
    return (
      <div className="pt-2">
        {visibleVoice.map((entry) => (
          <div key={entry.id} style={{ borderBottom: '1px solid var(--chr-rule)' }}>
            <VoiceRow entry={entry} tags={tagStore.tagsFor(entry.id)} onOpen={() => setOpenVoiceId(entry.id)} />
          </div>
        ))}
      </div>
    )
  }
}

/** Placeholder rows at the shape of the real ones, so the first paint does not jump. */
function ListSkeleton() {
  return (
    <div className="space-y-3 pt-6" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="h-[22px] w-[22px] shrink-0 rounded-[8px]" style={{ background: 'var(--charcoal-shadow)' }} />
          <span
            className="h-3 rounded-full"
            style={{ background: 'var(--charcoal-shadow)', width: `${70 - i * 9}%` }}
          />
        </div>
      ))}
    </div>
  )
}
