'use client'

import { Toaster } from 'sonner'

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur, 14px))',
          border: '1px solid var(--color-glass-border)',
          color: 'var(--color-text-primary)',
          borderRadius: 'var(--border-radius, 12px)',
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
