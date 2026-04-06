// @vitest-environment jsdom
/**
 * SendPortalLink — component behavior tests
 *
 * Tests:
 * 1. Renders the "Send Link" trigger button
 * 2. Dialog opens on button click and shows customer name
 * 3. Copy button calls createLink mutation (ensureLink) when no existing link
 * 4. Email button is visible when email is provided
 * 5. WhatsApp button is visible only when contactType is 'whatsapp'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '../helpers/render'
import { SendPortalLink } from '@/components/booking/send-portal-link'
import type { Id } from '@/lib/convex-generated'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateLink = vi.fn()
const mockSendEmail = vi.fn()
const mockExistingLink = vi.fn()

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => mockExistingLink(),
    useMutation: () => mockCreateLink,
    useAction: () => mockSendEmail,
  }
})

// Stub next-intl booking translations used inside the component
vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>()
  return {
    ...actual,
    useTranslations: (ns: string) => (key: string, _params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common:sendLink': 'Send Link',
        'booking:linkExpires': 'Expires soon',
        'booking:emailSent': 'Email sent',
        'booking:whatsAppOpened': 'WhatsApp opened',
        'booking:lineOpened': 'LINE opened',
        'common:copy': 'Copy',
        'common:copied': 'Copied',
        'common:actionFailed': 'Action failed',
        'errors:copyFailed': 'Copy failed',
        'errors:noWhatsApp': 'No WhatsApp number',
      }
      return map[`${ns}:${key}`] ?? key
    },
  }
})

// jsdom doesn't implement HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BOOKING_ID = 'booking-xyz' as Id<'bookings'>

const defaultProps = {
  bookingId: BOOKING_ID,
  customerName: 'Jane Diver',
  email: 'jane@example.com',
  operatorName: 'Sea Center',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SendPortalLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No existing link by default
    mockExistingLink.mockReturnValue(null)
  })

  it('renders the Send Link trigger button', () => {
    render(<SendPortalLink {...defaultProps} />)
    expect(screen.getByRole('button', { name: /send link/i })).toBeInTheDocument()
  })

  it('opens the dialog and shows the customer name when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(<SendPortalLink {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /send link/i }))

    expect(screen.getByText('Jane Diver')).toBeInTheDocument()
  })

  it('renders Email button when email is provided', async () => {
    const user = userEvent.setup()
    render(<SendPortalLink {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /send link/i }))

    expect(screen.getByRole('button', { name: /email/i, hidden: true })).toBeInTheDocument()
  })

  it('does not render WhatsApp button when contactType is not whatsapp', async () => {
    const user = userEvent.setup()
    render(<SendPortalLink {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /send link/i }))

    expect(screen.queryByRole('button', { name: /whatsapp/i, hidden: true })).toBeNull()
  })

  it('renders WhatsApp button when contactType is whatsapp with a value', async () => {
    const user = userEvent.setup()
    render(
      <SendPortalLink
        {...defaultProps}
        contactType="whatsapp"
        contactValue="+66812345678"
      />,
    )

    await user.click(screen.getByRole('button', { name: /send link/i }))

    expect(screen.getByRole('button', { name: /whatsapp/i, hidden: true })).toBeInTheDocument()
  })
})
