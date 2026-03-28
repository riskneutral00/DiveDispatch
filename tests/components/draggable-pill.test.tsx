// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'
import userEvent from '@testing-library/user-event'

// Mock dnd-kit — we test drag behavior via integration tests, not unit
vi.mock('@dnd-kit/react', () => ({
  useDraggable: () => ({
    ref: () => {},
    isDragging: false,
    isDragSource: false,
    isDropping: false,
    handleRef: () => {},
    draggable: {},
  }),
}))

import { DraggablePill } from '@/components/booking/draggable-pill'
import type { CourseCode } from '@/lib/constants/course-catalog'

describe('DraggablePill', () => {
  const template = { id: 'ow', label: 'OWC', courses: ['OW'] as CourseCode[] }
  let onSelect: (courses: CourseCode[]) => void

  beforeEach(() => {
    onSelect = vi.fn() as unknown as (courses: CourseCode[]) => void
  })

  it('renders the template label', () => {
    const { getByRole } = render(
      <DraggablePill template={template} onSelect={onSelect} canBook />,
    )
    expect(getByRole('button', { name: 'OWC' })).toBeTruthy()
  })

  it('fires onSelect with courses on click', async () => {
    const { getByRole } = render(
      <DraggablePill template={template} onSelect={onSelect} canBook />,
    )
    await userEvent.click(getByRole('button', { name: 'OWC' }))
    expect(onSelect).toHaveBeenCalledWith(['OW'])
  })

  it('does not fire onSelect when canBook is false', async () => {
    const { getByRole } = render(
      <DraggablePill template={template} onSelect={onSelect} canBook={false} />,
    )
    await userEvent.click(getByRole('button', { name: 'OWC' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('renders disabled when canBook is false', () => {
    const { getByRole } = render(
      <DraggablePill template={template} onSelect={onSelect} canBook={false} />,
    )
    expect(getByRole('button', { name: 'OWC' })).toBeDisabled()
  })
})
