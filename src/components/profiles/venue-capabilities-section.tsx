'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { Id } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { EntityCardList } from '@/components/ui/entity-card-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingCard } from '@/components/ui/loading-card'
import type { BaseProfileSectionProps } from '@/lib/profile-form'
import type { VenueSubtype } from '@/lib/constants/venue-subtypes'
import {
  VenueEditDialog,
  EMPTY_VENUE_EDIT,
  type VenueEditValue,
} from './venue-edit-dialog'

export type VenueCapabilitiesFormState = {
  subtype: VenueSubtype
  confinedCapable?: boolean
  maxDepth: number
  maxCapacity: number
}

export const INITIAL_VENUE_CAPABILITIES_FORM: VenueCapabilitiesFormState = {
  subtype: 'pool',
  confinedCapable: false,
  maxDepth: 0,
  maxCapacity: 0,
}

export function venueCapabilitiesFromProfile(p: Record<string, unknown>): VenueCapabilitiesFormState {
  const subtype = (p.subtype as VenueSubtype | undefined) ?? 'pool'
  return {
    subtype,
    confinedCapable: (p.confinedCapable as boolean) ?? false,
    maxDepth: (p.maxDepth as number) ?? 0,
    maxCapacity: (p.maxCapacity as number) ?? 0,
  }
}

export function venueCapabilitiesToPayload(f: VenueCapabilitiesFormState): Record<string, unknown> {
  return {
    subtype: f.subtype,
    ...(f.maxDepth > 0 ? { maxDepth: f.maxDepth } : {}),
    ...(f.maxCapacity > 0 ? { maxCapacity: f.maxCapacity } : {}),
    ...(f.confinedCapable !== undefined ? { confinedCapable: f.confinedCapable } : {}),
  }
}

const SUBTYPE_LABELS: Record<VenueSubtype, string> = {
  pool: 'Pool',
  shore: 'Shore',
  reef: 'Reef',
  lake: 'Lake',
  river: 'River',
  quarry: 'Quarry',
  other: 'Other',
}

type VenueCapabilitiesSectionProps = BaseProfileSectionProps

export function VenueCapabilitiesSection(_props: VenueCapabilitiesSectionProps) {
  const venues = useQuery(api.venues.mine)
  const createVenue = useMutation(api.venues.create)
  const updateVenue = useMutation(api.venues.update)
  const removeVenue = useMutation(api.venues.remove)

  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; venueId: Id<'venues'>; initial: VenueEditValue }
  >({ open: false })

  if (venues === undefined) {
    return <LoadingCard />
  }

  const handleCreate = async (value: VenueEditValue) => {
    if (!value.location) return
    await createVenue({
      name: value.name,
      address: value.location.address,
      placeId: value.location.placeId,
      lat: value.location.lat,
      lng: value.location.lng,
      email: '',
      phone: '',
      subtype: value.subtype,
      hasCompressor: value.hasCompressor,
      confinedCapable: value.confinedCapable,
      maxDepth: value.maxDepth > 0 ? value.maxDepth : undefined,
      maxCapacity: value.maxCapacity > 0 ? value.maxCapacity : undefined,
      isAllowed: value.isAllowed,
      notAllowed: value.notAllowed,
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
      subtype: value.subtype,
      hasCompressor: value.hasCompressor,
      confinedCapable: value.confinedCapable,
      maxDepth: value.maxDepth > 0 ? value.maxDepth : undefined,
      maxCapacity: value.maxCapacity > 0 ? value.maxCapacity : undefined,
      isAllowed: value.isAllowed,
      notAllowed: value.notAllowed,
    })
  }

  const handleRemove = async (venueId: Id<'venues'>) => {
    await removeVenue({ venueId })
  }

  const openEditFor = (venue: (typeof venues)[number]) => {
    setDialogState({
      open: true,
      mode: 'edit',
      venueId: venue._id,
      initial: {
        name: venue.name,
        subtype: venue.subtype as VenueSubtype,
        location: {
          address: venue.address,
          placeId: venue.placeId,
          lat: venue.lat,
          lng: venue.lng,
        },
        maxDepth: venue.maxDepth ?? 0,
        maxCapacity: venue.maxCapacity ?? 0,
        confinedCapable: venue.confinedCapable ?? false,
        hasCompressor: venue.hasCompressor,
        isAllowed: venue.isAllowed ?? [],
        notAllowed: venue.notAllowed ?? [],
      },
    })
  }

  return (
    <>
      <EntityCardList
        label="Venues"
        items={venues}
        addLabel="Add venue"
        emptyMessage="No venues yet. Add your first venue to start accepting bookings."
        onAdd={() => setDialogState({ open: true, mode: 'create' })}
        onRemove={(venue) => void handleRemove(venue._id)}
        itemKey={(venue) => venue._id}
        removeAriaLabel={(venue) => `Remove ${venue.name}`}
        renderCard={(venue) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary truncate">{venue.name}</span>
              <Badge variant="muted">{SUBTYPE_LABELS[venue.subtype as VenueSubtype]}</Badge>
            </div>
            <div className="text-body-sm text-secondary">
              {venue.maxDepth ? `${venue.maxDepth} m` : '—'}
              {' · '}
              {venue.maxCapacity ? `${venue.maxCapacity} cap` : '—'}
              {venue.confinedCapable ? ' · Confined' : ''}
              {venue.hasCompressor ? ' · Compressor' : ''}
            </div>
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
              Edit
            </Button>
          </div>
        )}
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
