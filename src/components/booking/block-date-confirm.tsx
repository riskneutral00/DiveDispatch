'use client'

import { GlassDialog, GlassButton } from '@/components/ui'

interface BlockDateConfirmProps {
  date: string
  mode: 'block' | 'unblock'
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export function BlockDateConfirm({
  date,
  mode,
  onConfirm,
  onCancel,
  isPending = false,
}: BlockDateConfirmProps) {
  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <GlassDialog
      open
      onClose={onCancel}
      title={mode === 'block' ? 'Block this date?' : 'Unblock this date?'}
      description={
        mode === 'block'
          ? `Mark ${formatted} as unavailable. Operators will not be able to book you on this date.`
          : `Remove the block on ${formatted}. You will be available for bookings on this date again.`
      }
      size="sm"
    >
      <div className="flex gap-3 justify-end">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
          type="button"
        >
          Cancel
        </GlassButton>
        <GlassButton
          variant={mode === 'block' ? 'destructive' : 'primary'}
          size="sm"
          onClick={onConfirm}
          loading={isPending}
          type="button"
        >
          {mode === 'block' ? 'Block date' : 'Unblock'}
        </GlassButton>
      </div>
    </GlassDialog>
  )
}
