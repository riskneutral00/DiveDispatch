import type { RoleKey } from './roles'

interface Tab {
  id: string
  label: string
}

export interface ProfileConfig {
  label: string
  tabs: Tab[] | null
  /** When true, embed role profile form on the role Workspace page (manage roles + prefs). */
  workspaceIncludesEmbeddedProfile: boolean
}

/** Tabs that only appear in the overlay — not on standalone profile pages. */
export const OVERLAY_ONLY_SECTIONS = new Set(['booking', 'availability', 'resources', 'inventory'])

export const PROFILE_REGISTRY: Record<string, ProfileConfig> = {
  'dive-center': {
    label: 'Dive Center',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'associations', label: 'Affiliations' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  agent: {
    label: 'Agent',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'associations', label: 'Memberships' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  instructor: {
    label: 'Instructor',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'credentials', label: 'Credentials' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-master': {
    label: 'Divemaster',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'credentials', label: 'Credentials' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  boat: {
    label: 'Boat',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'fleet', label: 'Fleet' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  compressor: {
    label: 'Compressor',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gas-mixes', label: 'Gas Mixes' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  equipment: {
    label: 'Equipment',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gear-catalog', label: 'Gear Catalog' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  pool: {
    label: 'Pool',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-site': {
    label: 'Dive Site',
    tabs: [
      { id: 'details', label: 'Details' },
      { id: 'capabilities', label: 'Capabilities' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  liveaboard: {
    label: 'Liveaboard',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-resort': {
    label: 'Dive Resort',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-hostel': {
    label: 'Dive Hostel',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'resources', label: 'Resources' },
      { id: 'booking', label: 'Booking' },
      { id: 'availability', label: 'Availability' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
} satisfies Partial<Record<RoleKey, ProfileConfig>>
