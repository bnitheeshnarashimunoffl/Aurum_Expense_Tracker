import { useEffect, useRef, useState } from 'react'
import ChronicleSheet from './ChronicleSheet'
import { FIELD_CLASS, FieldLabel, PrimaryButton } from './Primitives'
import type { Priority } from '../lib/types'

interface NewTodoSheetProps {
  open: boolean
  onClose: () => void
  onCreate: (draft: { title: string; priority: Priority; due_date: string | null }) => Promise<void>
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH']
const LABEL: Record<Priority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' }

/**
 * Quick capture, not the full editor. Title, priority, due — everything else
 * (detail, repeat, tags, attachments) is in the detail sheet, one tap away on the
 * row that was just created.
 *
 * The brief makes capture the hero interaction, and the fastest capture is the one
 * where the only required field already has the cursor in it.
 */
export default function NewTodoSheet({ open, onClose, onCreate }: NewTodoSheetProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on BOTH edges, not just on open. Clearing only on the way in leaves the
  // last capture's priority and date sitting in state while the sheet is closed, so
  // anything that reads the form before the open effect has run — a reopen inside
  // the close animation, most obviously — sees the previous to-do's settings and
  // silently applies them to the next one.
  useEffect(() => {
    setTitle('')
    setPriority('MEDIUM')
    setDue('')
    if (!open) return
    // The sheet springs in; focusing before it lands makes the keyboard fight the
    // animation on a phone.
    const id = window.setTimeout(() => inputRef.current?.focus(), 240)
    return () => window.clearTimeout(id)
  }, [open])

  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      await onCreate({ title: title.trim(), priority, due_date: due || null })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ChronicleSheet open={open} onClose={onClose} title="New to-do">
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="new-todo-title">What needs doing</FieldLabel>
          <input
            id="new-todo-title"
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <FieldLabel>Priority</FieldLabel>
          <div role="group" aria-label="Priority" className="chr-neu-pressed-sm flex gap-1 rounded-card p-1">
            {PRIORITIES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={priority === option}
                onClick={() => setPriority(option)}
                className={`min-h-[38px] flex-1 rounded-[14px] text-[12.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  priority === option ? 'chr-neu-raised-teal font-semibold text-ivory' : 'text-ivoryDim'
                }`}
              >
                {LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="new-todo-due">Due (optional)</FieldLabel>
          <input
            id="new-todo-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <PrimaryButton full onClick={submit} disabled={!title.trim() || busy}>
          {busy ? 'Adding…' : 'Add to-do'}
        </PrimaryButton>
        <p className="text-center text-[11.5px] text-ivoryDim">
          Repeat, tags and attachments are on the to-do once it exists.
        </p>
      </div>
    </ChronicleSheet>
  )
}
