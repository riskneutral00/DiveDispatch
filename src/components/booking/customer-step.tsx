'use client'

import { AlertTriangle, Plus, Trash2, User } from 'lucide-react'
import { GlassButton, GlassCard } from '@/components/glass'
import { countryCodeToEmoji } from '@/components/common/flag-emoji'
import { hasLanguageConflict } from '@/lib/utils/language-matching'
import type { CustomerData, WizardAction } from '@/lib/booking/wizard-state'
import type { Dispatch } from 'react'

interface CustomerStepProps {
  customers: CustomerData[]
  dispatch: Dispatch<WizardAction>
  onAddOpen: () => void
}

export function CustomerStep({ customers, dispatch, onAddOpen }: CustomerStepProps) {
  const conflict = hasLanguageConflict(
    customers.map((c) => ({ flags: c.flags?.map((f) => ({ code: f.code, label: f.label })) })),
  )

  return (
    <div className="flex flex-col gap-4">
      {customers.length === 0 ? (
        <div
          className="text-center py-10 text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          No customers yet. Add at least one to continue.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((customer, idx) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              index={idx}
              onRemove={() => dispatch({ type: 'REMOVE_CUSTOMER', id: customer.id })}
            />
          ))}
        </div>
      )}

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

      <GlassButton variant="secondary" size="md" onClick={onAddOpen} className="w-full">
        <Plus size={15} />
        Add Customer
      </GlassButton>
    </div>
  )
}

interface CustomerCardProps {
  customer: CustomerData
  index: number
  onRemove: () => void
}

function CustomerCard({ customer, index, onRemove }: CustomerCardProps) {
  const flags = customer.flags ?? []
  const courseCount = customer.courseEntries?.length ?? 0
  const linkSent = customer.linkSent

  return (
    <GlassCard padding="sm" elevated>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
          style={{
            background: 'var(--color-glass-bg)',
            border: '1px solid var(--color-glass-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {customer.name ? (
            customer.name.charAt(0).toUpperCase()
          ) : (
            <User size={14} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
          >
            {customer.name || `Customer ${index + 1}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {flags.map((f) => (
              <span key={f.code} className="text-sm leading-none" title={f.label}>
                {countryCodeToEmoji(f.code)}
              </span>
            ))}
            {courseCount > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {courseCount} course{courseCount !== 1 ? 's' : ''}
              </span>
            )}
            {linkSent && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-success, #10b981) 15%, transparent)',
                  color: 'var(--color-success, #10b981)',
                }}
              >
                Link sent
              </span>
            )}
          </div>
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-destructive)' }}
          title="Remove customer"
          aria-label={`Remove ${customer.name || `customer ${index + 1}`}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </GlassCard>
  )
}
