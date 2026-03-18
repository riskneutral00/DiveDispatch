import type { CalendarDisplayStatus } from '@/lib/constants/status-colors'

export interface DashboardRoleConfig {
  allowedRoles: string[]
  isResourceBased: boolean
  widgetTitle: string
  widgetStatusClass: string
  emptyMessage: string
  showAccept?: boolean
  legendStatuses?: CalendarDisplayStatus[]
  calendarOnly?: boolean
}

export const DASHBOARD_CONFIGS: Record<string, DashboardRoleConfig> = {
  instructor: {
    allowedRoles: ['Instructor'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No open requests',
    showAccept: true,
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-center': {
    allowedRoles: ['DiveCenter'],
    isResourceBased: false,
    widgetTitle: 'UPCOMING BOOKINGS',
    widgetStatusClass: '',
    emptyMessage: 'No pending confirmations',
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  agent: {
    allowedRoles: ['Agent'],
    isResourceBased: false,
    widgetTitle: 'BOOKINGS',
    widgetStatusClass: '',
    emptyMessage: 'No bookings yet',
    showAccept: false,
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  liveaboard: {
    allowedRoles: ['Liveaboard'],
    isResourceBased: false,
    widgetTitle: 'UPCOMING TRIPS',
    widgetStatusClass: '',
    emptyMessage: 'No upcoming trips',
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-resort': {
    allowedRoles: ['DiveResort'],
    isResourceBased: false,
    widgetTitle: 'PENDING CONFIRMATIONS',
    widgetStatusClass: '',
    emptyMessage: 'No pending confirmations',
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  boat: {
    allowedRoles: ['Boat'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No open requests',
    showAccept: true,
    legendStatuses: ['Active', 'Upcoming', 'Completed'],
  },
  pool: {
    allowedRoles: ['Pool'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No open requests',
    showAccept: true,
    legendStatuses: ['Active', 'Upcoming', 'Completed'],
  },
  equipment: {
    allowedRoles: ['Equipment'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No open requests',
    showAccept: true,
    legendStatuses: ['Active', 'Upcoming', 'Completed'],
  },
  compressor: {
    allowedRoles: ['Compressor'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No open requests',
    showAccept: true,
    legendStatuses: ['Active', 'Upcoming', 'Completed'],
  },
  'dive-hostel': {
    allowedRoles: ['DiveHostel'],
    isResourceBased: false,
    widgetTitle: 'BOOKINGS',
    widgetStatusClass: '',
    emptyMessage: 'No bookings yet',
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
  'dive-master': {
    allowedRoles: ['DiveMaster'],
    isResourceBased: true,
    widgetTitle: 'OPEN REQUESTS',
    widgetStatusClass: '',
    emptyMessage: 'No bookings',
    showAccept: true,
    legendStatuses: ['Active', 'Upcoming', 'Completed'],
  },
  'dive-site': {
    allowedRoles: ['DiveSite'],
    isResourceBased: false,
    calendarOnly: true,
    widgetTitle: '',
    widgetStatusClass: '',
    emptyMessage: '',
    legendStatuses: ['Active', 'Draft', 'Upcoming', 'Completed'],
  },
}
