import { Outlet } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'
import KindleNav from './KindleNav'

/**
 * Kindle's layout wrapper, mirroring Aurum's <AppShell>: shared shell chrome
 * (sun-exit) plus this module's own nav, on this module's own dark blue/purple
 * base rather than Aurum's near-black one.
 */
export default function KindleShell() {
  return (
    <div className="min-h-full bg-kindleBase text-primary">
      <div className="mx-auto min-h-full max-w-lg pb-28 pt-safe-top">
        <SunExitButton />
        <Outlet />
        <KindleNav />
      </div>
    </div>
  )
}
