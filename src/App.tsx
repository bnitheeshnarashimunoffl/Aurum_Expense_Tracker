import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import RequireAuth from '@/routes/RequireAuth'
import AppShell from '@/components/layout/AppShell'
import Login from '@/routes/Login'
import Signup from '@/routes/Signup'
import ForgotPassword from '@/routes/ForgotPassword'
import Dashboard from '@/routes/Dashboard'
import LoadingRing from '@/components/LoadingRing'

// Code-split screens that pull in heavier libraries (Recharts, html2pdf) so the
// first paint on a phone doesn't pay for report/export tooling upfront.
const TransactionsList = lazy(() => import('@/routes/TransactionsList'))
const ManagePresets = lazy(() => import('@/routes/ManagePresets'))
const Budgets = lazy(() => import('@/routes/Budgets'))
const Settings = lazy(() => import('@/routes/Settings'))
const ExportShare = lazy(() => import('@/routes/ExportShare'))

function RouteFallback() {
  return <LoadingRing />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TransactionsList />} />
                <Route path="/presets" element={<ManagePresets />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/export" element={<ExportShare />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
