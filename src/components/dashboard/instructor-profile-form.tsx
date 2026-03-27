'use client'

import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { SaveButton } from '@/components/common/save-button'
import { ProfileBasicInfo } from '@/components/common/profile-basic-info'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { GlassCheckboxGroup } from '@/components/glass/glass-checkbox-group'
import { COURSE_CODES } from '@/lib/constants/course-catalog'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { Spinner } from '@/components/common/spinner'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { CredentialRow } from '@/components/common/credential-row'
import { LanguageField } from '@/components/common/language-field'
import type { Language } from '@/lib/types/language'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

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

// ── Zod Schemas ───────────────────────────────────────────────────────

const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
  courses: z.array(z.string()).min(1, 'Select at least one course'),
})

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
})

type CredentialData = z.infer<typeof credentialSchema>
type CredentialErrors = Partial<Record<keyof CredentialData, string>>

type ProfileFormData = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  credential: CredentialData[]
  teachingLanguages: Language[]
}

const emptyCredential = (): CredentialData => ({ agency: '', level: '', agencyID: '', courses: [] })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  email: '',
  phone: '',
  credential: [emptyCredential()],
  teachingLanguages: [],
}

// ── Sub-components ────────────────────────────────────────────────────

function InstructorCredentialFields({ index, credential, errors, onChange }: {
  index: number
  credential: CredentialData
  errors: Record<string, string>
  onChange: (index: number, updated: CredentialData) => void
}) {
  const update = (field: keyof CredentialData, value: string | string[]) => {
    onChange(index, { ...credential, [field]: value })
  }
  const courseItems = COURSE_CODES.map((code) => ({ value: code, label: COURSE_LABELS[code] ?? code }))
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <GlassSimpleSelect label="Agency" value={credential.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES} placeholder="Select agency…" error={errors[`credential.${index}.agency`]} />
        <GlassInput label="Certification Level" placeholder="e.g. Open Water Instructor" value={credential.level} onChange={(e) => update('level', e.target.value)} error={errors[`credential.${index}.level`]} />
        <GlassInput label="Agency Instructor ID" placeholder="e.g. 12345678" value={credential.agencyID} onChange={(e) => update('agencyID', e.target.value)} error={errors[`credential.${index}.agencyID`]} className="sm:col-span-1" />
      </div>
      <GlassCheckboxGroup label="Courses Taught" items={courseItems} selected={credential.courses} onChange={(values) => update('courses', values)} error={errors[`credential.${index}.courses`]} columns={3} />
    </>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export type InstructorProfileSection = 'contact' | 'languages' | 'credentials'

export function InstructorProfileForm({ section }: { section?: InstructorProfileSection } = {}) {
  const profile = useQuery(api.instructors.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.instructors.create)
  const update = useMutation(api.instructors.update)

  const { form, setForm, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const cred = p.credential as { agency: string; level: string; agencyID: string; courses: string[] }[]
      return {
        name: p.name as string,
        location: {
          placeName: p.placeName,
          country: p.country,
          lat: p.lat,
          lng: p.lng,
          placeId: (p.placeId ?? undefined) as string | undefined,
        } as LocationValue,
        email: p.email as string,
        phone: p.phone as string,
        credential: cred.length > 0 ? cred : [emptyCredential()],
        teachingLanguages: ((p.teachingLanguages as string[]) ?? [])
          .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
          .filter((l): l is NonNullable<typeof l> => l !== undefined)
          .map((l) => ({ code: l.code, label: l.label })),
      }
    },
    fromMe: (defaults, initial) => ({
      ...initial,
      email: defaults.email ?? '',
      phone: defaults.phone ?? '',
    }),
    toPayload: (f) => {
      const loc = f.location!
      return {
        name: f.name,
        placeName: loc.placeName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        placeId: loc.placeId,
        email: f.email,
        phone: f.phone,
        credential: f.credential,
        teachingLanguages: f.teachingLanguages.map((l) => l.code),
      }
    },
    create,
    update,
  })

  const updateCredential = (index: number, updated: CredentialData) => {
    setForm((prev) => { const credential = [...prev.credential]; credential[index] = updated; return { ...prev, credential } })
  }

  const addCredential = () => setForm((prev) => ({ ...prev, credential: [...prev.credential, emptyCredential()] }))

  const removeCredential = (index: number) => {
    setForm((prev) => ({ ...prev, credential: prev.credential.filter((_, i) => i !== index) }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-primary)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {!section && (
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isUpdate ? 'Keep your profile current so dive centers can find you.' : 'Set up your instructor profile to start receiving booking requests.'}
          </p>
        </div>
      )}

      {(!section || section === 'contact') && (
        <GlassCard padding="md">
          <FormSectionHeader label="Contact Information" />
          <div className="space-y-4">
            <ProfileBasicInfo
              nameValue={form.name}
              onNameChange={(val) => setField('name', val)}
              nameError={errors.name}
              nameLabel="Full Name"
              namePlaceholder="Your name"
              locationValue={form.location}
              onLocationChange={(loc) => setField('location', loc)}
              locationError={errors.location}
              emailValue={form.email}
              onEmailChange={(val) => setField('email', val)}
              emailError={errors.email}
              phoneValue={form.phone}
              onPhoneChange={(val) => setField('phone', val)}
              phoneError={errors.phone}
            />
          </div>
        </GlassCard>
      )}

      {(!section) && <hr className="form-divider" />}

      {(!section || section === 'languages') && (
        <LanguageField
          label="Teaching Languages"
          value={form.teachingLanguages}
          onChange={(langs) => setField('teachingLanguages', langs)}
          max={4}
        />
      )}

      {(!section) && <hr className="form-divider" />}

      {(!section || section === 'credentials') && (
        <div className="space-y-4">
          <FormSectionHeader
            label="Dive Credentials"
            action={
              <GlassButton variant="secondary" size="sm" type="button" onClick={addCredential}>
                <Plus size={14} />
                Add Credential
              </GlassButton>
            }
          />
          {errors.credential && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.credential}</p>}
          {form.credential.map((cred, index) => (
            <CredentialRow key={index} index={index} onRemove={removeCredential} canRemove={form.credential.length > 1}>
              <InstructorCredentialFields index={index} credential={cred} errors={errors} onChange={updateCredential} />
            </CredentialRow>
          ))}
        </div>
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} />
    </form>
  )
}
