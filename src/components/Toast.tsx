import { AnimatePresence, motion } from 'framer-motion'

interface ToastProps {
  message: string | null
  tone?: 'default' | 'error'
}

export default function Toast({ message, tone = 'default' }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`glass fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full px-4 py-2.5 text-sm ${
            tone === 'error' ? 'text-expense' : 'text-primary'
          }`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
