'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { EntityCardList } from '@/components/ui/entity-card-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingCard } from '@/components/ui/loading-card'
import {
  useInheritedContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import type { VenueKind, VenueFeature } from '@/lib/constants/venue-subtypes'
import type { GasMix } from '@/lib/constants/gas-mixes'
import {
  VenueEditDialog,
  EMPTY_VENUE_EDIT,
  type VenueEditValue,
} from './venue-edit-dialog'

export type VenueCapabilitiesFormState = {
  kind: VenueKind
  features: VenueFeature[]
  confinedCapable?: boolean
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_VENUE_CAPABILITIES_FORM: VenueCapabilitiesFormState = {
  kind: 'pool',
  features: [],
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
}

export function venueCapabilitiesFromProfile(p: Record<string, unknown>): VenueCapabilitiesFormState {
  const kind = (p.kind as VenueKind | undefined) ?? 'pool'
  return {
    kind,
    features: (p.features as VenueFeature[]) ?? [],
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function venueCapabilitiesToPayload(f: VenueCapabilitiesFormState): Record<string, unknown> {
  return {
    kind: f.kind,
    features: f.features,
    ...(f.maxDepth > 0 ? { maxDepth: f.maxDepth } : {}),
    ...(f.maxCapacity > 0 ? { maxCapacity: f.maxCapacity } : {}),
    ...(f.confinedCapable !== undefined ? { confinedCapable: f.confinedCapable } : {}),
  }
}

type VenueCapabilitiesSectionProps = BaseProfileSectionProps

export function VenueCapabilitiesSection({ me }: VenueCapabilitiesSectionProps) {
  const t = useTranslations('common')
  const venues = useQuery(api.venues.mine)
  const createVenue = useMutation(api.venues.create)
  const updateVenue = useMutation(api.venues.update)
  const removeVenue = useMutation(api.venues.remove)
  const venueInheritedDefaults = useInheritedContactDefaults('Venue', me)

  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; venueId: Id<'venues'>; initial: VenueEditValue }
  >({ open: false })

  if (venues === undefined) {
    return <LoadingCard />
  }

  const buildGasMixPayload = (value: VenueEditValue) => {
    if (!value.hasCompressorOnSite || !value.compressorGasMixes?.length) {
      return { gasMixes: [] as GasMix[] }
    }
    const includesNitrox = value.compressorGasMixes.includes('nitrox')
    return {
      gasMixes: value.compressorGasMixes,
      ...(includesNitrox && value.compressorNitroxMin !== undefined ? { nitroxMin: value.compressorNitroxMin } : {}),
      ...(includesNitrox && value.compressorNitroxMax !== undefined ? { nitroxMax: value.compressorNitroxMax } : {}),
    }
  }

  const handleCreate = async (value: VenueEditValue) => {
    if (!value.location) return
    await createVenue({
      name: value.name,
      address: value.location.address,
      placeId: value.location.placeId,
      lat: value.location.lat,
      lng: value.location.lng,
      email: (venueInheritedDefaults.email as string) || '',
      phone: (venueInheritedDefaults.phone as string) || '',
      kind: value.kind,
      features: value.features,
      confinedCapable: value.confinedCapable,
      maxDepth: value.maxDepth > 0 ? value.maxDepth : undefined,
      maxCapacity: value.maxCapacity > 0 ? value.maxCapacity : undefined,
      isAllowed: value.isAllowed,
      notAllowed: value.notAllowed,
      ...buildGasMixPayload(value),
    })
  }

  const handleEdit = async (venueId: Id<'venues'>, value: VenueEditValue) => {
    if (!value.location) return
    await updateVenue({
      venueId,
      name: value.name,
      address: value.location.address,
      placeId: value.location.placeId,
      lat: value.location.lat,
      lng: value.location.lng,
      kind: value.kind,
      features: value.features,
      confinedCapable: value.confinedCapable,
      maxDepth: value.maxDepth > 0 ? value.maxDepth : undefined,
      maxCapacity: value.maxCapacity > 0 ? value.maxCapacity : undefined,
      isAllowed: value.isAllowed,
      notAllowed: value.notAllowed,
      ...buildGasMixPayload(value),
    })
  }

  const handleRemove = async (venueId: Id<'venues'>) => {
    await removeVenue({ venueId })
  }

  const openEditFor = (venue: (typeof venues)[number]) => {
    const existingGasMixes = (venue.gasMixes ?? []) as GasMix[]
    setDialogState({
      open: true,
      mode: 'edit',
      venueId: venue._id,
      initial: {
        name: venue.name,
        kind: venue.kind as VenueKind,
        location: {
          address: venue.address,
          placeId: venue.placeId,
          lat: venue.lat,
          lng: venue.lng,
        },
        maxDepth: venue.maxDepth ?? 0,
        maxCapacity: venue.maxCapacity ?? 0,
        confinedCapable: venue.confinedCapable ?? false,
        features: (venue.features ?? []) as VenueFeature[],
        isAllowed: venue.isAllowed ?? [],
        notAllowed: venue.notAllowed ?? [],
        hasCompressorOnSite: existingGasMixes.length > 0,
        compressorGasMixes: existingGasMixes,
        compressorNitroxMin: venue.nitroxMin ?? undefined,
        compressorNitroxMax: venue.nitroxMax ?? undefined,
      },
    })
  }

  return (
    <>
      <EntityCardList
        label={t('venues')}
        items={venues}
        addLabel={t('addVenue')}
        emptyMessage={t('noVenuesYet')}
        onAdd={() => setDialogState({ open: true, mode: 'create' })}
        onRemove={(venue) => void handleRemove(venue._id)}
        itemKey={(venue) => venue._id}
        removeAriaLabel={(venue) => t('removeVenue', { name: venue.name })}
        getCompleteness={(venue) => ({
          complete: venue.profileComplete === true,
          incomplete: [],
        })}
        completeLabel={t('complete')}
        incompleteLabel={t('incomplete')}
        renderCard={(venue) => {
          const features = (venue.features ?? []) as VenueFeature[]
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary truncate">{venue.name}</span>
                <Badge variant="muted">{t(`venueKinds.${venue.kind as VenueKind}`)}</Badge>
              </div>
              <div className="text-body-sm text-secondary">
                {venue.maxDepth ? `${venue.maxDepth} m` : '—'}
                {' · '}
                {venue.maxCapacity ? `${venue.maxCapacity} cap` : '—'}
                {venue.confinedCapable ? ' · Confined' : ''}
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {features.map((f) => (
                    <Badge key={f} variant="info" size="sm">
                      {t(`venueFeatures.${f}`)}
                    </Badge>
                  ))}
                </div>
              )}
              {venue.address?.city && (
                <div className="text-body-sm text-secondary truncate">
                  {venue.address.city}
                  {venue.address.country ? `, ${venue.address.country}` : ''}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openEditFor(venue)}
                className="self-start"
              >
                {t('edit')}
              </Button>
            </div>
          )
        }}
      />

      <VenueEditDialog
        open={dialogState.open}
        onClose={() => setDialogState({ open: false })}
        mode={dialogState.open && dialogState.mode === 'edit' ? 'edit' : 'create'}
        initialValue={
          dialogState.open && dialogState.mode === 'edit'
            ? dialogState.initial
            : EMPTY_VENUE_EDIT
        }
        onSubmit={async (value) => {
          if (dialogState.open && dialogState.mode === 'edit') {
            await handleEdit(dialogState.venueId, value)
          } else {
            await handleCreate(value)
          }
        }}
      />
    </>
  )
}
