// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../helpers/render'
import userEvent from '@testing-library/user-event'


let mutationCallIndex = 0
let queryCallIndex = 0
let mockExisting: unknown = undefined
let mockMe: unknown = undefined
let mockInheritance: unknown = null

const mockMutate = vi.fn()

vi.mock('@/lib/hooks/use-session-identity', () => ({
  useSessionIdentity: () => ({
    user: mockMe,
    roles: undefined,
    defaultRole: null,
    defaultRoleKey: null,
    slug: null,
    status: mockMe === undefined ? 'loading' : 'ready',
    isAuthLoading: false,
    isAuthenticated: mockMe !== null && mockMe !== undefined,
  }),
}))

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => {
      const idx = queryCallIndex++
      // After hook migration: only existing + inheritance via useQuery (me comes from session hook)
      if (idx % 2 === 0) return mockExisting
      return mockInheritance
    },
    useMutation: () => {
      mutationCallIndex++
      return mockMutate
    },
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

vi.mock('@/components/profiles/location-picker', () => ({
  LocationPicker: ({ onChange, label }: { onChange: (v: unknown) => void; label?: string }) => (
    <button
      aria-label={label ?? 'Location'}
      data-testid="location-picker"
      onClick={() =>
        onChange({ address: { city: 'Koh Tao', country: 'TH' }, lat: 10.1, lng: 99.8 })
      }
    >
      Pick Location
    </button>
  ),
}))

import { OrganizerBasicStep } from '@/components/onboarding/organizer-basic-step'

beforeEach(() => {
  vi.clearAllMocks()
  queryCallIndex = 0
  mutationCallIndex = 0
  mockExisting = undefined
  mockMe = undefined
  mockInheritance = null
  mockMutate.mockResolvedValue(undefined)
})

describe('OrganizerBasicStep', () => {
  it('shows loading card while queries are pending', () => {
    mockExisting = undefined
    mockMe = undefined
    render(<OrganizerBasicStep role="DiveCenter" onSaved={vi.fn()} />)
    expect(screen.queryByText('Basic Information')).toBeNull()
  })

  it('renders the form when queries resolve', () => {
    mockExisting = null
    mockMe = { email: 'test@test.com', businessName: 'Test Dive' }
    render(<OrganizerBasicStep role="DiveCenter" onSaved={vi.fn()} />)
    expect(screen.getByText('Basic Information')).toBeInTheDocument()
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contact email/i)).toBeInTheDocument()
    expect(screen.getByText(/contact phone/i)).toBeInTheDocument()
  })

  it('pre-fills fields from existing profile', () => {
    mockExisting = {
      name: 'Ocean Divers',
      email: 'ocean@dive.com',
      phone: '+66812345678',
      lat: 7.88,
      lng: 98.39,
      address: { city: 'Phuket', country: 'TH' },
    }
    mockMe = { email: 'me@test.com', businessName: 'My Biz' }
    render(<OrganizerBasicStep role="DiveCenter" onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('Ocean Divers')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ocean@dive.com')).toBeInTheDocument()
  })

  it('calls create mutation and onSaved for new DiveCenter profile', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    mockExisting = null
    mockMe = { email: 'test@test.com', businessName: '' }

    render(<OrganizerBasicStep role="DiveCenter" onSaved={onSaved} />)

    const nameInput = screen.getByLabelText(/business name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Deep Blue Diving')

    await user.click(screen.getByTestId('location-picker'))

    const emailInput = screen.getByLabelText(/contact email/i)
    await user.clear(emailInput)
    await user.type(emailInput, 'info@deepblue.com')

    const phoneInput = screen.getAllByRole('textbox').find((el) => (el as HTMLInputElement).name === 'phone' || el.getAttribute('autocomplete') === 'tel')
    if (phoneInput) {
      await user.type(phoneInput, '2025550100')
    }

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Deep Blue Diving' }),
      )
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('pre-fills fields from inherited contact when no existing profile', async () => {
    mockExisting = null
    mockMe = { email: 'me@test.com' }
    mockInheritance = {
      name: 'Sea Fun Divers',
      email: 'hello@seafun.example',
      phone: '+66999888777',
      address: { city: 'Phuket', country: 'TH' },
      placeId: null,
      lat: 7.88,
      lng: 98.39,
    }

    render(<OrganizerBasicStep role="Agent" onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Sea Fun Divers')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('hello@seafun.example')).toBeInTheDocument()
  })

  it('existing profile takes precedence over inheritance', async () => {
    mockExisting = {
      name: 'Real Agent Name',
      email: 'real@liveaboard.example',
      phone: '+66111222333',
      lat: 10,
      lng: 99,
      address: { city: 'Koh Tao', country: 'TH' },
    }
    mockMe = { email: 'me@test.com' }
    mockInheritance = {
      name: 'Inherited DC Name',
      email: 'dc@example.com',
      phone: '+66000000000',
      address: { city: 'Phuket', country: 'TH' },
      placeId: null,
      lat: 7.88,
      lng: 98.39,
    }

    render(<OrganizerBasicStep role="Agent" onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Real Agent Name')).toBeInTheDocument()
    })
    expect(screen.queryByDisplayValue('Inherited DC Name')).toBeNull()
  })

  it('shows loading card while inheritance query is pending', () => {
    mockExisting = null
    mockMe = { email: 'me@test.com' }
    mockInheritance = undefined

    render(<OrganizerBasicStep role="Agent" onSaved={vi.fn()} />)
    expect(screen.queryByText('Basic Information')).toBeNull()
  })

  it('does not call onSaved when mutation throws', async () => {
    const user = userEvent.setup()
    mockExisting = null
    mockMe = { email: 'test@test.com', businessName: '' }
    mockMutate.mockRejectedValueOnce(new Error('Network error'))
    const onSaved = vi.fn()

    render(<OrganizerBasicStep role="DiveCenter" onSaved={onSaved} />)

    const nameInput = screen.getByLabelText(/business name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Deep Blue')
    await user.click(screen.getByTestId('location-picker'))
    const emailInput = screen.getByLabelText(/contact email/i)
    await user.clear(emailInput)
    await user.type(emailInput, 'fail@test.com')
    const phoneInput = screen.getAllByRole('textbox').find((el) => (el as HTMLInputElement).name === 'phone' || el.getAttribute('autocomplete') === 'tel')
    if (phoneInput) {
      await user.type(phoneInput, '2025550100')
    }

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})
