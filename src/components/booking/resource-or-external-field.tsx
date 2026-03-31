/**
 * Resource-or-external toggle field. Shows a system resource dropdown by default;
 * when "__external__" is selected, switches to a freeform text input with a
 * "Switch to system" link.
 */

import { GlassInput } from '@/components/ui/glass-input'
import { GlassLink } from '@/components/ui/glass-link'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'

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
}: ResourceOrExternalFieldProps) {
  if (isExternal) {
    return (
      <div className="flex flex-col gap-1">
        <GlassInput
          label={`${label} (external)`}
          value={externalName}
          onChange={(e) => onExternalNameChange(e.target.value)}
          placeholder={placeholder ?? `${label} name`}
        />
        <GlassLink onClick={() => onSetExternal(false)}>
          Switch to system
        </GlassLink>
      </div>
    )
  }

  const options = [
    { value: '__external__', label: 'External (not in system)' },
    ...resources.map((r) => ({ value: r.id, label: r.label })),
  ]

  return (
    <div className="flex flex-col gap-1">
      <GlassSimpleSelect
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
