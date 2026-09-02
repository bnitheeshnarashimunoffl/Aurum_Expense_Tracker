import { Suspense, lazy } from 'react'
import type { NoteEditorProps } from './NoteEditor'

/**
 * The rich text editor is the heaviest thing in Meridian by a wide margin — TipTap
 * and ProseMirror together are larger than the rest of Chronicle put together. It is
 * also the one screen you reach by a deliberate tap, so it is split out and fetched
 * then, rather than being paid for on every cold start of the whole platform.
 */
const NoteEditor = lazy(() => import('./NoteEditor'))

export default function LazyNoteEditor(props: NoteEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          className={`chronicle-root fixed inset-0 z-50 flex items-center justify-center ${
            props.teal ? 'bg-chrTeal' : 'bg-chrBase'
          }`}
        >
          <span className="text-[13px] text-ivoryDim">Opening…</span>
        </div>
      }
    >
      <NoteEditor {...props} />
    </Suspense>
  )
}
