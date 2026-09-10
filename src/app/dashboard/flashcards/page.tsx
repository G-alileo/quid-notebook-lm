import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FlashcardsStudio from '@/components/flashcards-studio'

export default async function FlashcardsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/sign-in')

  return <FlashcardsStudio />
}
