import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeSync, syncNow, type SyncState } from '../lib/sync'

const LABEL: Record<SyncState, string> = {
  idle: 'Saved on device',
  syncing: 'Backing up…',
  offline: 'Offline — saved on device',
  synced: 'Backed up',
  error: 'Backup failed',
}

/**
 * Tells the user where their data currently lives. Loom writes to IndexedDB
 * first and always succeeds, so this never reports an error for the edit itself —
 * only for the background copy to Supabase. Being offline is shown as a normal
 * state, not a failure, because it is.
 */
export default function SyncBadge() {
  const [state, setState] = useState<SyncState>('idle')
  const [pending, setPending] = useState(0)

  useEffect(() => subscribeSync((next, count) => {
    setState(next)
    setPending(count)
  }), [])

  const dotColor =
    state === 'synced' ? 'var(--loom-gold)' : state === 'error' ? 'var(--loom-burgundy-soft)' : 'var(--loom-muted)'

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      aria-label={`${LABEL[state]}${pending > 0 ? `, ${pending} changes not yet backed up` : ''}. Tap to sync now.`}
      className="loom-neu-raised-sm flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            ...(state === 'syncing' ? { opacity: [1, 0.35, 1] } : {}),
          }}
          transition={state === 'syncing' ? { duration: 1.1, repeat: Infinity } : { duration: 0.2 }}
        />
      </AnimatePresence>
      <span className="text-[10px] tabular-nums text-loomMuted">{pending > 0 ? pending : ''}</span>
    </button>
  )
}
