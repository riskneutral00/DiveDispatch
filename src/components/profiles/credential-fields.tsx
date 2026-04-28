import { Fragment } from 'react'

import { CheckboxGroup } from '@/components/ui/checkbox-group'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { AGENCIES, DIVE_AGENCIES } from '@/lib/constants/agencies'

import type { PersonalCredential } from './personal-profile-form'

export interface CredentialFieldsErrors {
  agency?: string
  level?: string
  agencyID?: string
  specialtyRatings?: string
}

interface CredentialFieldsProps {
  value: PersonalCredential
  onChange: (next: PersonalCredential) => void
  errors?: CredentialFieldsErrors
}

export function CredentialFields({ value, onChange, errors = {} }: CredentialFieldsProps) {
  const selectedAgency = value.agency
  const selectedLevel = value.level
  const agencyDef = selectedAgency ? AGENCIES[selectedAgency] : undefined
  const levelOptions = (agencyDef ?? AGENCIES['PADI']).levels.map((l) => l.code)
  const ratingItems = (agencyDef?.specialties ?? [])
    .filter((s) => s.specialtyCourseName !== null)
    .map((s) => ({ value: s.code, label: s.label }))

  return (
    <Fragment>
      <div className="flex flex-wrap gap-3 mb-4">
        <SimpleSelect
          label="Agency"
          value={selectedAgency}
          onChange={(v) => onChange({ ...value, agency: v, level: '', agencyID: '' })}
          options={DIVE_AGENCIES}
          error={errors.agency}
          required
          className="field-sm"
        />
        <SimpleSelect
          label="Level"
          value={selectedLevel}
          onChange={(v) => onChange({ ...value, level: v, agencyID: '' })}
          options={levelOptions}
          error={errors.level}
          required
          disabled={!selectedAgency}
          className="field-sm"
        />
        <Input
          label="Agency ID"
          helperText={agencyDef?.memberIdLabel}
          value={value.agencyID}
          onChange={(e) => onChange({ ...value, agencyID: e.target.value })}
          error={errors.agencyID}
          className="field-md"
          required
          disabled={!selectedAgency || !selectedLevel}
        />
      </div>
      <div
        className={
          ratingItems.length > 0
            ? 'opacity-100'
            : 'opacity-0 h-0 overflow-hidden'
        }
      >
        <CheckboxGroup
          label="Specialty Instructor Ratings"
          items={ratingItems}
          selected={value.specialtyRatings ?? []}
          onChange={(values) => onChange({ ...value, specialtyRatings: values })}
          error={errors.specialtyRatings}
          columns={3}
        />
      </div>
    </Fragment>
  )
}
