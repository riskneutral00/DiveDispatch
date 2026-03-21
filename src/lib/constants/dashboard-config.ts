import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

export interface DashboardRoleConfig {
  legendStatuses?: CalendarDisplayStatus[]
}

export const DASHBOARD_CONFIGS: Record<string, DashboardRoleConfig> = {
  instructor: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-center': {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  agent: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  liveaboard: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-resort': {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  boat: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  pool: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  equipment: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  compressor: {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-hostel': {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-master': {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-site': {
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
}
