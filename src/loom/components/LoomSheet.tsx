import { type ReactNode, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface LoomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Loom's bottom sheet — same spring and geometry as the other modules', on gunmetal glass. */
export default function LoomSheet({ open, onClose, title, children }: LoomSheetProps) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="loom-glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-lg overflow-y-auto rounded-t-sheet pb-safe-bottom"
            // dvh, unlike vh, shrinks when Android's soft keyboard opens (see the
            // interactive-widget viewport meta in index.html), so a sheet with a text
            // field in it stays fully reachable instead of being pushed behind it. The
            // 88vh class above is the fallback wherever dvh is not understood.
            style={{ maxHeight: '88dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 340, damping: 26, mass: 0.9 }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full" style={{ background: 'var(--loom-line)' }} />
            <div className="px-5 pb-6 pt-3">
              {title && <h2 className="font-display mb-4 text-lg font-semibold text-loomInk">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
