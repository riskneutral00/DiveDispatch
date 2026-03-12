'use client'

import { Menu, Waves } from 'lucide-react'
import { useState } from 'react'
import type { RoleKey } from '@/lib/constants/roles'
import { ThemeSwitcher } from './theme-switcher'
import { NavSidebar } from './nav-sidebar'

interface DashboardShellProps {
  children: React.ReactNode
  roleSlug: RoleKey
  slug: string
}

export function DashboardShell({ children, roleSlug, slug }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface)' }}>
      {/* Desktop sidebar — hidden below md */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0">
        <NavSidebar roleSlug={roleSlug} slug={slug} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col z-10">
            <NavSidebar
              roleSlug={roleSlug}
              slug={slug}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20"
          style={{
            background: 'var(--color-glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            borderBottom: '1px solid var(--color-glass-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Menu size={20} />
            </button>
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
          </div>
          <ThemeSwitcher />
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
