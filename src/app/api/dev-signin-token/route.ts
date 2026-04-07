import { clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (process.env.ENVIRONMENT !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { userId } = body as { userId?: unknown }

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const clerk = await clerkClient()
  const signInToken = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  })

  return NextResponse.json({ token: signInToken.token })
}
