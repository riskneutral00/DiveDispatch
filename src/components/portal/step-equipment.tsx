'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { GlassCard } from '../ui/glass-card'
import { GlassInput } from '../ui/glass-input'
import { GlassButton } from '../ui/glass-button'
import { GlassTextarea } from '../ui/glass-textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'

import type { HeightUnit, WeightUnit, ShoeSizeUnit } from '@/lib/utils/unit-conversion'
import { toHeightCm, toWeightKg, toShoeSizeNum } from '@/lib/utils/unit-conversion'

// ── Types ────────────────────────────────────────────────────────────────────

type RentalChoice = 'own' | 'rent'

type RentalChecklist = Record<
  'mask' | 'bcd' | 'wetsuit' | 'fins' | 'regulator',
  RentalChoice
>

export interface EquipmentData {
  heightCm?: number
  weightKg?: number
  shoeSize?: number
  shoeSizeUnit?: ShoeSizeUnit
  needsPoweredLenses?: boolean
  prescriptionStrength?: string
  rentalChecklist?: RentalChecklist & { maskPrescription?: string }
}

interface StepEquipmentProps {
  onChange: (data: EquipmentData) => void
  /** When provided, the component renders its own Continue button and
   * validates before calling this callback. */
  onComplete?: (data: EquipmentData) => void
}

// ── ToggleGroup ──────────────────────────────────────────────────────────────

interface ToggleGroupProps {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  'aria-label'?: string
  hasError?: boolean
}

function ToggleGroup({ options, value, onChange, 'aria-label': ariaLabel, hasError }: ToggleGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden border flex-shrink-0"
      style={{
        borderColor: hasError ? 'var(--color-destructive)' : 'var(--color-glass-border)',
        borderRadius: 'var(--border-radius)',
      }}
    >
      {options.map((opt) => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={selected}
            className="px-3 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2"
            style={{
              background: selected
                ? 'var(--color-primary)'
                : 'var(--color-glass-bg)',
              color: selected
                ? 'var(--color-text-on-primary)'
                : 'var(--color-text-secondary)',
              transitionDuration: 'var(--transition-speed)',
              outlineColor: 'var(--color-primary-glow)',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Rental items config ──────────────────────────────────────────────────────

const RENTAL_ITEMS: Array<{ key: keyof RentalChecklist; label: string }> = [
  { key: 'mask', label: 'Mask' },
  { key: 'bcd', label: 'BCD' },
  { key: 'wetsuit', label: 'Wetsuit' },
  { key: 'fins', label: 'Fins' },
  { key: 'regulator', label: 'Regulator' },
]

// ── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({
  children,
  note,
}: {
  children: React.ReactNode
  note?: string
}) {
  return (
    <div className="flex items-baseline gap-2 mb-4">
      <h3
        className="text-base font-semibold text-primary"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {children}
      </h3>
      {note && (
        <span className="text-sm text-secondary">
          {note}
        </span>
      )}
    </div>
  )
}

// ── Validation ───────────────────────────────────────────────────────────────

interface EquipmentErrors {
  rentalChecklist?: string
  heightCm?: string
  weightKg?: string
  shoeSize?: string
  prescriptionStrength?: string
}

function validateEquipment(
  rentalChecklist: Partial<RentalChecklist>,
  heightValue: string,
  heightUnit: HeightUnit,
  weightValue: string,
  weightUnit: WeightUnit,
  shoeSizeValue: string,
  needsPoweredLenses: boolean | null,
  prescriptionDetails: string,
): EquipmentErrors {
  const errs: EquipmentErrors = {}

  // All 5 rental items must be answered
  const missingItems = RENTAL_ITEMS.filter((item) => !rentalChecklist[item.key])
  if (missingItems.length > 0) {
    errs.rentalChecklist = 'Please select Own or Rent for all equipment items.'
  }

  const hasAnyRental = RENTAL_ITEMS.some((item) => rentalChecklist[item.key] === 'rent')

  if (hasAnyRental) {
    const heightCm = toHeightCm(heightValue, heightUnit)
    const weightKg = toWeightKg(weightValue, weightUnit)
    if (!heightCm) errs.heightCm = 'Height is required when renting equipment.'
    if (!weightKg) errs.weightKg = 'Weight is required when renting equipment.'

    if (rentalChecklist.fins === 'rent') {
      const shoeSize = toShoeSizeNum(shoeSizeValue)
      if (!shoeSize) errs.shoeSize = 'Shoe size is required when renting fins.'
    }

    if (rentalChecklist.mask === 'rent' && needsPoweredLenses === true) {
      if (!prescriptionDetails.trim()) {
        errs.prescriptionStrength = 'Prescription details are required for powered lens rental.'
      }
    }
  }

  return errs
}

// ── Component ────────────────────────────────────────────────────────────────

export function StepEquipment({ onChange, onComplete }: StepEquipmentProps) {
  const [heightValue, setHeightValue] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [shoeSizeValue, setShoeSizeValue] = useState('')
  const [shoeSizeUnit, setShoeSizeUnit] = useState<ShoeSizeUnit>('EU')

  const [needsPoweredLenses, setNeedsPoweredLenses] = useState<boolean | null>(null)
  const [prescriptionDetails, setPrescriptionDetails] = useState('')

  const [rentalChecklist, setRentalChecklist] = useState<Partial<RentalChecklist>>({})
  const [maskPrescription, setMaskPrescription] = useState('')

  // Show validation errors only after first submit attempt
  const [attempted, setAttempted] = useState(false)

  // Stable ref for onChange so we don't trigger infinite effect loops when
  // the parent passes an inline function.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const showMaskPrescription =
    rentalChecklist.mask === 'rent' && needsPoweredLenses === true

  const data = useMemo((): EquipmentData => {
    const heightCm = toHeightCm(heightValue, heightUnit)
    const weightKg = toWeightKg(weightValue, weightUnit)
    const shoeSize = toShoeSizeNum(shoeSizeValue)

    const { mask, bcd, wetsuit, fins, regulator } = rentalChecklist
    const allChosen = mask && bcd && wetsuit && fins && regulator

    return {
      ...(heightCm !== undefined && { heightCm }),
      ...(weightKg !== undefined && { weightKg }),
      ...(shoeSize !== undefined && { shoeSize, shoeSizeUnit }),
      ...(needsPoweredLenses !== null && { needsPoweredLenses }),
      ...(needsPoweredLenses === true && prescriptionDetails.trim()
        ? { prescriptionStrength: prescriptionDetails.trim() }
        : {}),
      ...(allChosen
        ? {
            rentalChecklist: {
              mask,
              bcd,
              wetsuit,
              fins,
              regulator,
              ...(showMaskPrescription && maskPrescription.trim()
                ? { maskPrescription: maskPrescription.trim() }
                : {}),
            },
          }
        : {}),
    }
  }, [
    heightValue,
    heightUnit,
    weightValue,
    weightUnit,
    shoeSizeValue,
    shoeSizeUnit,
    needsPoweredLenses,
    prescriptionDetails,
    rentalChecklist,
    maskPrescription,
    showMaskPrescription,
  ])

  useEffect(() => {
    onChangeRef.current(data)
  }, [data])

  // Compute current validation errors (for display when attempted=true)
  const validationErrors = useMemo(
    () =>
      validateEquipment(
        rentalChecklist,
        heightValue,
        heightUnit,
        weightValue,
        weightUnit,
        shoeSizeValue,
        needsPoweredLenses,
        prescriptionDetails,
      ),
    [
      rentalChecklist,
      heightValue,
      heightUnit,
      weightValue,
      weightUnit,
      shoeSizeValue,
      needsPoweredLenses,
      prescriptionDetails,
    ],
  )

  const displayErrors = attempted ? validationErrors : {}

  function handleRentalChange(key: keyof RentalChecklist, value: RentalChoice) {
    setRentalChecklist((prev) => ({ ...prev, [key]: value }))
  }

  function handleComplete() {
    setAttempted(true)
    const errs = validateEquipment(
      rentalChecklist,
      heightValue,
      heightUnit,
      weightValue,
      weightUnit,
      shoeSizeValue,
      needsPoweredLenses,
      prescriptionDetails,
    )
    if (Object.keys(errs).length > 0) return
    onComplete?.(data)
  }

  return (
    <div className="space-y-6">
      {/* ── Body Measurements ─────────────────────────────────────────── */}
      <GlassCard padding="md">
        <SectionHeading note="(required when renting)">Body Measurements</SectionHeading>

        <div className="space-y-4">
          {/* Height */}
          <fieldset className="border-none p-0 m-0">
            <legend className="sr-only">Height</legend>
            <label
              className="text-sm font-medium block mb-1.5 text-secondary"
            >
              Height
            </label>
            <div className="flex gap-2 items-center">
              <GlassInput
                type="number"
                inputMode="decimal"
                placeholder={heightUnit === 'cm' ? '175' : '5.9'}
                value={heightValue}
                onChange={(e) => setHeightValue(e.target.value)}
                min="0"
                className="flex-1 min-w-0"
                aria-label="Height value"
                error={displayErrors.heightCm}
              />
              <ToggleGroup
                options={['cm', 'in'] as const}
                value={heightUnit}
                onChange={(v) => setHeightUnit(v as HeightUnit)}
                aria-label="Height unit"
              />
            </div>
          </fieldset>

          {/* Weight */}
          <fieldset className="border-none p-0 m-0">
            <legend className="sr-only">Weight</legend>
            <label
              className="text-sm font-medium block mb-1.5 text-secondary"
            >
              Weight
            </label>
            <div className="flex gap-2 items-center">
              <GlassInput
                type="number"
                inputMode="decimal"
                placeholder={weightUnit === 'kg' ? '70' : '154'}
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                min="0"
                className="flex-1 min-w-0"
                aria-label="Weight value"
                error={displayErrors.weightKg}
              />
              <ToggleGroup
                options={['kg', 'lbs'] as const}
                value={weightUnit}
                onChange={(v) => setWeightUnit(v as WeightUnit)}
                aria-label="Weight unit"
              />
            </div>
          </fieldset>

          {/* Shoe size */}
          <fieldset className="border-none p-0 m-0">
            <legend className="sr-only">Shoe Size</legend>
            <label
              className="text-sm font-medium block mb-1.5 text-secondary"
            >
              Shoe Size
            </label>
            <div className="flex gap-2 items-center">
              <GlassInput
                type="text"
                inputMode="decimal"
                placeholder={
                  shoeSizeUnit === 'EU' ? '42' : shoeSizeUnit === 'US' ? '9' : '27'
                }
                value={shoeSizeValue}
                onChange={(e) => setShoeSizeValue(e.target.value)}
                className="flex-1 min-w-0"
                aria-label="Shoe size value"
                error={displayErrors.shoeSize}
              />
              <ToggleGroup
                options={['EU', 'US', 'CM'] as const}
                value={shoeSizeUnit}
                onChange={(v) => setShoeSizeUnit(v as ShoeSizeUnit)}
                aria-label="Shoe size unit"
              />
            </div>
          </fieldset>
        </div>
      </GlassCard>

      {/* ── Corrective Lenses ─────────────────────────────────────────── */}
      <GlassCard padding="md">
        <SectionHeading>Corrective Lenses</SectionHeading>
        <p className="text-sm mb-4 text-secondary">
          Do you need prescription (powered) lenses in your mask?
        </p>

        <fieldset>
          <legend className="sr-only">Needs powered lenses</legend>
          <div className="flex gap-6">
            {(['Yes', 'No'] as const).map((opt) => {
              const isSelected = needsPoweredLenses === (opt === 'Yes')
              return (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="poweredLenses"
                    value={opt}
                    checked={isSelected}
                    onChange={() => setNeedsPoweredLenses(opt === 'Yes')}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      borderColor: isSelected
                        ? 'var(--color-primary)'
                        : 'var(--color-glass-border)',
                      background: isSelected ? 'var(--color-primary)' : 'transparent',
                      transitionDuration: 'var(--transition-speed)',
                    }}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-white block" />
                    )}
                  </span>
                  <span
                    className="text-sm font-medium text-primary"
                  >
                    {opt}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {needsPoweredLenses === true && (
          <div className="mt-4">
            <GlassTextarea
              label={`Prescription Details${rentalChecklist.mask === 'rent' ? ' *' : ''}`}
              value={prescriptionDetails}
              onChange={(e) => setPrescriptionDetails(e.target.value)}
              placeholder="e.g. Left: −2.00, Right: −2.50"
              rows={DEFAULT_TEXTAREA_ROWS}
              error={displayErrors.prescriptionStrength}
            />
          </div>
        )}
      </GlassCard>

      {/* ── Equipment Rental ──────────────────────────────────────────── */}
      <GlassCard padding="md">
        <SectionHeading>Equipment Rental</SectionHeading>
        <p className="text-sm mb-4 text-secondary">
          Will you bring your own gear or rent from us?
        </p>

        <div className="space-y-3">
          {RENTAL_ITEMS.map(({ key, label }) => {
            const unanswered = attempted && !rentalChecklist[key]
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span
                  className="text-sm font-medium"
                  style={{
                    color: unanswered ? 'var(--color-destructive)' : 'var(--color-text-primary)',
                  }}
                >
                  {label}
                  {unanswered && ' *'}
                </span>
                <ToggleGroup
                  options={['own', 'rent'] as const}
                  value={rentalChecklist[key] ?? ''}
                  onChange={(v) => handleRentalChange(key, v as RentalChoice)}
                  aria-label={`${label} own or rent`}
                  hasError={unanswered}
                />
              </div>
            )
          })}
        </div>

        <div aria-live="polite" data-error-for="rentalChecklist" className="mt-3">
          {displayErrors.rentalChecklist && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {displayErrors.rentalChecklist}
            </p>
          )}
        </div>

        {/* Mask prescription — only when renting mask + needs powered lenses */}
        {showMaskPrescription && (
          <div
            className="mt-4 pt-4 border-t"
            style={{ borderColor: 'var(--color-glass-border)' }}
          >
            <GlassInput
              label="Mask Prescription"
              type="text"
              placeholder="e.g. −2.00 / −2.50"
              value={maskPrescription}
              onChange={(e) => setMaskPrescription(e.target.value)}
              helperText="Enter your prescription strength for the rental mask."
            />
          </div>
        )}
      </GlassCard>

      {/* Continue button — only rendered when parent passes onComplete */}
      {onComplete && (
        <div className="flex justify-end">
          <GlassButton
            type="button"
            variant="primary"
            size="md"
            onClick={handleComplete}
          >
            Continue
          </GlassButton>
        </div>
      )}
    </div>
  )
}
