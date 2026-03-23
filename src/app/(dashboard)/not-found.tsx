import { Search } from 'lucide-react'
import { GlassCard } from '@/components/glass/glass-card'

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <GlassCard className="max-w-md w-full p-8 text-center">
        <Search
          size={40}
          className="mx-auto mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          Page not found
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </GlassCard>
    </div>
  )
}
