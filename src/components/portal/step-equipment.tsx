'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '../ui/card'
import { FieldLabel } from '../ui/field-shell'
import { InlineError } from '../ui/inline-error'
import { Input } from '../ui/input'
import { NumberPicker } from '../ui/number-picker'
import { Button } from '../ui/button'
import { ButtonGroup } from '../ui/button-group'
import { Textarea } from '../ui/textarea'
import { DEFAULT_TEXTAREA_ROWS } from '@/lib/constants/form-config'
import { GEAR_TYPES, GEAR_TYPE_LABELS } from '@/lib/constants/gear-sizing'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { FieldRow } from '@/components/ui/field-row'

import type { HeightUnit, WeightUnit, ShoeSizeUnit } from '@/lib/utils/unit-conversion'
import { toHeightCm, toWeightKg, toShoeSizeNum } from '@/lib/utils/unit-conversion'
import { parseOptionalNumber } from '@/lib/utils/numbers'

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
  onComplete?: (data: EquipmentData) => void
}

function ToggleGroup({ options, value, onChange, 'aria-label': ariaLabel, hasError }: {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  'aria-label'?: string
  hasError?: boolean
}) {
  return (
    <ButtonGroup
      options={options.map((opt) => ({ value: opt, label: opt }))}
      value={value}
      onChange={onChange}
      variant="segment"
      size="md"
      aria-label={ariaLabel}
      className={hasError ? 'ring-2 ring-destructive' : ''}
    />
  )
}

const RENTAL_ITEMS: Array<{ key: keyof RentalChecklist; label: string }> =
  GEAR_TYPES.map((gt) => ({ key: gt as keyof RentalChecklist, label: GEAR_TYPE_LABELS[gt] }))

interface EquipmentErrors {
  rentalChecklist?: string
  heightCm?: string
  weightKg?: string
  shoeSize?: string
  prescriptionStrength?: string
}

interface ValidationMessages {
  rentalRequired: string
  heightRequired: string
  weightRequired: string
  shoeSizeRequired: string
  prescriptionRequired: string
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
  messages: ValidationMessages,
): EquipmentErrors {
  const errs: EquipmentErrors = {}

  const missingItems = RENTAL_ITEMS.filter((item) => !rentalChecklist[item.key])
  if (missingItems.length > 0) {
    errs.rentalChecklist = messages.rentalRequired
  }

  const hasAnyRental = RENTAL_ITEMS.some((item) => rentalChecklist[item.key] === 'rent')

  if (hasAnyRental) {
    const heightCm = toHeightCm(heightValue, heightUnit)
    const weightKg = toWeightKg(weightValue, weightUnit)
    if (!heightCm) errs.heightCm = messages.heightRequired
    if (!weightKg) errs.weightKg = messages.weightRequired

    if (rentalChecklist.fins === 'rent') {
      const shoeSize = toShoeSizeNum(shoeSizeValue)
      if (!shoeSize) errs.shoeSize = messages.shoeSizeRequired
    }

    if (rentalChecklist.mask === 'rent' && needsPoweredLenses === true) {
      if (!prescriptionDetails.trim()) {
        errs.prescriptionStrength = messages.prescriptionRequired
      }
    }
  }

  return errs
}

export function StepEquipment({ onChange, onComplete }: StepEquipmentProps) {
  const t = useTranslations('portal')
  const tCommon = useTranslations('common')

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

  const [attempted, setAttempted] = useState(false)

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

  const validationMessages: ValidationMessages = useMemo(() => ({
    rentalRequired: t('rentalRequired'),
    heightRequired: t('heightRequired'),
    weightRequired: t('weightRequired'),
    shoeSizeRequired: t('shoeSizeRequired'),
    prescriptionRequired: t('prescriptionRequired'),
  }), [t])

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
        validationMessages,
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
      validationMessages,
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
      validationMessages,
    )
    if (Object.keys(errs).length > 0) return
    onComplete?.(data)
  }

  return (
    <div className="space-y-6">
      <Card padding="md">
        <FormSectionHeader label={t('sectionBodyMeasurements')} note={t('bodyMeasurementsNote')} />

        <FieldRow>
          <fieldset className="field-lg border-none p-0 m-0">
            <legend className="sr-only">Height</legend>
            <FieldLabel className="block mb-1.5">{t('height')}</FieldLabel>
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <NumberPicker
                  value={parseOptionalNumber(heightValue)}
                  onChange={(v) => setHeightValue(v === undefined ? '' : String(v))}
                  min={heightUnit === 'cm' ? 100 : 36}
                  max={heightUnit === 'cm' ? 230 : 90}
                  step={heightUnit === 'cm' ? 1 : 1}
                  suffix={heightUnit === 'cm' ? ' cm' : ' in'}
                  aria-label="Height value"
                  error={displayErrors.heightCm}
                />
              </div>
              <ToggleGroup
                options={['cm', 'in'] as const}
                value={heightUnit}
                onChange={(v) => setHeightUnit(v as HeightUnit)}
                aria-label="Height unit"
              />
            </div>
          </fieldset>

          <fieldset className="field-lg border-none p-0 m-0">
            <legend className="sr-only">Weight</legend>
            <FieldLabel className="block mb-1.5">{t('weight')}</FieldLabel>
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <NumberPicker
                  value={parseOptionalNumber(weightValue)}
                  onChange={(v) => setWeightValue(v === undefined ? '' : String(v))}
                  min={weightUnit === 'kg' ? 30 : 66}
                  max={weightUnit === 'kg' ? 200 : 440}
                  step={1}
                  suffix={weightUnit === 'kg' ? ' kg' : ' lbs'}
                  aria-label="Weight value"
                  error={displayErrors.weightKg}
                />
              </div>
              <ToggleGroup
                options={['kg', 'lbs'] as const}
                value={weightUnit}
                onChange={(v) => setWeightUnit(v as WeightUnit)}
                aria-label="Weight unit"
              />
            </div>
          </fieldset>

          <fieldset className="field-lg border-none p-0 m-0">
            <legend className="sr-only">Shoe Size</legend>
            <FieldLabel className="block mb-1.5">{t('shoeSize')}</FieldLabel>
            <div className="flex gap-2 items-center">
              <Input
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
        </FieldRow>
      </Card>

      <Card padding="md">
        <FormSectionHeader label={t('sectionPrescriptionLenses')} />
        <p className="text-body mb-4 text-secondary">
          {t('prescriptionQuestion')}
        </p>

        <ButtonGroup
          options={[{ value: 'yes', label: tCommon('yes') }, { value: 'no', label: tCommon('no') }]}
          value={needsPoweredLenses === true ? 'yes' : needsPoweredLenses === false ? 'no' : ''}
          onChange={(v) => setNeedsPoweredLenses(v === 'yes')}
          variant="segment"
        />

        {needsPoweredLenses === true && (
          <div className="mt-4">
            <Textarea
              label={`${t('prescriptionDetails')}${rentalChecklist.mask === 'rent' ? ' *' : ''}`}
              value={prescriptionDetails}
              onChange={(e) => setPrescriptionDetails(e.target.value)}
              rows={DEFAULT_TEXTAREA_ROWS}
              error={displayErrors.prescriptionStrength}
            />
          </div>
        )}
      </Card>

      <Card padding="md">
        <FormSectionHeader label={t('sectionEquipmentRental')} />
        <p className="text-body mb-4 text-secondary">
          {t('rentalInstruction')}
        </p>

        <div className="space-y-3">
          {RENTAL_ITEMS.map(({ key, label }) => {
            const unanswered = attempted && !rentalChecklist[key]
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span
                  className="text-body font-medium"
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
            <InlineError>{displayErrors.rentalChecklist}</InlineError>
          )}
        </div>

        {showMaskPrescription && (
          <div
            className="mt-4 pt-4 border-t border-glass-border"
          >
            <Input
              label={t('maskPrescription')}
              type="text"
              value={maskPrescription}
              onChange={(e) => setMaskPrescription(e.target.value)}
              helperText={t('helperMaskPrescription')}
              className="field-md"
            />
          </div>
        )}
      </Card>

      {onComplete && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleComplete}
          >
            {tCommon('continue')}
          </Button>
        </div>
      )}
    </div>
  )
}
