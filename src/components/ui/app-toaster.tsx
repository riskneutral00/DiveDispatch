'use client'

import { Toaster } from 'sonner'

export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      offset={80}
      toastOptions={{
        style: {
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-glass-border)',
          color: 'var(--color-text-primary)',
          borderRadius: 'var(--border-radius, 12px)',
          boxShadow: '0 8px 32px var(--color-glass-shadow-elevated)',
        },
        classNames: {
          success: 'glass-toast-success',
          error: 'glass-toast-error',
        },
      }}
      gap={8}
    />
  )
}
