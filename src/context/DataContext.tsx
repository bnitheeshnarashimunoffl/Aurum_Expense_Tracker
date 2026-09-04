import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  connectData,
  getDataState,
  resetDataClient,
  subscribeToDataState,
  type DataFailure,
  type DataStatus,
} from '@/lib/dataClient'

/**
 * Brings the data connection up alongside the auth session, and tells the rest of
 * the app which of five states it is in.
 *
 * Deliberately a sibling of AuthContext rather than part of it: they answer
 * different questions ("who is this?" versus "where does their data live?"), they
 * fail independently, and only the second one has a setup flow behind it.
 */

interface DataConnectionState {
  status: DataStatus
  projectRef: string
  /** Why the last attempt failed, when it did. Shapes the help the user is offered. */
  failure: DataFailure
  /** Re-reads stored credentials and reconnects — used after setup and after a change. */
  reconnect: () => Promise<void>
}

const DataContext = createContext<DataConnectionState>({
  status: 'idle',
  projectRef: '',
  failure: null,
  reconnect: async () => {},
})

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const [state, setState] = useState(getDataState)
  // The connection attempt is async and the session can change under it (sign
  // out, token refresh). This is what stops a stale attempt from reporting back.
  const attemptRef = useRef(0)
  // Read through a ref rather than a dependency: supabase-js hands back a brand
  // new session OBJECT on every silent token refresh, so depending on it directly
  // would reconnect to the data project once an hour for no reason at all.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => subscribeToDataState(setState), [])

  const run = useCallback(async () => {
    const attempt = ++attemptRef.current
    await connectData(sessionRef.current)
    // A newer attempt started while this one was in flight; its result is the
    // current truth, so this one simply stops here.
    if (attempt !== attemptRef.current) return
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    if (loading) return
    if (!userId) {
      attemptRef.current++
      void resetDataClient()
      return
    }
    void run()
  }, [loading, userId, run])

  const reconnect = useCallback(async () => {
    await resetDataClient()
    await run()
  }, [run])

  return (
    <DataContext.Provider
      value={{ status: state.status, projectRef: state.projectRef, failure: state.failure, reconnect }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useDataConnection() {
  return useContext(DataContext)
}
