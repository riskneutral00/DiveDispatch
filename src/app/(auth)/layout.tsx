import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-image" />
      <div className="bg-overlay" />

      <div className="app-shell flex flex-col flex-1">
      <div className="px-6 pt-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-body transition-opacity duration-theme hover:opacity-70 text-secondary"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="glass-container w-full max-w-lg p-8 flex flex-col items-center">
          {children}
        </div>
      </main>
      </div>
    </div>
  )
}
