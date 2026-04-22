import type { ComponentType } from 'react'
import {
  DiveCenterIcon,
  AgentIcon,
  DiveSiteIcon,
  InstructorIcon,
  BoatIcon,
  EquipmentIcon,
  CompressorIcon,
  type RoleIconProps,
} from '@/lib/icons/role-icons'

export type RoleKey =
  | 'dive-center'
  | 'agent'
  | 'instructor'
  | 'boat'
  | 'equipment'
  | 'compressor'
  | 'venue'

export type ClerkRole =
  | 'DiveCenter'
  | 'Agent'
  | 'Instructor'
  | 'Boat'
  | 'Equipment'
  | 'Compressor'
  | 'Venue'

export interface ProfileTab {
  id: string
  label: string
  fields?: readonly string[]
}

export type RoleClass = 'freelance' | 'business'

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
  roleClass: RoleClass
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
    roleClass: 'business',
    tableName: 'diveCenters',
    description: 'Manage dive bookings, assign resources, and coordinate trips for customers.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address', 'customerLanguages'] },
      { id: 'associations', label: 'Affiliations', fields: ['associations'] },
      { id: 'resources', label: 'Preferences', fields: ['preferredInstructor', 'preferredEquipment', 'preferredVenue', 'preferredBoat', 'preferredCompressor'] },
      { id: 'booking', label: 'Booking', fields: ['acceptanceMode'] },
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
    roleClass: 'freelance',
    tableName: 'agents',
    description: 'Book dives on behalf of customers and earn commission from dive operators.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address', 'customerLanguages'] },
      { id: 'associations', label: 'Affiliations', fields: ['associations'] },
      { id: 'resources', label: 'Preferences', fields: ['preferredInstructor', 'preferredEquipment', 'preferredVenue', 'preferredBoat', 'preferredCompressor'] },
      { id: 'booking', label: 'Booking', fields: ['acceptanceMode'] },
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
    roleClass: 'freelance',
    tableName: 'diveStaff',
    description: 'Dive professionals — Divemaster through Course Director. Lead courses, guide dives, and assist at operator-organized trips.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address'] },
      { id: 'credentials', label: 'Credentials', fields: ['credential', 'teachingLanguages'] },
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
    roleClass: 'freelance',
    tableName: 'boats',
    description: 'Provide vessel transport and surface support for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address'] },
      { id: 'fleet', label: 'Fleet', fields: ['fleet', 'diveSite'] },
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
    roleClass: 'freelance',
    tableName: 'equipment',
    description: 'Supply rental gear and manage inventory across dive bookings.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address'] },
      { id: 'gear', label: 'Gear', fields: ['gearInventory'] },
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
    roleClass: 'freelance',
    tableName: 'compressors',
    description: 'Supply and track tank fills and gas blending for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address'] },
      { id: 'gas-mixes', label: 'Gas Mixes', fields: ['gasMixes'] },
      { id: 'booking', label: 'Booking' },
    ],
  },
  {
    key: 'venue',
    clerkRole: 'Venue',
    label: 'Venue',
    pluralLabel: 'Venues',
    route: '/venue',
    browseRoute: '/resources/venues',
    icon: DiveSiteIcon,
    isOrganizer: false,
    isResource: true,
    displayGroup: 'resource',
    roleClass: 'freelance',
    tableName: 'venues',
    description: 'Provide a place where diving happens — pool, shore, reef, lake, river, quarry, or other.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'address'] },
      { id: 'capabilities', label: 'Capabilities', fields: ['subtype', 'maxDepth', 'maxCapacity', 'confinedCapable'] },
      { id: 'booking', label: 'Booking', fields: ['acceptanceMode'] },
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
