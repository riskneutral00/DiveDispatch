/// <reference types="google.maps" />
'use client'

import { useState, useCallback, useEffect, useId, useRef, useReducer } from 'react'
import { useTranslations } from 'next-intl'
import { APIProvider, Map, useApiIsLoaded, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps'
import usePlacesAutocomplete from 'use-places-autocomplete'
import countries from 'i18n-iso-countries'
import enCountries from 'i18n-iso-countries/langs/en.json'
import { MapPin, Locate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { autocompleteKeyboardReducer, INITIAL_STATE } from '@/components/ui/autocomplete-keyboard'
import type { AddressLocationValue } from '@/lib/schemas/location'
import { AUTOCOMPLETE_DISMISS_MS } from '@/lib/constants/ui-timings'

countries.registerLocale(enCountries as unknown as Parameters<typeof countries.registerLocale>[0])

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 }

type LocationValue = AddressLocationValue

type NormalizedComponent = {
  long: string
  short: string
  types: ReadonlyArray<string>
}

function normalizeGeocoder(c: google.maps.GeocoderAddressComponent): NormalizedComponent {
  return { long: c.long_name, short: c.short_name, types: c.types }
}

function normalizePlace(c: google.maps.places.AddressComponent): NormalizedComponent {
  return { long: c.longText ?? '', short: c.shortText ?? '', types: c.types }
}

function parseAddress(
  comps: ReadonlyArray<NormalizedComponent>,
  formattedAddress?: string,
): AddressLocationValue['address'] {
  const get = (type: string, useShort = false): string | undefined => {
    const c = comps.find((c) => c.types.includes(type))
    if (!c) return undefined
    return useShort ? c.short : c.long
  }
  const city =
    get('locality') ||
    get('sublocality') ||
    get('sublocality_level_1') ||
    get('administrative_area_level_2') ||
    ''
  const country = get('country', true) || ''
  const state = get('administrative_area_level_1')
  const postalCode = get('postal_code')
  const streetNum = get('street_number')
  const route = get('route')
  let street: string | undefined
  if (streetNum && route) {
    street = `${streetNum} ${route}`
  } else if (route) {
    street = route
  } else if (formattedAddress) {
    const firstComma = formattedAddress.split(',')[0]?.trim()
    if (firstComma) street = firstComma
  }
  return { street, city, state, country, postalCode }
}

function displayLabel(value: AddressLocationValue): string {
  const city = value.address.city
  const iso = value.address.country
  const countryName = iso ? countries.getName(iso, 'en') ?? iso : ''
  if (city && countryName) return `${city}, ${countryName}`
  return city || countryName || ''
}

function displayFullAddress(value: AddressLocationValue): string {
  const { street, city, state, postalCode, country } = value.address
  const countryName = country ? countries.getName(country, 'en') ?? country : ''
  return [street, city, state, postalCode, countryName].filter((p): p is string => Boolean(p)).join(', ')
}

function FlyEffect({ target, zoom = 20 }: { target: { lat: number; lng: number } | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (target && map) {
      map.panTo(target)
      map.setZoom(zoom)
    }
  }, [target, map, zoom])
  return null
}

interface ModalInnerProps {
  value: LocationValue | null
  onConfirm: (loc: LocationValue) => void
  onCancel: () => void
}

function LocationPickerModalInner({ value, onConfirm, onCancel }: ModalInnerProps) {
  const t = useTranslations('portal')
  const tCommon = useTranslations('common')
  const inputId = useId()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER,
  )
  const [displayAddress, setDisplayAddress] = useState(
    value ? (value.formattedAddress ?? displayFullAddress(value)) : '',
  )
  const [pendingAddress, setPendingAddress] = useState<AddressLocationValue['address'] | null>(
    value ? value.address : null,
  )
  const [pendingPlaceId, setPendingPlaceId] = useState<string | undefined>(value?.placeId)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null,
  )
  const [flyZoom, setFlyZoom] = useState(20)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const poiClickRef = useRef(false)
  const initialLoadRef = useRef(!!value)
  const [poiSelected, setPoiSelected] = useState(false)

  const [kbState, kbDispatch] = useReducer(autocompleteKeyboardReducer, INITIAL_STATE)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }
  }, [])

  useEffect(() => {
    if (!value) handleGPS()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only GPS prefill; rerunning on handleGPS identity would loop
  }, [])

  const {
    value: query,
    suggestions: { status, data },
    setValue: setQuery,
    clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 300 })

  function handleGPS() {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false)
        setFlyZoom(15)
        setFlyTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setGpsLoading(false),
      { timeout: 8000 },
    )
  }

  async function handleSelect(suggestion: google.maps.places.AutocompletePrediction) {
    setQuery(suggestion.description, false)
    clearSuggestions()
    setSuggestionsOpen(false)
    poiClickRef.current = true
    setPoiSelected(true)

    try {
      const place = new google.maps.places.Place({ id: suggestion.place_id })
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] })
      if (!place.location) return
      setFlyZoom(20)
      setFlyTarget({ lat: place.location.lat(), lng: place.location.lng() })
      const formatted = place.formattedAddress ?? suggestion.description
      setDisplayAddress(formatted)
      const comps = (place.addressComponents ?? []).map(normalizePlace)
      setPendingAddress(parseAddress(comps, formatted))
      setPendingPlaceId(suggestion.place_id)
    } catch {
      setDisplayAddress(suggestion.description)
      setPendingAddress(null)
      setPendingPlaceId(suggestion.place_id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const itemCount = data.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        kbDispatch({ type: 'ARROW_DOWN', itemCount })
        break
      case 'ArrowUp':
        e.preventDefault()
        kbDispatch({ type: 'ARROW_UP', itemCount })
        break
      case 'Enter':
        e.preventDefault()
        if (kbState.highlightedIndex >= 0 && kbState.highlightedIndex < itemCount) {
          handleSelect(data[kbState.highlightedIndex])
          kbDispatch({ type: 'RESET' })
        }
        break
      case 'Escape':
        e.preventDefault()
        kbDispatch({ type: 'ESCAPE' })
        setSuggestionsOpen(false)
        inputRef.current?.focus()
        break
    }
  }

  async function handleMapClick(e: MapMouseEvent) {
    const placeId = e.detail.placeId
    if (!placeId) return
    e.stop()

    poiClickRef.current = true
    setPoiSelected(true)
    try {
      const place = new google.maps.places.Place({ id: placeId })
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'displayName', 'addressComponents'],
      })
      if (!place.location) return
      const name = place.displayName ?? ''
      const addr = place.formattedAddress ?? ''
      const display =
        name && addr && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name
      setFlyZoom(20)
      setFlyTarget({ lat: place.location.lat(), lng: place.location.lng() })
      setDisplayAddress(display)
      const comps = (place.addressComponents ?? []).map(normalizePlace)
      setPendingAddress(parseAddress(comps, addr || undefined))
      setPendingPlaceId(placeId)
    } catch {
    }
  }

  const handleIdle = useCallback(
    (e: { map: google.maps.Map }) => {
      const c = e.map.getCenter()
      if (!c) return
      const lat = c.lat()
      const lng = c.lng()
      setCenter({ lat, lng })

      if (initialLoadRef.current || poiClickRef.current) return

      setPoiSelected(false)

      ;(async () => {
        try {
          const geoResponse = await new google.maps.Geocoder().geocode({ location: { lat, lng } })
          const geoResults = geoResponse?.results
          const best = geoResults?.length
            ? geoResults.find(
                (r) => !r.types.includes('plus_code') && !/^[A-Z0-9]{4}\+/.test(r.formatted_address),
              ) ?? geoResults[0]
            : null
          const fallbackAddress = best?.formatted_address ?? ''
          const country =
            best?.address_components?.find((ac) => ac.types.includes('country'))?.long_name ?? ''

          if (best?.address_components) {
            const comps = best.address_components.map(normalizeGeocoder)
            setPendingAddress(parseAddress(comps, fallbackAddress))
            setPendingPlaceId(best.place_id)
          }

          try {
            const { places } = await google.maps.places.Place.searchNearby({
              locationRestriction: { center: { lat, lng }, radius: 50 },
              fields: ['displayName', 'formattedAddress'],
              maxResultCount: 1,
            })
            if (places?.length && places[0].displayName) {
              const parts = [places[0].displayName, places[0].formattedAddress, country].filter(
                (p): p is string => Boolean(p),
              )
              const deduped = parts.filter(
                (part, i) => i === 0 || !parts[i - 1]?.endsWith(part),
              )
              setDisplayAddress(deduped.join(', '))
            } else if (fallbackAddress) {
              setDisplayAddress(fallbackAddress)
            }
          } catch {
            if (fallbackAddress) setDisplayAddress(fallbackAddress)
          }
        } catch {
        }
      })()
    },
    [],
  )

  function handleConfirm() {
    let address: AddressLocationValue['address']
    if (pendingAddress && pendingAddress.city && pendingAddress.country) {
      address = pendingAddress
    } else {
      const parts = displayAddress.split(', ')
      const fallbackCity =
        parts.length > 1 ? parts.slice(0, -1).join(', ') : displayAddress
      const fallbackCountry = parts.length > 1 ? parts[parts.length - 1] : ''
      const iso =
        fallbackCountry.length === 2 && countries.isValid(fallbackCountry)
          ? fallbackCountry.toUpperCase()
          : countries.getAlpha2Code(fallbackCountry, 'en') || fallbackCountry
      address = {
        street: pendingAddress?.street,
        city: pendingAddress?.city || fallbackCity || displayAddress,
        state: pendingAddress?.state,
        country: pendingAddress?.country || iso,
        postalCode: pendingAddress?.postalCode,
      }
    }
    onConfirm({
      address,
      placeId: pendingPlaceId,
      formattedAddress: displayAddress || undefined,
      lat: center.lat,
      lng: center.lng,
    })
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <div
        className="flex-shrink-0 p-3 flex flex-col gap-2 glass-divider"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input /* design-ok: compound picker search filter */
              ref={inputRef}
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={suggestionsOpen && status === 'OK'}
              aria-controls={listboxId}
              aria-activedescendant={
                kbState.highlightedIndex >= 0 && suggestionsOpen && status === 'OK'
                  ? `${listboxId}-option-${kbState.highlightedIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              value={query}
              placeholder={value ? displayLabel(value) : t('searchAddress')}
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value)
                setSuggestionsOpen(true)
                kbDispatch({ type: 'RESET' })
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query) setSuggestionsOpen(true)
              }}
              onBlur={() => {
                if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
                blurTimerRef.current = setTimeout(() => { setSuggestionsOpen(false); kbDispatch({ type: 'CLOSE' }) }, AUTOCOMPLETE_DISMISS_MS)
              }}
              className="field-underline w-full text-body py-2.5 px-0 placeholder:opacity-60 text-primary caret-accent"
            />
          </div>
          <button /* design-ok: GPS locate button inside compound search input */
            type="button"
            onClick={handleGPS}
            disabled={gpsLoading}
            title={t('useMyLocation')}
            className="glass glass-field flex items-center justify-center px-3 transition-opacity duration-theme hover:opacity-80 disabled:opacity-40 cursor-pointer text-accent"
          >
            <Locate size={16} className={gpsLoading ? 'animate-pulse' : ''} />
          </button>
        </div>

        {suggestionsOpen && status === 'OK' && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Address suggestions"
            className="rounded-theme border overflow-hidden shadow-lg bg-surface-elevated border-glass-border"
          >
            {data.map((s, index) => {
              const isHighlighted = index === kbState.highlightedIndex
              return (
                <li
                  key={s.place_id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  aria-posinset={index + 1}
                  aria-setsize={data.length}
                  className="px-3 py-2.5 text-body cursor-pointer text-primary"
                  style={{
                    background: isHighlighted
                      ? 'var(--color-glass-container-border)'
                      : undefined,
                  }}
                  onMouseDown={() => {
                    handleSelect(s)
                    kbDispatch({ type: 'RESET' })
                  }}
                  onMouseEnter={() => {
                    kbDispatch({ type: 'SET_INDEX', index })
                  }}
                  onMouseLeave={() => {
                    kbDispatch({ type: 'SET_INDEX', index: -1 })
                  }}
                >
                  <span className="font-medium">{s.structured_formatting.main_text}</span>
                  {s.structured_formatting.secondary_text && (
                    <span className="ml-1.5 opacity-60 text-label">
                      {s.structured_formatting.secondary_text}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <Map
          defaultCenter={center}
          defaultZoom={value ? 20 : 10}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="dd-location-picker"
          onClick={(e) => void handleMapClick(e)}
          onDragstart={() => { poiClickRef.current = false; initialLoadRef.current = false }}
          onIdle={handleIdle}
          style={{ width: '100%', height: '100%' }}
        >
          <FlyEffect target={flyTarget} zoom={flyZoom} />
        </Map>

        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-theme ${poiSelected ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="map-crosshair">
            <line x1="18" y1="4"  x2="18" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="18" y1="23" x2="18" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4"  y1="18" x2="13" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="23" y1="18" x2="32" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="18" r="3.5" stroke="white" strokeWidth="2.5" fill="none" />
          </svg>
        </div>
      </div>

      <div
        className="flex-shrink-0 flex items-center justify-between gap-3 p-3 border-t border-glass-border"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="text-accent shrink-0" />
          <span
            className={`text-body truncate ${displayAddress ? 'text-primary' : 'text-secondary'}`}
          >
            {displayAddress || t('dragToSetLocation')}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={handleConfirm} disabled={!displayAddress}>
            {tCommon('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function LocationPickerGate(props: ModalInnerProps) {
  const t = useTranslations('common')
  const isLoaded = useApiIsLoaded()
  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center h-full text-secondary"
      >
        <span className="text-body">{t('loading')}</span>
      </div>
    )
  }
  return <LocationPickerModalInner {...props} />
}

export function LocationPickerModal(props: ModalInnerProps) {
  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <LocationPickerGate {...props} />
    </APIProvider>
  )
}
