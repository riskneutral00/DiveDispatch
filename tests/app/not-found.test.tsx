// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '../helpers/render'

const notFoundCardSpy = vi.fn()

vi.mock('@/components/ui/not-found-card', () => ({
  NotFoundCard: (props: { href: string; linkText: string }) => {
    notFoundCardSpy(props)
    return null
  },
}))

import GlobalNotFound from '../../src/app/not-found'

describe('GlobalNotFound', () => {
  it('renders a Clerk-free dashboard fallback', async () => {
    const view = await GlobalNotFound()

    render(view as ReactElement)

    expect(notFoundCardSpy).toHaveBeenCalledWith({
      href: '/dashboard',
      linkText: 'Back to dashboard',
    })
  })
})
