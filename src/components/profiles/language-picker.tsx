"use client";

import { useEffect, useState, useRef } from "react";
import { countryCodeToEmoji } from "@/components/ui/flag-emoji";
import {
  ALL_LANGUAGES,
  POPULAR_ROW1_CODES,
  POPULAR_ROW2_CODES,
  CHINESE_SCRIPT_LABELS,
  findLanguageByCode,
  type LanguageCode,
  type DiveLanguage,
} from "@/lib/constants/dive-languages";
import type { Language } from "@/lib/types/language";

export type { Language };

const FLAG_TILE =
  "h-7 w-7 rounded-[var(--border-radius-button)] flex items-center justify-center text-[1rem] leading-none transition-colors duration-theme border outline-none glass-field";

interface LanguagePickerProps {
  value: Language[];
  onChange: (languages: Language[]) => void;
  max?: number;
  disabled?: boolean;
  popularCodes?: string[];
}

export function LanguagePicker({
  value,
  onChange,
  max = 4,
  disabled = false,
  popularCodes,
}: LanguagePickerProps) {
  const [query, setQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [restingHeight, setRestingHeight] = useState(0);

  const selectedCodes = new Set<string>(value.map((l) => l.code));
  const atMax = value.length >= max;

  function toggle(lang: Language) {
    if (max === 1) {
      if (selectedCodes.has(lang.code)) {
        onChange([]);
      } else {
        onChange([{ code: lang.code, label: lang.label }]);
      }
      setQuery("");
      return;
    }

    if (selectedCodes.has(lang.code)) {
      onChange(value.filter((l) => l.code !== lang.code));
    } else if (!atMax) {
      onChange([...value, { code: lang.code, label: lang.label }]);
    }

    setQuery("");
  }

  const popRowALanguages = POPULAR_ROW1_CODES.map(findLanguageByCode).filter(
    Boolean,
  ) as DiveLanguage[];
  const popRowBLanguages = POPULAR_ROW2_CODES.map(findLanguageByCode).filter(
    Boolean,
  ) as DiveLanguage[];

  const popularSet = new Set<string>([
    ...POPULAR_ROW1_CODES,
    ...POPULAR_ROW2_CODES,
  ]);

  const overflowLanguages = value.filter((l) => !popularSet.has(l.code));

  const searchResults = query.trim()
    ? ALL_LANGUAGES.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.label.toLowerCase().includes(q) ||
          l.searchTerms?.toLowerCase().includes(q)
        );
      })
    : null;

  useEffect(() => {
    if (searchResults === null && gridRef.current) {
      setRestingHeight(gridRef.current.scrollHeight);
    }
  }, [searchResults]);

  const renderFlagGroup = (languages: DiveLanguage[] | Language[]) => {
    if (languages.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {languages.map((lang) => (
          <FlagPill
            key={lang.code}
            lang={lang}
            active={selectedCodes.has(lang.code)}
            disabled={
              disabled || (max !== 1 && atMax && !selectedCodes.has(lang.code))
            }
            onToggle={() => toggle(lang)}
          />
        ))}
      </div>
    );
  };

  const placeholderText =
    value.length > 0
      ? value
          .map((l) => CHINESE_SCRIPT_LABELS[l.code as LanguageCode] ?? l.label)
          .join(", ")
      : "Search languages…";

  return (
    <div className="flex flex-col items-center gap-1.5 w-full min-w-0">
      <div className="relative w-full max-w-[280px]">
        <input /* design-ok: compound picker search filter */
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder={placeholderText}
          className={`field-underline w-full text-body py-2.5 pl-0 pr-12 text-primary caret-accent ${value.length > 0 ? "placeholder:opacity-100" : "placeholder:opacity-60"}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label pointer-events-none text-secondary">
          {value.length} / {max}
        </span>
      </div>

      <div
        ref={gridRef}
        style={
          searchResults !== null && restingHeight
            ? { minHeight: restingHeight }
            : undefined
        }
      >
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <p className="text-label px-1 text-secondary">
              No languages match &ldquo;{query}&rdquo;
            </p>
          ) : (
            renderFlagGroup(searchResults)
          )
        ) : popularCodes ? (
          <div className="flex flex-col gap-1.5">
            {renderFlagGroup(overflowLanguages)}
            {renderFlagGroup(
              popularCodes
                .map(findLanguageByCode)
                .filter(Boolean) as DiveLanguage[],
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {renderFlagGroup(overflowLanguages)}
            {renderFlagGroup(popRowALanguages)}
            {renderFlagGroup(popRowBLanguages)}
          </div>
        )}
      </div>
    </div>
  );
}

interface FlagPillProps {
  lang: Language;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function FlagPill({ lang, active, disabled, onToggle }: FlagPillProps) {
  const scriptLabel = CHINESE_SCRIPT_LABELS[lang.code as LanguageCode];
  const isText = Boolean(scriptLabel);

  return (
    <button /* design-ok: flag/script-label toggle pill, custom chrome distinct from Button primitive */
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={lang.label}
      aria-label={lang.label}
      aria-pressed={active}
      translate="no"
      className={
        isText
          ? `h-7 px-1.5 rounded-[var(--border-radius-button)] flex items-center justify-center text-[11px] font-medium leading-none transition-all duration-theme border glass-field`
          : `${FLAG_TILE.replace(" transition-colors ", " transition-all ")}${active ? " scale-110" : ""}`
      }
      style={{
        background: active ? "var(--color-primary-muted)" : "transparent",
        borderColor: active
          ? "var(--color-primary)"
          : "var(--color-glass-border)",
        outline: active ? "2px solid var(--color-primary)" : "none",
        outlineOffset: active ? "1px" : "0",
        color: isText ? "var(--color-text-primary)" : undefined,
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {scriptLabel ?? countryCodeToEmoji(lang.code)}
    </button>
  );
}
