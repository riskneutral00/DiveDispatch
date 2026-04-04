import type { DirectoryEntry } from '../../../convex/directory'

/**
 * Alias for DirectoryEntry. All role-specific fields (credentials, agencies,
 * languages, etc.) are defined on DirectoryEntry itself. This alias exists so
 * frontend components can import from @/lib/types without reaching into convex/.
 */
export type RichDirectoryEntry = DirectoryEntry
