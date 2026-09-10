'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, AtSign, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthField from '@/components/auth/auth-field'
import { EASE, formItem, formStagger } from '@/components/auth/auth-motion'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.45 }}
      >
        <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1 text-sm text-ink-2">Sign in to your folders.</p>
      </motion.div>

      <motion.form
        variants={formStagger}
        initial="hidden"
        animate="show"
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <AuthField
          id="email"
          label="Email"
          icon={AtSign}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <AuthField
          id="password"
          label="Password"
          icon={Lock}
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          revealable
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
        <motion.button
          variants={formItem}
          whileTap={{ scale: 0.985 }}
          type="submit"
          disabled={loading}
          className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
          {loading ? 'Signing in…' : 'Sign in'}
        </motion.button>
        <motion.p variants={formItem} className="text-center text-xs text-ink-3">
          By signing in, you agree to our Privacy Policy.
        </motion.p>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.95 }}
        className="mt-6 text-center text-sm text-ink-2"
      >
        No account yet?{' '}
        <Link href="/auth/sign-up" className="font-medium text-accent hover:text-accent-deep">
          Create one
        </Link>
      </motion.p>
    </div>
  )
}
