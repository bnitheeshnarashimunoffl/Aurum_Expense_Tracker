import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { compressImage } from '@/lib/image'
import { hydrateNoteImages, signedUrl, uploadImage } from '../lib/media'
import { useBackGuard } from '../hooks/useBackGuard'
import { TagChip } from './Primitives'
import type { Note, Tag } from '../lib/types'

const AUTOSAVE_DELAY = 700

/**
 * Carries the storage path alongside the src. The bucket is private, so src holds a
 * signed URL that expires within the hour — the path is the only durable reference,
 * and lib/media.ts swaps between the two on save and load.
 */
const PathImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-path': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-path'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['data-path'] ? { 'data-path': attributes['data-path'] as string } : {},
      },
    }
  },
})

type SaveState = 'idle' | 'saving' | 'saved'

export interface NoteEditorProps {
  note: Note
  tags: Tag[]
  onSave: (patch: { title?: string; body_html?: string }) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  onEditTags: () => void
  /** Renders on the teal ground when the note belongs to the Secret section. */
  teal?: boolean
  /** Which to-do this note is attached to, shown as the reverse of a cross-link. */
  linkedTodoTitles?: string[]
}

export default function NoteEditor({
  note,
  tags,
  onSave,
  onDelete,
  onClose,
  onEditTags,
  teal = false,
  linkedTodoTitles = [],
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ title?: string; body_html?: string }>({})

  useBackGuard(true, onClose)

  // Keeps the title box exactly as tall as its content, on every change and on the
  // first paint of a note that already has a long one.
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  /**
   * Autosave. The brief forbids an explicit save action, so every keystroke queues a
   * write and the queue is flushed after a pause. Patches accumulate into one object
   * so a title edit and a body edit inside the same pause become one round trip
   * rather than two racing ones.
   */
  const queueSave = useCallback(
    (patch: { title?: string; body_html?: string }) => {
      pendingRef.current = { ...pendingRef.current, ...patch }
      setSaveState('saving')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(async () => {
        const payload = pendingRef.current
        pendingRef.current = {}
        try {
          await onSave(payload)
          setSaveState('saved')
        } catch {
          setSaveState('idle')
        }
      }, AUTOSAVE_DELAY)
    },
    [onSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      PathImage.configure({ inline: false, allowBase64: false }),
      TaskList,
      /**
       * data-type is not decoration — it is what makes a checklist survive being
       * saved and reopened.
       *
       * TipTap 2.27 renders a task item as `<li data-checked="…">` but its parser
       * only recognises `li[data-type="taskItem"]`. Its own output therefore does
       * not round-trip through its own input: write a checklist, close the note,
       * open it again, and every checkbox has quietly become a plain bullet, with
       * the ticked/unticked state gone with it. Emitting the attribute the parser
       * looks for closes that loop.
       */
      TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'chr-prose min-h-[40vh] pb-32',
        'aria-label': 'Note body',
      },
    },
    onUpdate: ({ editor: instance }) => queueSave({ body_html: instance.getHTML() }),
  })

  /**
   * Loads the body exactly once per note. Deliberately not kept in sync with the
   * store afterwards: every autosave refreshes the notes list, and re-applying that
   * result into the editor would reset the cursor to the top mid-sentence.
   */
  const loadedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!editor || loadedIdRef.current === note.id) return
    loadedIdRef.current = note.id
    let cancelled = false
    hydrateNoteImages(note.body_html).then((html) => {
      if (!cancelled) editor.commands.setContent(html || '', false)
    })
    return () => {
      cancelled = true
    }
  }, [editor, note.id, note.body_html])

  // A note closed inside the autosave window must not lose those last keystrokes.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (Object.keys(pendingRef.current).length > 0) void onSave(pendingRef.current)
    },
    [onSave]
  )

  async function handleImage(file: File) {
    if (!editor) return
    setUploading(true)
    try {
      // Reuses Aurum's receipt compressor — a phone photo dropped into a note is
      // several megabytes otherwise, and this is a free-tier storage bucket.
      const blob = await compressImage(file)
      const path = await uploadImage(new File([blob], file.name, { type: blob.type }))
      const url = await signedUrl(path)
      if (url) {
        editor.chain().focus().setImage({ src: url, 'data-path': path } as { src: string }).run()
      }
    } catch {
      /* The note is unharmed; the image simply is not added. */
    } finally {
      setUploading(false)
    }
  }

  const ground = teal ? 'bg-chrTeal' : 'bg-chrBase'

  return (
    <div className={`chronicle-root fixed inset-0 z-50 flex flex-col ${ground}`}>
      {/* Header: back, save state, delete. */}
      <div
        className={`flex items-center gap-2 px-3 pb-2 ${ground}`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to notes"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span aria-live="polite" className="flex-1 text-[12px] text-ivoryDim">
          {uploading ? 'Adding image…' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
        </span>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[40px] rounded-card px-3 text-[13px] text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[40px] rounded-card bg-gold px-3 text-[13px] font-semibold text-chrBase focus:outline-none focus-visible:ring-2 focus-visible:ring-ivory"
            >
              Delete note
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete note"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M7 7l1 12.2a.8.8 0 0 0 .8.8h6.4a.8.8 0 0 0 .8-.8L17 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <Toolbar editor={editor} onPickImage={() => fileRef.current?.click()} teal={teal} />

      <div className="flex-1 overflow-y-auto px-5 pt-4">
        {/* A textarea rather than an input, so a long title wraps instead of being
            silently cut off at the right edge — which is what happened to "Seminar
            notes — memory and the archive", a perfectly ordinary title. It grows to
            fit and never scrolls, so it still behaves like a heading. */}
        <textarea
          ref={titleRef}
          rows={1}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            queueSave({ title: e.target.value })
          }}
          onKeyDown={(e) => {
            // Enter belongs to the body, not to a title that is only ever one line.
            if (e.key === 'Enter') {
              e.preventDefault()
              editor?.commands.focus('start')
            }
          }}
          placeholder="Title"
          aria-label="Note title"
          className="font-chronicle -mx-1.5 w-[calc(100%+0.75rem)] resize-none overflow-hidden rounded-[10px] bg-transparent px-1.5 text-[26px] font-semibold leading-tight text-ivory placeholder:text-ivoryDim/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        />

        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <TagChip key={tag.id} label={tag.label} />
          ))}
          <button
            type="button"
            onClick={onEditTags}
            className="min-h-[28px] rounded-full px-2 text-[11.5px] text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {tags.length === 0 ? '+ Add tags' : 'Edit'}
          </button>
        </div>

        {linkedTodoTitles.length > 0 && (
          <p className="mb-4 text-[12.5px] text-ivoryDim">
            Attached to {linkedTodoTitles.map((t) => `“${t}”`).join(', ')}
          </p>
        )}

        <EditorContent editor={editor} />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImage(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* ------------------------------------------------------------------------- */

interface ToolbarButtonProps {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // The editor loses its selection to a normal button press, and a formatting
      // command applied to no selection does nothing.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-[11px] px-2 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        active ? 'bg-gold font-semibold text-chrBase' : 'text-ivoryDim'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, onPickImage, teal }: { editor: Editor | null; onPickImage: () => void; teal: boolean }) {
  if (!editor) return null
  const c = () => editor.chain().focus()

  return (
    <div
      className={`sticky top-0 z-10 flex items-center gap-1 overflow-x-auto px-3 py-1.5 ${teal ? 'bg-chrTeal' : 'bg-chrBase'}`}
      style={{ borderBottom: `1px solid ${teal ? 'var(--chr-rule-teal)' : 'var(--chr-rule)'}` }}
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarButton label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        <span className="font-chronicle">H1</span>
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <span className="font-chronicle">H2</span>
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: teal ? 'var(--chr-rule-teal)' : 'var(--chr-rule)' }} />

      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <span className="font-chronicle italic">I</span>
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: teal ? 'var(--chr-rule-teal)' : 'var(--chr-rule)' }} />

      <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="4" cy="5.5" r="1.4" fill="currentColor" />
          <circle cx="4" cy="10" r="1.4" fill="currentColor" />
          <circle cx="4" cy="14.5" r="1.4" fill="currentColor" />
          <path d="M8 5.5h9M8 10h9M8 14.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <text x="1.4" y="7.4" fontSize="6.4" fill="currentColor">1</text>
          <text x="1.4" y="12.4" fontSize="6.4" fill="currentColor">2</text>
          <text x="1.4" y="17.2" fontSize="6.4" fill="currentColor">3</text>
          <path d="M8 5.5h9M8 10h9M8 14.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Checklist" active={editor.isActive('taskList')} onClick={() => c().toggleTaskList().run()}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="1.6" y="3.2" width="5" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.6 13.4l1.5 1.6 2.6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 5.7h8M9.5 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: teal ? 'var(--chr-rule-teal)' : 'var(--chr-rule)' }} />

      <ToolbarButton label="Insert image" onClick={onPickImage}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="2" y="3.6" width="16" height="12.8" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="1.5" fill="currentColor" />
          <path d="M3 14l4-4 3.5 3.5L13 11l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ToolbarButton>
    </div>
  )
}
