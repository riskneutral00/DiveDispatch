'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { RoleKey } from '@/lib/constants/roles'
import { buildNavItems } from '@/lib/nav-items'

interface MobileBottomNavProps {
  roleSlug: RoleKey
  slug: string
}

export function MobileBottomNav({ roleSlug, slug }: MobileBottomNavProps) {
  const pathname = usePathname()
  const navItems = buildNavItems(roleSlug, slug)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around px-2 pt-2"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderTop: '1px solid var(--color-glass-border)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
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
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[calc(var(--border-radius)/2)] transition-all min-w-[60px]"
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
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
