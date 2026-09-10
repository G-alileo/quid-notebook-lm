'use client'

import Image from 'next/image'
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'

const EMBERS = [
  { left: '6%', top: '78%', size: 4, delay: 0, duration: 17 },
  { left: '12%', top: '34%', size: 3, delay: 3.2, duration: 21 },
  { left: '19%', top: '62%', size: 5, delay: 6.5, duration: 15 },
  { left: '27%', top: '86%', size: 3, delay: 1.8, duration: 19 },
  { left: '34%', top: '18%', size: 4, delay: 8.4, duration: 23 },
  { left: '41%', top: '54%', size: 2, delay: 4.6, duration: 16 },
  { left: '48%', top: '74%', size: 5, delay: 10.2, duration: 20 },
  { left: '55%', top: '28%', size: 3, delay: 2.4, duration: 18 },
  { left: '63%', top: '66%', size: 4, delay: 7.1, duration: 22 },
  { left: '70%', top: '42%', size: 2, delay: 12.6, duration: 17 },
  { left: '77%', top: '82%', size: 5, delay: 5.3, duration: 24 },
  { left: '84%', top: '24%', size: 3, delay: 9.7, duration: 19 },
  { left: '90%', top: '58%', size: 4, delay: 0.9, duration: 21 },
  { left: '95%', top: '76%', size: 2, delay: 6.8, duration: 16 },
]

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

type AuthBackdropProps = {
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  scrollY: MotionValue<number>
}

export default function AuthBackdrop({ pointerX, pointerY, scrollY }: AuthBackdropProps) {
  const reduced = useReducedMotion()

  const silkScrollY = useTransform(scrollY, [0, 800], [0, 70])
  const silkX = useTransform(pointerX, [-1, 1], [-12, 12])
  const silkY = useTransform([pointerY, silkScrollY], ([p, s]: number[]) => p * 8 + s)
  const glowX = useTransform(pointerX, [-1, 1], [-30, 30])
  const glowY = useTransform([pointerY, scrollY], ([p, s]: number[]) => p * -18 + s * 0.11)
  const emberX = useTransform(pointerX, [-1, 1], [-44, 44])
  const emberY = useTransform(pointerY, [-1, 1], [22, -22])

  return (
    <div aria-hidden className="absolute inset-0 overflow-clip">
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="absolute -inset-[10%] mix-blend-screen bg-[radial-gradient(42%_34%_at_50%_38%,rgb(245_158_11/0.16),transparent_70%),radial-gradient(30%_26%_at_24%_76%,rgb(251_191_36/0.10),transparent_72%)]"
      />

      <div className="auth-silk">
        <motion.div style={{ x: silkX, y: silkY }} className="h-full w-full">
          <motion.div
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <motion.div
              className="relative h-full w-full"
              animate={reduced ? undefined : { scale: [1, 1.03, 1] }}
              transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/login page background.jpg"
                alt=""
                fill
                sizes="100vw"
                quality={85}
                preload
                className="object-cover object-[50%_50%]"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div style={{ x: emberX, y: emberY }} className="absolute inset-0">
        {!reduced &&
          EMBERS.map((ember, index) => (
            <motion.span
              key={index}
              className="absolute rounded-full bg-amber-400"
              style={{
                left: ember.left,
                top: ember.top,
                width: ember.size,
                height: ember.size,
                boxShadow: `0 0 ${ember.size * 3}px rgb(251 191 36 / 0.55)`,
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.8, 0], y: [0, -130] }}
              transition={{
                duration: ember.duration,
                delay: ember.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
      </motion.div>

      <div className="absolute inset-0 bg-[rgb(10_10_13/0.12)]" />
      <div className="absolute inset-0 bg-[linear-gradient(95deg,rgb(9_9_12/0.78)_0%,rgb(9_9_12/0.45)_40%,transparent_62%,rgb(9_9_12/0.22)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(125%_100%_at_50%_10%,transparent_48%,rgb(8_8_10/0.42)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  )
}
