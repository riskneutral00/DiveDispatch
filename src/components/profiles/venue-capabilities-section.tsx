'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from 'convex/react'
import type { Doc, Id } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { EntityCardList } from '@/components/ui/entity-card-list'
import { Button } from '@/components/ui/button'
import { MenuButton } from '@/components/ui/menu-button'
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

type VenueDoc = Doc<'venues'>

type SubTab = 'pool' | 'dive_site'

function buildCreateDefaults(
  kind: VenueKind,
  venues: VenueDoc[],
  inheritedDefaults: Record<string, unknown>,
): VenueEditValue {
  const sortedSameKind = venues
    .filter((v) => (v.kind as VenueKind) === kind)
    .sort((a, b) => b._creationTime - a._creationTime)
  const sortedAny = [...venues].sort((a, b) => b._creationTime - a._creationTime)
  const seed = sortedSameKind[0] ?? sortedAny[0] ?? null

  if (seed) {
    const existingGasMixes = (seed.gasMixes ?? []) as GasMix[]
    return {
      ...EMPTY_VENUE_EDIT,
      kind,
      email: seed.email ?? '',
      phone: seed.phone ?? '',
      location: {
        address: seed.address,
        placeId: seed.placeId,
        lat: seed.lat,
        lng: seed.lng,
      },
      isAllowed: seed.isAllowed ?? [],
      notAllowed: seed.notAllowed ?? [],
      hasCompressorOnSite: existingGasMixes.length > 0,
      compressorGasMixes: existingGasMixes,
      compressorNitroxMin: seed.nitroxMin ?? undefined,
      compressorNitroxMax: seed.nitroxMax ?? undefined,
    }
  }

  return {
    ...EMPTY_VENUE_EDIT,
    kind,
    email: (inheritedDefaults.email as string) || '',
    phone: (inheritedDefaults.phone as string) || '',
  }
}

export function VenueCapabilitiesSection({ me }: VenueCapabilitiesSectionProps) {
  const t = useTranslations('common')
  const venues = useQuery(api.venues.mine)
  const createVenue = useMutation(api.venues.create)
  const updateVenue = useMutation(api.venues.update)
  const removeVenue = useMutation(api.venues.remove)
  const venueInheritedDefaults = useInheritedContactDefaults('Venue', me)

  const initialTab: SubTab =
    venues && venues.length === 1 ? (venues[0].kind as SubTab) : 'pool'
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab)
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: 'create'; kind: VenueKind; initial: VenueEditValue }
    | { open: true; mode: 'edit'; venueId: Id<'venues'>; kind: VenueKind; initial: VenueEditValue }
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
      email: value.email,
      phone: value.phone,
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
      email: value.email,
      phone: value.phone,
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

  const openCreate = (kind: VenueKind) => {
    setDialogState({
      open: true,
      mode: 'create',
      kind,
      initial: buildCreateDefaults(kind, venues, venueInheritedDefaults),
    })
  }

  const openEditFor = (venue: VenueDoc) => {
    const existingGasMixes = (venue.gasMixes ?? []) as GasMix[]
    setDialogState({
      open: true,
      mode: 'edit',
      venueId: venue._id,
      kind: venue.kind as VenueKind,
      initial: {
        name: venue.name,
        kind: venue.kind as VenueKind,
        email: venue.email ?? '',
        phone: venue.phone ?? '',
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

  const filtered = venues.filter((v) => (v.kind as VenueKind) === activeTab)
  const addLabel = activeTab === 'pool' ? t('addPool') : t('addDiveSite')
  const emptyMessage = activeTab === 'pool' ? t('noPoolsYet') : t('noDiveSitesYet')
  const removeAriaKey = activeTab === 'pool' ? 'removePool' : 'removeDiveSite'

  return (
    <>
      <nav className="flex gap-2 mb-4" role="tablist" aria-label={t('venues')}>
        <MenuButton
          variant="pill"
          size="sm"
          role="tab"
          aria-selected={activeTab === 'pool'}
          active={activeTab === 'pool'}
          onClick={() => setActiveTab('pool')}
        >
          {t('venueKinds.pool')}
        </MenuButton>
        <MenuButton
          variant="pill"
          size="sm"
          role="tab"
          aria-selected={activeTab === 'dive_site'}
          active={activeTab === 'dive_site'}
          onClick={() => setActiveTab('dive_site')}
        >
          {t('venueKinds.dive_site')}
        </MenuButton>
      </nav>

      <EntityCardList
        label={activeTab === 'pool' ? t('venueKinds.pool') : t('venueKinds.dive_site')}
        items={filtered}
        addLabel={addLabel}
        emptyMessage={emptyMessage}
        onAdd={() => openCreate(activeTab)}
        onRemove={(venue) => void handleRemove(venue._id)}
        itemKey={(venue) => venue._id}
        removeAriaLabel={(venue) => t(removeAriaKey, { name: venue.name })}
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
        lockedKind={dialogState.open ? dialogState.kind : undefined}
        initialValue={dialogState.open ? dialogState.initial : EMPTY_VENUE_EDIT}
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
