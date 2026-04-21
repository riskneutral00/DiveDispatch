import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AddEntityButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

export function AddEntityButton({ label, onClick, disabled = false }: AddEntityButtonProps) {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={onClick} disabled={disabled}>
      <Plus size={14} />
      {label}
    </Button>
  )
}
