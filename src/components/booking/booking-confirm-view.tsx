'use client'

import { useRouter } from 'next/navigation'
import { Check, Send, Users, Calendar } from 'lucide-react'
import { GlassCard, GlassButton } from '@/components/ui'
import { countryCodeToEmoji } from '@/components/ui/flag-emoji'
import { formatDateRange } from '@/lib/booking/booking-display'
import type { WizardState } from '@/lib/booking/wizard-state'

interface BookingConfirmViewProps {
  state: WizardState
}

export function BookingConfirmView({ state }: BookingConfirmViewProps) {
  const router = useRouter()
  const { customers, days, startDate, endDate } = state

  return (
    <div className="flex flex-col gap-4">
      {/* Success banner */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius)]"
        style={{
          background: 'color-mix(in srgb, var(--color-success, #34d399) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-success, #34d399) 30%, transparent)',
          color: 'var(--color-success, #34d399)',
        }}
      >
        <Check size={16} className="flex-shrink-0" />
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-body)' }}>
          Booking saved!
        </span>
      </div>

      {/* Customer list */}
      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <Users className="text-secondary" size={13} />
          <p
            className="text-xs font-semibold uppercase tracking-wider text-secondary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Customers ({customers.length})
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {customers.map((c, i) => {
            const contactLabel = c.contact?.email ?? c.contact?.whatsapp ?? c.contact?.line ?? ''
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-2 rounded-md"
                style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {c.flags?.[0] && (
                    <span className="text-base leading-none">{countryCodeToEmoji(c.flags[0].code)}</span>
                  )}
                  <span className="text-sm font-medium truncate text-primary">
                    {c.name || `Customer ${i + 1}`}
                  </span>
                  {contactLabel && (
                    <span className="text-xs truncate text-secondary">
                      {contactLabel}
                    </span>
                  )}
                </div>
                {c.linkSent ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, var(--color-success, #34d399) 15%, transparent)',
                      color: 'var(--color-success, #34d399)',
                    }}
                  >
                    Link sent
                  </span>
                ) : (
                  <GlassButton variant="ghost" size="sm" className="flex-shrink-0">
                    <Send size={11} />
                    Send link
                  </GlassButton>
                )}
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Booking summary */}
      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar className="text-secondary" size={13} />
          <p
            className="text-xs font-semibold uppercase tracking-wider text-secondary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Summary
          </p>
        </div>
        <div className="text-sm text-primary" style={{ fontFamily: 'var(--font-body)' }}>
          <p>{formatDateRange(startDate, endDate)}</p>
          <p className="mt-1">
            {days.length} day{days.length !== 1 ? 's' : ''} ·{' '}
            {days.reduce((sum, d) => sum + d.dives.length, 0)} dives
          </p>

          {/* Course pills */}
          {state.selectedCourses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {state.selectedCourses.map((code) => (
                <span
                  key={code}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                    color: 'var(--color-accent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                  }}
                >
                  {code}
                </span>
              ))}
            </div>
          )}

          {/* Day breakdown */}
          <div className="flex flex-col gap-1.5 mt-3">
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-secondary">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)' }}
                >
                  {i + 1}
                </span>
                <span>{d.date}</span>
                <span className="capitalize">{d.venueType}</span>
                <span className="ml-auto">{d.startTime}–{d.endTime}</span>
                <span>{d.dives.length} dive{d.dives.length !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Done button */}
      <div className="flex justify-center pt-2">
        <GlassButton variant="primary" size="md" onClick={() => router.push('/dashboard')}>
          Done
        </GlassButton>
      </div>
    </div>
  )
}
