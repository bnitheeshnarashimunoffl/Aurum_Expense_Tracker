import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import ProgressRing from './ProgressRing'
import TickBox from './TickBox'
import InlineAdd from './InlineAdd'
import { subtopicIdsInCategory, type CategoryNode, type NodeState, type SubjectNode } from '../lib/tree'

interface TopicTreeProps {
  tree: CategoryNode[]
  onSetCompleted: (ids: string[], completed: boolean) => void
  onAddCategory: (label: string) => Promise<void>
  /** Bumped by the empty state to open the category field. See InlineAdd.openToken. */
  addCategoryToken?: number
  onAddSubject: (categoryId: string, label: string) => Promise<void>
  onAddSubtopic: (subjectId: string, label: string) => Promise<void>
  onDeleteCategory: (id: string) => void
  onDeleteSubject: (id: string) => void
  onDeleteSubtopic: (id: string) => void
}

/**
 * Flashes once when a node newly reaches `complete` — the visible payoff for the
 * upward cascade. It watches the DERIVED state, so ticking the last subtopic in a
 * subject lights that subject, and if that was the category's last one, the
 * category lights too, in the same beat.
 */
function useCompletionPulse(state: NodeState): boolean {
  const [pulse, setPulse] = useState(false)
  const previous = useRef<NodeState | null>(null)

  useEffect(() => {
    if (previous.current !== null && previous.current !== 'complete' && state === 'complete') {
      setPulse(true)
      const id = window.setTimeout(() => setPulse(false), 900)
      return () => window.clearTimeout(id)
    }
    previous.current = state
  }, [state])

  useEffect(() => {
    previous.current = state
  }, [state])

  return pulse
}

/** Gold sweep across a row that has just completed. Purely decorative. */
function CompletionSweep({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 rounded-card"
          style={{
            background: 'linear-gradient(100deg, transparent 30%, rgba(188,138,63,0.28) 50%, transparent 70%)',
            backgroundSize: '250% 100%',
          }}
          initial={{ backgroundPosition: '120% 0', opacity: 0 }}
          animate={{ backgroundPosition: '-40% 0', opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: open ? 90 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </motion.svg>
  )
}

function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? `Confirm delete ${label}` : `Delete ${label}`}
      className={`flex h-7 flex-shrink-0 items-center justify-center rounded-full px-2 text-[10px] transition-colors ${
        armed ? 'bg-vigilGold text-vigilSurface' : 'text-vigilInkSoft opacity-45 hover:opacity-100'
      }`}
    >
      {armed ? 'Delete?' : '✕'}
    </button>
  )
}

function SubjectRow({
  node,
  onSetCompleted,
  onAddSubtopic,
  onDeleteSubject,
  onDeleteSubtopic,
}: {
  node: SubjectNode
  onSetCompleted: (ids: string[], completed: boolean) => void
  onAddSubtopic: (subjectId: string, label: string) => Promise<void>
  onDeleteSubject: (id: string) => void
  onDeleteSubtopic: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const pulse = useCompletionPulse(node.state)
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative overflow-hidden rounded-card">
      <CompletionSweep active={pulse} />
      <div className="flex items-center gap-3 py-2">
        <ProgressRing
          size={30}
          ratio={node.ratio}
          state={node.state}
          done={node.done}
          total={node.total}
          label={node.subject.label}
          onToggle={() =>
            onSetCompleted(
              node.subtopics.map((t) => t.id),
              node.state !== 'complete'
            )
          }
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="min-w-0 flex-1 truncate text-sm text-vigilInk">{node.subject.label}</span>
          <span className="flex-shrink-0 text-[11px] tabular-nums text-vigilInkSoft">
            {node.total === 0 ? 'empty' : `${node.done}/${node.total}`}
          </span>
          <span className="flex-shrink-0 text-vigilInkSoft">
            <Chevron open={open} />
          </span>
        </button>
        <DeleteButton label={node.subject.label} onConfirm={() => onDeleteSubject(node.subject.id)} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="ml-[42px] border-l pl-3.5" style={{ borderColor: 'var(--vigil-line)' }}>
              {node.subtopics.map((subtopic) => (
                <div key={subtopic.id} className="flex items-center gap-2.5 py-1.5">
                  <TickBox
                    checked={subtopic.completed}
                    label={subtopic.label}
                    onToggle={() => onSetCompleted([subtopic.id], !subtopic.completed)}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] transition-colors ${
                      subtopic.completed ? 'text-vigilInkSoft line-through' : 'text-vigilInk'
                    }`}
                  >
                    {subtopic.label}
                  </span>
                  <DeleteButton label={subtopic.label} onConfirm={() => onDeleteSubtopic(subtopic.id)} />
                </div>
              ))}
              <InlineAdd size="sm" placeholder="Add subtopic" onAdd={(label) => onAddSubtopic(node.subject.id, label)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TopicTree({
  tree,
  onSetCompleted,
  onAddCategory,
  addCategoryToken,
  onAddSubject,
  onAddSubtopic,
  onDeleteCategory,
  onDeleteSubject,
  onDeleteSubtopic,
}: TopicTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const reduceMotion = useReducedMotion()

  function toggleCategory(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3.5">
      {tree.map((node) => {
        const open = !collapsed.has(node.category.id)
        return <CategoryCard
          key={node.category.id}
          node={node}
          open={open}
          reduceMotion={Boolean(reduceMotion)}
          onToggleOpen={() => toggleCategory(node.category.id)}
          onSetCompleted={onSetCompleted}
          onAddSubject={onAddSubject}
          onAddSubtopic={onAddSubtopic}
          onDeleteCategory={onDeleteCategory}
          onDeleteSubject={onDeleteSubject}
          onDeleteSubtopic={onDeleteSubtopic}
        />
      })}

      <div className="vigil-neu-raised rounded-card px-4 py-2">
        <InlineAdd placeholder="Add category" onAdd={onAddCategory} openToken={addCategoryToken} />
      </div>
    </div>
  )
}

function CategoryCard({
  node,
  open,
  reduceMotion,
  onToggleOpen,
  onSetCompleted,
  onAddSubject,
  onAddSubtopic,
  onDeleteCategory,
  onDeleteSubject,
  onDeleteSubtopic,
}: {
  node: CategoryNode
  open: boolean
  reduceMotion: boolean
  onToggleOpen: () => void
  onSetCompleted: (ids: string[], completed: boolean) => void
  onAddSubject: (categoryId: string, label: string) => Promise<void>
  onAddSubtopic: (subjectId: string, label: string) => Promise<void>
  onDeleteCategory: (id: string) => void
  onDeleteSubject: (id: string) => void
  onDeleteSubtopic: (id: string) => void
}) {
  const pulse = useCompletionPulse(node.state)

  return (
    <section className="vigil-neu-raised relative overflow-hidden rounded-card px-4 py-3.5">
      <CompletionSweep active={pulse} />

      {/* A quiet fill along the card's foot, so a category's overall progress is
          readable without opening it or reading the count. */}
      <motion.span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left"
        style={{ background: 'var(--vigil-gold)' }}
        initial={false}
        animate={{ scaleX: node.ratio, opacity: node.ratio > 0 ? 1 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 26 }}
        aria-hidden
      />

      <div className="flex items-center gap-3">
        <ProgressRing
          size={38}
          ratio={node.ratio}
          state={node.state}
          done={node.done}
          total={node.total}
          label={node.category.label}
          onToggle={() => onSetCompleted(subtopicIdsInCategory(node), node.state !== 'complete')}
        />
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold text-vigilInk">
            {node.category.label}
          </span>
          <span className="flex-shrink-0 text-[11px] tabular-nums text-vigilInkSoft">
            {node.total === 0 ? 'empty' : `${node.done}/${node.total}`}
          </span>
          <span className="flex-shrink-0 text-vigilInkSoft">
            <Chevron open={open} />
          </span>
        </button>
        <DeleteButton label={node.category.label} onConfirm={() => onDeleteCategory(node.category.id)} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-1.5">
              {node.subjects.map((subject) => (
                <SubjectRow
                  key={subject.subject.id}
                  node={subject}
                  onSetCompleted={onSetCompleted}
                  onAddSubtopic={onAddSubtopic}
                  onDeleteSubject={onDeleteSubject}
                  onDeleteSubtopic={onDeleteSubtopic}
                />
              ))}
              <InlineAdd placeholder="Add subject" onAdd={(label) => onAddSubject(node.category.id, label)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
