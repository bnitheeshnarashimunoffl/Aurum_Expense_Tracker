import { Outlet } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'
import VirtusNav from './VirtusNav'

/**
 * Virtus's layout wrapper, mirroring Aurum's <AppShell> and the other modules'
 * shells: the shared sun-exit gesture plus this module's own nav, on marble.
 */
export default function VirtusShell() {
  return (
    <div className="min-h-full bg-marbleBase text-inkCharcoal">
      <div className="mx-auto min-h-full max-w-lg pb-28 pt-safe-top">
        <SunExitButton tone="virtus" />
        <Outlet />
        <VirtusNav />
      </div>
    </div>
  )
}
