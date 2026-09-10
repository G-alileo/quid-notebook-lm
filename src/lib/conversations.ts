import type { SupabaseClient } from '@supabase/supabase-js'

export async function latestConversationId(supabase: SupabaseClient, folderId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}
