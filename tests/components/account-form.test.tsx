// @vitest-environment jsdom
/**
 * Tests for AccountForm:
 * 1. Nickname field renders
 * 2. Nickname + Business Name in same grid-cols-2 container
 * 3. Form submits nickname value to createUser mutation
 * 4. Within-section spacing uses gap-3 (not gap-4)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'
import { screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockUser: unknown = undefined
let mockUserRoles: unknown = undefined
const mockCreateUser = vi.fn().mockResolvedValue(undefined)

let qIdx = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: () => {
      if (qIdx >= 2) qIdx = 0
      const idx = qIdx++
      if (idx === 0) return mockUser
      return mockUserRoles
    },
    useMutation: () => mockCreateUser,
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setMockUser(overrides: Record<string, unknown> = {}) {
  mockUser = {
    businessName: 'Reef Explorers',
    nickname: 'Reefy',
    ...overrides,
  }
  mockUserRoles = [{ role: 'DiveCenter' }]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccountForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    qIdx = 0
    mockUser = undefined
    mockUserRoles = undefined
  })

  // Lazy import so mocks are in place
  async function renderForm() {
    const { AccountForm } = await import(
      '../../src/components/settings/account-form'
    )
    return render(<AccountForm />)
  }

  it('renders nickname field', async () => {
    setMockUser()
    await renderForm()
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument()
  })

  it('renders nickname + business name in a grid-cols-2 container', async () => {
    setMockUser()
    await renderForm()
    const nickname = screen.getByLabelText(/nickname/i)
    const businessName = screen.getByLabelText(/business name/i)

    // Both inputs should share a common grid parent with grid-cols-2
    const nicknameParent = nickname.closest('.grid')
    const businessParent = businessName.closest('.grid')
    expect(nicknameParent).toBeTruthy()
    expect(nicknameParent).toBe(businessParent)
    expect(nicknameParent!.className).toMatch(/grid-cols-2/)
  })

  it('submits nickname value to createUser mutation', async () => {
    setMockUser()
    await renderForm()

    const nicknameInput = screen.getByLabelText(/nickname/i)
    fireEvent.change(nicknameInput, { target: { value: 'New Nick' } })

    const submitBtn = screen.getByRole('button', { name: /save/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: 'New Nick' }),
      )
    })
  })

  it('uses gap-3 for within-section spacing', async () => {
    setMockUser()
    const { container } = await renderForm()

    // The field group inside GlassCard should use gap-3
    const fieldGroup = container.querySelector('.flex.flex-col.gap-3')
    expect(fieldGroup).toBeTruthy()
  })

  it('populates nickname from profile data', async () => {
    setMockUser({ nickname: 'Deep Blue' })
    await renderForm()
    const nicknameInput = screen.getByLabelText(/nickname/i) as HTMLInputElement
    expect(nicknameInput.value).toBe('Deep Blue')
  })
})
