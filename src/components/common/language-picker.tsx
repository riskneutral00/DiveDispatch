'use client'

import { useEffect, useRef, useState } from 'react'
import { countryCodeToEmoji } from '@/components/common/flag-emoji'
import {
  ALL_LANGUAGES,
  POPULAR_ROW1_CODES,
  POPULAR_ROW2_CODES,
  CHINESE_SCRIPT_LABELS,
  type LanguageCode,
  type DiveLanguage,
} from '@/lib/constants/dive-languages'

export type { Language } from '@/lib/types/language'
import type { Language } from '@/lib/types/language'

// h-8 w-8 rounded-[6px] flex items-center justify-center text-[1.1rem] leading-none transition-colors border
const FLAG_TILE =
  'h-9 w-9 rounded-[6px] flex items-center justify-center text-[1.2rem] leading-none transition-colors border'

interface LanguagePickerProps {
  value: Language[]
  onChange: (languages: Language[]) => void
  max?: number
  disabled?: boolean
}

export function LanguagePicker({
  value,
  onChange,
  max = 4,
  disabled = false,
}: LanguagePickerProps) {
  const [query, setQuery] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const restingHeight = useRef<number>(0)

  const selectedCodes = new Set<string>(value.map((l) => l.code))
  const atMax = value.length >= max
  function toggle(lang: Language) {
    if (max === 1) {
      onChange([{ code: lang.code, label: lang.label }])
      setQuery('')
      return
    }
    if (selectedCodes.has(lang.code)) {
      onChange(value.filter((l) => l.code !== lang.code))
    } else {
      if (atMax) return
      onChange([...value, { code: lang.code, label: lang.label }])
    }
    setQuery('')
  }

  const row1Set = new Set<string>()

  // Popular row A (Asian): popular codes minus anything already in row 1
  const popRowALanguages = POPULAR_ROW1_CODES.filter((code) => !row1Set.has(code))
    .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
    .filter((l): l is DiveLanguage => Boolean(l))

  // Popular row B (European): popular codes minus anything already in row 1
  const popRowBLanguages = POPULAR_ROW2_CODES.filter((code) => !row1Set.has(code))
    .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
    .filter((l): l is DiveLanguage => Boolean(l))

  const popularSet = new Set<string>([
    ...popRowALanguages.map((l) => l.code),
    ...popRowBLanguages.map((l) => l.code),
  ])

  // Overflow: selected languages not present in any main row (added via search)
  const overflowLanguages = value.filter((l) => !row1Set.has(l.code) && !popularSet.has(l.code))

  const searchResults = query.trim()
    ? ALL_LANGUAGES.filter((l) => {
        const q = query.toLowerCase()
        return l.label.toLowerCase().includes(q) || l.searchTerms?.toLowerCase().includes(q)
      })
    : null

  // Capture the grid's natural height when not searching so the container
  // never shrinks below it when search results replace the grid.
  useEffect(() => {
    if (searchResults === null && gridRef.current) {
      restingHeight.current = gridRef.current.scrollHeight
    }
  })

  return (
    <div className="flex flex-col gap-2">
      {/* Search input with counter */}
      <div className="relative w-full">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder={value.length > 0 ? value.map((l) => CHINESE_SCRIPT_LABELS[l.code as LanguageCode] ?? l.label).join(', ') : 'Search languages…'}
          className={`glass glass-field w-full text-sm py-2.5 pl-3 pr-12 ${value.length > 0 ? 'placeholder:opacity-70' : 'placeholder:opacity-50'} text-primary`}
          style={{ caretColor: 'var(--color-accent)' }}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-secondary"
        >
          {value.length} / {max}
        </span>
      </div>

      <div
        ref={gridRef}
        style={searchResults !== null && restingHeight.current
          ? { minHeight: restingHeight.current }
          : undefined}
      >
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <p className="text-xs px-1 text-secondary">
              No languages match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {searchResults.map((lang) => (
                <FlagPill
                  key={lang.code}
                  lang={lang}
                  active={selectedCodes.has(lang.code)}
                  disabled={disabled || (max !== 1 && atMax && !selectedCodes.has(lang.code))}
                  onToggle={() => toggle(lang)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1.5">
            {overflowLanguages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {overflowLanguages.map((lang) => (
                  <FlagPill key={lang.code} lang={lang} active={true} disabled={disabled} onToggle={() => toggle(lang)} />
                ))}
              </div>
            )}
            {popRowALanguages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {popRowALanguages.map((lang) => (
                  <FlagPill
                    key={lang.code}
                    lang={lang}
                    active={selectedCodes.has(lang.code)}
                    disabled={disabled || (max !== 1 && atMax && !selectedCodes.has(lang.code))}
                    onToggle={() => toggle(lang)}
                  />
                ))}
              </div>
            )}
            {popRowBLanguages.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {popRowBLanguages.map((lang) => (
                  <FlagPill
                    key={lang.code}
                    lang={lang}
                    active={selectedCodes.has(lang.code)}
                    disabled={disabled || (max !== 1 && atMax && !selectedCodes.has(lang.code))}
                    onToggle={() => toggle(lang)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface FlagPillProps {
  lang: Language
  active: boolean
  disabled?: boolean
  onToggle: () => void
}

function FlagPill({ lang, active, disabled, onToggle }: FlagPillProps) {
  const scriptLabel = CHINESE_SCRIPT_LABELS[lang.code as LanguageCode]
  const isText = Boolean(scriptLabel)
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={lang.label}
      aria-label={lang.label}
      aria-pressed={active}
      translate="no"
      className={isText
        ? 'h-9 px-1.5 rounded-[6px] flex items-center justify-center text-xs font-medium leading-none transition-colors border'
        : FLAG_TILE}
      style={{
        background: active ? 'var(--color-primary-muted)' : 'transparent',
        borderColor: active
          ? 'var(--color-primary-border)'
          : 'var(--color-glass-border)',
        color: isText ? 'var(--color-text-primary)' : undefined,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {scriptLabel ?? countryCodeToEmoji(lang.code)}
    </button>
  )
}
