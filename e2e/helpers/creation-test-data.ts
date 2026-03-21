/**
 * Test data for stakeholder creation E2E tests.
 * Each entry defines the role tile to select, profile form data,
 * and expected routing after setup completes.
 */

export interface AccountProfileData {
  firstName: string
  lastName: string
  businessName: string
  city: string
  country: string
  contactEmail: string
  contactPhone: string
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
      city: 'Phuket',
      country: 'Thailand',
      contactEmail: 'test-dc@example.com',
      contactPhone: '+66891234001',
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
      city: 'Bangkok',
      country: 'Thailand',
      contactEmail: 'test-agent@example.com',
      contactPhone: '+66891234002',
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
      city: 'Koh Tao',
      country: 'Thailand',
      contactEmail: 'test-instructor@example.com',
      contactPhone: '+66891234003',
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
      city: 'Chalong',
      country: 'Thailand',
      contactEmail: 'test-boat@example.com',
      contactPhone: '+66891234004',
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
      city: 'Kata',
      country: 'Thailand',
      contactEmail: 'test-equipment@example.com',
      contactPhone: '+66891234005',
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
      city: 'Rawai',
      country: 'Thailand',
      contactEmail: 'test-pool@example.com',
      contactPhone: '+66891234006',
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
      city: 'Chalong',
      country: 'Thailand',
      contactEmail: 'test-compressor@example.com',
      contactPhone: '+66891234007',
    },
  },
]
