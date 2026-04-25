'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api, type Doc, type Id } from '@/lib/convex-generated'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { NameField } from '@/components/ui/name-field'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { FieldRow } from '@/components/ui/field-row'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker'
import {
  GAS_MIX_OPTIONS,
  NITROX_MIN_PERCENT,
  NITROX_MAX_PERCENT,
  NITROX_DEFAULT_MIN,
  NITROX_DEFAULT_MAX,
  type GasMix,
} from '@/lib/constants/gas-mixes'
import { COMPRESSOR_LOCATIONS, type CompressorLocation } from '../../../convex/shared/compressorTypes'

export interface CompressorEditValue {
  name: string
  location: CompressorLocation
  boatId: Id<'boats'> | null
  venueId: Id<'venues'> | null
  venueLocation: LocationValue | null
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export const EMPTY_COMPRESSOR_EDIT: CompressorEditValue = {
  name: '',
  location: 'fixed',
  boatId: null,
  venueId: null,
  venueLocation: null,
  gasMixes: [],
  nitroxMin: undefined,
  nitroxMax: undefined,
}

interface CompressorEditDialogProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialValue?: CompressorEditValue
  onSubmit: (value: CompressorEditValue) => Promise<void>
}

export function CompressorEditDialog({
  open,
  onClose,
  mode,
  initialValue,
  onSubmit,
}: CompressorEditDialogProps) {
  const t = useTranslations('common')
  const boatProfile = useQuery(api.boats.mine) as Doc<'boats'> | null | undefined
  const venues = useQuery(api.venues.mine) as Doc<'venues'>[] | undefined

  const locationOptions = useMemo(
    () => COMPRESSOR_LOCATIONS.map((loc) => ({
      value: loc,
      label: t(`compressorLocations.${loc}`),
    })),
    [t],
  )

  const [form, setForm] = useState<CompressorEditValue>(initialValue ?? EMPTY_COMPRESSOR_EDIT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialValue ?? EMPTY_COMPRESSOR_EDIT)
      setError(null)
    }
  }, [open, initialValue])

  const boatOptions = useMemo(() => {
    if (!boatProfile) return []
    const entries = (boatProfile.fleet ?? []).map((v) => v.boatName).filter(Boolean)
    return entries.map((label) => ({ value: boatProfile._id, label }))
  }, [boatProfile])

  const venueOptions = useMemo(
    () =>
      (venues ?? []).map((venue) => ({
        value: venue._id,
        label: venue.name,
      })),
    [venues],
  )

  const needsBoat = form.location === 'boat'
  const needsVenue = form.location === 'venue'
  const nitroxSelected = form.gasMixes.includes('nitrox')

  const canSubmit =
    form.name.trim().length > 0 &&
    form.gasMixes.length > 0 &&
    (!needsBoat || form.boatId !== null) &&
    (!needsVenue || form.venueId !== null) &&
    (!nitroxSelected || (form.nitroxMin !== undefined && form.nitroxMax !== undefined))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actionFailed', { action: t('save') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('addCompressor') : t('editCompressor')}
      size="lg"
    >
      <div className="space-y-4">
        <NameField
          scope="organization"
          label={t('compressorName')}
          value={form.name}
          onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
          required
        />
        <SimpleSelect
          label={t('locationType')}
          value={form.location}
          onChange={(v) => {
            const next = v as CompressorLocation
            setForm((prev) => ({
              ...prev,
              location: next,
              boatId: next === 'boat' ? prev.boatId : null,
              venueId: next === 'venue' ? prev.venueId : null,
            }))
          }}
          options={locationOptions}
          required
        />

        {needsBoat && (
          <SimpleSelect
            label={t('linkedBoat')}
            value={form.boatId ?? ''}
            onChange={(v) =>
              setForm((prev) => ({ ...prev, boatId: v ? (v as Id<'boats'>) : null }))
            }
            options={[{ value: '', label: t('selectABoat') }, ...boatOptions]}
            required
          />
        )}

        {needsVenue && (
          <SimpleSelect
            label={t('linkedVenue')}
            value={form.venueId ?? ''}
            onChange={(v) =>
              setForm((prev) => ({ ...prev, venueId: v ? (v as Id<'venues'>) : null }))
            }
            options={[{ value: '', label: t('selectAVenue') }, ...venueOptions]}
            required
          />
        )}

        {form.location === 'fixed' && (
          <LocationPicker
            label={t('address')}
            value={form.venueLocation}
            onChange={(loc) => setForm((prev) => ({ ...prev, venueLocation: loc }))}
          />
        )}

        <CheckboxGroup
          label={t('gasMixes')}
          items={GAS_MIX_OPTIONS.map(({ value, label }) => ({ value, label }))}
          selected={form.gasMixes}
          onChange={(values) => {
            const next = values as GasMix[]
            setForm((prev) => ({
              ...prev,
              gasMixes: next,
              nitroxMin: next.includes('nitrox') && prev.nitroxMin === undefined ? NITROX_DEFAULT_MIN : prev.nitroxMin,
              nitroxMax: next.includes('nitrox') && prev.nitroxMax === undefined ? NITROX_DEFAULT_MAX : prev.nitroxMax,
            }))
          }}
          columns={2}
          required
        />

        {nitroxSelected && (
          <FieldRow density="compact">
            <NumberPicker
              className="field-sm"
              label={t('nitroxMinPercent')}
              value={form.nitroxMin}
              onChange={(v) => setForm((prev) => ({ ...prev, nitroxMin: v }))}
              min={NITROX_MIN_PERCENT}
              max={NITROX_MAX_PERCENT}
              suffix="%"
            />
            <NumberPicker
              className="field-sm"
              label={t('nitroxMaxPercent')}
              value={form.nitroxMax}
              onChange={(v) => setForm((prev) => ({ ...prev, nitroxMax: v }))}
              min={NITROX_MIN_PERCENT}
              max={NITROX_MAX_PERCENT}
              suffix="%"
            />
          </FieldRow>
        )}

        {error && <div className="text-destructive text-body">{error}</div>}

        <DialogFooter
          className="pt-2"
          primaryLabel={mode === 'create' ? t('addCompressor') : t('save')}
          onPrimary={handleSubmit}
          primaryDisabled={!canSubmit || saving}
          primaryLoading={saving}
          secondaryLabel={t('cancel')}
          onSecondary={onClose}
          secondaryDisabled={saving}
        />
      </div>
    </Dialog>
  )
}
