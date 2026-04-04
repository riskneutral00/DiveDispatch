// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { Checkbox } from '../../src/components/ui/checkbox'

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox label="Test" checked={false} onChange={() => {}} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('renders checked when checked prop is true', () => {
    render(<Checkbox label="Test" checked={true} onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('fires onChange with new value when clicked', () => {
    const onChange = vi.fn()
    render(<Checkbox label="Test" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders label text', () => {
    render(<Checkbox label="My Label" checked={false} onChange={() => {}} />)
    expect(screen.getByText('My Label')).toBeInTheDocument()
  })

  it('supports disabled state', () => {
    render(<Checkbox label="Disabled" checked={false} onChange={() => {}} disabled />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })

  it('renders ReactNode label', () => {
    render(
      <Checkbox
        label={<span data-testid="custom-label">Custom</span>}
        checked={false}
        onChange={() => {}}
      />,
    )
    expect(screen.getByTestId('custom-label')).toBeInTheDocument()
  })
})
