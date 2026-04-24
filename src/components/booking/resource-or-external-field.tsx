import { Input } from '@/components/ui/input'
import { ActionLink } from '@/components/ui/action-link'
import { SimpleSelect } from '@/components/ui/simple-select'

interface ResourceOption {
  id: string
  label: string
}

interface ResourceOrExternalFieldProps {
  label: string
  resources: ResourceOption[]
  selectedId: string
  isExternal: boolean
  externalName: string
  onSelectResource: (id: string) => void
  onSetExternal: (isExternal: boolean) => void
  onExternalNameChange: (name: string) => void
  placeholder?: string
  className?: string
}

export function ResourceOrExternalField({
  label,
  resources,
  selectedId,
  isExternal,
  externalName,
  onSelectResource,
  onSetExternal,
  onExternalNameChange,
  placeholder,
  className,
}: ResourceOrExternalFieldProps) {
  if (isExternal) {
    return (
      <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
        <Input
          label={`${label} (external)`}
          value={externalName}
          onChange={(e) => onExternalNameChange(e.target.value)}
          placeholder={placeholder ?? `${label} name`}
        />
        <ActionLink onClick={() => onSetExternal(false)}>
          Switch to system
        </ActionLink>
      </div>
    )
  }

  const options = [
    { value: '__external__', label: 'External (not in system)' },
    ...resources.map((r) => ({ value: r.id, label: r.label })),
  ]

  return (
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <SimpleSelect
        label={label}
        value={selectedId}
        onChange={(v) => {
          if (v === '__external__') {
            onSetExternal(true)
            onSelectResource('')
          } else {
            onSelectResource(v)
          }
        }}
        options={options}
        placeholder={placeholder ?? `Select ${label.toLowerCase()}…`}
      />
    </div>
  )
}
