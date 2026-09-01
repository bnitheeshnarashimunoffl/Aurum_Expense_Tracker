import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import AddTransactionSheet from '../AddTransactionSheet'
import SunExitButton from '../SunExitButton'

export default function AppShell() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="mx-auto min-h-full max-w-lg pb-28 pt-safe-top">
      <SunExitButton />
      <Outlet />
      <BottomNav onAddClick={() => setAddOpen(true)} />
      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
