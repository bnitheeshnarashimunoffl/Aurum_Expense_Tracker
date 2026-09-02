import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'
import { useAuth } from '@/context/AuthContext'
import { setLoomUserId } from '../lib/db'
import { startSyncLoop } from '../lib/sync'
import LoomNav from './LoomNav'

/**
 * Loom's layout wrapper, mirroring the other modules' shells. It also owns the
 * background sync loop for the whole module: mounting Loom starts it, leaving
 * Loom stops it, and nothing inside the module ever waits on it.
 */
export default function LoomShell() {
  const { session } = useAuth()

  useEffect(() => {
    if (session?.user?.id) setLoomUserId(session.user.id)
  }, [session?.user?.id])

  useEffect(() => startSyncLoop(), [])

  return (
    <div className="loom-root min-h-full bg-loomBase text-loomInk">
      <div className="mx-auto min-h-full max-w-lg pb-28 pt-safe-top">
        <SunExitButton tone="loom" />
        <Outlet />
        <LoomNav />
      </div>
    </div>
  )
}
