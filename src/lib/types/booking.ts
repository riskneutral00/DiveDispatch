export interface ResourcePickerEntry {
  slug: string
  name: string
  city: string
  country: string
  languages: string[]
  verified: boolean
  /** Boat vessel names, pool names, etc. — shown as info badges */
  subItems?: string[]
}
