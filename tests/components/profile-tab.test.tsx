// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Stub LanguageField to avoid Convex query inside it
vi.mock('@/components/profiles/language-field', () => ({
  LanguageField: ({ value, onChange }: { value: unknown[]; onChange: (langs: { code: string }[]) => void }) => (
    <button
      data-testid="language-field"
      onClick={() => onChange([{ code: 'th' }])}
    >
      Language
    </button>
  ),
}))

let mockUser: unknown = undefined
const mockCreateUser = vi.fn()
const mockUpdateProfile = vi.fn()

let mutationCallIndex = 0

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => mockUser,
    useMutation: () => {
      const idx = mutationCallIndex++
      return idx === 0 ? mockCreateUser : mockUpdateProfile
    },
  }
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import { ProfileTab } from '@/components/account/profile-tab'

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mutationCallIndex = 0
  mockUser = undefined
  mockCreateUser.mockResolvedValue(undefined)
  mockUpdateProfile.mockResolvedValue(undefined)
})

describe('ProfileTab', () => {
  it('renders loading state when user query is pending', () => {
    mockUser = undefined
    const { container } = render(<ProfileTab />)
    // ProfileFormShell shows skeleton/spinner while loading; form fields not yet visible
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument()
    // Some loading element present (pulse animation or spinner)
    const loading = container.querySelector('[class*="animate"]') || container.querySelector('[class*="pulse"]')
    expect(loading).toBeTruthy()
  })

  it('renders form fields when user data is available', () => {
    mockUser = {
      firstName: 'Alice',
      lastName: 'Tan',
      nickname: '',
      businessName: 'Dive Co',
      email: 'alice@dive.co',
      phone: '+66812345678',
      dateOfBirth: '1990-06-15',
      appLanguage: 'en',
    }

    render(<ProfileTab />)

    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@dive.co')).toBeInTheDocument()
  })

  it('renders form fields with defaults when user record is null (new user)', () => {
    mockUser = null

    render(<ProfileTab />)

    // Fields rendered with empty defaults — form is in create mode
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i })
    expect(firstNameInput).toBeInTheDocument()
    expect((firstNameInput as HTMLInputElement).value).toBe('')
  })

  it('calls updateProfile mutation on submit when user already exists', async () => {
    mockUser = {
      firstName: 'Alice',
      lastName: 'Tan',
      nickname: '',
      businessName: 'Dive Co',
      email: 'alice@dive.co',
      phone: '+66812345678',
      dateOfBirth: null,
      appLanguage: 'en',
    }

    const userEvent = await import('@testing-library/user-event')
    const user = userEvent.default.setup()

    render(<ProfileTab />)

    // Dirty the form so Save is enabled
    const firstNameInput = screen.getByRole('textbox', { name: /first name/i })
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Bob')

    // Submit the form via the Save button
    const saveBtn = screen.getByRole('button', { name: /save/i })
    await user.click(saveBtn)

    const { waitFor } = await import('@testing-library/react')
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
    })
  })

  it('renders a single Date of birth field', () => {
    mockUser = null

    render(<ProfileTab />)

    expect(screen.getByText(/date of birth/i)).toBeInTheDocument()
  })
})
