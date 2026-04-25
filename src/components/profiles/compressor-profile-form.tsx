'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { useTranslations } from 'next-intl'
import { api, type Doc, type Id } from '@/lib/convex-generated'
import { EntityCardList } from '@/components/ui/entity-card-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingCard } from '@/components/ui/loading-card'
import { ConfirmActionDialog } from '@/components/ui/confirm-dialog'
import {
  CompressorEditDialog,
  EMPTY_COMPRESSOR_EDIT,
  type CompressorEditValue,
} from './compressor-edit-dialog'
import {
  useInheritedContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'

import { type GasMix } from '@/lib/constants/gas-mixes'
import type { CompressorLocation } from '../../../convex/shared/compressorTypes'

export type CompressorProfileSection = 'contact'

type CompressorListSectionProps = BaseProfileSectionProps

export function CompressorContactSection({ me }: CompressorListSectionProps) {
  const t = useTranslations('common')
  const compressors = useQuery(api.compressors.mine)
  const boatProfile = useQuery(api.boats.mine) as Doc<'boats'> | null | undefined
  const venues = useQuery(api.venues.mine) as Doc<'venues'>[] | undefined
  const createCompressor = useMutation(api.compressors.create)
  const updateCompressor = useMutation(api.compressors.update)
  const removeCompressor = useMutation(api.compressors.remove)
  const inheritedDefaults = useInheritedContactDefaults('Compressor', me)

  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: 'create' }
    | { open: true; mode: 'edit'; compressorId: Id<'compressors'>; initial: CompressorEditValue }
  >({ open: false })

  const [confirmRemove, setConfirmRemove] = useState<{
    compressorId: Id<'compressors'>
    name: string
  } | null>(null)

  if (compressors === undefined) {
    return <LoadingCard />
  }

  const venueNameById = new Map<string, string>()
  for (const venue of venues ?? []) {
    venueNameById.set(venue._id, venue.name)
  }
  const boatVesselNames = (boatProfile?.fleet ?? []).map((v) => v.boatName).filter(Boolean)

  const resolveSubtitle = (compressor: Doc<'compressors'>): string => {
    if (compressor.location === 'fixed') return t('compressorLocations.fixed')
    if (compressor.location === 'boat') {
      if (!compressor.boatId) return t('compressorLocations.boat')
      const label = boatVesselNames[0]
      return label ? t('compressorOnboardLabel', { name: label }) : t('compressorLocations.boat')
    }
    if (compressor.location === 'venue') {
      if (!compressor.venueId) return t('compressorLocations.venue')
      const name = venueNameById.get(compressor.venueId)
      return name ? t('compressorAtVenueLabel', { name }) : t('compressorLocations.venue')
    }
    return t(`compressorLocations.${compressor.location as CompressorLocation}`)
  }

  const handleCreate = async (value: CompressorEditValue) => {
    const payload: Record<string, unknown> = {
      ...inheritedDefaults,
      name: value.name,
      location: value.location,
      gasMixes: value.gasMixes,
    }
    if (value.location === 'boat' && value.boatId) payload.boatId = value.boatId
    if (value.location === 'venue' && value.venueId) payload.venueId = value.venueId
    if (value.location === 'fixed' && value.venueLocation) {
      payload.address = value.venueLocation.address
      payload.lat = value.venueLocation.lat
      payload.lng = value.venueLocation.lng
      if (value.venueLocation.placeId) payload.placeId = value.venueLocation.placeId
    }
    if (value.gasMixes.includes('nitrox')) {
      payload.nitroxMin = value.nitroxMin
      payload.nitroxMax = value.nitroxMax
    }
    await createCompressor(payload as never)
  }

  const handleEdit = async (compressorId: Id<'compressors'>, value: CompressorEditValue) => {
    const payload: Record<string, unknown> = {
      compressorId,
      name: value.name,
      location: value.location,
      gasMixes: value.gasMixes,
    }
    if (value.location === 'boat' && value.boatId) payload.boatId = value.boatId
    if (value.location === 'venue' && value.venueId) payload.venueId = value.venueId
    if (value.location === 'fixed' && value.venueLocation) {
      payload.address = value.venueLocation.address
      payload.lat = value.venueLocation.lat
      payload.lng = value.venueLocation.lng
      if (value.venueLocation.placeId) payload.placeId = value.venueLocation.placeId
    }
    if (value.gasMixes.includes('nitrox')) {
      payload.nitroxMin = value.nitroxMin
      payload.nitroxMax = value.nitroxMax
    }
    await updateCompressor(payload as never)
  }

  const openEditFor = (compressor: Doc<'compressors'>) => {
    setDialogState({
      open: true,
      mode: 'edit',
      compressorId: compressor._id,
      initial: {
        name: compressor.name,
        location: compressor.location,
        boatId: compressor.boatId ?? null,
        venueId: compressor.venueId ?? null,
        venueLocation:
          compressor.location === 'fixed' && compressor.address
            ? {
                address: compressor.address,
                placeId: compressor.placeId,
                lat: compressor.lat,
                lng: compressor.lng,
              }
            : null,
        gasMixes: (compressor.gasMixes ?? []) as GasMix[],
        nitroxMin: compressor.nitroxMin,
        nitroxMax: compressor.nitroxMax,
      },
    })
  }

  return (
    <>
      <EntityCardList
        label="Compressors"
        items={compressors}
        addLabel={t('addCompressor')}
        emptyMessage="No compressors yet. Add your first compressor to list your gas mix service."
        onAdd={() => setDialogState({ open: true, mode: 'create' })}
        onRemove={(compressor) =>
          setConfirmRemove({ compressorId: compressor._id, name: compressor.name })
        }
        itemKey={(compressor) => compressor._id}
        removeAriaLabel={(compressor) => `Remove ${compressor.name}`}
        renderCard={(compressor) => {
          const mixes = (compressor.gasMixes ?? []) as GasMix[]
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary truncate">{compressor.name}</span>
                <Badge variant="muted">{resolveSubtitle(compressor)}</Badge>
              </div>
              {mixes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {mixes.map((mix) => (
                    <Badge key={mix} variant="info" size="sm">
                      {mix === 'nitrox' && compressor.nitroxMin !== undefined && compressor.nitroxMax !== undefined
                        ? `Nitrox ${compressor.nitroxMin}–${compressor.nitroxMax}%`
                        : mix === 'nitrox'
                          ? 'Nitrox'
                          : 'Air'}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openEditFor(compressor)}
                className="self-start"
              >
                Edit
              </Button>
            </div>
          )
        }}
      />

      <CompressorEditDialog
        open={dialogState.open}
        onClose={() => setDialogState({ open: false })}
        mode={dialogState.open && dialogState.mode === 'edit' ? 'edit' : 'create'}
        initialValue={
          dialogState.open && dialogState.mode === 'edit'
            ? dialogState.initial
            : EMPTY_COMPRESSOR_EDIT
        }
        onSubmit={async (value) => {
          if (dialogState.open && dialogState.mode === 'edit') {
            await handleEdit(dialogState.compressorId, value)
          } else {
            await handleCreate(value)
          }
        }}
      />

      <ConfirmActionDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={t('removeCompressor')}
        description={
          confirmRemove
            ? t('removeCompressorConfirm', { name: confirmRemove.name })
            : ''
        }
        confirmLabel={t('remove')}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmRemove) return
          await removeCompressor({ compressorId: confirmRemove.compressorId })
          setConfirmRemove(null)
        }}
      />
    </>
  )
}

export type CompressorGasMixesFormState = {
  gasMixes: GasMix[]
  nitroxMin: number | undefined
  nitroxMax: number | undefined
}

export const INITIAL_COMPRESSOR_GAS_MIXES_FORM: CompressorGasMixesFormState = {
  gasMixes: [],
  nitroxMin: undefined,
  nitroxMax: undefined,
}

export function compressorGasMixesFromProfile(p: Record<string, unknown>): CompressorGasMixesFormState {
  return {
    gasMixes: (p.gasMixes ?? []) as GasMix[],
    nitroxMin: typeof p.nitroxMin === 'number' ? p.nitroxMin : undefined,
    nitroxMax: typeof p.nitroxMax === 'number' ? p.nitroxMax : undefined,
  }
}

export function compressorGasMixesToPayload(f: CompressorGasMixesFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = { gasMixes: f.gasMixes }
  if (f.gasMixes.includes('nitrox')) {
    payload.nitroxMin = f.nitroxMin
    payload.nitroxMax = f.nitroxMax
  }
  return payload
}

