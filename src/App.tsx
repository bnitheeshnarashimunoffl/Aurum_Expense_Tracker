import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import RequireAuth from '@/routes/RequireAuth'
import AppShell from '@/components/layout/AppShell'
import Login from '@/routes/Login'
import Signup from '@/routes/Signup'
import ForgotPassword from '@/routes/ForgotPassword'
import Launcher from '@/routes/Launcher'
import Dashboard from '@/routes/Dashboard'
import LoadingRing from '@/components/LoadingRing'
import KindleShell from '@/kindle/components/KindleShell'
import KindleWeeklyGrid from '@/kindle/routes/WeeklyGrid'
import VigilShell from '@/vigil/components/VigilShell'
import VigilHome from '@/vigil/routes/Home'
import LoomShell from '@/loom/components/LoomShell'
import LoomTimetable from '@/loom/routes/Timetable'
import VirtusShell from '@/virtus/components/VirtusShell'
import VirtusHome from '@/virtus/routes/Home'

// Code-split screens that pull in heavier libraries (Recharts, html2pdf) so the
// first paint on a phone doesn't pay for report/export tooling upfront.
const TransactionsList = lazy(() => import('@/routes/TransactionsList'))
const ManagePresets = lazy(() => import('@/routes/ManagePresets'))
const Budgets = lazy(() => import('@/routes/Budgets'))
const Settings = lazy(() => import('@/routes/Settings'))
const ExportShare = lazy(() => import('@/routes/ExportShare'))
const KindleHistory = lazy(() => import('@/kindle/routes/History'))
const KindleSettings = lazy(() => import('@/kindle/routes/Settings'))
const VigilTopics = lazy(() => import('@/vigil/routes/Topics'))
const VigilSettings = lazy(() => import('@/vigil/routes/Settings'))
const LoomClasses = lazy(() => import('@/loom/routes/Classes'))
const LoomTerms = lazy(() => import('@/loom/routes/Terms'))
const VirtusTrain = lazy(() => import('@/virtus/routes/Train'))
const VirtusSettings = lazy(() => import('@/virtus/routes/Settings'))

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

            <Route path="/" element={<RequireAuth />}>
              {/* Meridian launcher — the shell's home screen. */}
              <Route index element={<Launcher />} />

              {/* Aurum module, nested under /aurum so future modules can sit alongside it. */}
              <Route path="aurum" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<TransactionsList />} />
                <Route path="presets" element={<ManagePresets />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="settings" element={<Settings />} />
                <Route path="export" element={<ExportShare />} />
              </Route>

              {/* Kindle module — daily habit tracker, second module inside the shell. */}
              <Route path="kindle" element={<KindleShell />}>
                <Route index element={<KindleWeeklyGrid />} />
                <Route path="history" element={<KindleHistory />} />
                <Route path="settings" element={<KindleSettings />} />
              </Route>

              {/* Vigil module — study timer + topic tree, third module in the shell. */}
              <Route path="vigil" element={<VigilShell />}>
                <Route index element={<VigilHome />} />
                <Route path="topics" element={<VigilTopics />} />
                <Route path="settings" element={<VigilSettings />} />
              </Route>

              {/* Loom module — offline-first class timetable, fourth module in the shell. */}
              <Route path="loom" element={<LoomShell />}>
                <Route index element={<LoomTimetable />} />
                <Route path="classes" element={<LoomClasses />} />
                <Route path="terms" element={<LoomTerms />} />
              </Route>

              {/* Virtus module — gym / strength training, fifth module in the shell. */}
              <Route path="virtus" element={<VirtusShell />}>
                <Route index element={<VirtusHome />} />
                <Route path="train" element={<VirtusTrain />} />
                <Route path="settings" element={<VirtusSettings />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
