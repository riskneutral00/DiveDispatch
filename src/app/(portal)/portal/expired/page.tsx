import { Link2Off } from 'lucide-react'
import { GlassCard } from '../../../../components/glass/glass-card'

// Static page — no client-side JS needed.
export default function PortalExpiredPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--color-surface)' }}
    >
      <GlassCard className="max-w-md w-full text-center" padding="lg">
        <div className="mb-5 flex justify-center">
          <Link2Off
            size={44}
            style={{ color: 'var(--color-text-secondary)' }}
          />
        </div>
        <h1
          className="text-xl font-semibold mb-3"
          style={{
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          This link has expired
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Your portal link is no longer valid. Please contact the dive operator
          who sent you this link to request a new one.
        </p>
      </GlassCard>
    </div>
  )
}
