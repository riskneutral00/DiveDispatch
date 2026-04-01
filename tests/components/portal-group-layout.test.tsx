// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import PortalGroupLayout from '@/app/(portal)/layout'

describe('PortalGroupLayout', () => {
  it('renders shared portal background layers and shell', () => {
    const { container } = render(
      <PortalGroupLayout>
        <div>Portal child</div>
      </PortalGroupLayout>,
    )

    expect(container.querySelector('.bg-image')).toBeTruthy()
    expect(container.querySelector('.bg-overlay')).toBeTruthy()
    expect(container.querySelector('.app-shell')).toBeTruthy()
    expect(screen.getByText('Portal child')).toBeInTheDocument()
  })
})
