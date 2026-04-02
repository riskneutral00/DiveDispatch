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
  const base = `/${slug}/${roleSlug}`

  return [
    { key: 'dashboard', label: 'Dashboard', href: base, Icon: LayoutDashboard },
    { key: 'directory', label: 'Directory', href: `/directory`, Icon: Users },
    { key: 'workspace', label: 'Workspace', href: `${base}/workspace`, Icon: Settings },
  ]
}
