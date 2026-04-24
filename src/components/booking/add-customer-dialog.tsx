'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogFooter } from '@/components/ui'
import { CustomerContactFields, type CustomerContactType } from '@/components/booking/customer-contact-fields'
import type { Language } from '@/lib/types/language'
import type { CustomerContact } from '@/lib/booking/wizard-state'

interface AddCustomerDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, contact: CustomerContact, flags: Language[]) => void
}

export function AddCustomerDialog({
  open,
  onClose,
  onAdd,
}: AddCustomerDialogProps) {
  const tDialogs = useTranslations('booking.dialogs')
  const tCommon = useTranslations('common')
  const [name, setName] = useState('')
  const [contactType, setContactType] = useState<CustomerContactType>('email')
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
    <Dialog open={open} onClose={handleClose} title={tDialogs('addCustomerTitle')} size="sm">
      <div className="flex flex-col gap-4">
        <CustomerContactFields
          name={name}
          onNameChange={(v) => {
            setName(v)
            if (nameError) setNameError('')
          }}
          nameError={nameError}
          contactType={contactType}
          onContactTypeChange={setContactType}
          contactValue={contactValue}
          onContactValueChange={setContactValue}
          languages={languages}
          onLanguagesChange={setLanguages}
          labels={{
            name: 'Full name',
            contactTypeAria: 'Contact type',
            emailOption: 'Email',
            whatsappOption: 'WhatsApp',
            lineOption: 'LINE',
            whatsappField: 'WhatsApp number',
            emailField: 'Email address',
            lineField: 'LINE ID',
            emailPlaceholder: 'customer@email.com',
            linePlaceholder: 'LINE ID',
          }}
        />

        <DialogFooter
          primaryLabel={tDialogs('addCustomerTitle')}
          onPrimary={handleSubmit}
          primaryDisabled={!canSubmit}
          secondaryLabel={tCommon('cancel')}
          onSecondary={handleClose}
        />
      </div>
    </Dialog>
  )
}
