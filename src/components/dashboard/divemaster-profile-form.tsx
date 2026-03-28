'use client'

import { z } from 'zod'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassSimpleSelect } from '@/components/glass/glass-simple-select'
import { DIVE_AGENCIES } from '@/lib/constants/agencies'
import { Spinner } from '@/components/common/spinner'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { CredentialRow } from '@/components/common/credential-row'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { LanguageField } from '@/components/common/language-field'
import { SaveButton } from '@/components/common/save-button'
import type { Language } from '@/lib/types/language'
import { resolveLanguages } from '@/lib/constants/dive-languages'

// ── Zod Schemas ───────────────────────────────────────────────────────

const credentialSchema = z.object({
  agency: z.string().min(1, 'Agency is required'),
  level: z.string().min(1, 'Level is required'),
  agencyID: z.string().min(1, 'Agency ID is required'),
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

type ProfileFormData = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  credential: CredentialData[]
  teachingLanguages: Language[]
}

const emptyCredential = (): CredentialData => ({ agency: '', level: '', agencyID: '' })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  email: '',
  phone: '',
  credential: [emptyCredential()],
  teachingLanguages: [],
}

// ── Sub-components ────────────────────────────────────────────────────

function DmCredentialFields({ index, credential, errors, onChange }: {
  index: number
  credential: CredentialData
  errors: Record<string, string>
  onChange: (index: number, updated: CredentialData) => void
}) {
  const update = (field: keyof CredentialData, value: string) => {
    onChange(index, { ...credential, [field]: value })
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <GlassSimpleSelect label="Agency" value={credential.agency} onChange={(v) => update('agency', v)} options={DIVE_AGENCIES} placeholder="Select agency…" error={errors[`credential.${index}.agency`]} />
      <GlassInput label="Certification Level" placeholder="e.g. Divemaster" value={credential.level} onChange={(e) => update('level', e.target.value)} error={errors[`credential.${index}.level`]} />
      <GlassInput label="Agency Member ID" placeholder="e.g. 12345678" value={credential.agencyID} onChange={(e) => update('agencyID', e.target.value)} error={errors[`credential.${index}.agencyID`]} className="sm:col-span-2" />
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────────────

export type DiveMasterProfileSection = 'contact' | 'languages' | 'credentials'

export function DiveMasterProfileForm({ section }: { section?: DiveMasterProfileSection } = {}) {
  const profile = useQuery(api.diveMasters.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.diveMasters.create)
  const update = useMutation(api.diveMasters.update)

  const { form, setForm, setField, errors, serverError, saving, saved, isDirty, loading, isUpdate, handleSubmit } = useProfileForm({
    profile,
    me: me ?? undefined,
    schema: profileSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const cred = p.credential as { agency: string; level: string; agencyID: string }[]
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
        teachingLanguages: resolveLanguages((p.teachingLanguages as string[]) ?? []),
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
          <h1 className="text-2xl font-bold mb-1 text-primary" style={{ fontFamily: 'var(--font-heading)' }}>
            {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
          </h1>
          <p className="text-sm text-secondary">
            {isUpdate ? 'Keep your profile current so dive centers can find you.' : 'Set up your divemaster profile to start receiving booking requests.'}
          </p>
        </div>
      )}

      {(!section || section === 'contact') && (
        <GlassCard padding="md">
          <FormSectionHeader label="Contact Information" />
          <div className="space-y-4">
            <div className="max-w-sm">
              <GlassInput label="Full Name" placeholder="Your name" value={form.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            </div>
            <div className="max-w-md">
              <LocationPicker label="Location" value={form.location} onChange={(loc) => setField('location', loc)} error={errors.location} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassInput label="Contact Email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
              <GlassInput label="Contact Phone" type="tel" placeholder="+66 81 234 5678" value={form.phone} onChange={(e) => setField('phone', e.target.value)} error={errors.phone} />
            </div>
          </div>
        </GlassCard>
      )}

      {(!section) && <hr className="form-divider" />}

      {(!section || section === 'languages') && (
        <LanguageField
          variant="teaching"
          value={form.teachingLanguages}
          onChange={(langs) => setField('teachingLanguages', langs)}
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
              <DmCredentialFields index={index} credential={cred} errors={errors} onChange={updateCredential} />
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
