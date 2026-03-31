'use client'

import { Fragment } from 'react'
import { Plus } from 'lucide-react'
import { GlassButton } from '@/components/ui/glass-button'
import { GlassInput } from '@/components/ui/glass-input'
import { GlassSelect } from '@/components/ui'
import { GlassSimpleSelect } from '@/components/ui/glass-simple-select'
import { GlassCheckboxGroup } from '@/components/ui/glass-checkbox-group'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import { ItemCard } from '@/components/ui/item-card'
import { CredentialRow } from '@/components/profiles/credential-row'
import { LanguageField } from '@/components/profiles/language-field'
import { AGENCIES, AGENCY_CODES } from '@/lib/constants/agencies'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { COURSE_CODES } from '@/lib/constants/course-catalog'
import type { Language } from '@/lib/types/language'

// ── Types ────────────────────────────────────────────────────────────

/** DC/Agent association — agency + member number. */
export interface AssociationData {
  agency: string
  number: string
}

/** Instructor credential — agency + level + ID + courses. */
export interface InstructorCredentialData {
  agency: string
  level: string
  agencyID: string
  courses: string[]
}

/** DiveMaster credential — agency + level + ID (no courses). */
export interface DmCredentialData {
  agency: string
  level: string
  agencyID: string
}

type CenterRole = 'DiveCenter' | 'Agent' | 'Instructor' | 'DiveMaster'

// ── Course labels ────────────────────────────────────────────────────

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

// ── Empty defaults ───────────────────────────────────────────────────

export const emptyAssociation = (): AssociationData => ({ agency: '', number: '' })
export const emptyInstructorCredential = (): InstructorCredentialData => ({ agency: '', level: '', agencyID: '', courses: [] })
export const emptyDmCredential = (): DmCredentialData => ({ agency: '', level: '', agencyID: '' })

// ── Inline field renderers ───────────────────────────────────────────

function AssociationFields({ index, data, errors, onChange, role }: {
  index: number
  data: AssociationData
  errors: Record<string, string>
  onChange: (index: number, updated: AssociationData) => void
  role: 'DiveCenter' | 'Agent'
}) {
  const fieldPrefix = role === 'DiveCenter' ? 'associations' : 'associations'
  const agency = AGENCIES[data.agency]

  if (role === 'DiveCenter') {
    return (
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <GlassSelect
            label="Agency"
            value={data.agency}
            onChange={(v) => onChange(index, { ...data, agency: v })}
            options={AGENCY_CODES.map((code) => ({ id: code, label: AGENCIES[code].name }))}
            placeholder="Select agency"
            required
          />
        </div>
        <div className="flex-1">
          <GlassInput
            label={agency?.memberIdLabel ?? 'Member ID'}
            value={data.number}
            onChange={(e) => onChange(index, { ...data, number: e.target.value })}
            placeholder={agency?.memberIdLabel ?? 'Member ID'}
            required
          />
        </div>
      </div>
    )
  }

  // Agent variant — simpler, uses GlassSimpleSelect with DIVE_AGENCIES
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <GlassSimpleSelect
        label="Agency"
        value={data.agency}
        onChange={(v) => onChange(index, { ...data, agency: v })}
        options={DIVE_AGENCIES as unknown as string[]}
        placeholder="Select agency…"
        error={errors[`${fieldPrefix}.${index}.agency`]}
      />
      <GlassInput
        label="Membership Number"
        placeholder="e.g. PADI-12345"
        value={data.number}
        onChange={(e) => onChange(index, { ...data, number: e.target.value })}
        error={errors[`${fieldPrefix}.${index}.number`]}
      />
    </div>
  )
}

function InstructorCredentialFields({ index, credential, errors, onChange }: {
  index: number
  credential: InstructorCredentialData
  errors: Record<string, string>
  onChange: (index: number, updated: InstructorCredentialData) => void
}) {
  const update = (field: keyof InstructorCredentialData, value: string | string[]) => {
    onChange(index, { ...credential, [field]: value })
  }
  const courseItems = COURSE_CODES.map((code) => ({ value: code, label: COURSE_LABELS[code] ?? code }))
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <GlassSimpleSelect label="Agency" value={credential.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES as unknown as string[]} placeholder="Select agency…" error={errors[`credential.${index}.agency`]} />
        <GlassInput label="Certification Level" placeholder="e.g. Open Water Instructor" value={credential.level} onChange={(e) => update('level', e.target.value)} error={errors[`credential.${index}.level`]} />
        <GlassInput label="Agency Instructor ID" placeholder="e.g. 12345678" value={credential.agencyID} onChange={(e) => update('agencyID', e.target.value)} error={errors[`credential.${index}.agencyID`]} className="sm:col-span-1" />
      </div>
      <GlassCheckboxGroup label="Courses Taught" items={courseItems} selected={credential.courses} onChange={(values) => update('courses', values)} error={errors[`credential.${index}.courses`]} columns={3} />
    </>
  )
}

function DmCredentialFields({ index, credential, errors, onChange }: {
  index: number
  credential: DmCredentialData
  errors: Record<string, string>
  onChange: (index: number, updated: DmCredentialData) => void
}) {
  const update = (field: keyof DmCredentialData, value: string) => {
    onChange(index, { ...credential, [field]: value })
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <GlassSimpleSelect label="Agency" value={credential.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES as unknown as string[]} placeholder="Select agency…" error={errors[`credential.${index}.agency`]} />
      <GlassInput label="Certification Level" placeholder="e.g. Divemaster" value={credential.level} onChange={(e) => update('level', e.target.value)} error={errors[`credential.${index}.level`]} />
      <GlassInput label="Agency Member ID" placeholder="e.g. 12345678" value={credential.agencyID} onChange={(e) => update('agencyID', e.target.value)} error={errors[`credential.${index}.agencyID`]} className="sm:col-span-2" />
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────

interface ProfileCenterSectionProps {
  role: CenterRole
  // Language
  languageValue: Language[]
  onLanguageChange: (languages: Language[]) => void
  // Affiliations (DC/Agent)
  associations?: AssociationData[]
  onAssociationsChange?: (associations: AssociationData[]) => void
  // Credentials (Instructor)
  instructorCredentials?: InstructorCredentialData[]
  onInstructorCredentialsChange?: (credentials: InstructorCredentialData[]) => void
  // Credentials (DiveMaster)
  dmCredentials?: DmCredentialData[]
  onDmCredentialsChange?: (credentials: DmCredentialData[]) => void
  // Errors
  errors: Record<string, string>
}

/**
 * Shared center section for DC, Agent, Instructor, DiveMaster.
 * Renders: language field + unified affiliations/credentials.
 * Resource roles (Boat, Equipment, Pool, Compressor) skip this entirely.
 */
export function ProfileCenterSection({
  role,
  languageValue,
  onLanguageChange,
  associations,
  onAssociationsChange,
  instructorCredentials,
  onInstructorCredentialsChange,
  dmCredentials,
  onDmCredentialsChange,
  errors,
}: ProfileCenterSectionProps) {
  const languageVariant = role === 'DiveCenter' ? 'customer' : 'teaching'

  return (
    <>
      {/* Language */}
      <LanguageField
        variant={languageVariant}
        value={languageValue}
        onChange={onLanguageChange}
      />

      <hr className="form-divider" />

      {/* Affiliations / Credentials */}
      {(role === 'DiveCenter' || role === 'Agent') && associations && onAssociationsChange && (
        <AffiliationsSection
          role={role}
          associations={associations}
          onChange={onAssociationsChange}
          errors={errors}
        />
      )}

      {role === 'Instructor' && instructorCredentials && onInstructorCredentialsChange && (
        <CredentialsSection
          credentials={instructorCredentials}
          onChange={onInstructorCredentialsChange}
          onAdd={() => onInstructorCredentialsChange([...instructorCredentials, emptyInstructorCredential()])}
          onRemove={(idx) => onInstructorCredentialsChange(instructorCredentials.filter((_, i) => i !== idx))}
          errors={errors}
          renderFields={(index, cred, onChange) => (
            <InstructorCredentialFields
              index={index}
              credential={cred as InstructorCredentialData}
              errors={errors}
              onChange={(i, updated) => onChange(i, updated)}
            />
          )}
        />
      )}

      {role === 'DiveMaster' && dmCredentials && onDmCredentialsChange && (
        <CredentialsSection
          credentials={dmCredentials}
          onChange={onDmCredentialsChange}
          onAdd={() => onDmCredentialsChange([...dmCredentials, emptyDmCredential()])}
          onRemove={(idx) => onDmCredentialsChange(dmCredentials.filter((_, i) => i !== idx))}
          errors={errors}
          renderFields={(index, cred, onChange) => (
            <DmCredentialFields
              index={index}
              credential={cred as DmCredentialData}
              errors={errors}
              onChange={(i, updated) => onChange(i, updated)}
            />
          )}
        />
      )}
    </>
  )
}

// ── Sub-sections ─────────────────────────────────────────────────────

function AffiliationsSection({ role, associations, onChange, errors }: {
  role: 'DiveCenter' | 'Agent'
  associations: AssociationData[]
  onChange: (associations: AssociationData[]) => void
  errors: Record<string, string>
}) {
  const label = role === 'DiveCenter' ? 'Affiliations' : 'Agency Memberships'

  const addAssociation = () => onChange([...associations, emptyAssociation()])

  const removeAssociation = (idx: number) => {
    if (associations.length <= 1) return
    onChange(associations.filter((_, i) => i !== idx))
  }

  const updateAssociation = (idx: number, updated: AssociationData) => {
    onChange(associations.map((a, i) => (i === idx ? updated : a)))
  }

  return (
    <div className="space-y-4">
      <FormSectionHeader
        label={label}
        action={
          <GlassButton type="button" variant="ghost" size="sm" onClick={addAssociation}>
            <Plus size={14} />
            Add
          </GlassButton>
        }
      />

      {associations.length === 0 ? (
        <p className="text-sm text-secondary">
          No affiliations added. Click Add to register one.
        </p>
      ) : (
        <div className="space-y-6">
          {associations.map((assoc, idx) => (
            <Fragment key={idx}>
              {idx > 0 && <hr className="form-divider" />}
              <ItemCard
                onRemove={() => removeAssociation(idx)}
                canRemove={associations.length > 1}
                aria-label="Remove affiliation"
              >
                <AssociationFields
                  index={idx}
                  data={assoc}
                  errors={errors}
                  onChange={updateAssociation}
                  role={role}
                />
              </ItemCard>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

function CredentialsSection<T extends { agency: string }>({ credentials, onChange, onAdd, onRemove, errors, renderFields }: {
  credentials: T[]
  onChange: (credentials: T[]) => void
  onAdd: () => void
  onRemove: (index: number) => void
  errors: Record<string, string>
  renderFields: (index: number, credential: T, onChange: (index: number, updated: T) => void) => React.ReactNode
}) {
  const updateCredential = (index: number, updated: T) => {
    onChange(credentials.map((c, i) => (i === index ? updated : c)))
  }

  return (
    <div className="space-y-4">
      <FormSectionHeader
        label="Dive Credentials"
        action={
          <GlassButton variant="secondary" size="sm" type="button" onClick={onAdd}>
            <Plus size={14} />
            Add Credential
          </GlassButton>
        }
      />
      {errors.credential && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.credential}</p>}
      {credentials.map((cred, index) => (
        <CredentialRow key={index} index={index} onRemove={onRemove} canRemove={credentials.length > 1}>
          {renderFields(index, cred, updateCredential)}
        </CredentialRow>
      ))}
    </div>
  )
}
