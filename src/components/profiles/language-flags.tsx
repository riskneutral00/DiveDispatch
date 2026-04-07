import { countryCodeToEmoji } from '@/components/ui/flag-emoji'
import { languageToCode } from '@/lib/constants/dive-languages'

const MAX_FLAGS = 4

function toFlag(input: string): string {
  const code = languageToCode(input)
  return code ? countryCodeToEmoji(code) : ''
}

interface LanguageFlagsProps {
  languages: string[]
  max?: number
  className?: string
}

export function LanguageFlags({ languages, max = MAX_FLAGS, className }: LanguageFlagsProps) {
  if (!languages?.length) return null
  const flags = languages.slice(0, max).map(toFlag).filter(Boolean)
  if (flags.length === 0) return null
  return <span className={className}>{flags.join(' ')}</span>
}

export function languageFlagText(languages: string[] | undefined, max = MAX_FLAGS): string {
  if (!languages?.length) return ''
  const flags = languages.slice(0, max).map(toFlag).filter(Boolean)
  if (flags.length === 0) return ''
  return '  ' + flags.join(' ')
}
