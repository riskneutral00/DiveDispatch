// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'
import { ProfileOverlay } from '@/components/profiles/profile-overlay'
import type { RoleKey } from '@/lib/constants/roles'

vi.mock('@/lib/icons/role-icons', () => {
  const stub = (props: Record<string, unknown>) => <svg data-testid="role-icon" {...props} />
  return {
    DiveCenterIcon: stub,
    AgentIcon: stub,
    LiveaboardIcon: stub,
    DiveResortIcon: stub,
    DiveHostelIcon: stub,
    DiveSiteIcon: stub,
    InstructorIcon: stub,
    DiveMasterIcon: stub,
    BoatIcon: stub,
    EquipmentIcon: stub,
    PoolIcon: stub,
    CompressorIcon: stub,
  }
})

beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

vi.mock('@/components/account/profile-tab', () => ({
  ProfileTab: () => <div data-testid="profile-tab">ProfileTab</div>,
}))
vi.mock('@/components/account/manage-roles-connected', () => ({
  ManageRolesConnected: () => <div data-testid="manage-roles-connected">ManageRoles</div>,
}))
vi.mock('@/components/profiles/connected-role-forms', () => ({
  RoleProfileForm: () => <div data-testid="role-profile-form">RoleProfileForm</div>,
}))
vi.mock('@/components/account/profile-section-tab-bar', () => ({
  ProfileSectionTabBar: () => <div data-testid="profile-section-tab-bar" />,
}))
vi.mock('@/components/layout/dashboard-page-frame', () => ({
  DashboardPageFrame: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dashboard-page-frame" className={className}>{children}</div>
  ),
}))
vi.mock('@/components/inventory/connected-equipment-gear', () => ({
  ConnectedEquipmentGear: () => null,
}))
vi.mock('@/components/account/preferences-editor', () => ({
  PreferencesEditor: () => null,
}))

let mockMyRoles: { role: string }[] = []

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => mockMyRoles,
  }
})

function renderOverlay(opts: { roles: string[]; initialTab?: 'profile' | 'roles' | `role:${RoleKey}` }) {
  mockMyRoles = opts.roles.map((role) => ({ role }))
  return render(
    <ProfileOverlay
      open
      onClose={vi.fn()}
      initialTab={opts.initialTab ?? 'profile'}
      roleSlug="dive-center"
      slug="test-user"
    />,
  )
}

describe('ProfileOverlay — Roles tab visibility', () => {
  beforeEach(() => {
    mockMyRoles = []
  })

  it('hides Roles tab for pure-resource users', () => {
    renderOverlay({ roles: ['Instructor', 'Boat'] })
    const tabs = screen.getAllByRole('tab', { hidden: true })
    const tabLabels = tabs.map((t) => t.textContent)
    expect(tabLabels).not.toContain('Roles')
  })

  it('shows Roles tab for single-operator user', () => {
    renderOverlay({ roles: ['DiveCenter'] })
    const tabs = screen.getAllByRole('tab', { hidden: true })
    const tabLabels = tabs.map((t) => t.textContent)
    expect(tabLabels).toContain('Roles')
  })

  it('shows Roles tab for mixed-role user', () => {
    renderOverlay({ roles: ['DiveCenter', 'Instructor'] })
    const tabs = screen.getAllByRole('tab', { hidden: true })
    const tabLabels = tabs.map((t) => t.textContent)
    expect(tabLabels).toContain('Roles')
  })

  it('falls back to Profile tab when pure-resource user opens with initialTab=roles', () => {
    renderOverlay({ roles: ['Instructor', 'Boat'], initialTab: 'roles' })
    expect(screen.getByTestId('profile-tab', { })).toBeInTheDocument()
    expect(screen.queryByTestId('manage-roles-connected')).not.toBeInTheDocument()
  })
})
