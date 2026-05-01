'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery } from 'convex/react'
import type { Id, VenueDoc } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { ExpandingCardList } from '@/components/profiles/collection-editors'
import { Badge } from '@/components/ui/badge'
import { LoadingCard } from '@/components/ui/loading-card'
import { MenuButton } from '@/components/ui/menu-button'
import { RequiredAsterisk } from '@/components/ui/required-asterisk'
import { INLINE_SAVED_FLASH_MS } from '@/lib/constants/ui-timings'
import {
  useInheritedContactDefaults,
  type BaseProfileSectionProps,
} from '@/lib/profile-form'
import type { VenueKind, VenueFeature } from '@/lib/constants/venue-subtypes'
import type { GasMix } from '@/lib/constants/gas-mixes'
import {
  clearStoredVenueSignupIntent,
  useVenueSignupIntent,
} from '@/lib/hooks/use-venue-signup-intent'
import {
  VenueFormBody,
  EMPTY_VENUE_FORM,
  isVenueFormSubmittable,
  type VenueFormValue,
} from './venue-form-body'

type VenueCapabilitiesSectionProps = BaseProfileSectionProps
type SubTab = 'pool' | 'dive_site'

interface VenueEntry {
  key: string
  venueId: Id<'venues'> | null
  kind: VenueKind
  form: VenueFormValue
}

function venueToEntry(venue: VenueDoc): VenueEntry {
  const gasMixes = (venue.gasMixes ?? []) as GasMix[]
  return {
    key: venue._id,
    venueId: venue._id,
    kind: venue.kind as VenueKind,
    form: {
      name: venue.name,
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
      hasCompressorOnSite: gasMixes.length > 0,
      compressorGasMixes: gasMixes,
      compressorNitroxMin: venue.nitroxMin,
      compressorNitroxMax: venue.nitroxMax,
    },
  }
}

function inheritDraftForm(
  prior: VenueEntry | null,
  targetKind: VenueKind,
  inherited: { email?: string; phone?: string },
): VenueFormValue {
  if (!prior) {
    return {
      ...EMPTY_VENUE_FORM,
      email: inherited.email ?? '',
      phone: inherited.phone ?? '',
    }
  }
  const sameKind = prior.kind === targetKind
  const targetIsPool = targetKind === 'pool'
  return {
    ...prior.form,
    name: '',
    confinedCapable: sameKind ? prior.form.confinedCapable : targetIsPool,
    features: sameKind ? prior.form.features : [],
    maxDepth: sameKind ? prior.form.maxDepth : 0,
    maxCapacity: sameKind && targetIsPool ? prior.form.maxCapacity : 0,
  }
}

function pickPriorEntry(
  sortedAllEntries: VenueEntry[],
  targetKind: VenueKind,
): VenueEntry | null {
  return (
    sortedAllEntries.find((e) => e.kind === targetKind) ??
    sortedAllEntries[0] ??
    null
  )
}

function makeDraft(
  kind: VenueKind,
  prior: VenueEntry | null,
  inherited: { email?: string; phone?: string },
  index: number,
): VenueEntry {
  return {
    key: `draft-${kind}-${index}`,
    venueId: null,
    kind,
    form: inheritDraftForm(prior, kind, inherited),
  }
}

function selectInitialTab(
  hasPool: boolean,
  hasDiveSite: boolean,
  intentKind: VenueKind | null,
): SubTab {
  if (!hasPool && !hasDiveSite) return intentKind ?? 'pool'
  if (hasPool && !hasDiveSite) return 'pool'
  if (!hasPool && hasDiveSite) return 'dive_site'
  return intentKind ?? 'pool'
}

function buildGasMixPayload(form: VenueFormValue) {
  if (!form.hasCompressorOnSite || !form.compressorGasMixes?.length) {
    return { gasMixes: [] as GasMix[] }
  }
  const includesNitrox = form.compressorGasMixes.includes('nitrox')
  return {
    gasMixes: form.compressorGasMixes,
    ...(includesNitrox && form.compressorNitroxMin !== undefined ? { nitroxMin: form.compressorNitroxMin } : {}),
    ...(includesNitrox && form.compressorNitroxMax !== undefined ? { nitroxMax: form.compressorNitroxMax } : {}),
  }
}

export function VenueCapabilitiesSection({ me }: VenueCapabilitiesSectionProps) {
  const venues = useQuery(api.venues.mine)
  if (venues === undefined) return <LoadingCard />
  return <VenueCapabilitiesInner venues={venues as VenueDoc[]} me={me} />
}

function VenueCapabilitiesInner({
  venues,
  me,
}: {
  venues: VenueDoc[]
  me: BaseProfileSectionProps['me']
}) {
  const t = useTranslations('common')
  const createVenue = useMutation(api.venues.create)
  const updateVenue = useMutation(api.venues.update)
  const removeVenue = useMutation(api.venues.remove)
  const venueInheritedDefaults = useInheritedContactDefaults('Venue', me)
  const venueSignupIntent = useVenueSignupIntent()
  const intentKind: VenueKind | null =
    venueSignupIntent === 'pool' || venueSignupIntent === 'dive_site'
      ? venueSignupIntent
      : null

  const sortedAllEntries = useMemo(() => {
    const sorted = [...venues].sort((a, b) => b._creationTime - a._creationTime)
    return sorted.map(venueToEntry)
  }, [venues])

  const existingByKind = useMemo(
    () => ({
      pool: sortedAllEntries.filter((e) => e.kind === 'pool'),
      dive_site: sortedAllEntries.filter((e) => e.kind === 'dive_site'),
    }),
    [sortedAllEntries],
  )

  const inheritedEmail = (venueInheritedDefaults.email as string) || undefined
  const inheritedPhone = (venueInheritedDefaults.phone as string) || undefined

  const [activeTab, setActiveTab] = useState<SubTab>(() =>
    selectInitialTab(
      existingByKind.pool.length > 0,
      existingByKind.dive_site.length > 0,
      intentKind,
    ),
  )

  const draftCounterRef = useRef(0)
  const justCreatedKindsRef = useRef<Set<SubTab>>(new Set())

  const [drafts, setDrafts] = useState<Record<SubTab, VenueEntry[]>>(() => {
    const out: Record<SubTab, VenueEntry[]> = { pool: [], dive_site: [] }
    const initial = selectInitialTab(
      existingByKind.pool.length > 0,
      existingByKind.dive_site.length > 0,
      intentKind,
    )
    if (existingByKind[initial].length === 0) {
      const idx = draftCounterRef.current++
      const prior = pickPriorEntry(sortedAllEntries, initial)
      out[initial] = [
        makeDraft(initial, prior, { email: inheritedEmail, phone: inheritedPhone }, idx),
      ]
    }
    return out
  })

  useEffect(() => {
    if (existingByKind[activeTab].length > 0) {
      justCreatedKindsRef.current.delete(activeTab)
      return
    }
    if (justCreatedKindsRef.current.has(activeTab)) return
    if (drafts[activeTab].length > 0) return
    const idx = draftCounterRef.current++
    const prior = pickPriorEntry(sortedAllEntries, activeTab)
    const newDraft = makeDraft(
      activeTab,
      prior,
      { email: inheritedEmail, phone: inheritedPhone },
      idx,
    )
    setDrafts((prev) => ({ ...prev, [activeTab]: [newDraft] }))
    setExpandedByTab((prev) => ({
      ...prev,
      [activeTab]: new Set([newDraft.key]),
    }))
  }, [
    activeTab,
    existingByKind,
    drafts,
    inheritedEmail,
    inheritedPhone,
    sortedAllEntries,
  ])

  const [edits, setEdits] = useState<Record<string, VenueFormValue>>({})
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})

  const [expandedByTab, setExpandedByTab] = useState<Record<SubTab, Set<string>>>(() => {
    const out: Record<SubTab, Set<string>> = {
      pool: new Set(),
      dive_site: new Set(),
    }
    const initial = selectInitialTab(
      existingByKind.pool.length > 0,
      existingByKind.dive_site.length > 0,
      intentKind,
    )
    if (existingByKind[initial].length === 0) {
      out[initial] = new Set([`draft-${initial}-0`])
    }
    return out
  })

  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (!intentKind) return
    autoOpenedRef.current = true
    if (venues.some((v) => (v.kind as VenueKind) === intentKind)) {
      clearStoredVenueSignupIntent()
    }
  }, [intentKind, venues])

  const existingWithEdits = existingByKind[activeTab].map((entry) =>
    edits[entry.key] ? { ...entry, form: edits[entry.key]! } : entry,
  )
  const items: VenueEntry[] = [...existingWithEdits, ...drafts[activeTab]]

  const buildVenueArgs = (entry: VenueEntry) => {
    if (!entry.form.location) throw new Error( // error-ok: developer contract — isVenueFormSubmittable gates location !== null upstream
      'LOCATION_REQUIRED',
    )
    return {
      name: entry.form.name,
      address: entry.form.location.address,
      placeId: entry.form.location.placeId,
      lat: entry.form.location.lat,
      lng: entry.form.location.lng,
      email: entry.form.email,
      phone: entry.form.phone,
      kind: entry.kind,
      features: entry.form.features,
      confinedCapable: entry.form.confinedCapable,
      maxDepth: entry.form.maxDepth > 0 ? entry.form.maxDepth : undefined,
      maxCapacity:
        entry.kind === 'pool' && entry.form.maxCapacity > 0
          ? entry.form.maxCapacity
          : undefined,
      isAllowed: entry.form.isAllowed,
      notAllowed: entry.form.notAllowed,
      ...buildGasMixPayload(entry.form),
    }
  }

  const handleAdd = () => {
    const idx = draftCounterRef.current++
    const prior = pickPriorEntry(sortedAllEntries, activeTab)
    const newDraft = makeDraft(
      activeTab,
      prior,
      { email: inheritedEmail, phone: inheritedPhone },
      idx,
    )
    setDrafts((prev) => ({
      ...prev,
      [activeTab]: [...prev[activeTab], newDraft],
    }))
    setExpandedByTab((prev) => ({
      ...prev,
      [activeTab]: new Set(prev[activeTab]).add(newDraft.key),
    }))
  }

  const handleEntryChange = (entry: VenueEntry, nextForm: VenueFormValue) => {
    if (entry.venueId) {
      setEdits((prev) => ({ ...prev, [entry.key]: nextForm }))
    } else {
      setDrafts((prev) => ({
        ...prev,
        [entry.kind]: prev[entry.kind].map((d) =>
          d.key === entry.key ? { ...d, form: nextForm } : d,
        ),
      }))
    }
  }

  const handleSave = async (entry: VenueEntry) => {
    if (!isVenueFormSubmittable(entry.form, entry.kind)) {
      setSaveErrors((prev) => ({
        ...prev,
        [entry.key]: t('fillRequiredFields'),
      }))
      return
    }
    setSavingKeys((prev) => new Set(prev).add(entry.key))
    setSaveErrors((prev) => {
      const next = { ...prev }
      delete next[entry.key]
      return next
    })
    try {
      if (entry.venueId) {
        await updateVenue({ venueId: entry.venueId, ...buildVenueArgs(entry) })
        setEdits((prev) => {
          const next = { ...prev }
          delete next[entry.key]
          return next
        })
      } else {
        await createVenue(buildVenueArgs(entry))
        justCreatedKindsRef.current.add(entry.kind as SubTab)
        setDrafts((prev) => ({
          ...prev,
          [entry.kind]: prev[entry.kind].filter((d) => d.key !== entry.key),
        }))
        if (intentKind) clearStoredVenueSignupIntent()
      }
      setSavedKeys((prev) => new Set(prev).add(entry.key))
      setTimeout(() => {
        setSavedKeys((prev) => {
          const next = new Set(prev)
          next.delete(entry.key)
          return next
        })
      }, INLINE_SAVED_FLASH_MS)
    } catch (e) {
      setSaveErrors((prev) => ({
        ...prev,
        [entry.key]:
          e instanceof Error ? e.message : t('actionFailed', { action: t('save') }),
      }))
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev)
        next.delete(entry.key)
        return next
      })
    }
  }

  const handleRemove = async (entry: VenueEntry) => {
    if (entry.venueId) {
      await removeVenue({ venueId: entry.venueId })
    } else {
      setDrafts((prev) => ({
        ...prev,
        [entry.kind]: prev[entry.kind].filter((d) => d.key !== entry.key),
      }))
    }
  }

  const tabLabel = activeTab === 'pool' ? t('venueKinds.pool') : t('venueKinds.dive_site')
  const addLabel = activeTab === 'pool' ? t('addPool') : t('addDiveSite')
  const newDefaultLabel = activeTab === 'pool' ? t('newPool') : t('newDiveSite')
  const removeLabelTemplate = activeTab === 'pool' ? 'removePool' : 'removeDiveSite'

  return (
    <>
      <nav className="flex gap-2 mb-4" role="tablist" aria-label={t('venues')}>
        <MenuButton
          variant="pill"
          size="sm"
          role="tab"
          aria-selected={activeTab === 'pool'}
          aria-required
          active={activeTab === 'pool'}
          onClick={() => setActiveTab('pool')}
        >
          {t('venueKinds.pool')}
          <RequiredAsterisk />
        </MenuButton>
        <MenuButton
          variant="pill"
          size="sm"
          role="tab"
          aria-selected={activeTab === 'dive_site'}
          aria-required
          active={activeTab === 'dive_site'}
          onClick={() => setActiveTab('dive_site')}
        >
          {t('venueKinds.dive_site')}
          <RequiredAsterisk />
        </MenuButton>
      </nav>

      <ExpandingCardList<VenueEntry>
        label={tabLabel}
        addLabel={addLabel}
        items={items}
        itemKey={(entry) => entry.key}
        expandedKeys={expandedByTab[activeTab]}
        onExpandedKeysChange={(next) =>
          setExpandedByTab((prev) => ({ ...prev, [activeTab]: next }))
        }
        onAdd={handleAdd}
        onSave={handleSave}
        onRemove={handleRemove}
        savingKeys={savingKeys}
        savedKeys={savedKeys}
        saveErrors={saveErrors}
        removeAriaLabel={(entry) =>
          t(removeLabelTemplate, { name: entry.form.name || newDefaultLabel })
        }
        renderCardTitle={(entry) => (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-primary truncate">
              {entry.form.name || newDefaultLabel}
            </span>
            <Badge variant="muted" size="sm">{t(`venueKinds.${entry.kind}`)}</Badge>
          </div>
        )}
        renderExpandedBody={(entry) => (
          <VenueFormBody
            kind={entry.kind}
            value={entry.form}
            onChange={(next) => handleEntryChange(entry, next)}
          />
        )}
      />
    </>
  )
}
