'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { countryCodeToEmoji } from '@/components/common/flag-emoji'
import {
  ALL_LANGUAGES,
  POPULAR_LANGUAGE_CODES,
  type LanguageCode,
  type DiveLanguage,
} from '@/lib/constants/dive-languages'

export type { Language } from '@/lib/types/language'
import type { Language } from '@/lib/types/language'

const MAX_LANGUAGES = 4

// h-8 w-8 rounded-[6px] flex items-center justify-center text-[1.1rem] leading-none transition-colors border
const FLAG_TILE =
  'h-8 w-8 rounded-[6px] flex items-center justify-center text-[1.1rem] leading-none transition-colors border'

interface LanguagePickerProps {
  value: Language[]
  onChange: (languages: Language[]) => void
  commonLanguageCodes?: LanguageCode[]
  className?: string
}

export function LanguagePicker({
  value,
  onChange,
  commonLanguageCodes = [],
  className,
}: LanguagePickerProps) {
  const [query, setQuery] = useState('')

  const me = useQuery(api.users.me)

  const selectedCodes = new Set<string>(value.map((l) => l.code))
  const atMax = value.length >= MAX_LANGUAGES
  const favoriteCodes: string[] = me?.profile?.focusedLanguages ?? me?.profile?.languages ?? []

  function toggle(lang: Language) {
    if (selectedCodes.has(lang.code)) {
      onChange(value.filter((l) => l.code !== lang.code))
    } else {
      if (atMax) return
      onChange([...value, { code: lang.code, label: lang.label }])
    }
    setQuery('')
  }

  const commonSet = new Set<string>(commonLanguageCodes)

  // Row 1: common codes, then any favorites not already in common
  const row1Codes = [
    ...commonLanguageCodes,
    ...favoriteCodes.filter((code) => !commonSet.has(code)),
  ]
  const row1Set = new Set(row1Codes)
  const row1Languages = row1Codes
    .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
    .filter((l): l is DiveLanguage => Boolean(l))

  // Row 2: popular codes minus anything already in row 1
  const row2Languages = POPULAR_LANGUAGE_CODES.filter((code) => !row1Set.has(code))
    .map((code) => ALL_LANGUAGES.find((l) => l.code === code))
    .filter((l): l is DiveLanguage => Boolean(l))

  const row2Set = new Set<string>(row2Languages.map((l) => l.code))

  // Overflow: selected languages not present in either main row (added via search)
  const overflowLanguages = value.filter((l) => !row1Set.has(l.code) && !row2Set.has(l.code))

  const searchResults = query.trim()
    ? ALL_LANGUAGES.filter((l) => {
        const q = query.toLowerCase()
        return l.label.toLowerCase().includes(q) || l.searchTerms?.toLowerCase().includes(q)
      })
    : null

  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      {/* Search input with counter */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search languages…"
          className="glass glass-field w-full text-sm py-2.5 pl-3 pr-12 placeholder:opacity-50"
          style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-accent)' }}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {value.length} / {MAX_LANGUAGES}
        </span>
      </div>

      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <p className="text-xs px-1" style={{ color: 'var(--color-text-secondary)' }}>
            No languages match &ldquo;{query}&rdquo;
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {searchResults.map((lang) => (
              <FlagPill
                key={lang.code}
                lang={lang}
                active={selectedCodes.has(lang.code)}
                disabled={atMax && !selectedCodes.has(lang.code)}
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
                <FlagPill key={lang.code} lang={lang} active={true} onToggle={() => toggle(lang)} />
              ))}
            </div>
          )}
          {row1Languages.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row1Languages.map((lang) => (
                <FlagPill
                  key={lang.code}
                  lang={lang}
                  active={selectedCodes.has(lang.code)}
                  disabled={atMax && !selectedCodes.has(lang.code)}
                  onToggle={() => toggle(lang)}
                />
              ))}
            </div>
          )}
          {row2Languages.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row2Languages.map((lang) => (
                <FlagPill
                  key={lang.code}
                  lang={lang}
                  active={selectedCodes.has(lang.code)}
                  disabled={atMax && !selectedCodes.has(lang.code)}
                  onToggle={() => toggle(lang)}
                />
              ))}
            </div>
          )}
        </div>
      )}
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
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={lang.label}
      aria-label={lang.label}
      aria-pressed={active}
      className={FLAG_TILE}
      style={{
        background: active ? 'var(--color-primary-muted, rgba(var(--color-primary-rgb,99,102,241),0.15))' : 'transparent',
        borderColor: active
          ? 'var(--color-primary-border, rgba(var(--color-primary-rgb,99,102,241),0.4))'
          : 'var(--color-glass-border)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {countryCodeToEmoji(lang.code)}
    </button>
  )
}
