// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../helpers/render'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCurrentUser = vi.fn<() => { user: Record<string, unknown> | null; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: () => mockCurrentUser(),
}))

const mockUseQuery = vi.fn()
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return { ...actual, useQuery: () => mockUseQuery(), useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }) }
})

// ─── Import after mocks ──────────────────────────────────────────────────────
import { QuickBookRail } from '@/components/booking/quick-book-rail'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QuickBookRail', () => {
  describe('when onboarding is complete', () => {
    beforeEach(() => {
      mockCurrentUser.mockReturnValue({
        user: { onboardingComplete: true, role: 'DiveCenter', slug: 'test' },
        isLoading: false,
      })
      mockUseQuery.mockReturnValue({ percentage: 100, incomplete: [] })
    })

    it('renders all course pills and the + Booking button enabled', () => {
      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      expect(getByRole('button', { name: 'DSD' })).not.toBeDisabled()
      expect(getByRole('button', { name: 'OWC' })).not.toBeDisabled()
      expect(getByRole('button', { name: '+ Booking' })).not.toBeDisabled()
    })

    it('calls onSelect when a course pill is clicked', async () => {
      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      await userEvent.click(getByRole('button', { name: 'DSD' }))
      expect(onSelect).toHaveBeenCalledWith(['DSD'])
    })

    it('calls onSelect with empty array when + Booking is clicked', async () => {
      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      await userEvent.click(getByRole('button', { name: '+ Booking' }))
      expect(onSelect).toHaveBeenCalledWith([])
    })
  })

  describe('when onboarding is NOT complete', () => {
    beforeEach(() => {
      mockCurrentUser.mockReturnValue({
        user: { onboardingComplete: false, role: 'DiveCenter', slug: 'test' },
        isLoading: false,
      })
      mockUseQuery.mockReturnValue({ percentage: 50, incomplete: ['Business name'] })
    })

    it('renders all buttons disabled', () => {
      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      expect(getByRole('button', { name: 'DSD' })).toBeDisabled()
      expect(getByRole('button', { name: 'OWC' })).toBeDisabled()
      expect(getByRole('button', { name: '+ Booking' })).toBeDisabled()
    })

    it('does NOT call onSelect when disabled buttons are clicked', async () => {
      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      await userEvent.click(getByRole('button', { name: /DSD/i }))
      await userEvent.click(getByRole('button', { name: /\+ Booking/i }))
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('has disabled buttons when onboarding is incomplete', () => {
      const onSelect = vi.fn()
      const { container } = render(<QuickBookRail onSelect={onSelect} />)

      const disabledButtons = container.querySelectorAll('button[disabled]')
      expect(disabledButtons.length).toBeGreaterThan(0)
    })
  })

  describe('when user is null (loading / no record)', () => {
    it('renders buttons disabled while user data is absent', () => {
      mockCurrentUser.mockReturnValue({ user: null, isLoading: true })
      mockUseQuery.mockReturnValue(undefined)

      const onSelect = vi.fn()
      const { getByRole } = render(<QuickBookRail onSelect={onSelect} />)

      expect(getByRole('button', { name: /\+ Booking/i })).toBeDisabled()
    })
  })

  describe('drag-to-date behavior', () => {
    beforeEach(() => {
      mockCurrentUser.mockReturnValue({
        user: { onboardingComplete: true, role: 'DiveCenter', slug: 'test' },
        isLoading: false,
      })
      mockUseQuery.mockReturnValue({ percentage: 100, incomplete: [] })
    })

    it('pills have cursor-grab class when canBook=true', () => {
      const { getByRole } = render(
        <DndContext>
          <QuickBookRail onSelect={vi.fn()} />
        </DndContext>,
      )
      const pill = getByRole('button', { name: 'DSD' })
      expect(pill.className).toContain('cursor-grab')
    })

    it('armed pill receives glow box-shadow', () => {
      const { getByRole } = render(
        <DndContext>
          <QuickBookRail onSelect={vi.fn()} armedPillId="dsd" onArmPill={vi.fn()} />
        </DndContext>,
      )
      const pill = getByRole('button', { name: 'DSD' })
      expect(pill.style.boxShadow).toContain('var(--color-primary)')
    })

    it('tapping armed pill disarms it', () => {
      const onArmPill = vi.fn()
      const { getByRole } = render(
        <DndContext>
          <QuickBookRail onSelect={vi.fn()} armedPillId="ow" onArmPill={onArmPill} />
        </DndContext>,
      )
      // Use fireEvent.click (not userEvent) — dnd-kit pointer listeners intercept userEvent's pointer sequence
      fireEvent.click(getByRole('button', { name: 'OWC' }))
      expect(onArmPill).toHaveBeenCalledWith(null)
    })

    it('tapping unarmed pill arms it', () => {
      const onArmPill = vi.fn()
      const { getByRole } = render(
        <DndContext>
          <QuickBookRail onSelect={vi.fn()} armedPillId={null} onArmPill={onArmPill} />
        </DndContext>,
      )
      fireEvent.click(getByRole('button', { name: 'DSD' }))
      expect(onArmPill).toHaveBeenCalledWith('dsd')
    })

    it('+ Booking pill also supports armed state', () => {
      const { getByRole } = render(
        <DndContext>
          <QuickBookRail onSelect={vi.fn()} armedPillId="plus" onArmPill={vi.fn()} />
        </DndContext>,
      )
      const pill = getByRole('button', { name: '+ Booking' })
      expect(pill.style.boxShadow).toContain('var(--color-primary)')
    })
  })
})
