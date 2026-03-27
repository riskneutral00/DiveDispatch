import type { RoleKey } from './roles'

interface Tab {
  id: string
  label: string
}

export interface ProfileConfig {
  label: string
  tabs: Tab[] | null
  settingsIncludesProfile: boolean
}

export const PROFILE_REGISTRY: Record<string, ProfileConfig> = {
  'dive-center': {
    label: 'Dive Center',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'associations', label: 'Affiliations' },
    ],
    settingsIncludesProfile: false,
  },
  agent: {
    label: 'Agent',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'associations', label: 'Memberships' },
    ],
    settingsIncludesProfile: false,
  },
  instructor: {
    label: 'Instructor',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'credentials', label: 'Credentials' },
    ],
    settingsIncludesProfile: false,
  },
  'dive-master': {
    label: 'Divemaster',
    tabs: [
      { id: 'contact', label: 'Contact' },
      { id: 'credentials', label: 'Credentials' },
    ],
    settingsIncludesProfile: false,
  },
  boat: {
    label: 'Boat',
    tabs: null,
    settingsIncludesProfile: true,
  },
  compressor: {
    label: 'Compressor',
    tabs: null,
    settingsIncludesProfile: true,
  },
  equipment: {
    label: 'Equipment',
    tabs: null,
    settingsIncludesProfile: true,
  },
  pool: {
    label: 'Pool',
    tabs: null,
    settingsIncludesProfile: true,
  },
} satisfies Partial<Record<RoleKey, ProfileConfig>>
