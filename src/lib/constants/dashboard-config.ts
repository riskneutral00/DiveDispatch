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

/**
 * Per-role dashboard overrides. Roles not listed here (or listed with empty config)
 * use DEFAULT_LEGEND_STATUSES. Add per-role entries only when a role needs different
 * legend statuses or other config.
 */
export const DASHBOARD_CONFIGS: Record<string, DashboardRoleConfig> = {}
