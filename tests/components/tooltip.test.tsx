// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../helpers/render'
import { Tooltip } from '@/components/ui/tooltip'

afterEach(() => {
  vi.useRealTimers()
})

describe('Tooltip — visibility matrix', () => {
  it('shows on hover (mouseenter) and hides on mouseleave', async () => {
    const user = userEvent.setup()
    const { getByRole, queryByRole, getByTestId } = render(
      <Tooltip label="Coming soon">
        <button data-testid="trigger">Trigger</button>
      </Tooltip>,
    )

    expect(queryByRole('tooltip')).toBeNull()
    await user.hover(getByTestId('trigger'))
    expect(getByRole('tooltip')).toHaveTextContent('Coming soon')

    await user.unhover(getByTestId('trigger'))
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('shows on focus and hides on blur', () => {
    const { getByRole, queryByRole, getByTestId } = render(
      <Tooltip label="Coming soon">
        <button data-testid="trigger">Trigger</button>
      </Tooltip>,
    )

    expect(queryByRole('tooltip')).toBeNull()
    const button = getByTestId('trigger') as HTMLButtonElement
    fireEvent.focus(button)
    expect(getByRole('tooltip')).toHaveTextContent('Coming soon')

    fireEvent.blur(button)
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('keeps tooltip visible while focused even after mouseleave', async () => {
    const user = userEvent.setup()
    const { getByRole, getByTestId } = render(
      <Tooltip label="Coming soon">
        <button data-testid="trigger">Trigger</button>
      </Tooltip>,
    )

    const button = getByTestId('trigger') as HTMLButtonElement
    fireEvent.focus(button)
    await user.hover(button)
    expect(getByRole('tooltip')).toBeInTheDocument()

    await user.unhover(button)
    expect(getByRole('tooltip')).toBeInTheDocument()
  })

  it('hides on blur only when no other state is active', async () => {
    const user = userEvent.setup()
    const { getByRole, queryByRole, getByTestId } = render(
      <Tooltip label="Coming soon">
        <button data-testid="trigger">Trigger</button>
      </Tooltip>,
    )

    const button = getByTestId('trigger') as HTMLButtonElement
    fireEvent.focus(button)
    await user.hover(button)
    expect(getByRole('tooltip')).toBeInTheDocument()

    fireEvent.blur(button)
    expect(getByRole('tooltip')).toBeInTheDocument()

    await user.unhover(button)
    expect(queryByRole('tooltip')).toBeNull()
  })

  it('preserves touch behavior — click toggles showTouch on hover:none devices', () => {
    const matchMediaSpy = vi.fn().mockImplementation((q: string) => ({
      matches: q === '(hover: none)',
      media: q,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }))
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaSpy,
    })

    const { getByRole, queryByRole, getByTestId } = render(
      <Tooltip label="Coming soon">
        <button data-testid="trigger">Trigger</button>
      </Tooltip>,
    )

    expect(queryByRole('tooltip')).toBeNull()
    fireEvent.click(getByTestId('trigger'))
    expect(getByRole('tooltip')).toHaveTextContent('Coming soon')

    fireEvent.click(getByTestId('trigger'))
    expect(queryByRole('tooltip')).toBeNull()
  })
})
