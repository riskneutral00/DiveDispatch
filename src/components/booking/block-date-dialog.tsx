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
  const tDialogs = useTranslations('booking.dialogs')
  const isBlock = pendingToggle.mode === 'block'
  return (
    <Dialog
      open
      onClose={onCancel}
      title={isBlock ? tDialogs('blockDateTitle') : tDialogs('unblockDateTitle')}
      size="sm"
    >
      <p className="text-body mb-4 text-secondary">
        {isBlock
          ? tDialogs('blockDateBody', { date: pendingToggle.date })
          : tDialogs('unblockDateBody', { date: pendingToggle.date })}
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
          {isBlock ? tDialogs('blockConfirm') : tDialogs('unblockConfirm')}
        </Button>
      </div>
    </Dialog>
  )
}
