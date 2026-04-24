'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { Button } from '@/components/ui'
import { CustomerContactFields, type CustomerContactType } from '@/components/booking/customer-contact-fields'

import { hasLanguageConflict } from '@/lib/utils/language-matching'
import { isValidEmail, isValidWhatsApp, isValidLine, newEntryId } from '@/lib/booking/wizard-state'
import type { CustomerData, CustomerContact, WizardAction } from '@/lib/booking/wizard-state'
import type { Language } from '@/lib/types/language'
import { SectionDivider } from '@/components/ui/section-divider'
import type { Dispatch } from 'react'

type ContactType = CustomerContactType

interface CustomerStepProps {
  customers: CustomerData[]
  dispatch: Dispatch<WizardAction>
}

export function CustomerStep({ customers, dispatch }: CustomerStepProps) {
  const conflict = hasLanguageConflict(
    customers.map((c) => ({ flags: c.flags?.map((f) => ({ code: f.code, label: f.label })) })),
  )

  function handleAddCustomer() {
    const customer: CustomerData = {
      id: newEntryId(),
      name: '',
      contact: {},
      flags: [],
      courseEntries: [{ id: newEntryId(), activityCode: '', dates: [], agency: '' }],
    }
    dispatch({ type: 'ADD_CUSTOMER', customer })
  }

  return (
    <div className="flex flex-col gap-4">
      {customers.map((customer, idx) => (
        <InlineCustomerForm
          key={customer.id}
          customer={customer}
          index={idx}
          canRemove={customers.length > 1}
          totalCustomers={customers.length}
          dispatch={dispatch}
        />
      ))}

      {conflict && (
        <ErrorAlert variant="warning">
          No common language — review assignments.
        </ErrorAlert>
      )}

      <Button variant="secondary" size="md" onClick={handleAddCustomer} fullWidth>
        <Plus size={16} />
        Add
      </Button>
    </div>
  )
}

interface InlineCustomerFormProps {
  customer: CustomerData
  index: number
  canRemove: boolean
  totalCustomers: number
  dispatch: Dispatch<WizardAction>
}

function InlineCustomerForm({ customer, index, canRemove, totalCustomers, dispatch }: InlineCustomerFormProps) {
  const [contactType, setContactType] = useState<ContactType>(() => {
    if (customer.contact?.whatsapp) return 'whatsapp'
    if (customer.contact?.line) return 'line'
    return 'email'
  })

  function getContactValue(): string {
    if (contactType === 'email') return customer.contact?.email ?? ''
    if (contactType === 'whatsapp') return customer.contact?.whatsapp ?? ''
    return customer.contact?.line ?? ''
  }

  function handleNameChange(name: string) {
    dispatch({ type: 'UPDATE_CUSTOMER', id: customer.id, updates: { name } })
  }

  function handleContactTypeChange(type: ContactType) {
    setContactType(type)
    const currentValue = getContactValue()
    const contact: CustomerContact = {}
    if (currentValue) {
      if (type === 'email') contact.email = currentValue
      else if (type === 'whatsapp') contact.whatsapp = currentValue
      else contact.line = currentValue
    }
    dispatch({ type: 'UPDATE_CUSTOMER', id: customer.id, updates: { contact } })
  }

  function handleContactValueChange(value: string) {
    const contact: CustomerContact = {}
    if (contactType === 'email') contact.email = value
    else if (contactType === 'whatsapp') contact.whatsapp = value
    else contact.line = value
    dispatch({ type: 'UPDATE_CUSTOMER', id: customer.id, updates: { contact } })
  }

  function handleLanguagesChange(languages: Language[]) {
    dispatch({
      type: 'UPDATE_CUSTOMER',
      id: customer.id,
      updates: { flags: languages.map((l) => ({ code: l.code, label: l.label })) },
    })
  }

  const flags = customer.flags ?? []

  return (
    <div className="flex flex-col gap-4">
      <CustomerContactFields
        name={customer.name}
        onNameChange={handleNameChange}
        nameRequired
        onRemove={canRemove ? () => dispatch({ type: 'REMOVE_CUSTOMER', id: customer.id }) : undefined}
        contactType={contactType}
        onContactTypeChange={handleContactTypeChange}
        contactValue={getContactValue()}
        onContactValueChange={handleContactValueChange}
        contactRequired
        hint={<ContactValidationHint contactType={contactType} value={getContactValue()} />}
        languages={flags.map((f) => ({ code: f.code, label: f.label }))}
        onLanguagesChange={handleLanguagesChange}
        labels={{
          name: 'Name',
          removeAria: `Remove ${customer.name || `customer ${index + 1}`}`,
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

      <SectionDivider show={index < totalCustomers - 1} />
    </div>
  )
}

function ContactValidationHint({ contactType, value }: { contactType: ContactType; value: string }) {
  const valid =
    !value ||
    (contactType === 'email' ? isValidEmail(value) :
    contactType === 'whatsapp' ? isValidWhatsApp(value) :
    isValidLine(value))

  const hint =
    contactType === 'email' ? 'Enter a valid email address' :
    contactType === 'whatsapp' ? 'Enter a valid phone number' :
    'LINE ID must be at least 4 characters (letters, numbers, dots, underscores)'

  return (
    <span
      className="text-label min-h-[1rem] text-destructive"
      style={{
        opacity: valid ? 0 : 1,
        transition: 'opacity var(--transition-speed) ease',
      }}
      aria-hidden={valid}
    >
      {hint}
    </span>
  )
}
