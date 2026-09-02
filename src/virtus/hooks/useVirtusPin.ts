import { usePinTable } from '@/hooks/usePinTable'

/** Virtus's own row in the shared PIN storage shape — see src/hooks/usePinTable.ts. */
export function useVirtusPin() {
  return usePinTable('virtus_pin')
}
