'use client'

import { useAuth } from '@clerk/nextjs'
import { type ReactNode } from 'react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

// Single shared Convex client instance.
export const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!,
)

// Client component wrapper that injects Clerk auth into the Convex client.
// Usage: wrap at root layout below ClerkProvider.
export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
