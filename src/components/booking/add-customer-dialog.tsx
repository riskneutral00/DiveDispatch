'use client'

import { useState } from 'react'
import { Dialog, Button, Input, ButtonGroup } from '@/components/ui'
import type { ButtonGroupOption } from '@/components/ui'
import { LanguageField } from '@/components/profiles/language-field'
import type { Language } from '@/lib/types/language'
import type { CustomerContact } from '@/lib/booking/wizard-state'

interface AddCustomerDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, contact: CustomerContact, flags: Language[]) => void
}

type ContactType = 'email' | 'whatsapp' | 'line'

export function AddCustomerDialog({
  open,
  onClose,
  onAdd,
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
    <Dialog open={open} onClose={handleClose} title="Add Customer" size="sm">
      <div className="flex flex-col gap-4">
        {/* Name + Contact paired with Languages */}
        <div className="flex flex-wrap gap-4 w-full">
          <div className="flex flex-col gap-3 min-w-0">
            <Input
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
            <div className="flex flex-col gap-2">
              <p
                className="text-body font-medium text-secondary"
              >
                Contact (optional)
              </p>
              <ButtonGroup
                variant="segment"
                value={contactType}
                onChange={(v) => setContactType(v as ContactType)}
                aria-label="Contact type"
                options={[
                  { value: 'email', label: 'Email' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'line', label: 'LINE' },
                ] satisfies ButtonGroupOption[]}
              />
              <Input
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={
                  contactType === 'email'
                    ? 'customer@email.com'
                    : contactType === 'whatsapp'
                      ? '+66 81 234 5678'
                      : 'LINE ID'
                }
                type="text"
                inputMode={contactType === 'email' ? 'email' : contactType === 'whatsapp' ? 'tel' : 'text'}
              />
            </div>
          </div>
          <div className="min-w-0">
            <LanguageField
              variant="customer"
              value={languages}
              onChange={setLanguages}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="md" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit}>
            Add Customer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
