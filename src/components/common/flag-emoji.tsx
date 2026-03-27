'use client'

interface FlagEmojiProps {
  countryCode: string
  label: string
  className?: string
}

/** Convert a country code or ISO locale to a flag emoji.
 *  Handles both 'GB' and 'en-GB' formats (extracts region part). */
export function countryCodeToEmoji(code: string): string {
  // Extract country/region from ISO locale if present (e.g. 'en-GB' → 'GB', 'zh-CN' → 'CN')
  const region = code.includes('-') ? code.split('-').pop()!.toUpperCase() : code.toUpperCase()
  return String.fromCodePoint(...Array.from(region).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function FlagEmoji({ countryCode, label, className }: FlagEmojiProps) {
  return (
    <span
      className={className}
      role="img"
      aria-label={label}
      title={label}
    >
      {countryCodeToEmoji(countryCode)}
    </span>
  )
}
