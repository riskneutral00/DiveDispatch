/**
 * Test data for stakeholder creation E2E tests.
 * Each entry defines the role tile to select, profile form data,
 * and expected routing after setup completes.
 */

export interface AccountProfileData {
  firstName: string
  lastName: string
  businessName: string
}

export interface CreationTestRole {
  /** ClerkRole value stored in Convex (e.g. 'DiveCenter') */
  clerkRole: string
  /** URL path segment (e.g. 'dive-center') */
  roleKey: string
  /** Exact label text on the role tile button */
  tileLabel: string
  /** Whether the account profile form shows the Business name field */
  showsBusinessName: boolean
  /** Data to fill into the account page profile form */
  profile: AccountProfileData
}

export const CREATION_ROLES: CreationTestRole[] = [
  {
    clerkRole: 'DiveCenter',
    roleKey: 'dive-center',
    tileLabel: 'Dive Center',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'DiveCenter',
      businessName: 'E2E Dive Shop',
    },
  },
  {
    clerkRole: 'Agent',
    roleKey: 'agent',
    tileLabel: 'Agent',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'Agent',
      businessName: 'E2E Travel Agency',
    },
  },
  {
    clerkRole: 'Instructor',
    roleKey: 'instructor',
    tileLabel: 'Instructor',
    showsBusinessName: false,
    profile: {
      firstName: 'Test',
      lastName: 'Instructor',
      businessName: '',
    },
  },
  {
    clerkRole: 'Boat',
    roleKey: 'boat',
    tileLabel: 'Boat',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'Boat',
      businessName: 'E2E Boat Charter',
    },
  },
  {
    clerkRole: 'Equipment',
    roleKey: 'equipment',
    tileLabel: 'Equipment',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'Equipment',
      businessName: 'E2E Gear Rental',
    },
  },
  {
    clerkRole: 'Pool',
    roleKey: 'pool',
    tileLabel: 'Pool',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'Pool',
      businessName: 'E2E Training Pool',
    },
  },
  {
    clerkRole: 'Compressor',
    roleKey: 'compressor',
    tileLabel: 'Compressor',
    showsBusinessName: true,
    profile: {
      firstName: 'Test',
      lastName: 'Compressor',
      businessName: 'E2E Air Station',
    },
  },
]
