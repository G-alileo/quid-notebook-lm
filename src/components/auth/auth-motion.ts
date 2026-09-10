import type { Variants } from 'framer-motion'

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.25 },
  },
}

export const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

export const maskLine: Variants = {
  hidden: { y: '115%' },
  show: { y: '0%', transition: { duration: 0.95, ease: EASE } },
}

export const formStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.5 },
  },
}

export const formItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}
