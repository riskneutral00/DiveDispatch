import { useTranslations } from 'next-intl'
import { Dialog, Button } from '@/components/ui'

interface BlockDateDialogProps {
  pendingToggle: { date: string; mode: 'block' | 'unblock' }
  isToggling: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BlockDateDialog({ pendingToggle, isToggling, onConfirm, onCancel }: BlockDateDialogProps) {
  const tCommon = useTranslations('common')
  const isBlock = pendingToggle.mode === 'block'
  return (
    <Dialog
      open
      onClose={onCancel}
      title={isBlock ? 'Block date?' : 'Unblock date?'}
      size="sm"
    >
      <p className="text-body mb-4 text-secondary">
        {isBlock
          ? `Block ${pendingToggle.date}? You won't receive booking requests.`
          : `Unblock ${pendingToggle.date}? You'll be available for bookings again.`}
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isToggling}>
          {tCommon('cancel')}
        </Button>
        <Button
          size="sm"
          variant={isBlock ? 'destructive' : 'primary'}
          onClick={onConfirm}
          loading={isToggling}
        >
          {isBlock ? 'Block' : 'Unblock'}
        </Button>
      </div>
    </Dialog>
  )
}
