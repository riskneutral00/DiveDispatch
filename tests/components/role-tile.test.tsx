// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '../helpers/render'
import { RoleTile } from '@/components/ui/role-tile'
import type { RoleIconProps } from '@/lib/icons/role-icons'

const stubIcon = (props: RoleIconProps) => <svg data-testid="role-icon" {...props} />

const sample = {
  label: 'Dive Site',
  description: 'Operate a private dive site.',
  icon: stubIcon,
}

describe('RoleTile — comingSoon', () => {
  it('sets aria-disabled="true" when comingSoon is true', () => {
    const onClick = vi.fn()
    const { getByRole } = render(
      <RoleTile role={sample} comingSoon onClick={onClick} />,
    )
    const button = getByRole('button')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not call onClick when comingSoon is true', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(
      <RoleTile role={sample} comingSoon onClick={onClick} />,
    )
    await user.click(getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick when comingSoon is false', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { getByRole } = render(<RoleTile role={sample} onClick={onClick} />)
    await user.click(getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not set native HTML disabled attribute (must remain hover-focus-capable for tooltip)', () => {
    const onClick = vi.fn()
    const { getByRole } = render(
      <RoleTile role={sample} comingSoon onClick={onClick} />,
    )
    const button = getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })
})
