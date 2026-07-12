import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-safe-top">
      <div className="w-full max-w-sm">
        <h1 className="font-display mb-1 text-3xl font-bold text-primary">Reset password</h1>
        <p className="mb-8 text-sm text-muted">We'll email you a reset link.</p>

        {sent ? (
          <p className="text-sm text-income">Check your inbox for the reset link.</p>
        ) : (
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

            {error && <p className="text-sm text-expense">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-sm text-muted">
          <Link to="/login" className="hover:text-accent">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
