'use client'

import { useMutation, useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassCard, GlassInput } from '@/components/glass'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { AOW_MAIN, AOW_OVERFLOW, MANDATORY_AOW_SPECIALTIES } from '@/lib/constants/aow-specialties'
import { MAX_COURSE_DAYS } from '@/lib/constants/form-config'
import { LanguagePicker } from '@/components/common/language-picker'
import type { Language } from '@/lib/types/language'

interface DcLanguagesStepProps {
  onSaved: () => void
  onBack: () => void
}

export function DcLanguagesStep({ onSaved, onBack }: DcLanguagesStepProps) {
  const existing = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const update = useMutation(api.diveCenters.update)

  const [focusedLanguages, setFocusedLanguages] = useState<Language[]>([])
  const [owDays, setOwDays] = useState('')
  const [aowDays, setAowDays] = useState('')
  const [oaDays, setOaDays] = useState('')
  const [aowSpecialties, setAowSpecialties] = useState<string[]>([...MANDATORY_AOW_SPECIALTIES])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (existing !== undefined && me !== undefined && !initialized) {
      const langCodes: string[] = me?.customerLanguages ?? []
      setFocusedLanguages(
        langCodes
          .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
          .filter((l): l is NonNullable<typeof l> => l !== undefined)
          .map((l) => ({ code: l.code, label: l.label }))
      )
      setOwDays(existing?.bookingPreferences?.owDays?.toString() ?? '')
      setAowDays(existing?.bookingPreferences?.aowDays?.toString() ?? '')
      setOaDays(existing?.bookingPreferences?.oaDays?.toString() ?? '')
      setAowSpecialties([...new Set([...MANDATORY_AOW_SPECIALTIES, ...(existing?.bookingPreferences?.aowSpecialties ?? [])])])
      setInitialized(true)
    }
  }, [existing, me, initialized])

  function toggleSpecialty(s: string) {
    if (MANDATORY_AOW_SPECIALTIES.has(s)) return
    setAowSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      const owDaysNum = owDays ? parseInt(owDays, 10) : undefined
      const aowDaysNum = aowDays ? parseInt(aowDays, 10) : undefined
      const oaDaysNum = oaDays ? parseInt(oaDays, 10) : undefined
      const specialties = aowSpecialties.length > 0 ? aowSpecialties : undefined
      const hasPrefs = owDaysNum !== undefined || aowDaysNum !== undefined || oaDaysNum !== undefined || specialties !== undefined

      await update({
        bookingPreferences: hasPrefs
          ? { owDays: owDaysNum, aowDays: aowDaysNum, oaDays: oaDaysNum, aowSpecialties: specialties }
          : undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (existing === undefined || me === undefined) {
    return (
      <GlassCard padding="lg">
        <div className="flex items-center justify-center py-8">
          <span className="text-sm animate-pulse" style={{ color: 'var(--color-text-secondary)' }}>
            Loading…
          </span>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding="lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Languages & Preferences
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          What languages do you teach in, and how long are your courses?
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Languages Offered
          </p>
          <LanguagePicker value={focusedLanguages} onChange={setFocusedLanguages} />
        </div>

        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Default Course Durations <span style={{ fontWeight: 400 }}>(optional)</span>
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Used when creating bookings.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <GlassInput
              label="Open Water Days"
              type="number"
              min={1}
              max={MAX_COURSE_DAYS}
              value={owDays}
              onChange={(e) => setOwDays(e.target.value)}
              placeholder="4"
            />
            <GlassInput
              label="Advanced OW Days"
              type="number"
              min={1}
              max={MAX_COURSE_DAYS}
              value={aowDays}
              onChange={(e) => setAowDays(e.target.value)}
              placeholder="2"
            />
            <GlassInput
              label="Adventure Days"
              type="number"
              min={1}
              max={MAX_COURSE_DAYS}
              value={oaDays}
              onChange={(e) => setOaDays(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            AOW Specialties Offered <span style={{ fontWeight: 400 }}>(optional)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AOW_MAIN.map(({ value, label }) => {
              const checked = aowSpecialties.includes(value)
              const locked = MANDATORY_AOW_SPECIALTIES.has(value)
              return (
                <label
                  key={value}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{
                    background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
                    transitionDuration: 'var(--transition-speed)',
                  }}
                  aria-disabled={locked || undefined}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggleSpecialty(value)}
                  />
                  {label}
                  {locked && <Lock size={10} style={{ opacity: 0.7 }} />}
                </label>
              )
            })}
            {!showMore && (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer"
                style={{
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px dashed var(--color-glass-border)',
                }}
              >
                More…
              </button>
            )}
            {showMore && AOW_OVERFLOW.map(({ value, label }) => {
              const checked = aowSpecialties.includes(value)
              return (
                <label
                  key={value}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: checked ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                    color: checked ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
                    border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-glass-border)'}`,
                    transitionDuration: 'var(--transition-speed)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleSpecialty(value)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
        )}

        <div className="flex gap-3">
          <GlassButton variant="secondary" fullWidth onClick={onBack}>
            Back
          </GlassButton>
          <GlassButton
            variant="primary"
            fullWidth
            loading={saving}
            onClick={handleNext}
          >
            Next
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
