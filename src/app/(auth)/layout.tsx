import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Background layers — glass needs a photo to float above */}
      <div className="bg-image" />
      <div className="bg-overlay" />

      {/* Back to home */}
      <div className="relative z-10 px-6 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      {/* Centered glass container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="glass-container w-full max-w-lg p-8 flex flex-col items-center">
          {children}
        </div>
      </main>
    </div>
  )
}
