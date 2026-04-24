import { useTranslations } from 'next-intl'
import { Dialog, DialogFooter } from '@/components/ui'

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
      <DialogFooter
        size="sm"
        primaryLabel={isBlock ? tDialogs('blockConfirm') : tDialogs('unblockConfirm')}
        primaryVariant={isBlock ? 'destructive' : 'primary'}
        onPrimary={onConfirm}
        primaryLoading={isToggling}
        secondaryLabel={tCommon('cancel')}
        onSecondary={onCancel}
        secondaryDisabled={isToggling}
      />
    </Dialog>
  )
}
