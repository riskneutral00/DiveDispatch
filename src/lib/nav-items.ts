import {
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  href: string
  Icon: React.ElementType
}

export function buildNavItems(roleSlug: string, slug: string): NavItem[] {
  const base = `/${roleSlug}/${slug}`

  return [
    { key: 'dashboard', label: 'Dashboard', href: `${base}/dashboard`, Icon: LayoutDashboard },
    { key: 'directory', label: 'Directory', href: `/directory`, Icon: Users },
    { key: 'settings', label: 'Settings', href: `${base}/settings`, Icon: Settings },
  ]
}
