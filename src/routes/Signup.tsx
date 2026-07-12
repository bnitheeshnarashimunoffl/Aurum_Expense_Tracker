import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function Signup() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-safe-top">
      <div className="w-full max-w-sm">
        <h1 className="font-display mb-1 text-3xl font-bold text-primary">Aurum</h1>
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
          <div>
            <label className="mb-1.5 block text-sm text-muted" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

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
