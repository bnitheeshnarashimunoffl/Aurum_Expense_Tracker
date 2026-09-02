import { type ReactNode, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface VigilSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Vigil's equivalent of Aurum's <BottomSheet> — same spring slide-up, cream glass. */
export default function VigilSheet({ open, onClose, title, children }: VigilSheetProps) {
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
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(58, 46, 30, 0.34)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="vigil-glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-lg overflow-y-auto rounded-t-sheet pb-safe-bottom"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 340, damping: 26, mass: 0.9 }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full" style={{ background: 'var(--vigil-line)' }} />
            <div className="px-5 pb-6 pt-3">
              {title && <h2 className="font-display mb-4 text-lg font-semibold text-vigilInk">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
