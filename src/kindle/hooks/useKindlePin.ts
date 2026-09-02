import { usePinTable } from '@/hooks/usePinTable'

/**
 * Kindle's PIN, stored in kindle_pin. The load/set/verify logic is shared with
 * Vigil via usePinTable — only the table name differs.
 */
export function useKindlePin() {
  return usePinTable('kindle_pin')
}
