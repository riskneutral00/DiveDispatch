#!/usr/bin/env tsx
import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { join } from 'path'

const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
const env: Record<string, string> = {}
for (const line of content.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
  if (match) env[match[1]] = match[2].trim()
}

const secretKey = env['CLERK_SECRET_KEY']
const email = process.argv[2]
if (!email) { console.error('Usage: npx tsx scripts/_get-token-by-email.ts <email>'); process.exit(1) }

const clerk = createClerkClient({ secretKey })

async function main() {
  const users = await clerk.users.getUserList({ emailAddress: [email] })
  const user = users.data[0]
  if (!user) { console.error('User not found:', email); process.exit(1) }

  const token = await clerk.signInTokens.createSignInToken({ userId: user.id, expiresInSeconds: 300 })
  console.log(token.token)
}

main()
