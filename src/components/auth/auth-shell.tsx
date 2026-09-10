'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import AuthBackdrop from './auth-backdrop'
import { EASE, maskLine, rise, stagger } from './auth-motion'

const HEADLINE = ['Ask your documents.', 'Get answers you can check.']

export default function AuthShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const reduced = useReducedMotion()
  const { scrollY } = useScroll()

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const pointerX = useSpring(rawX, { stiffness: 55, damping: 18, mass: 0.7 })
  const pointerY = useSpring(rawY, { stiffness: 55, damping: 18, mass: 0.7 })
  const cardY = useTransform(scrollY, [0, 800], [0, -26])

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1)
      rawY.set((event.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [rawX, rawY, reduced])

  return (
    <div className="relative min-h-dvh overflow-clip bg-[#0b0b0d]">
      <AuthBackdrop pointerX={pointerX} pointerY={pointerY} scrollY={scrollY} />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
        className="absolute left-5 top-5 z-20 sm:left-8 sm:top-7"
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base font-semibold text-pearl ring-1 ring-white/20 transition group-hover:bg-white/15">
            Q
          </span>
          <span className="text-sm font-semibold tracking-tight text-white/85 transition group-hover:text-white">
            Quid Notebook
          </span>
        </Link>
      </motion.div>

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 px-5 pb-14 pt-24 sm:px-8 lg:grid-cols-[1.05fr_minmax(400px,0.85fr)] lg:items-center lg:gap-16 lg:pb-16 lg:pt-16">
        <motion.div variants={stagger} initial="hidden" animate="show" className="hidden lg:block">
          <h1 className="text-5xl font-semibold leading-[1.06] tracking-tight text-pearl xl:text-6xl">
            {HEADLINE.map((line) => (
              <span key={line} className="block overflow-hidden pb-1.5">
                <motion.span variants={maskLine} className="block">
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p variants={rise} className="mt-6 max-w-md text-base leading-relaxed text-pearl/60">
            Cited answers from your documents, with podcasts on top.
          </motion.p>
        </motion.div>

        <motion.div style={{ y: cardY }} className="flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, ease: EASE, delay: 0.3 }}
            className="w-full max-w-[420px]"
          >
            <div className="relative rounded-2xl bg-[linear-gradient(165deg,rgb(29_22_24/0.86),rgb(29_22_24/0.66))] p-7 shadow-[0_24px_80px_rgb(0_0_0/0.45),0_0_70px_rgb(245_158_11/0.08)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-8 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.28),transparent)]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
