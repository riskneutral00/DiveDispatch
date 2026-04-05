import { Fragment } from 'react'
import { Plus } from 'lucide-react'

import { SpecialtyField } from '@/components/profiles/specialty-field'
import { DayPicker } from '@/components/ui/day-picker'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { Button } from '@/components/ui/button'
import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Select } from '@/components/ui/select'
import { ItemCard } from '@/components/ui/item-card'
import {
  AGENCIES,
  AGENCY_CODES,
  COURSE_DAY_RANGES,
  DIVE_AGENCIES,
  getDefaultSpecialties,
  type AgencyCourse,
} from '@/lib/constants/agencies'
import { COURSE_CODES } from '@/lib/constants/course-catalog'

const COURSE_LABELS: Record<string, string> = {
  DSD: 'Discover Scuba Diving',
  TRY_DIVE: 'Try Dive',
  OW: 'Open Water',
  AOW: 'Advanced Open Water',
  RESCUE: 'Rescue Diver',
  DM: 'Divemaster',
  FD: 'Fun Dive',
  REFRESH: 'Refresher / ReActivate',
  SPECIALTY: 'Specialty',
}

export type ProfileAgencyInfoVariant = 'dive-center' | 'agent' | 'instructor' | 'divemaster'

type AgencyRow = Record<string, unknown>

export interface ProfileAgencyInfoProps<TItem extends AgencyRow = AgencyRow> {
  variant: ProfileAgencyInfoVariant
  items: TItem[]
  onChange: (items: TItem[]) => void
  errors?: Record<string, string>
}

export function ProfileAgencyInfo<TItem extends AgencyRow = AgencyRow>({
  variant,
  items,
  onChange,
  errors = {},
}: ProfileAgencyInfoProps<TItem>) {
  const isPro = variant === 'instructor' || variant === 'divemaster'
  const isAgent = variant === 'agent'
  const isCenter = variant === 'dive-center'

  const sectionLabel = isPro ? 'Dive Credentials' : 'Affiliations'
  const addLabel = isPro ? 'Add Credential' : 'Add'
  const emptyMessage = isPro
    ? 'No credentials yet. Tap Add to get started.'
    : 'No affiliations yet. Tap Add to get started.'

  let keyCounter = 0
  function nextKey() { return `item-${Date.now()}-${++keyCounter}` }

  function makeDefaultItem() {
    const _key = nextKey()
    if (isCenter) {
      return {
        _key,
        agency: '',
        number: '',
        owDays: COURSE_DAY_RANGES.OW.min,
        aowDays: COURSE_DAY_RANGES.AOW.min,
        oaDays: COURSE_DAY_RANGES.combined.min,
        selectedSpecialties: getDefaultSpecialties('PADI'),
      }
    }
    if (isAgent) {
      return { _key, agency: '', number: '' }
    }
    if (variant === 'instructor') {
      return { _key, agency: '', level: '', agencyID: '', courses: [] }
    }
    // divemaster
    return { _key, agency: '', level: '', agencyID: '' }
  }

  function handleAdd() {
    onChange([...items, makeDefaultItem() as unknown as TItem])
  }

  function handleRemove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function handleUpdate(idx: number, patch: Record<string, unknown>) {
    const newItems = [...items] as TItem[]
    const updated = { ...(newItems[idx] as AgencyRow), ...patch } as TItem

    // If changing agency in a Dive Center, reset specialties
    if (isCenter && patch.agency && patch.agency !== (newItems[idx] as AgencyRow).agency) {
      ;(updated as AgencyRow).selectedSpecialties = getDefaultSpecialties(String(patch.agency))
    }

    newItems[idx] = updated
    onChange(newItems)
  }

  // --- RENDERING HELPERS ---

  function renderDiveCenterFields(item: AgencyRow, idx: number) {
    const agencyPrefix = AGENCIES[item.agency as keyof typeof AGENCIES]
    return (
      <div className="flex flex-col gap-4 items-start">
        {/* Agency + Member Number */}
        <div className="flex flex-wrap gap-2">
        <Select
          label="Agency"
          value={String((item as AgencyRow).agency ?? '')}
          onChange={(v) => handleUpdate(idx, { agency: v })}
          options={AGENCY_CODES.filter(
            (code) => code === item.agency || !items.some((a, i) => i !== idx && a.agency === code)
          ).map((code) => ({ id: code, label: AGENCIES[code as keyof typeof AGENCIES].name }))}
          placeholder="Select agency"
          required
        />
        <Input
          label="Member Number"
          value={String((item as AgencyRow).number ?? '')}
          onChange={(e) => handleUpdate(idx, { number: e.target.value })}
          placeholder="Member Number"
          required
          className="field-text-short"
        />
        </div>

        {/* Row 2 */}
        <div>
          <p className="text-sm font-medium mb-2 text-secondary">
            Default course #days<span style={{ color: 'var(--color-destructive)' }}> *</span>
          </p>
          <div className="flex gap-2">
            <DayPicker
              label={agencyPrefix?.courses.find((c: AgencyCourse) => c.code === 'OW')?.label ?? 'OW'}
              value={Number((item as AgencyRow).owDays)}
              min={COURSE_DAY_RANGES.OW.min}
              max={COURSE_DAY_RANGES.OW.max}
              onChange={(v) => handleUpdate(idx, { owDays: v })}
            />
            <DayPicker
              label={agencyPrefix?.courses.find((c: AgencyCourse) => c.code === 'AOW')?.label ?? 'AOW'}
              value={Number((item as AgencyRow).aowDays)}
              min={COURSE_DAY_RANGES.AOW.min}
              max={COURSE_DAY_RANGES.AOW.max}
              onChange={(v) => handleUpdate(idx, { aowDays: v })}
            />
            <DayPicker
              label={agencyPrefix?.combinedLabel ?? 'O+A'}
              value={Number((item as AgencyRow).oaDays)}
              min={COURSE_DAY_RANGES.combined.min}
              max={COURSE_DAY_RANGES.combined.max}
              onChange={(v) => handleUpdate(idx, { oaDays: v })}
            />
          </div>
        </div>
        <SpecialtyField
          agencyCode={String((item as AgencyRow).agency ?? '')}
          value={((item as AgencyRow).selectedSpecialties as string[] | undefined) ?? []}
          onChange={(specialties) => handleUpdate(idx, { selectedSpecialties: specialties })}
        />
      </div>
    )
  }

  function renderAgentFields(item: AgencyRow, idx: number) {
    return (
      <div className="flex flex-wrap gap-3 mb-4">
        <SimpleSelect
          label="Agency"
          value={String((item as AgencyRow).agency ?? '')}
          onChange={(v) => handleUpdate(idx, { agency: v })}
          options={DIVE_AGENCIES}
          placeholder="Select agency…"
          error={errors[`associations.${idx}.agency`]}
          required
          className="field-select-short"
        />
        <Input
          label="Agency Member ID"
          placeholder="e.g. 12345678"
          value={String((item as AgencyRow).number ?? '')}
          onChange={(e) => handleUpdate(idx, { number: e.target.value })}
          error={errors[`associations.${idx}.number`]}
          required
          className="field-text-short"
        />
      </div>
    )
  }

  function renderProFields(item: AgencyRow, idx: number) {
    const courseItems = COURSE_CODES.map((code) => ({ value: code, label: COURSE_LABELS[code] ?? code }))
    return (
      <Fragment>
        <div className="flex flex-wrap gap-3 mb-4">
          <SimpleSelect
            label="Agency"
            value={String((item as AgencyRow).agency ?? '')}
            onChange={(v) => handleUpdate(idx, { agency: v })}
            options={DIVE_AGENCIES}
            placeholder="Select agency…"
            error={errors[`credential.${idx}.agency`]}
            required
            className="field-select-short"
          />
          <Input
            label="Certification Level"
            placeholder={variant === 'instructor' ? 'e.g. Open Water Instructor' : 'e.g. Divemaster'}
            value={String((item as AgencyRow).level ?? '')}
            onChange={(e) => handleUpdate(idx, { level: e.target.value })}
            error={errors[`credential.${idx}.level`]}
            required
            className="field-text-short"
          />
          <Input
            label={variant === 'instructor' ? 'Agency Instructor ID' : 'Agency Member ID'}
            placeholder="e.g. 12345678"
            value={String((item as AgencyRow).agencyID ?? '')}
            onChange={(e) => handleUpdate(idx, { agencyID: e.target.value })}
            error={errors[`credential.${idx}.agencyID`]}
            className="field-text-short"
            required
          />
        </div>
        {variant === 'instructor' && (
          <CheckboxGroup
            label="Courses Taught"
            items={courseItems}
            selected={((item as AgencyRow).courses as string[] | undefined) ?? []}
            onChange={(values) => handleUpdate(idx, { courses: values })}
            error={errors[`credential.${idx}.courses`]}
            columns={3}
          />
        )}
      </Fragment>
    )
  }

  function renderVariantFields(item: AgencyRow, idx: number) {
    if (isCenter) return renderDiveCenterFields(item, idx)
    if (isAgent) return renderAgentFields(item, idx)
    return renderProFields(item, idx)
  }

  return (
    <div className="space-y-4">
      {!isCenter && (
        <FormSectionHeader
          label={sectionLabel}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
              <Plus size={14} />
              {addLabel}
            </Button>
          }
        />
      )}

      {errors.associations && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.associations}</p>
      )}
      {errors.credential && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.credential}</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-secondary">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <Fragment key={String((item as AgencyRow)._key ?? idx)}>
              <ItemCard
                onRemove={() => handleRemove(idx)}
                canRemove={isAgent ? true : items.length > 1}
                aria-label={`Remove ${sectionLabel.toLowerCase()}`}
              >
                {renderVariantFields(item, idx)}
              </ItemCard>
            </Fragment>
          ))}
        </div>
      )}

    </div>
  )
}
