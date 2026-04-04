import { Dialog, Button } from '@/components/ui'

interface BlockDateDialogProps {
  pendingToggle: { date: string; mode: 'block' | 'unblock' }
  isToggling: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BlockDateDialog({ pendingToggle, isToggling, onConfirm, onCancel }: BlockDateDialogProps) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={pendingToggle.mode === 'block' ? 'Block this date?' : 'Unblock this date?'}
      size="sm"
    >
      <p className="text-sm mb-4 text-secondary">
        {pendingToggle.mode === 'block'
          ? `Block ${pendingToggle.date}? Operators will not be able to book you on this date.`
          : `Unblock ${pendingToggle.date}? You will become available for bookings on this date again.`}
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isToggling}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant={pendingToggle.mode === 'block' ? 'destructive' : 'primary'}
          onClick={onConfirm}
          disabled={isToggling}
        >
          {isToggling
            ? 'Saving…'
            : pendingToggle.mode === 'block'
              ? 'Block'
              : 'Unblock'}
        </Button>
      </div>
    </Dialog>
  )
}
