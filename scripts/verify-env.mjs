import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
)

const fail = (label, message) => {
  console.error(`FAIL ${label}: ${message}`)
  process.exitCode = 1
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  fail('supabase', 'NEXT_PUBLIC_SUPABASE_URL missing or placeholder')
} else {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    })
    if (!res.ok) {
      fail('supabase', `settings endpoint returned ${res.status}`)
    } else {
      const settings = await res.json()
      console.log(`OK   supabase reachable`)
      console.log(`     mailer autoconfirm: ${settings.mailer_autoconfirm ?? false}`)
    }
  } catch (error) {
    fail('supabase', error instanceof Error ? error.message : String(error))
  }

  const anonHeaders = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  for (const table of ['profiles', 'documents', 'chunks', 'chat_messages', 'podcasts']) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
      headers: anonHeaders,
    })
    if (res.ok) {
      console.log(`OK   table ${table} exists`)
    } else {
      fail('schema', `${table} returned ${res.status}: ${(await res.text()).slice(0, 140)}`)
    }
  }

  const zeroVector = `[${Array(1024).fill(0).join(',')}]`
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_chunks`, {
    method: 'POST',
    headers: { ...anonHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_embedding: zeroVector, match_count: 1 }),
  })
  if (rpcRes.ok) {
    const rows = await rpcRes.json()
    console.log(`OK   match_chunks RPC works (${rows.length} rows for anonymous, RLS active)`)
  } else {
    fail('schema', `match_chunks returned ${rpcRes.status}: ${(await rpcRes.text()).slice(0, 140)}`)
  }
}

const cohereKey = env.COHERE_API_KEY
if (!cohereKey || cohereKey.includes('placeholder') || cohereKey.trim() === '') {
  fail('embeddings', 'COHERE_API_KEY missing or placeholder')
} else {
  try {
    const res = await fetch('https://api.cohere.com/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cohereKey}`,
      },
      body: JSON.stringify({
        model: env.COHERE_EMBED_MODEL,
        input_type: 'search_document',
        texts: ['quid notebook verification'],
      }),
    })
    if (!res.ok) {
      fail('embeddings', `${res.status} ${await res.text()}`)
    } else {
      const data = await res.json()
      const dims = data.embeddings?.[0]?.length
      console.log(`OK   embeddings: model ${env.COHERE_EMBED_MODEL}, dims ${dims}`)
      if (dims !== 1024) {
        console.warn(`WARN dims ${dims} != 1024: schema vector(1024) must match the model`)
      }
    }
  } catch (error) {
    fail('embeddings', error instanceof Error ? error.message : String(error))
  }
}

if (!env.QWEN_CHAT_MODEL || env.QWEN_CHAT_MODEL.includes('placeholder')) {
  console.warn('WARN QWEN_CHAT_MODEL not set yet (needed for the chat phase)')
}
