import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNotes } from '../hooks/useNotes'
import { useTags } from '../hooks/useTags'
import { MIN_PIN_LENGTH, useSecretPin } from '../hooks/useSecretPin'
import { searchAll } from '../lib/search'
import { noteLabel, type Note } from '../lib/types'
import NoteEditor from './LazyNoteEditor'
import ChronicleSheet from './ChronicleSheet'
import TagPicker from './TagPicker'
import { SearchField } from './HomeChrome'
import { NoteRow } from './ListRows'
import { EmptyState, FIELD_CLASS, FieldLabel, PrimaryButton, QuietButton } from './Primitives'

interface SecretSectionProps {
  /** 'setup' when no PIN exists yet and the bootstrap phrase was typed. */
  mode: 'setup' | 'unlocked'
  onLock: () => void
  onReady: () => void
}

/**
 * The Secret Notes section: notes only, on the teal ground.
 *
 * The ground changing colour is the whole visual argument — no banner, no badge,
 * no lock icon plastered across the screen. You are somewhere else, and you can
 * see that without being told, which suits a section whose entrance is deliberately
 * unadvertised.
 *
 * It mounts only while unlocked, so useNotes(true) is the only place secret notes
 * are ever fetched; locking unmounts this and the rows leave memory with it.
 */
export default function SecretSection({ mode, onLock, onReady }: SecretSectionProps) {
  const reduceMotion = useReducedMotion()
  const { notes, createNote, saveNote, deleteNote } = useNotes(true)
  const { tags, tagsFor, createTag, setItemTags } = useTags()
  const { hasPin, setPin, changePin } = useSecretPin()

  const [query, setQuery] = useState('')
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [tagSheetFor, setTagSheetFor] = useState<string | null>(null)
  const [showChangePin, setShowChangePin] = useState(false)

  const openNote = notes.find((n) => n.id === openNoteId) ?? null

  /** Search inside the section searches secret notes only — the array it is handed
   *  contains nothing else. */
  const hits = useMemo(
    () => searchAll({ query, todos: [], notes, voice: [], allowedIds: null }),
    [query, notes]
  )
  const visible: Note[] = query.trim()
    ? hits.map((hit) => notes.find((n) => n.id === hit.id)).filter((n): n is Note => Boolean(n))
    : notes

  if (mode === 'setup' && !hasPin) {
    return <SecretSetup onDone={async (pin) => { await setPin(pin); onReady() }} onCancel={onLock} />
  }

  async function handleNew() {
    const note = await createNote()
    setOpenNoteId(note.id)
  }

  return (
    <motion.div
      className="chronicle-root fixed inset-0 z-[60] overflow-y-auto bg-chrTeal"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="mx-auto max-w-lg px-5 pb-32 pt-safe-top">
        <header className="flex items-baseline gap-3 pb-4 pt-6">
          <h1 className="font-chronicle text-[26px] font-semibold leading-none text-ivory">Private</h1>
          <span className="text-[12.5px] text-ivory/70">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
          <button
            type="button"
            onClick={onLock}
            className="ml-auto min-h-[40px] rounded-card px-3 text-[13px] text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Lock
          </button>
        </header>

        <SearchField value={query} onChange={setQuery} placeholder="Search private notes" teal />

        <div className="pt-2">
          {visible.length === 0 ? (
            <EmptyState
              title={query.trim() ? 'Nothing matches that' : 'Nothing kept here yet'}
              body={
                query.trim()
                  ? 'This search only looks at private notes.'
                  : 'Notes written here never appear in the normal list or in search. Tap the plus to start one.'
              }
            />
          ) : (
            visible.map((note) => (
              <div key={note.id} style={{ borderBottom: '1px solid var(--chr-rule-teal)' }}>
                <NoteRow note={note} tags={tagsFor(note.id)} onOpen={() => setOpenNoteId(note.id)} />
              </div>
            ))
          )}
        </div>

        <div className="pt-8">
          <button
            type="button"
            onClick={() => setShowChangePin(true)}
            className="min-h-[40px] text-[13px] text-ivory/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Change PIN
          </button>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg">
        <button
          type="button"
          onClick={handleNew}
          aria-label="New private note"
          className="chr-neu-raised-teal pointer-events-auto absolute right-5 flex h-[58px] w-[58px] items-center justify-center rounded-full ring-1 ring-inset ring-gold/25 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="var(--gold-primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {openNote && (
        <NoteEditor
          note={openNote}
          teal
          tags={tagsFor(openNote.id)}
          onSave={(patch) => saveNote(openNote.id, patch)}
          onDelete={async () => {
            await deleteNote(openNote.id)
            setOpenNoteId(null)
          }}
          onClose={() => setOpenNoteId(null)}
          onEditTags={() => setTagSheetFor(openNote.id)}
        />
      )}

      <ChronicleSheet open={Boolean(tagSheetFor)} onClose={() => setTagSheetFor(null)} title="Tags" teal>
        {tagSheetFor && (
          <TagPicker
            all={tags}
            selected={tagsFor(tagSheetFor)}
            onToggle={(tagId) => {
              const current = tagsFor(tagSheetFor).map((t) => t.id)
              const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
              void setItemTags('note', tagSheetFor, next)
            }}
            onCreate={async (label) => {
              const tag = await createTag(label)
              await setItemTags('note', tagSheetFor, [...tagsFor(tagSheetFor).map((t) => t.id), tag.id])
            }}
          />
        )}
      </ChronicleSheet>

      <ChangePinSheet
        open={showChangePin}
        onClose={() => setShowChangePin(false)}
        onSubmit={async (current, next) => {
          await changePin(current, next)
          setShowChangePin(false)
        }}
      />
    </motion.div>
  )
}

/* ------------------------------------------------------------------------- */
/* First-time setup                                                           */
/* ------------------------------------------------------------------------- */

function SecretSetup({ onDone, onCancel }: { onDone: (pin: string) => Promise<void>; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (pin.length < MIN_PIN_LENGTH) return setError(`Use at least ${MIN_PIN_LENGTH} characters.`)
    if (pin !== confirm) return setError('The two entries do not match.')
    setBusy(true)
    try {
      await onDone(pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chronicle-root fixed inset-0 z-[60] overflow-y-auto bg-chrTeal">
      <div className="mx-auto max-w-lg px-5 pb-20 pt-safe-top">
        <h1 className="font-chronicle pt-10 text-[26px] font-semibold leading-tight text-ivory">Set a private PIN</h1>
        <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ivory/80">
          Typing this into the search field is how you get back here. Nothing else opens it, and it is not the PIN any
          other Meridian module uses.
        </p>
        <p className="mt-3 max-w-[46ch] text-[12.5px] leading-relaxed text-ivory/60">
          Worth being straight about: this hides the section, it does not encrypt it. Anyone already signed in to this
          account could reach the notes another way. Treat it as a closed door, not a safe.
        </p>

        <div className="mt-7 space-y-4">
          <div>
            <FieldLabel htmlFor="secret-pin">PIN or passphrase</FieldLabel>
            <input
              id="secret-pin"
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError(null)
              }}
              autoComplete="new-password"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <FieldLabel htmlFor="secret-pin-confirm">Type it again</FieldLabel>
            <input
              id="secret-pin-confirm"
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setError(null)
              }}
              autoComplete="new-password"
              className={FIELD_CLASS}
            />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-gold">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <QuietButton full onClick={onCancel}>
              Not now
            </QuietButton>
            <PrimaryButton full onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Set PIN'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Change PIN                                                                 */
/* ------------------------------------------------------------------------- */

function ChangePinSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (current: string, next: string) => Promise<void>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <ChronicleSheet
      open={open}
      teal
      title="Change PIN"
      onClose={() => {
        setCurrent('')
        setNext('')
        setError(null)
        onClose()
      }}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="pin-current">Current PIN</FieldLabel>
          <input id="pin-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={FIELD_CLASS} />
        </div>
        <div>
          <FieldLabel htmlFor="pin-next">New PIN</FieldLabel>
          <input id="pin-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={FIELD_CLASS} />
        </div>
        {error && (
          <p role="alert" className="text-[13px] text-gold">
            {error}
          </p>
        )}
        <PrimaryButton
          full
          onClick={async () => {
            setError(null)
            try {
              await onSubmit(current, next)
              setCurrent('')
              setNext('')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not change it.')
            }
          }}
        >
          Change PIN
        </PrimaryButton>
      </div>
    </ChronicleSheet>
  )
}
