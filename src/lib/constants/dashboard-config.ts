import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

export const DEFAULT_LEGEND_STATUSES: CalendarDisplayStatus[] = [
  'Active',
  'Draft',
  'Upcoming',
  'Completed',
]

export interface DashboardRoleConfig {
  legendStatuses?: CalendarDisplayStatus[]
}

export const DASHBOARD_CONFIGS: Record<string, DashboardRoleConfig> = {}
