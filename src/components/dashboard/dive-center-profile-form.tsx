'use client'

import { Fragment } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { api } from '../../../convex/_generated/api'
import { GlassButton, GlassInput, GlassSelect } from '@/components/glass'
import { LocationPicker, type LocationValue } from '@/components/common/location-picker'
import { FormGrid, FormField } from '@/components/common/form-grid'
import { LanguageField } from '@/components/common/language-field'
import { FormSectionHeader } from '@/components/common/form-section-header'
import { ProfileBasicInfo } from '@/components/common/profile-basic-info'
import { ItemCard } from '@/components/common/item-card'
import { DayPicker } from '@/components/common/day-picker'
import { SpecialtyField } from '@/components/common/specialty-field'
import { SaveButton } from '@/components/common/save-button'
import type { Language } from '@/lib/types/language'
import { resolveLanguages } from '@/lib/constants/dive-languages'
import { useProfileForm } from '@/lib/hooks/use-profile-form'
import { AGENCIES, AGENCY_CODES, COURSE_DAY_RANGES, getDefaultSpecialties } from '@/lib/constants/agencies'

const locationSchema = z.object({
  placeName: z.string().min(1),
  country: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeId: z.string().optional(),
})

const formSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  location: locationSchema.nullable().refine((v) => v !== null, { message: 'Location is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Contact phone is required'),
  customerLanguages: z.array(z.object({ code: z.string(), label: z.string() })).min(1, 'At least one language required'),
  associations: z.array(
    z.object({
      agencyCode: z.string().min(1, 'Agency is required'),
      memberId: z.string().min(1, 'Member ID is required'),
      owDays: z.number().min(1),
      aowDays: z.number().min(1),
      oaDays: z.number().min(1),
      selectedSpecialties: z.array(z.string()),
    }),
  ),
}).refine((data) => {
  return data.associations.every((a) => {
    const required = AGENCIES[a.agencyCode]?.specialtyCount ?? 5
    return a.selectedSpecialties.length >= required
  })
}, { message: 'Not enough specialties selected', path: ['associations'] })

interface AssociationForm {
  agencyCode: string
  memberId: string
  owDays: number
  aowDays: number
  oaDays: number
  selectedSpecialties: string[]
}

type FormState = {
  name: string
  location: LocationValue | null
  email: string
  phone: string
  associations: AssociationForm[]
  customerLanguages: Language[]
}

function makeDefaultAssociation(): AssociationForm {
  return {
    agencyCode: '',
    memberId: '',
    owDays: COURSE_DAY_RANGES.OW.min,
    aowDays: COURSE_DAY_RANGES.AOW.min,
    oaDays: COURSE_DAY_RANGES.combined.min,
    selectedSpecialties: getDefaultSpecialties('PADI'),
  }
}

const INITIAL_FORM: FormState = {
  name: '',
  location: null,
  email: '',
  phone: '',
  associations: [],
  customerLanguages: [],
}

export type DiveCenterProfileSection = 'contact' | 'languages' | 'associations'

export function DiveCenterProfileForm({ onSaved, section }: { onSaved?: () => void; section?: DiveCenterProfileSection } = {}) {
  const existing = useQuery(api.diveCenters.mine)
  const me = useQuery(api.users.me)
  const accountDefaults = useQuery(api.users.getAccountDefaults)
  const create = useMutation(api.diveCenters.create)
  const update = useMutation(api.diveCenters.update)

  const { form, setField, errors, serverError, saving, saved, isDirty, isValid, loading, isUpdate, handleSubmit } = useProfileForm({
    profile: existing,
    me,
    schema: formSchema,
    defaults: INITIAL_FORM,
    fromProfile: (p) => {
      const assocs = (p.associations as Array<{
        agencyCode: string; memberId: string
        owDays?: number; aowDays?: number; oaDays?: number
        selectedSpecialties?: string[]
      }>) ?? []
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
        associations: assocs.map((a) => ({
          agencyCode: a.agencyCode,
          memberId: a.memberId,
          owDays: a.owDays ?? COURSE_DAY_RANGES.OW.min,
          aowDays: a.aowDays ?? COURSE_DAY_RANGES.AOW.min,
          oaDays: a.oaDays ?? COURSE_DAY_RANGES.combined.min,
          selectedSpecialties: [
            ...new Set([
              ...getDefaultSpecialties(a.agencyCode),
              ...(a.selectedSpecialties ?? []),
            ]),
          ],
        })),
        customerLanguages: resolveLanguages((p.customerLanguages as string[]) ?? []),
      }
    },
    fromMe: (u, defaults) => ({
      ...defaults,
      name: u.businessName ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
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
        associations: f.associations.map((a) => ({
          agencyCode: a.agencyCode,
          memberId: a.memberId,
          owDays: a.owDays,
          aowDays: a.aowDays,
          oaDays: a.oaDays,
          selectedSpecialties: a.selectedSpecialties,
        })),
        customerLanguages: f.customerLanguages.map((l) => l.code),
      }
    },
    create,
    update,
    onSaved,
  })

  function addAssociation() {
    const firstAssoc = form.associations[0]
    const newAssoc = firstAssoc
      ? { ...firstAssoc, agencyCode: '', memberId: '' }
      : makeDefaultAssociation()
    setField('associations', [...form.associations, newAssoc])
  }

  function removeAssociation(idx: number) {
    if (form.associations.length <= 1) return
    setField('associations', form.associations.filter((_, i) => i !== idx))
  }

  function updateAssociation(idx: number, patch: Partial<AssociationForm>) {
    setField('associations', form.associations.map((a, i) => {
      if (i !== idx) return a
      const updated = { ...a, ...patch }
      if (patch.agencyCode && patch.agencyCode !== a.agencyCode) {
        updated.selectedSpecialties = getDefaultSpecialties(patch.agencyCode)
      }
      return updated
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm animate-pulse text-secondary">
          Loading profile…
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!section && (
        <div>
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {isUpdate ? 'Profile Settings' : 'Complete Your Profile'}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {isUpdate
              ? 'Update your dive center information.'
              : 'Tell us about your dive center to get started.'}
          </p>
        </div>
      )}

      {/* Basic Information */}
      {(!section || section === 'contact') && (
      <div className="space-y-4">
        <FormSectionHeader label="Basic Information" />
        <ProfileBasicInfo
          nameValue={form.name}
          onNameChange={(val) => setField('name', val)}
          nameError={errors.name}
          nameLabel="Business Name"
          namePlaceholder="e.g. Ocean Explorer Dive Center"
          nameRequired
          locationValue={form.location}
          onLocationChange={(loc) => {
            setField('location', loc)
            if (loc && isUpdate) {
              update({
                placeName: loc.placeName,
                country: loc.country,
                lat: loc.lat,
                lng: loc.lng,
                placeId: loc.placeId,
              })
            }
          }}
          locationError={errors.location}
          locationRequired
          emailValue={form.email}
          onEmailChange={(val) => setField('email', val)}
          emailError={errors.email}
          emailRequired
          phoneValue={form.phone}
          onPhoneChange={(val) => setField('phone', val)}
          phoneError={errors.phone}
          phoneRequired
        />
      </div>
      )}

      {(!section) && <hr className="form-divider" />}

      {/* Languages */}
      {(!section || section === 'languages') && (
        <LanguageField
          variant="customer"
          value={form.customerLanguages}
          onChange={(langs) => setField('customerLanguages', langs)}
        />
      )}

      {(!section) && <hr className="form-divider" />}

      {/* Affiliations */}
      {(!section || section === 'associations') && (
      <div className="space-y-4">
        <FormSectionHeader
          label="Affiliations"
          action={
            <GlassButton type="button" variant="ghost" size="sm" onClick={addAssociation}>
              <Plus size={14} />
              Add
            </GlassButton>
          }
        />

        {form.associations.length === 0 ? (
          <p className="text-sm text-secondary">
            No affiliations added. Click Add to register one.
          </p>
        ) : (
          <div className="space-y-6">
            {form.associations.map((assoc, idx) => {
              const agency = AGENCIES[assoc.agencyCode]

              return (
                <Fragment key={idx}>
                  {idx > 0 && <hr className="form-divider" />}
                <ItemCard
                  onRemove={() => removeAssociation(idx)}
                  canRemove={form.associations.length > 1}
                  aria-label="Remove affiliation"
                >
                  {/* Agency + Member ID row */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <GlassSelect
                        label="Agency"
                        value={assoc.agencyCode}
                        onChange={(v) => updateAssociation(idx, { agencyCode: v })}
                        options={AGENCY_CODES
                          .filter((code) => code === assoc.agencyCode || !form.associations.some((a, i) => i !== idx && a.agencyCode === code))
                          .map((code) => ({ id: code, label: AGENCIES[code].name }))}
                        placeholder="Select agency"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <GlassInput
                        label={agency?.memberIdLabel ?? 'Member ID'}
                        value={assoc.memberId}
                        onChange={(e) => updateAssociation(idx, { memberId: e.target.value })}
                        placeholder={agency?.memberIdLabel ?? 'Member ID'}
                        required
                      />
                    </div>
                  </div>

                  {/* Course days + Specialties */}
                  <div className="flex gap-6 items-start">
                    {/* Default course #days — fixed width */}
                    <div className="shrink-0">
                      <p className="text-sm font-medium mb-2 text-secondary">
                        Default course #days<span style={{ color: 'var(--color-destructive)' }}> *</span>
                      </p>
                      <div className="flex gap-2">
                        <DayPicker
                          label={agency?.courses.find((c) => c.code === 'OW')?.label ?? 'OW'}
                          value={assoc.owDays}
                          min={COURSE_DAY_RANGES.OW.min}
                          max={COURSE_DAY_RANGES.OW.max}
                          onChange={(v) => updateAssociation(idx, { owDays: v })}
                        />
                        <DayPicker
                          label={agency?.courses.find((c) => c.code === 'AOW')?.label ?? 'AOW'}
                          value={assoc.aowDays}
                          min={COURSE_DAY_RANGES.AOW.min}
                          max={COURSE_DAY_RANGES.AOW.max}
                          onChange={(v) => updateAssociation(idx, { aowDays: v })}
                        />
                        <DayPicker
                          label={agency?.combinedLabel ?? 'O+A'}
                          value={assoc.oaDays}
                          min={COURSE_DAY_RANGES.combined.min}
                          max={COURSE_DAY_RANGES.combined.max}
                          onChange={(v) => updateAssociation(idx, { oaDays: v })}
                        />
                      </div>
                    </div>

                    <SpecialtyField
                      agencyCode={assoc.agencyCode}
                      value={assoc.selectedSpecialties}
                      onChange={(specialties) => updateAssociation(idx, { selectedSpecialties: specialties })}
                    />
                  </div>
                </ItemCard>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
      )}

      {serverError && (
        <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{serverError}</p>
      )}

      <SaveButton saving={saving} saved={saved} isDirty={isDirty} isUpdate={isUpdate} disabled={!isValid} />
    </form>
  )
}
