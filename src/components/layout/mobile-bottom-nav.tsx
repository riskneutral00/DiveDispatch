'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { RoleKey } from '@/lib/constants/roles'
import { buildNavItems } from '@/lib/nav-items'

interface MobileBottomNavProps {
  roleSlug: RoleKey
  slug: string
}

export function MobileBottomNav({ roleSlug, slug }: MobileBottomNavProps) {
  const pathname = usePathname()
  const tNav = useTranslations('nav')
  const navItems = buildNavItems(roleSlug, slug)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] glass flex items-center justify-around px-2 pt-2"
      style={{
        borderTop: '1px solid var(--color-glass-border)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        willChange: 'transform',
      }}
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-[calc(var(--border-radius)/2)] transition-all min-w-[60px]"
            style={
              isActive
                ? {
                    color: 'var(--color-primary)',
                    background: 'var(--color-glass-bg-elevated)',
                    transitionDuration: 'var(--transition-speed)',
                  }
                : {
                    color: 'var(--color-text-secondary)',
                    background: 'transparent',
                    transitionDuration: 'var(--transition-speed)',
                  }
            }
            aria-current={isActive ? 'page' : undefined}
          >
            <item.Icon size={20} />
            <span className="text-[10px] font-medium"> {/* design-ok */}
              {tNav(item.key as 'dashboard')}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
