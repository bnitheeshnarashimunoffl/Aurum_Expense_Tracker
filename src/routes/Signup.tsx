import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { consumeOAuthError, signInWithGoogle } from '@/lib/oauth'
import { useAuth } from '@/context/AuthContext'
import GoogleSignInButton, { OrDivider } from '@/components/GoogleSignInButton'
import PasswordField from '@/components/PasswordField'

export default function Signup() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)

  // See the note in Login: a refused OAuth hand-off loses its reason in the
  // redirect, so main.tsx parks it and this reads it back.
  useEffect(() => {
    const message = consumeOAuthError()
    if (message) setError(message)
  }, [])

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      navigate('/', { replace: true })
      return
    }
    setInfo('Check your inbox to confirm your email, then sign in.')
  }

  /**
   * The same call as on the sign-in screen, and that is correct rather than lazy:
   * Google's flow has no separate "register" — the first time an account arrives
   * it is created, every time after that it signs in. Which is also why the
   * button says "Continue with" on both screens instead of promising one or the
   * other.
   */
  async function handleGoogle() {
    setError(null)
    setInfo(null)
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
        <p className="mb-8 text-sm text-muted">Create your account.</p>

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
            autoComplete="new-password"
            minLength={6}
          />

          {error && <p className="text-sm text-expense">{error}</p>}
          {info && <p className="text-sm text-income">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <OrDivider />
        <GoogleSignInButton onClick={() => void handleGoogle()} busy={googleBusy} disabled={loading} />

        <div className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="hover:text-accent">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
