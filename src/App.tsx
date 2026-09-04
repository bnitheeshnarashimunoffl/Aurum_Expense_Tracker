import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import RequireAuth from '@/routes/RequireAuth'
import RequireDataConnection from '@/routes/RequireDataConnection'
import InstallPrompt from '@/components/InstallPrompt'
import AppShell from '@/components/layout/AppShell'
import Login from '@/routes/Login'
import Signup from '@/routes/Signup'
import ForgotPassword from '@/routes/ForgotPassword'
import Launcher from '@/routes/Launcher'
import Dashboard from '@/routes/Dashboard'
import LoadingRing from '@/components/LoadingRing'
import PushNavigationBridge from '@/components/PushNavigationBridge'
import KindleShell from '@/kindle/components/KindleShell'
import KindleWeeklyGrid from '@/kindle/routes/WeeklyGrid'
import VigilShell from '@/vigil/components/VigilShell'
import VigilHome from '@/vigil/routes/Home'
import LoomShell from '@/loom/components/LoomShell'
import LoomTimetable from '@/loom/routes/Timetable'
import VirtusShell from '@/virtus/components/VirtusShell'
import VirtusHome from '@/virtus/routes/Home'
import ChronicleShell from '@/chronicle/components/ChronicleShell'
import ChronicleHome from '@/chronicle/routes/Home'

// Code-split screens that pull in heavier libraries (Recharts, html2pdf) so the
// first paint on a phone doesn't pay for report/export tooling upfront.
const TransactionsList = lazy(() => import('@/routes/TransactionsList'))
const ManagePresets = lazy(() => import('@/routes/ManagePresets'))
const Budgets = lazy(() => import('@/routes/Budgets'))
const Settings = lazy(() => import('@/routes/Settings'))
const ExportShare = lazy(() => import('@/routes/ExportShare'))
// Meridian's own settings — notification toggles and walkthrough replay. Platform
// level, above any single module, which is why it sits beside the launcher rather
// than inside one of the six shells.
const MeridianSettings = lazy(() => import('@/routes/MeridianSettings'))
// The first-run "connect your own Supabase project" walkthrough, and the screen
// that changes that connection later. Split out because most sessions never open
// either one — and the owner never sees them at all.
const SetupFlow = lazy(() => import('@/setup/SetupFlow'))
const ConnectionSettings = lazy(() => import('@/routes/ConnectionSettings'))
const Troubleshooting = lazy(() => import('@/routes/Troubleshooting'))
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
        {/* Brings up the per-user data project alongside the session. Inside
            AuthProvider because it needs the signed-in identity to know which
            project to open, and whether there is one to open at all. */}
        <DataProvider>
          {/* Routes a tapped notification to the right screen without a full reload. */}
          <PushNavigationBridge />
          {/* Android's own install prompt. iOS gets the Share-sheet banner instead;
              neither platform is ever shown the other's. */}
          <InstallPrompt />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route path="/" element={<RequireAuth />}>
                {/* These four sit OUTSIDE the data gate on purpose: they are how
                    someone with a missing or broken connection fixes it, and
                    putting them behind it would be a locked door with the key
                    shut inside. Troubleshooting especially — the screen that
                    links to it is itself the failure state. */}
                <Route path="setup" element={<SetupFlow />} />
                <Route path="settings" element={<MeridianSettings />} />
                <Route path="settings/connection" element={<ConnectionSettings />} />
                <Route path="settings/help" element={<Troubleshooting />} />

                {/* Everything below reads and writes module data, so none of it
                    can render until there is a database to read it from. */}
                <Route element={<RequireDataConnection />}>
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

                  {/* Chronicle module — to-dos, notes and voice, sixth module in the shell.
                      One route only: the three tabs are internal state, and the note editor
                      and Secret Notes section are overlays rather than routes so a secret
                      note never leaves an id in the URL or in history. */}
                  <Route path="chronicle" element={<ChronicleShell />}>
                    <Route index element={<ChronicleHome />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
          {/* Vercel Web Analytics — page views only, no cookies, no cross-site
              identifiers. It is inert anywhere but the Vercel deployment. */}
          <Analytics />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
