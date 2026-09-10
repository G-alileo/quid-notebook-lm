'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, AtSign, Loader2, Lock, User, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthField from '@/components/auth/auth-field'
import { EASE, formItem, formStagger } from '@/components/auth/auth-motion'

export default function SignUpPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: fullName || null },
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data.session) {
      setNotice('Check your email to confirm your account, then sign in.')
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
        <h2 className="text-xl font-semibold tracking-tight">Create account</h2>
        <p className="mt-1 text-sm text-ink-2">One folder is enough to start.</p>
      </motion.div>

      <motion.form
        variants={formStagger}
        initial="hidden"
        animate="show"
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <AuthField
          id="username"
          label="Username"
          icon={UserRound}
          required
          minLength={3}
          autoComplete="username"
          value={username}
          onChange={setUsername}
          placeholder="yourname"
        />
        <AuthField
          id="fullName"
          label="Full name"
          icon={User}
          optional
          autoComplete="name"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Doe"
        />
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
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
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
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-emerald-700"
          >
            {notice}
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
          {loading ? 'Creating account…' : 'Create account'}
        </motion.button>
        <motion.p variants={formItem} className="text-center text-xs text-ink-3">
          By creating an account, you agree to our Privacy Policy.
        </motion.p>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.05 }}
        className="mt-6 text-center text-sm text-ink-2"
      >
        Already have an account?{' '}
        <Link href="/auth/sign-in" className="font-medium text-accent hover:text-accent-deep">
          Sign in
        </Link>
      </motion.p>
    </div>
  )
}
