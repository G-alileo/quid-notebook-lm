import Link from 'next/link'
import LandingHero from '@/components/landing/hero'
import LandingSteps from '@/components/landing/steps'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-pearl">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-base font-semibold text-pearl">
              Q
            </span>
            <span className="text-sm font-semibold tracking-tight">Quid Notebook</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/auth/sign-in"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:bg-surface hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-pearl transition hover:bg-accent-deep"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <LandingHero />
        <LandingSteps />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-ink-3 sm:flex-row">
          <span>Quid Notebook</span>
          <span>By signing up, you agree to our Privacy Policy.</span>
        </div>
      </footer>
    </div>
  )
}
