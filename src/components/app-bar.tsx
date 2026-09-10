'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GraduationCap, LayoutDashboard } from 'lucide-react'
import SignOutButton from '@/components/sign-out-button'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/flashcards', label: 'Flashcards', icon: GraduationCap, exact: false },
]

export default function AppBar({ username }: { username: string }) {
  const pathname = usePathname()
  const initials = username.trim().slice(0, 2).toUpperCase() || 'Q'

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-pearl">
          Q
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">
          Quid Notebook
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-accent-soft text-accent-deep' : 'text-ink-2 hover:bg-pearl hover:text-ink'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-accent' : 'text-ink-3'}`} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="hidden max-w-[10rem] truncate text-xs font-medium text-ink-2 sm:inline">
          {username}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-pearl">
          {initials}
        </span>
        <SignOutButton iconOnly />
      </div>
    </header>
  )
}
