import { Outlet } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'
import VigilNav from './VigilNav'

/**
 * Vigil's layout wrapper, mirroring Aurum's <AppShell> and Kindle's <KindleShell>:
 * shared shell chrome (the sun-exit gesture) plus this module's own nav, on this
 * module's warm cream base rather than either of the dark ones.
 */
export default function VigilShell() {
  return (
    <div className="min-h-full bg-vigilBase text-vigilInk">
      <div className="mx-auto min-h-full max-w-lg pb-28 pt-safe-top">
        <SunExitButton tone="light" />
        <Outlet />
        <VigilNav />
      </div>
    </div>
  )
}
