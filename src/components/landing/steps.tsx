'use client'

import Link from 'next/link'
import { ArrowRight, FolderOpen, Highlighter, Quote } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

const STEPS = [
  {
    icon: FolderOpen,
    title: 'File it',
    body: 'Drop PDFs, notes, web pages or YouTube lectures into a folder. Ingestion runs in the background while you read.',
  },
  {
    icon: Highlighter,
    title: 'Read and mark',
    body: 'A clean reading view beside the original file. Highlight passages, attach notes, or turn the source into a flashcard deck.',
  },
  {
    icon: Quote,
    title: 'Ask and cite',
    body: 'Answers come only from the sources in scope, each claim numbered back to the file and page it came from.',
  },
]

const ACCEPTS = ['PDF', 'TXT', 'MD', 'Web pages', 'YouTube']

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

export default function LandingSteps() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section className="border-t border-line bg-surface">
      <div ref={ref} className="mx-auto w-full max-w-6xl px-5 pb-24 pt-44 sm:pt-52">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto max-w-xl text-center"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            From file to cited answer
          </h2>
        </motion.div>
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-line"
        >
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <motion.div key={title} variants={stepVariants} className="sm:px-8">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-pearl text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold tracking-[0.18em] text-ink-3">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </motion.div>
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
          className="mt-16 flex flex-wrap items-center justify-center gap-2"
        >
          <span className="text-xs font-medium text-ink-3">Ingests</span>
          {ACCEPTS.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-pearl px-3 py-1 text-xs text-ink-2"
            >
              {item}
            </span>
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          className="mt-20 rounded-3xl border border-line bg-pearl px-8 py-14 text-center sm:px-14"
        >
          <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Start with one folder
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-2">
            Create a folder, drop your files in, and read while they are indexed.
          </p>
          <Link
            href="/auth/sign-up"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-pearl transition hover:bg-accent-deep"
          >
            Create a free account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
