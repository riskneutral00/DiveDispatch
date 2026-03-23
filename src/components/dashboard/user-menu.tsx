'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import { LogOut, Settings, User, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'

interface UserMenuProps {
  roleSlug: RoleKey
  slug: string
}

export function UserMenu({ roleSlug, slug }: UserMenuProps) {
  const { user: clerkUser } = useUser()
  const { user: convexUser } = useCurrentUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)

  const displayName =
    convexUser?.businessName || clerkUser?.fullName || clerkUser?.username || '…'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null

  return (
    <div className="relative">
      <button
        aria-label="User menu"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-text-on-primary)',
        }}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
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

            <Link
              href={`/${slug}/${roleSlug}/profile`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <User size={14} />
              Profile
            </Link>

            <Link
              href={`/${slug}/${roleSlug}/settings`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Settings size={14} />
              Settings
            </Link>

            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <SlidersHorizontal size={14} />
              Account
            </Link>

            <div
              className="mt-1"
              style={{ borderTop: '1px solid var(--color-glass-border)' }}
            >
              <button
                onClick={() => {
                  setOpen(false)
                  signOut({ redirectUrl: '/' })
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
