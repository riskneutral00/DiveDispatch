'use client'

import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
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
  contactEmail: z.string().email('Invalid email address'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
})

type CredentialData = z.infer<typeof credentialSchema>
type CredentialErrors = Partial<Record<keyof CredentialData, string>>

type ProfileFormData = {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  credential: CredentialData[]
}

const emptyCredential = (): CredentialData => ({ agency: '', level: '', agencyID: '', courses: [] })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  contactEmail: '',
  contactPhone: '',
  credential: [emptyCredential()],
}

// ── Sub-components ────────────────────────────────────────────────────



interface CredentialRowProps {
  index: number
  credential: CredentialData
  errors: Record<string, string>
  onChange: (index: number, updated: CredentialData) => void
  onRemove: (index: number) => void
  canRemove: boolean
}

function CredentialRow({ index, credential, errors, onChange, onRemove, canRemove }: CredentialRowProps) {
  const update = (field: keyof CredentialData, value: string | string[]) => {
    onChange(index, { ...credential, [field]: value })
  }
  const courseItems = COURSE_CODES.map((code) => ({ value: code, label: COURSE_LABELS[code] ?? code }))
  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          Credential {index + 1}
        </h3>
        {canRemove && (
          <GlassButton variant="destructive" size="sm" type="button" onClick={() => onRemove(index)} aria-label={`Remove credential ${index + 1}`}>
            <Trash2 size={14} />
            Remove
          </GlassButton>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <GlassSimpleSelect label="Agency" value={credential.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES} placeholder="Select agency…" error={errors[`credential.${index}.agency`]} />
        <GlassInput label="Certification Level" placeholder="e.g. Open Water Instructor" value={credential.level} onChange={(e) => update('level', e.target.value)} error={errors[`credential.${index}.level`]} />
        <GlassInput label="Agency Instructor ID" placeholder="e.g. 12345678" value={credential.agencyID} onChange={(e) => update('agencyID', e.target.value)} error={errors[`credential.${index}.agencyID`]} className="sm:col-span-1" />
      </div>
      <GlassCheckboxGroup label="Courses Taught" items={courseItems} selected={credential.courses} onChange={(values) => update('courses', values)} error={errors[`credential.${index}.courses`]} columns={3} />
    </GlassCard>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export type InstructorProfileSection = 'contact' | 'credentials'

export function InstructorProfileForm({ section }: { section?: InstructorProfileSection } = {}) {
  const profile = useQuery(api.instructors.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.instructors.create)
  const update = useMutation(api.instructors.update)

  const { form, setForm, setField, errors, serverError, saving, saved, loading, isUpdate, handleSubmit } = useProfileForm<ProfileFormData>({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => ({
      name: p.name,
      location: {
        placeName: p.placeName,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        placeId: p.placeId ?? undefined,
      } as LocationValue,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      credential: p.credential.length > 0 ? p.credential : [emptyCredential()],
    }),
    fromMe: (defaults, initial) => ({
      ...initial,
      contactEmail: defaults.defaultContactEmail ?? '',
      contactPhone: defaults.defaultContactPhone ?? '',
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
        contactEmail: f.contactEmail,
        contactPhone: f.contactPhone,
        credential: f.credential,
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
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Contact Information
          </h2>
          <div className="space-y-4">
            <GlassInput label="Full Name" placeholder="Your name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            <LocationPicker label="Location" value={form.location} onChange={(loc) => setField('location', loc)} error={errors.location} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput label="Contact Email" type="email" placeholder="you@example.com" value={form.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} error={errors.contactEmail} />
              <GlassInput label="Contact Phone" type="tel" placeholder="+66 81 234 5678" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} error={errors.contactPhone} />
            </div>
          </div>
        </GlassCard>
      )}

      {(!section || section === 'credentials') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              Dive Credentials
            </h2>
            <GlassButton variant="secondary" size="sm" type="button" onClick={addCredential}>
              <Plus size={14} />
              Add Credential
            </GlassButton>
          </div>
          {errors.credential && <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{errors.credential}</p>}
          {form.credential.map((cred, index) => (
            <CredentialRow key={index} index={index} credential={cred} errors={errors} onChange={updateCredential} onRemove={removeCredential} canRemove={form.credential.length > 1} />
          ))}
        </div>
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <div className="flex justify-end">
        <GlassButton type="submit" variant="primary" size="md" loading={saving} disabled={saving}>
          {isUpdate ? 'Save Changes' : 'Create Profile'}
        </GlassButton>
      </div>
    </form>
  )
}
