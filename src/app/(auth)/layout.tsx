import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Back to home */}
      <div className="px-6 pt-5">
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
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="glass-elevated w-full max-w-md p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
