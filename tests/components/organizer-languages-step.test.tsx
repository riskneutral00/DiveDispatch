// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn()
let queryCallIndex = 0
let mockExisting: unknown = undefined
let mockMe: unknown = undefined

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => {
      const idx = queryCallIndex++
      // Alternates: even = existing profile, odd = me
      if (idx % 2 === 0) return mockExisting
      return mockMe
    },
    useMutation: () => mockUpdate,
  }
})

vi.mock('@/lib/hooks/use-organizer-role-api', () => ({
  useOrganizerRoleApi: (role: string) => {
    if (!role || role === 'Instructor') return null
    return {
      mine: `${role}.mine`,
      update: `${role}.update`,
      create: `${role}.create`,
    }
  },
}))

// Stub LanguageField — clicking it adds English to the selection
vi.mock('@/components/profiles/language-field', () => ({
  LanguageField: ({ onChange }: { onChange: (langs: unknown[]) => void }) => (
    <button
      data-testid="language-field"
      onClick={() => onChange([{ code: 'en', label: 'English' }])}
    >
      Add Language
    </button>
  ),
}))

// Stub SpecialtyField
vi.mock('@/components/profiles/specialty-field', () => ({
  SpecialtyField: () => <div data-testid="specialty-field" />,
}))

// ─── Import after mocks ───────────────────────────────────────────────────────
import { OrganizerLanguagesStep } from '@/components/onboarding/organizer-languages-step'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  mockExisting = undefined
  mockMe = undefined
  mockUpdate.mockResolvedValue(undefined)
})

describe('OrganizerLanguagesStep', () => {
  it('shows loading card while queries are pending', () => {
    mockExisting = undefined
    mockMe = undefined
    render(<OrganizerLanguagesStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)
    expect(screen.queryByText('Languages & Preferences')).toBeNull()
  })

  it('renders the form for Agent role (no course preferences)', () => {
    mockExisting = null
    mockMe = { customerLanguages: [] }
    render(<OrganizerLanguagesStep role="Agent" onSaved={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Languages & Preferences')).toBeInTheDocument()
    // Agent: subtitle is about customer languages
    expect(screen.getByText(/What languages do your customers speak/)).toBeInTheDocument()
    // No course duration fields
    expect(screen.queryByLabelText('OW Days')).toBeNull()
  })

  it('renders course preferences fields for DiveCenter role', () => {
    mockExisting = { associations: [] }
    mockMe = { customerLanguages: [] }
    render(<OrganizerLanguagesStep role="DiveCenter" onSaved={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Languages & Preferences')).toBeInTheDocument()
    expect(screen.getByText(/What languages do you teach in/)).toBeInTheDocument()
    expect(screen.getByLabelText('OW Days')).toBeInTheDocument()
    expect(screen.getByLabelText('AOW Days')).toBeInTheDocument()
    expect(screen.getByLabelText('Adv. Days')).toBeInTheDocument()
    expect(screen.getByTestId('specialty-field')).toBeInTheDocument()
  })

  it('calls update mutation and onSaved when Next is clicked (Agent)', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mockExisting = null
    mockMe = { customerLanguages: [] }

    render(<OrganizerLanguagesStep role="Agent" onSaved={onSaved} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ customerLanguages: expect.any(Array) }),
      )
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('shows error message when mutation throws', async () => {
    const user = userEvent.setup()
    mockExisting = null
    mockMe = { customerLanguages: [] }
    mockUpdate.mockRejectedValueOnce(new Error('Server error'))

    render(<OrganizerLanguagesStep role="Agent" onSaved={vi.fn()} onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument()
    })
  })

  it('auto-advances for unsupported roles (no roleApi)', async () => {
    const onSaved = vi.fn()
    render(<OrganizerLanguagesStep role="Instructor" onSaved={onSaved} onBack={vi.fn()} />)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
