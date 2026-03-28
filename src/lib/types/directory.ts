import type { DirectoryEntry } from '../../../convex/directory'

/**
 * Extends DirectoryEntry with role-specific fields returned by the enhanced
 * listByRole query. Field names match the backend's DirectoryEntry exactly.
 */
export type RichDirectoryEntry = DirectoryEntry & {
  agencies?: string[]    // Instructor: credential agencies (e.g. ['PADI', 'SSI'])
  boatCapacity?: number  // Boat: max pax of largest vessel in fleet
  boatType?: string      // Boat: type of largest vessel
  gasMixes?: string[]    // Compressor: supported gas mixes
  maxDepth?: number      // Pool: max depth in metres
  maxCapacity?: number   // Pool: max capacity in pax
  association?: string   // Agent: primary association agency name
  isPreferred?: boolean  // Instructor: starred by the authenticated caller
}
