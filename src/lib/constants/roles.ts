import type { FunctionReference } from 'convex/server'
import type { ZodType } from 'zod'
import { api } from '@/lib/convex-generated'
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
import {
  agentContactMergedSchema,
  diveCenterContactMergedSchema,
  personalContactMergedSchema,
  contactSchema,
} from '@/lib/schemas/profile-shared'
import type { ComponentType } from 'react'

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

export type ProfileSectionId =
  | 'contact'
  | 'associations'
  | 'credentials'
  | 'fleet'
  | 'gear'
  | 'gas-mixes'
  | 'capabilities'
  | 'resources'
  | 'booking'

export interface ProfileTab {
  id: ProfileSectionId
  label: string
  fields?: readonly string[]
}

export type RoleClass = 'freelance' | 'business'

export type BookingPresence = 'itinerary' | 'resource-step' | 'operator' | 'none'

export const OVERLAY_ONLY_SECTIONS: Set<ProfileSectionId> = new Set(['booking', 'resources', 'gear'])

export type ContactPayloadExtras =
  | { kind: 'agent'; createDefaults: { associations: [] } }
  | { kind: 'dive-center'; createDefaults: { associations: [] } }
  | { kind: 'instructor'; createDefaults: { credential: [] } }
  | { kind: 'boat'; createDefaults: { fleet: [] } }
  | { kind: 'equipment' }
  | { kind: 'compressor' }
  | { kind: 'venue' }

export interface RoleContactConfig {
  schema: ZodType
  nameLabel?: 'businessName'
  languageKey?: 'customerLanguages' | 'teachingLanguages'
  inheritFromOtherRoles?: ClerkRole
  payloadExtras: ContactPayloadExtras
}

export interface RoleApiConfig {
  mine: FunctionReference<'query'>
  create: FunctionReference<'mutation'>
  update: FunctionReference<'mutation'>
  idArg: 'entityId' | 'venueId' | 'compressorId' | null
}

export type RoleSectionComponentRef = ComponentType<unknown>

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
  bookingPresence: BookingPresence
  profileTabs: ProfileTab[]
  api: RoleApiConfig
  contact?: RoleContactConfig
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
    bookingPresence: 'operator',
    description: 'Manage dive bookings, assign resources, and coordinate trips for customers.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address', 'customerLanguages'] },
      { id: 'associations', label: 'Affiliations', fields: ['associations'] },
      { id: 'resources', label: 'Preferences', fields: ['preferredInstructor', 'preferredEquipment', 'preferredVenue', 'preferredBoat', 'preferredCompressor'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.diveCenters.mine,
      create: api.diveCenters.create,
      update: api.diveCenters.update,
      idArg: 'entityId',
    },
    contact: {
      schema: diveCenterContactMergedSchema,
      nameLabel: 'businessName',
      languageKey: 'customerLanguages',
      payloadExtras: { kind: 'dive-center', createDefaults: { associations: [] } },
    },
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
    bookingPresence: 'operator',
    description: 'Book dives on behalf of customers and earn commission from dive operators.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address', 'customerLanguages'] },
      { id: 'associations', label: 'Affiliations', fields: ['associations'] },
      { id: 'resources', label: 'Preferences', fields: ['preferredInstructor', 'preferredEquipment', 'preferredVenue', 'preferredBoat', 'preferredCompressor'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.agents.mine,
      create: api.agents.create,
      update: api.agents.update,
      idArg: null,
    },
    contact: {
      schema: agentContactMergedSchema,
      nameLabel: 'businessName',
      languageKey: 'customerLanguages',
      payloadExtras: { kind: 'agent', createDefaults: { associations: [] } },
    },
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
    bookingPresence: 'itinerary',
    description: 'Dive professionals — Divemaster through Course Director. Lead courses, guide dives, and assist at operator-organized trips.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address', 'teachingLanguages'] },
      { id: 'credentials', label: 'Credentials', fields: ['credential'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.diveStaff.mine,
      create: api.diveStaff.create,
      update: api.diveStaff.update,
      idArg: null,
    },
    contact: {
      schema: personalContactMergedSchema,
      languageKey: 'teachingLanguages',
      inheritFromOtherRoles: 'Instructor',
      payloadExtras: { kind: 'instructor', createDefaults: { credential: [] } },
    },
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
    bookingPresence: 'itinerary',
    description: 'Provide vessel transport and surface support for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address'] },
      { id: 'fleet', label: 'Fleet', fields: ['fleet', 'routeVenues'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.boats.mine,
      create: api.boats.create,
      update: api.boats.update,
      idArg: 'entityId',
    },
    contact: {
      schema: contactSchema,
      nameLabel: 'businessName',
      inheritFromOtherRoles: 'Boat',
      payloadExtras: { kind: 'boat', createDefaults: { fleet: [] } },
    },
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
    bookingPresence: 'resource-step',
    description: 'Supply rental gear and manage inventory across dive bookings.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address'] },
      { id: 'gear', label: 'Gear', fields: ['gear:wetsuit', 'gear:bcd', 'gear:fins', 'gear:mask', 'gear:regulator'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.equipment.mine,
      create: api.equipment.create,
      update: api.equipment.update,
      idArg: 'entityId',
    },
    contact: {
      schema: contactSchema,
      nameLabel: 'businessName',
      inheritFromOtherRoles: 'Equipment',
      payloadExtras: { kind: 'equipment' },
    },
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
    bookingPresence: 'resource-step',
    description: 'Supply and track tank fills and gas blending for dive operations.',
    profileTabs: [
      { id: 'contact', label: 'Contact', fields: ['name', 'email', 'phone', 'address'] },
      { id: 'gas-mixes', label: 'Gas Mixes', fields: ['location', 'gasMixes'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.compressors.mine,
      create: api.compressors.create,
      update: api.compressors.update,
      idArg: 'compressorId',
    },
    contact: {
      schema: contactSchema,
      nameLabel: 'businessName',
      inheritFromOtherRoles: 'Compressor',
      payloadExtras: { kind: 'compressor' },
    },
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
    bookingPresence: 'itinerary',
    description: 'Provide a place where diving happens — pool, shore, reef, lake, river, quarry, or other.',
    profileTabs: [
      { id: 'capabilities', label: 'Venues', fields: ['name', 'email', 'phone', 'address', 'kind', 'maxDepth', 'maxCapacity', 'confinedCapable'] },
      { id: 'booking', label: 'Booking' },
    ],
    api: {
      mine: api.venues.mine,
      create: api.venues.create,
      update: api.venues.update,
      idArg: 'venueId',
    },
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
