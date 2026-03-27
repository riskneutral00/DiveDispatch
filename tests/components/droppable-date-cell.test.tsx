// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '../helpers/render'

// Mock dnd-kit
const mockIsDropTarget = vi.fn(() => false)
vi.mock('@dnd-kit/react', () => ({
  useDroppable: () => ({
    ref: () => {},
    isDropTarget: mockIsDropTarget(),
    droppable: {},
  }),
}))

import { DroppableDateCell } from '@/components/booking/droppable-date-cell'

describe('DroppableDateCell', () => {
  it('renders children', () => {
    const { getByText } = render(
      <DroppableDateCell dateString="2026-04-01" disabled={false}>
        <span>Day Content</span>
      </DroppableDateCell>,
    )
    expect(getByText('Day Content')).toBeDefined()
  })

  it('applies highlight style when isDropTarget is true', () => {
    mockIsDropTarget.mockReturnValue(true)
    const { container } = render(
      <DroppableDateCell dateString="2026-04-01" disabled={false}>
        <span>Day</span>
      </DroppableDateCell>,
    )
    const cell = container.firstElementChild as HTMLElement
    expect(cell.style.boxShadow).toContain('var(--color-primary)')
  })

  it('does NOT apply highlight when disabled even if isDropTarget', () => {
    mockIsDropTarget.mockReturnValue(true)
    const { container } = render(
      <DroppableDateCell dateString="2026-04-01" disabled>
        <span>Day</span>
      </DroppableDateCell>,
    )
    const cell = container.firstElementChild as HTMLElement
    expect(cell.style.boxShadow).toBe('')
  })
})
