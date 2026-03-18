'use client'

import { useState } from 'react'
import { AlertTriangle, Plus, Trash2, ChevronDown } from 'lucide-react'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { LanguagePicker } from '@/components/common/language-picker'
import { countryCodeToEmoji } from '@/components/common/flag-emoji'
import { hasLanguageConflict } from '@/lib/utils/language-matching'
import { canAdvanceFromCustomers, isValidEmail, isValidWhatsApp, isValidLine } from '@/lib/booking/wizard-state'
import type { CustomerData, CustomerContact, WizardAction } from '@/lib/booking/wizard-state'
import type { Language } from '@/lib/types/language'
import type { Dispatch } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactType = 'email' | 'whatsapp' | 'line'

interface CustomerStepProps {
  customers: CustomerData[]
  dispatch: Dispatch<WizardAction>
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CustomerStep({ customers, dispatch }: CustomerStepProps) {
  const conflict = hasLanguageConflict(
    customers.map((c) => ({ flags: c.flags?.map((f) => ({ code: f.code, label: f.label })) })),
  )

  function handleAddCustomer() {
    const customer: CustomerData = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: '',
      contact: {},
      flags: [],
      courseEntries: [{ id: Math.random().toString(36).slice(2), activityCode: '', dates: [], agency: '' }],
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
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-[var(--border-radius)] text-sm"
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent)',
            color: 'var(--color-warning, #f59e0b)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" aria-hidden />
          <span>Customers share no common language — consider revising assignments.</span>
        </div>
      )}

      <GlassButton variant="secondary" size="md" onClick={handleAddCustomer} className="w-full">
        <Plus size={15} />
        Add Customer
      </GlassButton>
    </div>
  )
}

// ── Inline Customer Form ────────────────────────────────────────────────────

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
    // Clear other contact fields, keep only the new type's value
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
  const isComplete =
    customer.name.trim().length > 0 &&
    getContactValue().trim().length > 0 &&
    flags.length > 0

  return (
    <GlassCard padding="md" elevated>
      <div className="flex flex-col gap-3">
        {/* Full name + remove */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <GlassInput
              label="Full name *"
              value={customer.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Sara Kim"
              autoFocus={index === 0 && !customer.name}
            />
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'REMOVE_CUSTOMER', id: customer.id })}
              className="p-2 mb-[1px] rounded-md opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-destructive)' }}
              title="Remove customer"
              aria-label={`Remove ${customer.name || `customer ${index + 1}`}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Contact method */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Contact *
          </label>
          <div className="flex gap-2">
            <div
              className="inline-flex rounded-[var(--border-radius)] overflow-hidden border flex-shrink-0"
              style={{ borderColor: 'var(--color-glass-border)' }}
              role="group"
              aria-label="Contact type"
            >
              {(['email', 'whatsapp', 'line'] as ContactType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleContactTypeChange(type)}
                  className="px-2.5 py-2 text-xs font-medium capitalize transition-all border-l first:border-l-0"
                  style={{
                    background: contactType === type ? 'var(--color-accent)' : 'var(--color-glass-bg)',
                    color: contactType === type ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
                    borderColor: 'var(--color-glass-border)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {type === 'email' ? 'Email' : type === 'whatsapp' ? 'WhatsApp' : 'LINE'}
                </button>
              ))}
            </div>
            <input
              value={getContactValue()}
              onChange={(e) => handleContactValueChange(e.target.value)}
              placeholder={
                contactType === 'email'
                  ? 'customer@email.com'
                  : contactType === 'whatsapp'
                    ? '+66 81 234 5678'
                    : 'LINE ID'
              }
              type={contactType === 'email' ? 'email' : 'text'}
              className="glass glass-field flex-1 text-sm py-2 px-3"
              style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)' }}
            />
          </div>
          <ContactValidationHint contactType={contactType} value={getContactValue()} />
        </div>

        {/* Languages */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
          >
            Language{flags.length !== 1 ? 's' : ''} * {flags.length > 0 && (
              <span className="font-normal opacity-60">
                ({flags.map((f) => f.label).join(', ')})
              </span>
            )}
          </label>
          <LanguagePicker
            value={flags.map((f) => ({ code: f.code, label: f.label }))}
            onChange={handleLanguagesChange}
          />
        </div>
      </div>
    </GlassCard>
  )
}

// ── Contact Validation Hint ────────────────────────────────────────────────

function ContactValidationHint({ contactType, value }: { contactType: ContactType; value: string }) {
  const valid =
    !value ||
    (contactType === 'email' ? isValidEmail(value) :
    contactType === 'whatsapp' ? isValidWhatsApp(value) :
    isValidLine(value))

  const hint =
    contactType === 'email' ? 'Enter a valid email address' :
    contactType === 'whatsapp' ? 'Enter a valid phone number (e.g. +66 81 234 5678)' :
    'LINE ID must be at least 4 characters (letters, numbers, dots, underscores)'

  return (
    <span
      className="text-xs min-h-[1rem]"
      style={{
        color: 'var(--color-destructive)',
        fontFamily: 'var(--font-body)',
        opacity: valid ? 0 : 1,
        transition: 'opacity 150ms ease',
      }}
      aria-hidden={valid}
    >
      {hint}
    </span>
  )
}
