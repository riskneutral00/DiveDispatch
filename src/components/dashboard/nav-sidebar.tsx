'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import {
  BookOpen,
  Calendar,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Waves,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ROLE_BY_CLERK_ROLE, ROLE_BY_KEY, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { ThemeSwitcher } from './theme-switcher'

interface NavItem {
  key: string
  label: string
  href: string
  Icon: React.ElementType
}

function buildNavItems(roleSlug: RoleKey, slug: string): NavItem[] {
  const roleConfig = ROLE_BY_KEY[roleSlug]
  const base = `/${roleSlug}/${slug}`

  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', href: `${base}/dashboard`, Icon: LayoutDashboard },
  ]

  if (roleConfig?.isOrganizer) {
    items.push(
      { key: 'bookings', label: 'Bookings', href: `${base}/bookings`, Icon: BookOpen },
      { key: 'directory', label: 'Directory', href: `${base}/directory`, Icon: Users },
    )
  } else {
    items.push(
      { key: 'reservations', label: 'Reservations', href: `${base}/reservations`, Icon: Calendar },
    )
  }

  items.push({ key: 'settings', label: 'Settings', href: `${base}/settings`, Icon: Settings })

  return items
}

interface NavSidebarProps {
  roleSlug: RoleKey
  slug: string
  onClose?: () => void
}

export function NavSidebar({ roleSlug, slug, onClose }: NavSidebarProps) {
  const pathname = usePathname()
  const { user: clerkUser } = useUser()
  const { user: convexUser } = useCurrentUser()
  const { signOut } = useClerk()
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)

  const roleConfig = ROLE_BY_KEY[roleSlug]
  const navItems = buildNavItems(roleSlug, slug)

  const allRoles: ClerkRole[] = convexUser
    ? [
        convexUser.role as ClerkRole,
        ...(convexUser.additionalRoles ?? []) as ClerkRole[],
      ]
    : []

  // Deduplicate in case primary role appears in additionalRoles
  const uniqueRoles = [...new Set(allRoles)]
  const hasMultipleRoles = uniqueRoles.length > 1

  const displayName =
    convexUser?.businessName || clerkUser?.fullName || clerkUser?.username || '…'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderRight: '1px solid var(--color-glass-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <Link
          href={`/${roleSlug}/${slug}/dashboard`}
          className="flex items-center gap-2"
        >
          <Waves size={22} style={{ color: 'var(--color-primary)' }} />
          <span
            className="font-bold text-base leading-none"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text-primary)',
            }}
          >
            DiveDispatch
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {onClose && (
            <button
              aria-label="Close menu"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Role badge / switcher */}
      <div className="px-3 pt-3">
        {hasMultipleRoles ? (
          <div className="relative">
            <button
              onClick={() => setRoleSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-[calc(var(--border-radius)/2)] transition-all"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {roleConfig && <roleConfig.icon size={15} />}
              <span className="flex-1 text-left text-sm font-medium truncate">
                {roleConfig?.label ?? roleSlug}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--color-text-secondary)' }} />
            </button>

            {roleSwitcherOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setRoleSwitcherOpen(false)}
                />
                <div
                  className="absolute left-0 right-0 top-10 z-40 py-1 shadow-xl"
                  style={{
                    background: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-glass-border)',
                    borderRadius: 'var(--border-radius)',
                  }}
                >
                  {uniqueRoles.map((clerkRole) => {
                    const cfg = ROLE_BY_CLERK_ROLE[clerkRole]
                    if (!cfg) return null
                    const isActive = cfg.key === roleSlug
                    return (
                      <Link
                        key={clerkRole}
                        href={`/${cfg.key}/${slug}/dashboard`}
                        onClick={() => setRoleSwitcherOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm transition-all"
                        style={{
                          background: isActive ? 'var(--color-primary)' : 'transparent',
                          color: isActive
                            ? 'var(--color-text-on-primary)'
                            : 'var(--color-text-primary)',
                        }}
                      >
                        <cfg.icon size={14} />
                        <span>{cfg.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[calc(var(--border-radius)/2)]"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-glass-border)',
            }}
          >
            {roleConfig && (
              <roleConfig.icon size={15} style={{ color: 'var(--color-primary)' }} />
            )}
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {roleConfig?.label ?? roleSlug}
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4 flex-1" aria-label="Main navigation">
        {navItems.map(({ key, label, href, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={key}
              href={href}
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded-[calc(var(--border-radius)/2)] text-sm font-medium transition-all"
              style={isActive ? {
                background: 'var(--color-glass-bg-elevated)',
                backdropFilter: 'blur(var(--glass-blur-elevated))',
                WebkitBackdropFilter: 'blur(var(--glass-blur-elevated))',
                border: '1px solid var(--color-glass-border-elevated)',
                boxShadow: '0 4px 16px var(--color-glass-shadow), inset 0 1px 0 var(--color-glass-specular-subtle)',
                color: 'var(--color-text-primary)',
                transitionDuration: 'var(--transition-speed)',
              } : {
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                transitionDuration: 'var(--transition-speed)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer: user info + sign out */}
      <div
        className="px-3 py-3 mt-auto"
        style={{ borderTop: '1px solid var(--color-glass-border)' }}
      >
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
            }}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate leading-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {displayName}
            </p>
            {clerkUser?.primaryEmailAddress && (
              <p
                className="text-xs truncate leading-tight"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {clerkUser.primaryEmailAddress.emailAddress}
              </p>
            )}
          </div>

          <button
            aria-label="Sign out"
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
