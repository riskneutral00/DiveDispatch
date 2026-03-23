import { Loader2 } from 'lucide-react'

export default function PortalLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2
        size={32}
        className="animate-spin"
        style={{ color: 'var(--color-primary)' }}
      />
    </div>
  )
}
