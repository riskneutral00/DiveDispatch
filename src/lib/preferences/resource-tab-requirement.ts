export type ResourceSubTab =
  | 'instructors'
  | 'venues'
  | 'boats'
  | 'equipment'
  | 'compressors'
  | 'operator'

export interface PreferenceResourceSlugs {
  preferredInstructorSlugs?: string[]
  preferredEquipmentSlugs?: string[]
  preferredVenueSlugs?: string[]
  preferredBoatSlugs?: string[]
  preferredCompressorSlugs?: string[]
}

export const RESOURCE_TAB_REQUIRED: Record<ResourceSubTab, boolean> = {
  instructors: true,
  venues: true,
  boats: true,
  equipment: true,
  compressors: true,
  operator: false,
}
