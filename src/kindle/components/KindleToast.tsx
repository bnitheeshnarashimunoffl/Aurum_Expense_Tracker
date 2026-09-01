import { AnimatePresence, motion } from 'framer-motion'

interface KindleToastProps {
  message: string | null
  tone?: 'default' | 'error'
}

// Mirrors Aurum's <Toast> on kindle-glass — Aurum's is hardcoded to its near-black
// surface, which reads as a stray dark box on Kindle's blue base. Drives off the
// shared useToast hook, which is module-agnostic.
export default function KindleToast({ message, tone = 'default' }: KindleToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`kindle-glass fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm ${
            tone === 'error' ? 'text-expense' : 'text-primary'
          }`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
