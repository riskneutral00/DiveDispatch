'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { Card } from '@/components/ui/card'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { SimpleSelect } from '@/components/ui/simple-select'

interface PreferredOperatorPickerProps {
  value: string | undefined
  onChange: (slug: string | undefined) => void
}

export function PreferredOperatorPicker({ value, onChange }: PreferredOperatorPickerProps) {
  const t = useTranslations('booking')
  const dc = useQuery(api.directory.listByRole, { role: 'DiveCenter' })
  const ag = useQuery(api.directory.listByRole, { role: 'Agent' })

  const options = useMemo(() => {
    const merged = [...(dc ?? []), ...(ag ?? [])]
    return merged
      .map((e) => ({
        value: `${e.role}:${e.slug}`,
        label: `${e.name} (${e.role}) — ${e.placeName}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [dc, ag])

  const selectValue = useMemo(
    () => (value ? options.find((o) => o.value.endsWith(`:${value}`))?.value ?? '' : ''),
    [value, options],
  )

  return (
    <Card padding="sm">
      <FormSectionHeader className="mb-4" label={t('preferredOperator')} />
      <p className="text-body mb-4 text-secondary">{t('preferredOperatorDesc')}</p>
      <SimpleSelect
        label={t('targetOperator')}
        value={selectValue}
        onChange={(v) => {
          if (!v) {
            onChange(undefined)
            return
          }
          const idx = v.indexOf(':')
          onChange(idx >= 0 ? v.slice(idx + 1) : v)
        }}
        options={[{ value: '', label: 'None' }, ...options]}
      />
    </Card>
  )
}
