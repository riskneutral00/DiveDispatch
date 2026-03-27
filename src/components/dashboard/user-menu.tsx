'use client'

import { useClerk, useUser } from '@clerk/nextjs'
import { LogOut, Settings, User, SlidersHorizontal, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RoleKey } from '@/lib/constants/roles'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import type { ProfileOverlayTab } from './profile-overlay'

interface UserMenuProps {
  roleSlug: RoleKey
  slug: string
  onOpenOverlay?: (tab: ProfileOverlayTab) => void
}

export function UserMenu({ roleSlug, slug, onOpenOverlay }: UserMenuProps) {
  const { user: clerkUser } = useUser()
  const { user: convexUser } = useCurrentUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const displayName =
    convexUser?.businessName || clerkUser?.fullName || clerkUser?.username || '…'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null

  function handleMenuAction(tab: ProfileOverlayTab) {
    setOpen(false)
    onOpenOverlay?.(tab)
  }

  return (
    <div className="relative">
      <button
        aria-label="User menu"
        onClick={() => setOpen((o) => !o)}
        className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-text-on-primary)',
        }}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" onClick={() => setOpen(false)} />
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
              onClick={() => handleMenuAction('profile')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <User size={14} />
              Profile
            </button>

            <button
              onClick={() => handleMenuAction('roles')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Shield size={14} />
              Roles
            </button>

            <button
              onClick={() => handleMenuAction('preferences')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Settings size={14} />
              Preferences
            </button>

            <button
              onClick={() => handleMenuAction('account')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <SlidersHorizontal size={14} />
              Account
            </button>

            <div
              className="mt-1"
              style={{ borderTop: '1px solid var(--color-glass-border)' }}
            >
              <button
                onClick={() => {
                  setOpen(false)
                  signOut({ redirectUrl: '/' })
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer"
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
