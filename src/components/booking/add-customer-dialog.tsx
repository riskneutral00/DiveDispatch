'use client'

import { useState } from 'react'
import { GlassDialog, GlassButton, GlassInput, GlassButtonGroup } from '@/components/glass'
import type { GlassButtonGroupOption } from '@/components/glass'
import { LanguagePicker } from '@/components/common/language-picker'
import type { Language } from '@/lib/types/language'
import type { CustomerContact } from '@/lib/booking/wizard-state'

interface AddCustomerDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, contact: CustomerContact, flags: Language[]) => void
  commonLanguageCodes?: string[]
}

type ContactType = 'email' | 'whatsapp' | 'line'

export function AddCustomerDialog({
  open,
  onClose,
  onAdd,
  commonLanguageCodes = [],
}: AddCustomerDialogProps) {
  const [name, setName] = useState('')
  const [contactType, setContactType] = useState<ContactType>('email')
  const [contactValue, setContactValue] = useState('')
  const [languages, setLanguages] = useState<Language[]>([])
  const [nameError, setNameError] = useState('')

  function resetForm() {
    setName('')
    setContactType('email')
    setContactValue('')
    setLanguages([])
    setNameError('')
  }

  function buildContact(): CustomerContact {
    if (!contactValue.trim()) return {}
    if (contactType === 'email') return { email: contactValue.trim() }
    if (contactType === 'whatsapp') return { whatsapp: contactValue.trim() }
    return { line: contactValue.trim() }
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return
    }
    onAdd(trimmed, buildContact(), languages)
    resetForm()
    onClose()
  }

  const canSubmit = name.trim().length > 0

  return (
    <GlassDialog open={open} onClose={handleClose} title="Add Customer" size="sm">
      <div className="flex flex-col gap-4">
        {/* Name */}
        <GlassInput
          label="Full name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError) setNameError('')
          }}
          placeholder="e.g. Sara Kim"
          error={nameError}
          autoFocus
        />

        {/* Contact method */}
        <div className="flex flex-col gap-2">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Contact (optional)
          </p>
          <GlassButtonGroup
            variant="segment"
            value={contactType}
            onChange={(v) => setContactType(v as ContactType)}
            aria-label="Contact type"
            options={[
              { value: 'email', label: 'Email' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'line', label: 'LINE' },
            ] satisfies GlassButtonGroupOption[]}
          />
          <GlassInput
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={
              contactType === 'email'
                ? 'customer@email.com'
                : contactType === 'whatsapp'
                  ? '+66 81 234 5678'
                  : 'LINE ID'
            }
            type={contactType === 'email' ? 'email' : 'text'}
          />
        </div>

        {/* Languages */}
        <div className="flex flex-col gap-2">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Languages
          </p>
          <LanguagePicker
            value={languages}
            onChange={setLanguages}
            commonLanguageCodes={commonLanguageCodes as import('@/lib/constants/dive-languages').LanguageCode[]}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <GlassButton variant="secondary" size="md" onClick={handleClose}>
            Cancel
          </GlassButton>
          <GlassButton variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit}>
            Add Customer
          </GlassButton>
        </div>
      </div>
    </GlassDialog>
  )
}
