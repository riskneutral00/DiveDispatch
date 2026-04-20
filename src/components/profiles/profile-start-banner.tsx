'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

interface ProfileStartBannerProps {
  roleSlug: RoleKey
  onOpenOverlay: () => void
}

export function ProfileStartBanner({ roleSlug, onOpenOverlay }: ProfileStartBannerProps) {
  const tNav = useTranslations('nav')
  const roleLabel = ROLE_BY_KEY[roleSlug]?.label ?? roleSlug

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onOpenOverlay}
      className="rounded-full urgent-pulse"
      style={{
        border: '1px solid var(--color-destructive)',
        boxShadow: '0 0 12px var(--color-destructive-glow, var(--color-destructive)), 0 4px 12px var(--color-glass-shadow)',
      }}
      aria-label={tNav('startProfile', { role: roleLabel })}
    >
      <span className="text-label font-semibold whitespace-nowrap text-destructive">
        {tNav('startProfile', { role: roleLabel })}
      </span>
    </Button>
  )
}
