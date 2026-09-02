import { AnimatePresence, motion } from 'framer-motion'

/** Mirrors Aurum's <Toast> on vigil-glass — Aurum's is hardcoded to its dark surface. */
export default function VigilToast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="vigil-glass fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm text-vigilInk"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
