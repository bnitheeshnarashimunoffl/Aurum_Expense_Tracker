import { Outlet } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'

/**
 * Chronicle's layout wrapper, mirroring the other five modules' shells: the shared
 * sun-exit gesture on this module's own ground.
 *
 * There is no bottom nav here, unlike Kindle, Vigil, Loom and Virtus. Chronicle's
 * navigation is the three tabs the brief lays out, directly under the search field
 * — a bottom bar as well would be two navigations for one screen, and would take
 * the thumb space the capture action needs.
 */
export default function ChronicleShell() {
  return (
    <div className="chronicle-root min-h-full bg-chrBase font-body text-ivory">
      <div className="mx-auto min-h-full max-w-lg pt-safe-top">
        <SunExitButton tone="chronicle" />
        <Outlet />
      </div>
    </div>
  )
}
