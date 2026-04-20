// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { PortalSubmit } from '@/components/portal/portal-submit'

const mockSubmit = vi.fn()
const mockStatus = {
  portalContact: false,
  portalMedical: false,
  portalWaiver: false,
  contactComplete: true,
  medicalComplete: true,
  waiverComplete: true,
  alreadySubmitted: false,
  medicalHardBlock: false,
}
let statusReturn: unknown = mockStatus

// mock-ok: component-level jsdom render test. Backend behavior of submitPortal is covered by tests/portalSubmit.test.ts (convex-test + makeT). This suite asserts UI wiring: query states, mutation call args, success/error UI transitions.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => statusReturn,
    useMutation: () => mockSubmit,
  }
})

describe('PortalSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    statusReturn = { ...mockStatus }
  })

  it('shows spinner while status query is loading', () => {
    statusReturn = undefined
    const { container } = render(<PortalSubmit token="tok-1" />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows tokenExpired message when status query returns null', () => {
    statusReturn = null
    render(<PortalSubmit token="tok-1" />)
    expect(screen.getByText(/link has expired/i)).toBeInTheDocument()
  })

  it('calls submitPortal mutation with token on submit click', async () => {
    mockSubmit.mockResolvedValueOnce({ medicalHardBlock: false })

    render(<PortalSubmit token="tok-123" />)

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitBtn)

    await vi.waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({ token: 'tok-123' })
    })
  })

  it('shows success state after successful submission', async () => {
    mockSubmit.mockResolvedValueOnce({ medicalHardBlock: false })

    render(<PortalSubmit token="tok-1" />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/Paperwork complete/i)).toBeInTheDocument()
    })
  })

  it('shows medical hard-block message when mutation returns medicalHardBlock', async () => {
    mockSubmit.mockResolvedValueOnce({ medicalHardBlock: true })

    render(<PortalSubmit token="tok-1" />)

    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await vi.waitFor(() => {
      expect(screen.getByText(/Physician clearance is required/i)).toBeInTheDocument()
    })
  })

  it('disables submit button when required forms are incomplete', () => {
    statusReturn = {
      ...mockStatus,
      portalContact: true,
      contactComplete: false,
    }
    render(<PortalSubmit token="tok-1" />)

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    expect(submitBtn).toBeDisabled()
  })
})
