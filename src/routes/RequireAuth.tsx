import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import LoadingRing from '@/components/LoadingRing'

export default function RequireAuth() {
  const { session, loading } = useAuth()

  // Hold on the branded loader until the session check resolves — never flash
  // protected content to a logged-out visitor.
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingRing label="Checking session" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
