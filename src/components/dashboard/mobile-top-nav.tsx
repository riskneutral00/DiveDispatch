'use client'

import type { RoleKey } from '@/lib/constants/roles'
import { BgSwitcher } from './bg-switcher'
import { NotificationBell } from './notification-bell'
import { UserMenu } from './user-menu'

interface MobileTopNavProps {
  roleSlug: RoleKey
  slug: string
}

export function MobileTopNav({ roleSlug, slug }: MobileTopNavProps) {
  return (
    <div
      className="md:hidden sticky top-0 z-20 flex items-center justify-end gap-2 px-4 py-2"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      <BgSwitcher />
      <NotificationBell />
      <UserMenu roleSlug={roleSlug} slug={slug} />
    </div>
  )
}
