'use client'

import { useAuth } from '@clerk/nextjs'
import React, { type ReactNode } from 'react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

// Single shared Convex client instance.
export const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!,
)

// Client component wrapper that injects Clerk auth into the Convex client.
// Usage: wrap at root layout below ClerkProvider.
// Uses React.createElement to avoid JSX in a .ts file.
export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.createElement(ConvexProviderWithClerk as any, {
    client: convex,
    useAuth,
    children,
  })
}
