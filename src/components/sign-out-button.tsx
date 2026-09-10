'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
      return
    }
    router.push('/auth/sign-in')
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleSignOut}
        title="Sign out"
        className="rounded-lg border border-line p-2 text-ink-2 transition hover:border-line-2 hover:bg-pearl hover:text-ink"
      >
        <LogOut className="h-4 w-4" />
      </button>
    )
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 transition hover:border-line-2 hover:bg-pearl hover:text-ink"
    >
      Sign out
    </button>
  )
}
