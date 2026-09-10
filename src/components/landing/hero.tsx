'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { Fragment, useRef } from 'react'
import ParticleField from './particle-field'
import WorkspaceMock from './workspace-mock'

const EASE = [0.22, 1, 0.36, 1] as const
const EMPHASIS = [0.05, 0.75, 0.2, 1] as const

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

const word = {
  hidden: { y: '110%' },
  visible: { y: 0, transition: { duration: 0.6, ease: EMPHASIS } },
}

function RevealedLine({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <span className="block">
      {words.map((w, i) => (
        <Fragment key={w}>
          {i > 0 && ' '}
          <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span variants={word} className="inline-block">
              {w}
            </motion.span>
          </span>
        </Fragment>
      ))}
    </span>
  )
}

export default function LandingHero() {
  const mockRef = useRef<HTMLDivElement>(null)
  const mockInView = useInView(mockRef, { once: true, margin: '-120px' })
  return (
    <section className="relative">
      <ParticleField />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(58% 46% at 50% 34%, rgb(177 154 159 / 0.16), transparent 72%)',
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-5 pt-28 text-center">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="flex w-full flex-col items-center"
        >
          <motion.span
            variants={rise}
            className="rounded-full border border-line bg-surface px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2"
          >
            Grounded in your sources
          </motion.span>
          <h1 className="mt-8 text-5xl font-semibold leading-[1.04] tracking-[-0.03em] sm:text-7xl">
            <RevealedLine text="Ask your documents." />
            <RevealedLine text="Get answers you can check." />
          </h1>
          <motion.p variants={rise} className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-2">
            File the sources for a course, a case, or a project into one folder. Read them,
            highlight them, and ask questions answered from those files only.
          </motion.p>
          <motion.div variants={rise} className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/sign-up"
              className="group flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-pearl transition hover:bg-accent-deep"
            >
              Create a free account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-medium text-ink-2 transition hover:border-line-2 hover:text-ink"
            >
              Sign in
            </Link>
          </motion.div>
        </motion.div>
      </div>
      <div ref={mockRef} className="relative z-10 mx-auto w-full max-w-5xl px-5">
        <div className="translate-y-16 sm:translate-y-24">
          <motion.div
            initial={{ opacity: 0, y: 56, scale: 0.98 }}
            animate={mockInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <WorkspaceMock />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
