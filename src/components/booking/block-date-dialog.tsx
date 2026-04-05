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
      title={pendingToggle.mode === 'block' ? 'Block date?' : 'Unblock date?'}
      size="sm"
    >
      <p className="text-sm mb-4 text-secondary">
        {pendingToggle.mode === 'block'
          ? `Block ${pendingToggle.date}? You won't receive booking requests.`
          : `Unblock ${pendingToggle.date}? You'll be available for bookings again.`}
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
