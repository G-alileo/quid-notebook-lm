import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppBar from '@/components/app-bar'

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/sign-in')

  const username = user.user_metadata?.username ?? user.email ?? ''

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar username={String(username)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
