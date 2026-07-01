'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupMessage, setSignupMessage] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSignupMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName.trim() || null }
        }
      })
      if (error) {
        setError(error.message)
      } else {
        setSignupMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    }

    setLoading(false)
  }

  return (
    <main className="font-dm min-h-screen bg-[#f5f4f0] dark:bg-[#0c0c0b] text-[#0f0e0c] dark:text-[#f0ede8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#0f0e0c] dark:bg-[#f0ede8] mb-6">
            <span className="font-syne text-4xl font-black text-[#f5f4f0] dark:text-[#0c0c0b] tracking-tighter">DF</span>
          </div>
          <h1 className="font-syne text-4xl font-bold tracking-tight">DayForge</h1>
          <p className="text-stone-400 dark:text-stone-600 mt-1">Focus. Build. Repeat.</p>
        </div>

        <div className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-8 shadow-sm">
          <h2 className="font-syne text-2xl font-bold text-center mb-8">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600 mb-1.5">YOUR NAME</p>
                <input
                  type="text"
                  placeholder="Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
                />
              </div>
            )}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600 mb-1.5">EMAIL</p>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
              />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600 mb-1.5">PASSWORD</p>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-white dark:bg-[#0c0c0b] border border-stone-200 dark:border-stone-800 rounded-2xl px-4 py-3 text-[15px] outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors"
              />
            </div>

            {error && <p className="text-rose-500 text-sm text-center">{error}</p>}
            {signupMessage && <p className="text-emerald-600 dark:text-emerald-500 text-sm text-center">{signupMessage}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0f0e0c] dark:bg-[#f0ede8] hover:bg-black dark:hover:bg-white text-[#f5f4f0] dark:text-[#0c0c0b] font-semibold rounded-2xl py-3.5 text-[15px] transition-all disabled:opacity-60 mt-2"
            >
              {loading 
                ? 'Please wait...' 
                : mode === 'login' 
                  ? 'Sign In' 
                  : 'Create Account'
              }
            </button>
          </form>

          <p className="text-center text-sm text-stone-400 dark:text-stone-600 mt-8">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
                setSignupMessage(null)
                setDisplayName('')
              }}
              className="text-[#0f0e0c] dark:text-[#f0ede8] hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>

        <p className="text-center text-[11px] text-stone-400 dark:text-stone-600 mt-8">
          By signing up you agree to our Terms and Privacy Policy
        </p>
      </div>
    </main>
  )
}