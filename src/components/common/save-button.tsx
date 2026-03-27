import { Check, Save } from 'lucide-react'
import { GlassButton } from '@/components/glass'

interface SaveButtonProps {
  saving: boolean
  saved: boolean
  isDirty: boolean
  isUpdate: boolean
}

export function SaveButton({ saving, saved, isDirty, isUpdate }: SaveButtonProps) {
  return (
    <div className="flex justify-end">
      <GlassButton
        type="submit"
        loading={saving}
        disabled={isUpdate ? (!isDirty || saving) : saving}
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
            {isUpdate ? 'Save Changes' : 'Create Profile'}
          </>
        )}
      </GlassButton>
    </div>
  )
}
