'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import { ChevronDown, LogOut, Waves } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ROLE_BY_CLERK_ROLE, ROLE_BY_KEY, type ClerkRole, type RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { BgSwitcher } from './bg-switcher'
import { ThemeSwitcher } from './theme-switcher'

interface MobileTopNavProps {
  roleSlug: RoleKey
  slug: string
}

export function MobileTopNav({ roleSlug, slug }: MobileTopNavProps) {
  const { user: clerkUser } = useUser()
  const { user: convexUser } = useCurrentUser()
  const { signOut } = useClerk()
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const roleConfig = ROLE_BY_KEY[roleSlug]

  const allRoles: ClerkRole[] = convexUser
    ? [
        convexUser.role as ClerkRole,
        ...(convexUser.additionalRoles ?? []) as ClerkRole[],
      ]
    : []
  const uniqueRoles = [...new Set(allRoles)]
  const hasMultipleRoles = uniqueRoles.length > 1

  const displayName =
    convexUser?.businessName || clerkUser?.fullName || clerkUser?.username || '…'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null

  return (
    <div
      className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3"
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--color-glass-border)',
      }}
    >
      {/* Left: logo */}
      <Link
        href={`/${roleSlug}/${slug}/dashboard`}
        className="flex items-center gap-2"
      >
        <Waves size={20} style={{ color: 'var(--color-primary)' }} />
        <span
          className="font-bold text-sm"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-text-primary)',
          }}
        >
          DiveDispatch
        </span>
      </Link>

      {/* Right: role badge/switcher + avatar + theme */}
      <div className="flex items-center gap-2">
        {/* Role badge / switcher */}
        {hasMultipleRoles ? (
          <div className="relative">
            <button
              onClick={() => setRoleSwitcherOpen((o) => !o)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              {roleConfig && <roleConfig.icon size={12} />}
              <span className="hidden sm:inline">{roleConfig?.label ?? roleSlug}</span>
              <ChevronDown size={10} style={{ color: 'var(--color-text-secondary)' }} />
            </button>

            {roleSwitcherOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setRoleSwitcherOpen(false)}
                />
                <div
                  className="absolute right-0 top-8 z-40 py-1 shadow-xl min-w-[140px]"
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
          roleConfig && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-glass-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              <roleConfig.icon size={12} />
              <span className="hidden sm:inline">{roleConfig.label}</span>
            </div>
          )
        )}

        {/* Avatar / user menu */}
        <div className="relative">
          <button
            aria-label="User menu"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
            }}
          >
            {initials}
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-10 z-50 min-w-[180px] py-1 shadow-xl"
                style={{
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-glass-border)',
                  backdropFilter: 'blur(var(--glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur))',
                  borderRadius: 'var(--border-radius)',
                }}
              >
                <div
                  className="px-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-glass-border)' }}
                >
                  <p
                    className="text-sm font-medium truncate leading-tight"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {displayName}
                  </p>
                  {email && (
                    <p
                      className="text-xs truncate leading-tight mt-0.5"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => signOut({ redirectUrl: '/' })}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>

        {/* Theme + background switchers */}
        <BgSwitcher />
        <ThemeSwitcher />
      </div>
    </div>
  )
}
