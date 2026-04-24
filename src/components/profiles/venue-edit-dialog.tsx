'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { NameField } from '@/components/ui/name-field'
import { NumberPicker } from '@/components/ui/number-picker'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldLabel } from '@/components/ui/field-shell'
import { LocationPicker, type LocationValue } from '@/components/profiles/location-picker-lazy'
import {
  VENUE_SUBTYPES,
  RANGE_BY_SUBTYPE,
  SUBTYPES_WITH_OPTIONAL_CONFINED,
  CAPABILITIES_REQUIRED_BY_SUBTYPE,
  type VenueSubtype,
} from '@/lib/constants/venue-subtypes'

const SUBTYPE_LABELS: Record<VenueSubtype, string> = {
  pool: 'Pool',
  shore: 'Shore',
  reef: 'Reef',
  lake: 'Lake',
  river: 'River',
  quarry: 'Quarry',
  other: 'Other',
}

const SUBTYPE_OPTIONS = VENUE_SUBTYPES.map((s) => ({ value: s, label: SUBTYPE_LABELS[s] }))

export interface VenueEditValue {
  name: string
  subtype: VenueSubtype
  location: LocationValue | null
  maxDepth: number
  maxCapacity: number
  confinedCapable: boolean
  hasCompressor: boolean
  isAllowed: string[]
  notAllowed: string[]
}

export const EMPTY_VENUE_EDIT: VenueEditValue = {
  name: '',
  subtype: 'pool',
  location: null,
  maxDepth: 0,
  maxCapacity: 0,
  confinedCapable: false,
  hasCompressor: false,
  isAllowed: [],
  notAllowed: [],
}

interface VenueEditDialogProps {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialValue?: VenueEditValue
  onSubmit: (value: VenueEditValue) => Promise<void>
}

export function VenueEditDialog({ open, onClose, mode, initialValue, onSubmit }: VenueEditDialogProps) {
  const t = useTranslations('common')
  const [form, setForm] = useState<VenueEditValue>(initialValue ?? EMPTY_VENUE_EDIT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialValue ?? EMPTY_VENUE_EDIT)
      setError(null)
    }
  }, [open, initialValue])

  const range = RANGE_BY_SUBTYPE[form.subtype]
  const showConfinedToggle = SUBTYPES_WITH_OPTIONAL_CONFINED.has(form.subtype)
  const capabilitiesRequired = CAPABILITIES_REQUIRED_BY_SUBTYPE.has(form.subtype)

  const canSubmit =
    form.name.trim().length > 0 &&
    form.location !== null &&
    (!capabilitiesRequired || (form.maxDepth > 0 && form.maxCapacity > 0))

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('addVenue') : t('editVenue')}
      size="lg"
    >
      <div className="space-y-4">
        <NameField
          scope="organization"
          label="Venue Name"
          value={form.name}
          onChange={(v) => setForm((prev) => ({ ...prev, name: v }))}
          required
        />
        <SimpleSelect
          label="Venue Type"
          value={form.subtype}
          onChange={(v) => setForm((prev) => ({ ...prev, subtype: v as VenueSubtype }))}
          options={SUBTYPE_OPTIONS}
          required
        />
        <LocationPicker
          label="Location"
          value={form.location}
          onChange={(loc) => setForm((prev) => ({ ...prev, location: loc }))}
          required
        />
        <div className="flex flex-wrap gap-3">
          <NumberPicker
            label="Max Depth (m)"
            value={form.maxDepth || undefined}
            onChange={(v) => setForm((prev) => ({ ...prev, maxDepth: v ?? 0 }))}
            min={1}
            max={range.maxDepth}
            step={0.5}
            decimals={1}
            required={capabilitiesRequired}
          />
          <NumberPicker
            label="Max Capacity"
            value={form.maxCapacity || undefined}
            onChange={(v) => setForm((prev) => ({ ...prev, maxCapacity: v ?? 0 }))}
            min={1}
            max={range.maxCapacity}
            required={capabilitiesRequired}
          />
        </div>
        {showConfinedToggle && (
          <Checkbox
            label="Confined Water Capable"
            checked={form.confinedCapable}
            onChange={(v) => setForm((prev) => ({ ...prev, confinedCapable: v }))}
          />
        )}
        <Checkbox
          label="Has Compressor onsite"
          checked={form.hasCompressor}
          onChange={(v) => setForm((prev) => ({ ...prev, hasCompressor: v }))}
        />

        <DiveCenterAccessPicker
          isAllowed={form.isAllowed}
          notAllowed={form.notAllowed}
          onIsAllowedChange={(v) => setForm((prev) => ({ ...prev, isAllowed: v }))}
          onNotAllowedChange={(v) => setForm((prev) => ({ ...prev, notAllowed: v }))}
        />

        {error && <div className="text-destructive text-body">{error}</div>}

        <DialogFooter
          className="pt-2"
          primaryLabel={mode === 'create' ? t('addVenue') : t('save')}
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

interface DiveCenterAccessPickerProps {
  isAllowed: string[]
  notAllowed: string[]
  onIsAllowedChange: (next: string[]) => void
  onNotAllowedChange: (next: string[]) => void
}

function DiveCenterAccessPicker({
  isAllowed,
  notAllowed,
  onIsAllowedChange,
  onNotAllowedChange,
}: DiveCenterAccessPickerProps) {
  const diveCenters = useQuery(api.directory.listByRole, { role: 'DiveCenter' })
  const allowedSet = new Set(isAllowed)
  const blockedSet = new Set(notAllowed)

  const toggleAllowed = (slug: string) => {
    const next = new Set(allowedSet)
    if (next.has(slug)) next.delete(slug)
    else {
      next.add(slug)
      if (blockedSet.has(slug)) {
        const nextBlocked = new Set(blockedSet)
        nextBlocked.delete(slug)
        onNotAllowedChange(Array.from(nextBlocked))
      }
    }
    onIsAllowedChange(Array.from(next))
  }

  const toggleBlocked = (slug: string) => {
    const next = new Set(blockedSet)
    if (next.has(slug)) next.delete(slug)
    else {
      next.add(slug)
      if (allowedSet.has(slug)) {
        const nextAllowed = new Set(allowedSet)
        nextAllowed.delete(slug)
        onIsAllowedChange(Array.from(nextAllowed))
      }
    }
    onNotAllowedChange(Array.from(next))
  }

  if (diveCenters === undefined) {
    return <p className="text-body-sm text-secondary">Loading dive centers…</p>
  }

  if (diveCenters.length === 0) {
    return (
      <p className="text-body-sm text-secondary">
        No dive centers found. Access control can be configured once dive centers sign up.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor="dc-access">Dive Center Access</FieldLabel>
      <p className="text-body-sm text-secondary">
        Leave both columns blank to allow every dive center. Check Allow to whitelist specific dive
        centers (others blocked); check Block to blacklist specific dive centers (others allowed).
      </p>
      <div id="dc-access" className="glass-container rounded-theme p-3 space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-body-sm font-medium text-secondary pb-1 border-b border-glass-border">
          <span>Dive Center</span>
          <span className="w-12 text-center">Allow</span>
          <span className="w-12 text-center">Block</span>
        </div>
        {diveCenters.map((dc) => (
          <div
            key={dc.slug}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center"
          >
            <span className="truncate text-body">{dc.name}</span>
            <div className="w-12 flex justify-center">
              <Checkbox
                label=""
                checked={allowedSet.has(dc.slug)}
                onChange={() => toggleAllowed(dc.slug)}
                aria-label={`Allow ${dc.name}`}
              />
            </div>
            <div className="w-12 flex justify-center">
              <Checkbox
                label=""
                checked={blockedSet.has(dc.slug)}
                onChange={() => toggleBlocked(dc.slug)}
                aria-label={`Block ${dc.name}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
