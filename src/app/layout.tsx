import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { ConvexClerkProvider } from '../lib/convex'
import './globals.css'

export const metadata: Metadata = {
  title: 'DiveDispatch',
  description: 'Multi-stakeholder booking platform for scuba diving',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {/* Provider order is critical: ClerkProvider > ConvexProviderWithClerk > children */}
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/role-select"
        >
          <ConvexClerkProvider>
            {children}
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
