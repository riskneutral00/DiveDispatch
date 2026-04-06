'use client'

import { useState, useCallback, useEffect, useId, useRef, useReducer } from 'react'
import { useTranslations } from 'next-intl'
import { APIProvider, Map, useApiIsLoaded, useMap, type MapMouseEvent } from '@vis.gl/react-google-maps'
import usePlacesAutocomplete from 'use-places-autocomplete'
import { MapPin, X, Locate, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { Dialog } from '@/components/ui/dialog'
import { autocompleteKeyboardReducer, INITIAL_STATE } from '@/components/ui/autocomplete-keyboard'

// ── Types ─────────────────────────────────────────────────────────────────────

import type { LocationValue } from '@/lib/schemas/location'
export type { LocationValue }

interface LocationPickerProps {
  value: LocationValue | null
  onChange: (location: LocationValue | null) => void
  error?: string
  label?: string
  required?: boolean
  className?: string
}

// ── FlyEffect: child of <Map> that imperatively pans/zooms ────────────────────

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

// ── Modal inner content (requires API loaded) ─────────────────────────────────

interface ModalInnerProps {
  value: LocationValue | null
  onConfirm: (loc: LocationValue) => void
  onCancel: () => void
}

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 } // Bangkok fallback

function LocationPickerModalInner({ value, onConfirm, onCancel }: ModalInnerProps) {
  const inputId = useId()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER,
  )
  const [displayAddress, setDisplayAddress] = useState(
    value ? `${value.placeName}, ${value.country}` : '',
  )
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

  // Auto-trigger GPS if no value set yet
  useEffect(() => {
    if (!value) handleGPS()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    value: query,
    suggestions: { status, data },
    setValue: setQuery,
    clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 300 })

  // ── GPS ────────────────────────────────────────────────────────────────────
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

  // ── Autocomplete selection ─────────────────────────────────────────────────
  async function handleSelect(suggestion: google.maps.places.AutocompletePrediction) {
    setQuery(suggestion.description, false)
    clearSuggestions()
    setSuggestionsOpen(false)
    poiClickRef.current = true
    setPoiSelected(true)

    try {
      const place = new google.maps.places.Place({ id: suggestion.place_id })
      await place.fetchFields({ fields: ['location', 'formattedAddress'] })
      if (!place.location) return
      setFlyZoom(20)
      setFlyTarget({ lat: place.location.lat(), lng: place.location.lng() })
      setDisplayAddress(place.formattedAddress ?? suggestion.description)
    } catch {
      setDisplayAddress(suggestion.description)
    }
  }

  // ── Keyboard navigation for autocomplete ───────────────────────────────────
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

  // ── POI click: tap a place on the map to use its address ──────────────────
  async function handleMapClick(e: MapMouseEvent) {
    const placeId = e.detail.placeId
    if (!placeId) return
    e.stop()

    poiClickRef.current = true
    setPoiSelected(true)
    try {
      const place = new google.maps.places.Place({ id: placeId })
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] })
      if (!place.location) return
      const name = place.displayName ?? ''
      const addr = place.formattedAddress ?? ''
      const display =
        name && addr && !addr.startsWith(name) ? `${name}, ${addr}` : addr || name
      setFlyZoom(20)
      setFlyTarget({ lat: place.location.lat(), lng: place.location.lng() })
      setDisplayAddress(display)
    } catch {
      // Silent fail — user can still drag the map
    }
  }

  // ── Map idle: read center + reverse geocode ────────────────────────────────
  const handleIdle = useCallback(
    (e: { map: google.maps.Map }) => {
      const c = e.map.getCenter()
      if (!c) return
      const lat = c.lat()
      const lng = c.lng()
      setCenter({ lat, lng })

      // Skip reverse geocoding on initial load or after POI/autocomplete selection
      if (initialLoadRef.current || poiClickRef.current) return

      // User dragged the map — back to manual pin mode
      setPoiSelected(false)

      // Reverse geocode for area address + country, then nearby search for POI name
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

          // Nearby search for POI-level precision (differentiates gas station from 7-Eleven)
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
          // Geocoding failed — leave address as-is
        }
      })()
    },
    [],
  )

  // ── Confirm ────────────────────────────────────────────────────────────────
  function handleConfirm() {
    const parts = displayAddress.split(', ')
    const country = parts.length > 1 ? parts[parts.length - 1] : ''
    const placeName =
      parts.length > 1 ? parts.slice(0, -1).join(', ') : displayAddress
    onConfirm({ placeName: placeName || displayAddress, country, lat: center.lat, lng: center.lng })
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Search strip */}
      <div
        className="flex-shrink-0 p-3 flex flex-col gap-2"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary"
            >
              <Search size={15} />
            </span>
            <input
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
              placeholder={value ? `${value.placeName}, ${value.country}` : 'Search address…'}
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
                blurTimerRef.current = setTimeout(() => { setSuggestionsOpen(false); kbDispatch({ type: 'CLOSE' }) }, 150)
              }}
              className="glass glass-field w-full text-sm py-2.5 pl-9 pr-3 placeholder:opacity-50 text-primary"
              style={{ caretColor: 'var(--color-accent)' }}
            />
          </div>
          <button
            type="button"
            onClick={handleGPS}
            disabled={gpsLoading}
            title="Use my current location"
            className="glass glass-field flex items-center justify-center px-3 transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
            style={{ color: 'var(--color-accent)' }}
          >
            <Locate size={16} className={gpsLoading ? 'animate-pulse' : ''} />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {suggestionsOpen && status === 'OK' && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Address suggestions"
            className="rounded-theme border overflow-hidden shadow-lg"
            style={{
              background: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-glass-border)',
            }}
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
                  className="px-3 py-2.5 text-sm cursor-pointer text-primary"
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
                    <span className="ml-1.5 opacity-60 text-xs">
                      {s.structured_formatting.secondary_text}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Map with fixed crosshair */}
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

        {/* Crosshair overlay — stays centered while map moves */}
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${poiSelected ? 'opacity-0' : 'opacity-100'}`}
          style={{ transitionDuration: 'var(--transition-speed)' }}
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

      {/* Confirm strip */}
      <div
        className="flex-shrink-0 flex items-center justify-between gap-3 p-3"
        style={{ borderTop: '1px solid var(--color-glass-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span
            className="text-sm truncate"
            style={{
              color: displayAddress
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
            }}
          >
            {displayAddress || 'Drag the map to set location…'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={handleConfirm} disabled={!displayAddress}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Gate: defers modal inner until Maps API is loaded ─────────────────────────

function LocationPickerGate(props: ModalInnerProps) {
  const t = useTranslations('common')
  const isLoaded = useApiIsLoaded()
  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center h-full text-secondary"
      >
        <span className="text-sm">{t('loading')}</span>
      </div>
    )
  }
  return <LocationPickerModalInner {...props} />
}

// ── Trigger: read-only display with click-to-edit ─────────────────────────────

interface TriggerProps {
  value: LocationValue | null
  onOpen: () => void
  onClear: () => void
  error?: string
  label?: string
  required?: boolean
  className?: string
}

function LocationPickerTrigger({ value, onOpen, onClear, error, label, required, className }: TriggerProps) {
  const inputId = useId()
  return (
    <div className={cn("flex flex-col gap-1.5", className?.includes('field-') || className?.includes('w-') ? '' : 'w-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-secondary"
        >
          {label}
          {required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
        </label>
      )}
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary"
        >
          <MapPin size={16} />
        </span>
        <button
          id={inputId}
          type="button"
          onClick={onOpen}
          className="glass glass-field w-full text-sm py-2.5 pl-9 pr-9 text-left truncate cursor-pointer"
          style={{
            color: value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            ...(error
              ? {
                  borderColor: 'var(--color-destructive)',
                  boxShadow: '0 0 0 3px var(--color-destructive-glow)',
                }
              : {}),
          }}
          aria-label={
            value
              ? `Location: ${value.placeName}, ${value.country}. Click to edit.`
              : 'Add location'
          }
        >
          {value ? `${value.placeName}, ${value.country}` : 'Add location…'}
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-9 min-h-9 w-9 h-9 rounded-full transition-opacity hover:opacity-70 cursor-pointer text-secondary"
            aria-label="Clear location"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export function LocationPicker({ value, onChange, error, label, required, className }: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <LocationPickerTrigger
        value={value}
        onOpen={() => setOpen(true)}
        onClear={() => onChange(null)}
        error={error}
        label={label}
        required={required}
        className={className}
      />
      <Dialog open={open} onClose={() => setOpen(false)} title="Set Location" fullScreen>
        <APIProvider apiKey={API_KEY} libraries={['places']}>
          <LocationPickerGate
            value={value}
            onConfirm={(loc) => {
              onChange(loc)
              setOpen(false)
            }}
            onCancel={() => setOpen(false)}
          />
        </APIProvider>
      </Dialog>
    </>
  )
}
