'use client'

import { Bell } from 'lucide-react'
import { useQuery } from 'convex/react'
import { Button, DialogTrigger, Popover } from 'react-aria-components'
import { api } from '@/lib/convex-generated'
import { useCurrentUser } from '@/lib/hooks/use-current-user'
import { ICON_BUTTON_SIZE } from '@/lib/constants/button-sizes'
import { NotificationPanel } from './notification-panel'

export function NotificationBell() {
  const { user } = useCurrentUser()
  const userId = user?.slug ?? ''

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : 'skip',
  )

  if (!user) return null

  return (
    <DialogTrigger>
      <Button
        aria-label={
          unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        className={`${ICON_BUTTON_SIZE} rounded-full flex items-center justify-center cursor-pointer transition-all duration-theme text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-glow)] relative`}
      >
        <Bell size={18} />
        {!!unreadCount && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 pointer-events-none text-on-primary" /* design-ok */
            style={{ background: 'var(--color-status-urgent)' }} /* design-ok: --color-status-urgent not in @theme inline */
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>
      <Popover
        placement="bottom end"
        offset={4}
        className="z-[var(--z-dropdown)] w-80 max-w-[calc(100%-2rem)] max-h-[28rem] flex flex-col overflow-hidden shadow-xl glass-elevated glass-overlay-blur rounded-theme outline-none"
      >
        <NotificationPanel userId={userId} />
      </Popover>
    </DialogTrigger>
  )
}
