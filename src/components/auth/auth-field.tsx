'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { formItem } from './auth-motion'

type AuthFieldProps = {
  id: string
  label: string
  icon: LucideIcon
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  type?: string
  required?: boolean
  minLength?: number
  optional?: boolean
  revealable?: boolean
}

export default function AuthField({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = 'text',
  required,
  minLength,
  optional,
  revealable,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <motion.div variants={formItem} className="space-y-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-[13px] font-medium text-ink-2"
      >
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">optional</span>}
      </label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3 transition-colors group-focus-within:text-accent" />
        <input
          id={id}
          type={revealable && revealed ? 'text' : type}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 w-full rounded-xl border border-line bg-pearl pl-9 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/10 ${
            revealable ? 'pr-10' : 'pr-3'
          }`}
        />
        {revealable && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 transition hover:bg-pearl hover:text-ink"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </motion.div>
  )
}
