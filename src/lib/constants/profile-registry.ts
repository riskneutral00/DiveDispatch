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

export const PROFILE_REGISTRY: Record<string, ProfileConfig> = {
  'dive-center': {
    label: 'Dive Center',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'associations', label: 'Affiliations' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  agent: {
    label: 'Agent',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'associations', label: 'Memberships' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  instructor: {
    label: 'Instructor',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'credentials', label: 'Credentials' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-master': {
    label: 'Divemaster',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'languages', label: 'Languages' },
      { id: 'credentials', label: 'Credentials' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  boat: {
    label: 'Boat',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'fleet', label: 'Fleet' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  compressor: {
    label: 'Compressor',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gas-mixes', label: 'Gas Mixes' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  equipment: {
    label: 'Equipment',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'gear-catalog', label: 'Gear Catalog' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  pool: {
    label: 'Pool',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'capabilities', label: 'Capabilities' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
  'dive-site': {
    label: 'Dive Site',
    tabs: [
      { id: 'details', label: 'Details' },
      { id: 'capabilities', label: 'Capabilities' },
    ],
    workspaceIncludesEmbeddedProfile: false,
  },
} satisfies Partial<Record<RoleKey, ProfileConfig>>
