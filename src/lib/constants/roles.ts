import type { ComponentType } from 'react'
import {
  DiveCenterIcon,
  AgentIcon,
  LiveaboardIcon,
  DiveResortIcon,
  DiveHostelIcon,
  DiveSiteIcon,
  InstructorIcon,
  DiveMasterIcon,
  BoatIcon,
  EquipmentIcon,
  PoolIcon,
  CompressorIcon,
  type RoleIconProps,
} from '@/lib/icons/role-icons'

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

export interface ProfileTab {
  id: string
  label: string
}

export interface RoleConfig {
  key: RoleKey
  clerkRole: ClerkRole
  label: string
  pluralLabel: string
  route: string
  browseRoute: string
  icon: ComponentType<RoleIconProps>
  isOrganizer: boolean
  isResource: boolean
  displayGroup: 'operator' | 'resource'
  tableName: string
  description: string
  profileTabs: ProfileTab[]
}

export const ROLES: RoleConfig[] = [
  {
    key: 'dive-center',
    clerkRole: 'DiveCenter',
    label: 'Dive Center',
    pluralLabel: 'Dive Centers',
    route: '/dive-center',
    browseRoute: '/resources/dive-centers',
    icon: DiveCenterIcon,
    isOrganizer: true,
    isResource: false,
    displayGroup: 'operator',
    tableName: 'diveCenters',
    description: 'Manage dive bookings, assign resources, and coordinate trips for customers.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'associations', label: 'Affiliations' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'agent',
    clerkRole: 'Agent',
    label: 'Agent',
    pluralLabel: 'Agents',
    route: '/agent',
    browseRoute: '/resources/agents',
    icon: AgentIcon,
    isOrganizer: true,
    isResource: false,
    displayGroup: 'operator',
    tableName: 'agents',
    description: 'Book dives on behalf of customers and earn commission from dive operators.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'associations', label: 'Affiliations' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'liveaboard',
    clerkRole: 'Liveaboard',
    label: 'Liveaboard',
    pluralLabel: 'Liveaboards',
    route: '/liveaboard',
    browseRoute: '/resources/liveaboards',
    icon: LiveaboardIcon,
    isOrganizer: true,
    isResource: false,
    displayGroup: 'operator',
    tableName: 'liveaboards',
    description: 'Run multi-day dive expeditions with onboard accommodation and guided services.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'dive-resort',
    clerkRole: 'DiveResort',
    label: 'Dive Resort',
    pluralLabel: 'Dive Resorts',
    route: '/dive-resort',
    browseRoute: '/resources/dive-resorts',
    icon: DiveResortIcon,
    isOrganizer: true,
    isResource: false,
    displayGroup: 'operator',
    tableName: 'diveResorts',
    description: 'Offer dive packages, courses, and guided dives from a resort base.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'dive-hostel',
    clerkRole: 'DiveHostel',
    label: 'Dive Hostel',
    pluralLabel: 'Dive Hostels',
    route: '/dive-hostel',
    browseRoute: '/resources/dive-hostels',
    icon: DiveHostelIcon,
    isOrganizer: true,
    isResource: false,
    displayGroup: 'operator',
    tableName: 'diveHostels',
    description: 'Provide budget-friendly accommodation and dive services to traveling divers.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'dive-site',
    clerkRole: 'DiveSite',
    label: 'Dive Site',
    pluralLabel: 'Dive Sites',
    route: '/dive-site',
    browseRoute: '/resources/dive-sites',
    icon: DiveSiteIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'operator',
    tableName: 'venues',
    description: 'Manage access and dive conditions for a specific underwater site.',
    profileTabs: [
      { id: 'details', label: 'Details' },
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'resources', label: 'Preferences' },
      { id: 'booking', label: 'Booking' },
    ],
  },

  {
    key: 'instructor',
    clerkRole: 'Instructor',
    label: 'Instructor',
    pluralLabel: 'Instructors',
    route: '/instructor',
    browseRoute: '/resources/instructors',
    icon: InstructorIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'instructors',
    description: 'Lead courses, certify students, and guide dives at operator-organized trips.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'credentials', label: 'Credentials' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'dive-master',
    clerkRole: 'DiveMaster',
    label: 'Dive Master',
    pluralLabel: 'Dive Masters',
    route: '/dive-master',
    browseRoute: '/resources/dive-masters',
    icon: DiveMasterIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'diveMasters',
    description: 'Guide certified divers, assist instructors, and lead fun dives.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'credentials', label: 'Credentials' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'boat',
    clerkRole: 'Boat',
    label: 'Boat',
    pluralLabel: 'Boats',
    route: '/boat',
    browseRoute: '/resources/boats',
    icon: BoatIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'boats',
    description: 'Provide vessel transport and surface support for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'fleet', label: 'Fleet' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'equipment',
    clerkRole: 'Equipment',
    label: 'Equipment',
    pluralLabel: 'Equipment Managers',
    route: '/equipment',
    browseRoute: '/resources/equipment',
    icon: EquipmentIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'equipment',
    description: 'Supply rental gear and manage inventory across dive bookings.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gear-catalog', label: 'Gear Catalog' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'pool',
    clerkRole: 'Pool',
    label: 'Pool',
    pluralLabel: 'Pools',
    route: '/pool',
    browseRoute: '/resources/pools',
    icon: PoolIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'venues',
    description: 'Provide confined-water training space for beginner and refresher courses.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'compressor',
    clerkRole: 'Compressor',
    label: 'Compressor',
    pluralLabel: 'Compressors',
    route: '/compressor',
    browseRoute: '/resources/compressors',
    icon: CompressorIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    tableName: 'compressors',
    description: 'Supply and track tank fills and gas blending for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gas-mixes', label: 'Gas Mixes' },
      { id: 'booking', label: 'Booking' },
    ],
  },
]

export const ROLE_BY_KEY = Object.fromEntries(
  ROLES.map((r) => [r.key, r]),
) as Record<RoleKey, RoleConfig>

export const ROLE_BY_CLERK_ROLE = Object.fromEntries(
  ROLES.map((r) => [r.clerkRole, r]),
) as Record<ClerkRole, RoleConfig>

export const ORGANIZER_ROLES = ROLES.filter((r) => r.isOrganizer)
export const RESOURCE_ROLES = ROLES.filter((r) => r.isResource && !r.isOrganizer)

export const ORGANIZER_ROLE_KEYS = new Set<ClerkRole>(ORGANIZER_ROLES.map((r) => r.clerkRole))

export const DISPLAY_OPERATOR_ROLES = ROLES.filter((r) => r.displayGroup === 'operator')
export const DISPLAY_RESOURCE_ROLES = ROLES.filter((r) => r.displayGroup === 'resource')
