import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const baseUrl = process.argv[2] ?? 'http://localhost:3000'

const cookieStore = new Map()
const authClient = createServerClient(supabaseUrl, anonKey, {
  cookies: {
    getAll: () => Array.from(cookieStore, ([name, value]) => ({ name, value })),
    setAll: (cookiesToSet) =>
      cookiesToSet.forEach(({ name, value }) => cookieStore.set(name, value)),
  },
})

const email = `e2e-chat-${Date.now()}@gmail.com`
const password = 'e2e-chat-password-1'

const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    data: { username: `e2echat-${Date.now()}`, full_name: 'E2E Chat' },
  }),
})
if (!signupRes.ok) {
  console.error(`FAIL signup: ${signupRes.status} ${await signupRes.text()}`)
  process.exit(1)
}
const signup = await signupRes.json()
if (!signup.access_token) {
  console.error('FAIL signup returned no session (email confirmation is on?)')
  process.exit(1)
}
await authClient.auth.setSession({
  access_token: signup.access_token,
  refresh_token: signup.refresh_token,
})
console.log(`OK   signup: ${email} (${cookieStore.size} cookies written by @supabase/ssr)`)

const userToken = signup.access_token
const userId = signup.user.id
const authHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${userToken}`,
  'Content-Type': 'application/json',
}

const fact =
  'Quid Notebook can generate AI podcasts from uploaded documents. The studio turns a source into a multi-speaker script and then synthesizes the audio.'

const docRes = await fetch(`${supabaseUrl}/rest/v1/documents?select=id`, {
  method: 'POST',
  headers: { ...authHeaders, Prefer: 'return=representation' },
  body: JSON.stringify({
    user_id: userId,
    name: 'seed-note.txt',
    type: 'text',
    status: 'ready',
    chunk_count: 1,
  }),
})
if (!docRes.ok) {
  console.error(`FAIL documents insert: ${docRes.status} ${await docRes.text()}`)
  process.exit(1)
}
const documentId = (await docRes.json())[0].id

const embedRes = await fetch('https://api.cohere.com/v1/embed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.COHERE_API_KEY}`,
  },
  body: JSON.stringify({
    model: env.COHERE_EMBED_MODEL,
    input_type: 'search_document',
    texts: [fact],
  }),
})
if (!embedRes.ok) {
  console.error(`FAIL embed: ${embedRes.status} ${await embedRes.text()}`)
  process.exit(1)
}
const embedding = (await embedRes.json()).embeddings[0]

const chunkRes = await fetch(`${supabaseUrl}/rest/v1/chunks`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    document_id: documentId,
    user_id: userId,
    content: fact,
    embedding: `[${embedding.join(',')}]`,
    meta: {
      source_file: 'seed-note.txt',
      source_type: 'text',
      chunk_index: 0,
      start_char: 0,
      end_char: fact.length - 1,
      chunk_id: 'text_0_e2eseed',
    },
  }),
})
if (!chunkRes.ok) {
  console.error(`FAIL chunks insert: ${chunkRes.status} ${await chunkRes.text()}`)
  process.exit(1)
}
console.log(`OK   seeded 1 chunk in document ${documentId}`)

const cookieHeader = Array.from(cookieStore, ([name, value]) => `${name}=${value}`).join('; ')

const chatRes = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({ query: 'What can Quid Notebook generate from documents?' }),
})

const contentType = chatRes.headers.get('content-type') ?? ''
if (!chatRes.ok || !contentType.includes('text/event-stream')) {
  console.error(
    `FAIL chat: status ${chatRes.status} redirected=${chatRes.redirected} content-type=${contentType}`
  )
  console.error((await chatRes.text()).slice(0, 300))
  process.exit(1)
}
console.log('OK   /api/chat streaming response opened')

const reader = chatRes.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
let answer = ''
let gotSources = false
let gotDone = false

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const lines = (buffer + decoder.decode(value, { stream: true })).split('\n\n')
  buffer = lines.pop() ?? ''
  for (const block of lines) {
    const line = block.trim()
    if (!line.startsWith('data: ')) continue
    const event = JSON.parse(line.slice(6))
    if (event.sources_used) {
      gotSources = true
      console.log(`OK   sources event: ${event.sources_used.length} source(s)`)
      for (const s of event.sources_used) {
        console.log(
          `     ${s.reference} ${s.source_file} (${s.source_type}) score ${s.relevance_score?.toFixed(3)}`
        )
      }
    }
    if (event.token) {
      answer += event.token
      process.stdout.write(event.token)
    }
    if (event.done) gotDone = true
  }
}

console.log('\n---')
if (!gotSources) console.error('FAIL no sources event received')
if (!gotDone) console.error('FAIL no done event received')
if (gotSources && !/\[1\]/.test(answer)) console.error('WARN answer has no inline [1] citation')
if (gotSources && gotDone) console.log('OK   stream completed with sources and done')

const historyRes = await fetch(
  `${supabaseUrl}/rest/v1/chat_messages?select=role&order=created_at`,
  { headers: authHeaders }
)
const turns = await historyRes.json()
console.log(`chat_messages rows for user: ${turns.length}`)
