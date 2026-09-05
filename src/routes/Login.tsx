import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { consumeOAuthError, signInWithGoogle } from '@/lib/oauth'
import { useAuth } from '@/context/AuthContext'
import GoogleSignInButton, { OrDivider } from '@/components/GoogleSignInButton'
import PasswordField from '@/components/PasswordField'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  /**
   * A failed Google sign-in comes back to `/`, which has no session, so
   * RequireAuth sends it here — and a redirect drops the query string carrying
   * the reason. main.tsx lifts it out of the URL on startup; this is where it
   * gets read back, which is why it arrives as an effect rather than as a prop.
   */
  useEffect(() => {
    const message = consumeOAuthError()
    if (message) setError(message)
  }, [])

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  /**
   * On success this never comes back — the tab is replaced by Google's consent
   * screen — so `googleBusy` is deliberately left on. Only the failure path,
   * where the hand-off itself was refused before any redirect happened, needs to
   * put the button back.
   */
  async function handleGoogle() {
    setError(null)
    setGoogleBusy(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error)
      setGoogleBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-safe-top">
      <div className="w-full max-w-sm">
        <h1 className="font-display mb-1 text-3xl font-bold text-primary">Meridian</h1>
        <p className="mb-8 text-sm text-muted">Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error && <p className="text-sm text-expense">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Below the form, not above it. Email and password is how every account
            on Meridian was made until now, and the one that keeps working if
            Google is ever unreachable; Google is the alternative, and sits where
            an alternative sits. */}
        <OrDivider />
        <GoogleSignInButton onClick={() => void handleGoogle()} busy={googleBusy} disabled={loading} />

        <div className="mt-6 flex justify-between text-sm text-muted">
          <Link to="/forgot-password" className="hover:text-accent">
            Forgot password?
          </Link>
          <Link to="/signup" className="hover:text-accent">
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
