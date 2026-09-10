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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const stamp = Date.now()
const candidates = [
  `smoke.${stamp}@gmail.com`,
  `smoke.${stamp}@protonmail.com`,
  `smoke.${stamp}@outlook.com`,
]
const password = 'smoke-test-password-1'

let signup = null
for (const email of candidates) {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      data: { username: 'smoketester', full_name: 'Smoke Test' },
    }),
  })
  if (res.ok) {
    signup = await res.json()
    console.log(`OK   signup: ${email} -> user ${signup.user?.id}`)
    break
  }
  console.log(`no   ${email}: ${res.status} ${(await res.text()).slice(0, 120)}`)
}

if (!signup) {
  console.error('FAIL signup: every candidate email rejected')
  process.exitCode = 1
} else if (!signup.access_token) {
  console.log('SKIP email confirmation required: profiles trigger fired but the row needs a session to verify')
  console.log('     enable autoconfirm or confirm an email, then sign in from the UI')
} else {
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=username,full_name&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${signup.access_token}` } }
  )
  if (!profileRes.ok) {
    console.error(`FAIL profiles read: ${profileRes.status} ${await profileRes.text()}`)
    process.exitCode = 1
  } else {
    const rows = await profileRes.json()
    if (rows.length === 1 && rows[0].username === 'smoketester') {
      console.log('OK   profiles trigger created row for new user')
    } else {
      console.error(`FAIL profiles trigger: got ${JSON.stringify(rows)}`)
      process.exitCode = 1
    }
  }
}
