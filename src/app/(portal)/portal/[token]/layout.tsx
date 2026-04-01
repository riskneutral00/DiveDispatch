import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// Portal token layout — no dashboard shell, no nav, no auth.
// Customers arrive here via tokenized link. Mobile-first.
export default function PortalTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
