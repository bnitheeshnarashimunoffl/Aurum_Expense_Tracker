import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const showToast = useCallback((msg: string, durationMs = 2200) => {
    setMessage(msg)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessage(null), durationMs)
  }, [])

  return { message, showToast }
}
