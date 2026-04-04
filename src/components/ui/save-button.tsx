import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui'

interface SaveButtonProps {
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean
  disabled?: boolean
  label?: string
}

export function SaveButton({ saving, saved, isDirty, isUpdate, disabled, label }: SaveButtonProps) {
  return (
    <div className="flex justify-end">
      <Button
        type="submit"
        loading={saving}
        disabled={disabled || (isUpdate ? (!isDirty || saving) : saving)}
        style={saved ? { background: 'var(--color-active-fg)', borderColor: 'var(--color-active-fg)' } : undefined}
      >
        {saved ? (
          <>
            <Check size={16} />
            Saved
          </>
        ) : (
          <>
            <Save size={16} />
            {label ?? (isUpdate ? 'Save' : 'Create Profile')}
          </>
        )}
      </Button>
    </div>
  )
}
