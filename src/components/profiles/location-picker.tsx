'use client'

import { useId, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Dialog } from '@/components/ui/dialog'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'

import type { AddressLocationValue } from '@/lib/schemas/location'
export type LocationValue = AddressLocationValue
export type { AddressLocationValue }

const LocationPickerModal = dynamic(
  () => import('./location-picker-modal').then((m) => m.LocationPickerModal),
  { ssr: false, loading: () => null },
)

interface LocationPickerProps {
  value: LocationValue | null
  onChange: (location: LocationValue | null) => void
  error?: string
  label?: string
  required?: boolean
  className?: string
}

function formatTriggerLabel(value: AddressLocationValue): string {
  const city = value.address.city
  const country = value.address.country
  if (city && country) return `${city}, ${country}`
  return city || country || ''
}

interface TriggerProps {
  value: LocationValue | null
  onOpen: () => void
  onClear: () => void
  error?: string
  label?: string
  required?: boolean
  className?: string
}

function LocationPickerTrigger({ value, onOpen, onClear, error, label, required, className }: TriggerProps) {
  const t = useTranslations('portal')
  const inputId = useId()
  const filled = !!value
  const floated = filled
  const label2 = value ? formatTriggerLabel(value) : ''
  return (
    <div className={cn("relative", className?.includes('field-') || className?.includes('w-') ? '' : 'w-full', className)}>
      <div className="relative">
        <button /* design-ok: field-underline trigger for location picker */
          id={inputId}
          type="button"
          onClick={onOpen}
          className={cn("field-underline w-full text-body text-left truncate cursor-pointer pr-6", label ? "pt-4 pb-1.5" : "py-2.5", value ? "text-primary" : "text-secondary")}
          style={{
            ...(error
              ? {
                  borderBottomColor: 'var(--color-destructive)',
                }
              : {}),
          }}
          aria-label={value ? t('locationLabelEdit', { label: label2 }) : t('addLocation')}
        >
          {value ? label2 : (label ? ' ' : t('addLocation'))}
        </button>
        {value && (
          <button /* design-ok: inline clear X inside field trigger */
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-9 min-h-9 w-9 h-9 rounded-full transition-opacity duration-theme hover:opacity-70 cursor-pointer text-secondary"
            aria-label={t('clearLocation')}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {label && (
        <label /* design-ok: floating-label overlay inside compound picker trigger */
          htmlFor={inputId}
          className={cn(
            'absolute left-0 pointer-events-none transition-all duration-theme',
            floated
              ? 'top-0 text-[10px] font-medium label-float-in text-secondary'
              : 'top-3 text-body text-secondary',
          )}
        >
          {label}
          {required && <RequiredAsterisk />}
        </label>
      )}
      {error && (
        <p role="alert" className="text-body text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function LocationPicker({ value, onChange, error, label, required, className }: LocationPickerProps) {
  const t = useTranslations('portal')
  const [open, setOpen] = useState(false)
  return (
    <>
      <LocationPickerTrigger
        value={value}
        onOpen={() => setOpen(true)}
        onClear={() => onChange(null)}
        error={error}
        label={label}
        required={required}
        className={className}
      />
      <Dialog open={open} onClose={() => setOpen(false)} title={t('setLocation')} fullScreen>
        {open && (
          <LocationPickerModal
            value={value}
            onConfirm={(loc) => {
              onChange(loc)
              setOpen(false)
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  )
}
