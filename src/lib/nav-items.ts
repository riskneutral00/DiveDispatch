import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import { ROLE_BY_KEY, type RoleKey } from '@/lib/constants/roles'

export interface NavItem {
  key: string
  label: string
  href: string
  Icon: React.ElementType
}

export function buildNavItems(roleSlug: RoleKey, slug: string): NavItem[] {
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
