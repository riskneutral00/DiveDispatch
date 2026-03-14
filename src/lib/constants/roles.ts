import {
  Anchor,
  Building2,
  Compass,
  Droplets,
  Globe,
  Hotel,
  Package,
  Ship,
  Sunset,
  UserCog,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type RoleKey =
  | 'dive-center'
  | 'agent'
  | 'liveaboard'
  | 'dive-resort'
  | 'dive-hostel'
  | 'dive-site'
  | 'instructor'
  | 'dive-master'
  | 'boat'
  | 'equipment'
  | 'pool'
  | 'compressor'

export type ClerkRole =
  | 'DiveCenter'
  | 'Agent'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'
  | 'DiveSite'
  | 'Instructor'
  | 'DiveMaster'
  | 'Boat'
  | 'Equipment'
  | 'Pool'
  | 'Compressor'

export interface RoleConfig {
  key: RoleKey
  clerkRole: ClerkRole
  label: string
  pluralLabel: string
  route: string
  browseRoute: string
  icon: LucideIcon
  isOrganizer: boolean
  isResource: boolean
  tableName: string
  description: string
}

export const ROLES: RoleConfig[] = [
  // ── Organizers ───────────────────────────────────────────────────
  {
    key: 'dive-center',
    clerkRole: 'DiveCenter',
    label: 'Dive Center',
    pluralLabel: 'Dive Centers',
    route: '/dive-center',
    browseRoute: '/resources/dive-centers',
    icon: Compass,
    isOrganizer: true,
    isResource: false,
    tableName: 'diveCenters',
    description: 'Manage dive bookings, assign resources, and coordinate trips for customers.',
  },
  {
    key: 'agent',
    clerkRole: 'Agent',
    label: 'Agent',
    pluralLabel: 'Agents',
    route: '/agent',
    browseRoute: '/resources/agents',
    icon: UserCog,
    isOrganizer: true,
    isResource: false,
    tableName: 'agents',
    description: 'Book dives on behalf of customers and earn commission from dive operators.',
  },
  {
    key: 'liveaboard',
    clerkRole: 'Liveaboard',
    label: 'Liveaboard',
    pluralLabel: 'Liveaboards',
    route: '/liveaboard',
    browseRoute: '/resources/liveaboards',
    icon: Ship,
    isOrganizer: true,
    isResource: true,
    tableName: 'liveaboards',
    description: 'Run multi-day dive expeditions with onboard accommodation and guided services.',
  },
  {
    key: 'dive-resort',
    clerkRole: 'DiveResort',
    label: 'Dive Resort',
    pluralLabel: 'Dive Resorts',
    route: '/dive-resort',
    browseRoute: '/resources/dive-resorts',
    icon: Hotel,
    isOrganizer: true,
    isResource: false,
    tableName: 'diveResorts',
    description: 'Offer dive packages, courses, and guided dives from a resort base.',
  },
  {
    key: 'dive-hostel',
    clerkRole: 'DiveHostel',
    label: 'Dive Hostel',
    pluralLabel: 'Dive Hostels',
    route: '/dive-hostel',
    browseRoute: '/resources/dive-hostels',
    icon: Building2,
    isOrganizer: true,
    isResource: false,
    tableName: 'diveHostels',
    description: 'Provide budget-friendly accommodation and dive services to traveling divers.',
  },
  {
    key: 'dive-site',
    clerkRole: 'DiveSite',
    label: 'Dive Site',
    pluralLabel: 'Dive Sites',
    route: '/dive-site',
    browseRoute: '/resources/dive-sites',
    icon: Globe,
    isOrganizer: true,
    isResource: true,
    tableName: 'diveSites',
    description: 'Manage access and dive conditions for a specific underwater site.',
  },

  // ── Resources ────────────────────────────────────────────────────
  {
    key: 'instructor',
    clerkRole: 'Instructor',
    label: 'Instructor',
    pluralLabel: 'Instructors',
    route: '/instructor',
    browseRoute: '/resources/instructors',
    icon: Sunset,
    isOrganizer: false,
    isResource: true,
    tableName: 'instructors',
    description: 'Lead courses, certify students, and guide dives at operator-organized trips.',
  },
  {
    key: 'dive-master',
    clerkRole: 'DiveMaster',
    label: 'Dive Master',
    pluralLabel: 'Dive Masters',
    route: '/dive-master',
    browseRoute: '/resources/dive-masters',
    icon: Droplets,
    isOrganizer: false,
    isResource: true,
    tableName: 'diveMasters',
    description: 'Guide certified divers, assist instructors, and lead fun dives.',
  },
  {
    key: 'boat',
    clerkRole: 'Boat',
    label: 'Boat',
    pluralLabel: 'Boats',
    route: '/boat',
    browseRoute: '/resources/boats',
    icon: Anchor,
    isOrganizer: false,
    isResource: true,
    tableName: 'boats',
    description: 'Provide vessel transport and surface support for dive operations.',
  },
  {
    key: 'equipment',
    clerkRole: 'Equipment',
    label: 'Equipment',
    pluralLabel: 'Equipment Managers',
    route: '/equipment',
    browseRoute: '/resources/equipment',
    icon: Package,
    isOrganizer: false,
    isResource: true,
    tableName: 'equipment',
    description: 'Supply rental gear and manage inventory across dive bookings.',
  },
  {
    key: 'pool',
    clerkRole: 'Pool',
    label: 'Pool',
    pluralLabel: 'Pools',
    route: '/pool',
    browseRoute: '/resources/pools',
    icon: Wrench,
    isOrganizer: false,
    isResource: true,
    tableName: 'pools',
    description: 'Provide confined-water training space for beginner and refresher courses.',
  },
  {
    key: 'compressor',
    clerkRole: 'Compressor',
    label: 'Compressor',
    pluralLabel: 'Compressors',
    route: '/compressor',
    browseRoute: '/resources/compressors',
    icon: Wind,
    isOrganizer: false,
    isResource: true,
    tableName: 'compressors',
    description: 'Supply and track tank fills and gas blending for dive operations.',
  },
]

// Lookup maps for O(1) access
export const ROLE_BY_KEY = Object.fromEntries(
  ROLES.map((r) => [r.key, r]),
) as Record<RoleKey, RoleConfig>

export const ROLE_BY_CLERK_ROLE = Object.fromEntries(
  ROLES.map((r) => [r.clerkRole, r]),
) as Record<ClerkRole, RoleConfig>

export const ORGANIZER_ROLES = ROLES.filter((r) => r.isOrganizer)
export const RESOURCE_ROLES = ROLES.filter((r) => r.isResource && !r.isOrganizer)
