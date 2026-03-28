'use client'

import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard } from '@/components/glass'
import type { Id } from '../../../convex/_generated/dataModel'

const QUICK_BOOK_OPTIONS = [
  { code: 'DSD' as const, label: 'Discover Scuba Diving' },
  { code: 'TRY_DIVE' as const, label: 'Try Dive' },
  { code: 'OW' as const, label: 'Open Water' },
  { code: 'AOW' as const, label: 'Advanced Open Water' },
  { code: 'RESCUE' as const, label: 'Rescue Diver' },
  { code: 'DM' as const, label: 'Dive Master' },
  { code: 'FD' as const, label: 'Fun Dive' },
  { code: 'REFRESH' as const, label: 'Refresher' },
  { code: 'SPECIALTY' as const, label: 'Specialty' },
]

import { type CourseCode } from '@/lib/constants/course-catalog'
import { ORGANIZER_ROLE_KEYS } from '@/lib/constants/roles'

import type { StakeholderRole } from '../../../convex/lib/validators'

interface StepPreferencesProps {
  userRole: string
  onComplete?: () => void
}

export function StepPreferences({ userRole, onComplete }: StepPreferencesProps) {
  const templates = useQuery(api.bookingTemplates.list, { activeRole: userRole as StakeholderRole })
  const createTemplate = useMutation(api.bookingTemplates.create)
  const removeTemplate = useMutation(api.bookingTemplates.remove)

  const isOrganizer = ORGANIZER_ROLE_KEYS.has(userRole as import('@/lib/constants/roles').ClerkRole)

  const [selectedCodes, setSelectedCodes] = useState<Set<CourseCode>>(new Set())
  const [pillName, setPillName] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  function toggleCode(code: CourseCode) {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function handleAddPill() {
    if (selectedCodes.size === 0) return
    const name = pillName.trim() || Array.from(selectedCodes).join(', ')
    setAdding(true)
    try {
      await createTemplate({ activeRole: userRole as StakeholderRole, name, activityType: Array.from(selectedCodes) })
      setSelectedCodes(new Set())
      setPillName('')
      setShowForm(false)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(id: Id<'bookingTemplates'>) {
    await removeTemplate({ id })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 className="text-primary"
          style={{ fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginBottom: 4 }}
        >
          Preferences
        </h2>
        <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
          {isOrganizer
            ? 'Set up Quick Book pills for your most common bookings. You can always add more later.'
            : 'Your preferences are ready. You can update your availability settings from the dashboard.'}
        </p>
      </div>

      {isOrganizer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Existing templates */}
          {templates && templates.length > 0 && (
            <div>
              <p className="text-secondary"
                style={{ fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8 }}
              >
                Quick Book pills
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map((t) => (
                  <GlassCard key={t._id} padding="sm" className="flex items-center gap-2" style={{ borderRadius: 'var(--border-radius-pill)' }}>
                    <span className="text-primary" style={{ fontSize: 13 }}>{t.name}</span>
                    <button className="text-secondary"
                      onClick={() => handleRemove(t._id)}
                      style={{ background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center' }}
                      aria-label={`Remove ${t.name}`}
                    >
                      <Trash2 size={12} strokeWidth={1.75} />
                    </button>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Add pill form */}
          {showForm ? (
            <GlassCard padding="md">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="text-primary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Select activity types for this pill:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {QUICK_BOOK_OPTIONS.map((opt) => {
                    const active = selectedCodes.has(opt.code)
                    return (
                      <button
                        key={opt.code}
                        onClick={() => toggleCode(opt.code)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--border-radius-pill)',
                          border: '1px solid',
                          borderColor: active ? 'var(--color-primary)' : 'var(--color-glass-border)',
                          background: active ? 'var(--color-primary)' : 'var(--color-glass-bg)',
                          color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                          fontSize: 13,
                          cursor: 'pointer',
                          transition: 'all var(--transition-speed) ease',
                          backdropFilter: 'blur(var(--glass-blur))',
                          WebkitBackdropFilter: 'blur(var(--glass-blur))',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <input className="text-primary"
                  value={pillName}
                  onChange={(e) => setPillName(e.target.value)}
                  placeholder="Pill name (optional — defaults to activity codes)"
                  style={{ width: '100%',
                    padding: '10px 14px',
                    fontSize: 14,
                    background: 'var(--color-glass-bg)',
                    border: '1px solid var(--color-glass-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    backdropFilter: 'blur(var(--glass-blur))',
                    WebkitBackdropFilter: 'blur(var(--glass-blur))',
                    outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={handleAddPill}
                    disabled={selectedCodes.size === 0 || adding}
                  >
                    {adding ? 'Adding…' : 'Add pill'}
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowForm(false); setSelectedCodes(new Set()); setPillName('') }}
                  >
                    Cancel
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setShowForm(true)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} strokeWidth={1.75} />
              Add Quick Book pill
            </GlassButton>
          )}
        </div>
      )}

      {onComplete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <GlassButton variant="primary" size="md" onClick={onComplete}>
            Continue
          </GlassButton>
        </div>
      )}
    </div>
  )
}
