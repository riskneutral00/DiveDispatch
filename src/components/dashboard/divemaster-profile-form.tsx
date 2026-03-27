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
import { type LocationValue } from '@/components/common/location-picker'
import { ProfileBasicInfo } from '@/components/common/profile-basic-info'
import { CredentialRow } from '@/components/common/credential-row'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { LanguageField } from '@/components/common/language-field'
import { SaveButton } from '@/components/common/save-button'
import type { Language } from '@/lib/types/language'
import { ALL_LANGUAGES } from '@/lib/constants/dive-languages'

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
  contactPhone: z.string().min(1, 'Phone number is required'),
  credential: z.array(credentialSchema).min(1, 'Add at least one credential'),
})

type CredentialData = z.infer<typeof credentialSchema>

type ProfileFormData = {
  name: string
  location: LocationValue | null
  contactEmail: string
  contactPhone: string
  credential: CredentialData[]
  teachingLanguages: Language[]
}

const emptyCredential = (): CredentialData => ({ agency: '', level: '', agencyID: '' })

const INITIAL_FORM: ProfileFormData = {
  name: '',
  location: null,
  contactEmail: '',
  contactPhone: '',
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

export type DiveMasterProfileSection = 'contact' | 'credentials'

export function DiveMasterProfileForm({ section }: { section?: DiveMasterProfileSection } = {}) {
  const profile = useQuery(api.diveMasters.mine)
  const me = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.diveMasters.create)
  const update = useMutation(api.diveMasters.update)

  const { form, setForm, setField, errors, serverError, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } = useProfileForm({
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
        contactEmail: p.contactEmail as string,
        contactPhone: p.contactPhone as string,
        credential: cred.length > 0 ? cred : [emptyCredential()],
        teachingLanguages: ((p.teachingLanguages as string[]) ?? [])
          .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
          .filter((l): l is NonNullable<typeof l> => l !== undefined)
          .map((l) => ({ code: l.code, label: l.label })),
      }
    },
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
      {(!section || section === 'contact') && (
        <GlassCard padding="md">
          <div className="space-y-4">
            <ProfileBasicInfo
              nameLabel="Full Name"
              namePlaceholder="Your name"
              nameValue={form.name}
              onNameChange={(val) => setField('name', val)}
              nameError={errors.name}
              locationValue={form.location}
              onLocationChange={(loc) => setField('location', loc)}
              locationError={errors.location}
              phoneValue={form.contactPhone}
              onPhoneChange={(val) => setField('contactPhone', val)}
              phoneError={errors.contactPhone}
            >
              <LanguageField
                label="Teaching Languages"
                value={form.teachingLanguages}
                onChange={(langs) => setField('teachingLanguages', langs)}
                max={4}
                required
              />
            </ProfileBasicInfo>
          </div>
        </GlassCard>
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
            <div key={index}>
              {index > 0 && <hr className="form-divider mb-4" />}
              <CredentialRow index={index} onRemove={removeCredential} canRemove={form.credential.length > 1}>
                <DmCredentialFields index={index} credential={cred} errors={errors} onChange={updateCredential} />
              </CredentialRow>
            </div>
          ))}
        </div>
      )}

      {serverError && <p className="text-sm text-center" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>}
      {saved && <p className="text-sm text-center" style={{ color: 'var(--color-success)' }}>Profile saved successfully.</p>}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} disabled={!isValid} />
    </form>
  )
}
