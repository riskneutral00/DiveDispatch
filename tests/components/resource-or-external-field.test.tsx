// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { ResourceOrExternalField } from '../../src/components/booking/resource-or-external-field'

const RESOURCES = [
  { id: 'res-1', label: 'Resource A' },
  { id: 'res-2', label: 'Resource B' },
]

describe('ResourceOrExternalField', () => {
  it('renders dropdown when not external', () => {
    render(
      <ResourceOrExternalField
        label="Equipment"
        resources={RESOURCES}
        selectedId=""
        isExternal={false}
        externalName=""
        onSelectResource={() => {}}
        onSetExternal={() => {}}
        onExternalNameChange={() => {}}
      />,
    )
    expect(screen.getByText('Equipment')).toBeInTheDocument()
    expect(screen.getByText('External (not in system)')).toBeInTheDocument()
    expect(screen.getByText('Resource A')).toBeInTheDocument()
    expect(screen.getByText('Resource B')).toBeInTheDocument()
  })

  it('renders freeform input when external', () => {
    render(
      <ResourceOrExternalField
        label="Equipment"
        resources={RESOURCES}
        selectedId=""
        isExternal={true}
        externalName="Custom Gear"
        onSelectResource={() => {}}
        onSetExternal={() => {}}
        onExternalNameChange={() => {}}
      />,
    )
    expect(screen.getByDisplayValue('Custom Gear')).toBeInTheDocument()
    expect(screen.getByText('Switch to system')).toBeInTheDocument()
  })

  it('calls onSelectResource when selecting a system resource', () => {
    const onSelect = vi.fn()
    render(
      <ResourceOrExternalField
        label="Equipment"
        resources={RESOURCES}
        selectedId=""
        isExternal={false}
        externalName=""
        onSelectResource={onSelect}
        onSetExternal={() => {}}
        onExternalNameChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'res-1' } })
    expect(onSelect).toHaveBeenCalledWith('res-1')
  })

  it('calls onSetExternal when selecting __external__', () => {
    const onSetExternal = vi.fn()
    const onSelect = vi.fn()
    render(
      <ResourceOrExternalField
        label="Equipment"
        resources={RESOURCES}
        selectedId=""
        isExternal={false}
        externalName=""
        onSelectResource={onSelect}
        onSetExternal={onSetExternal}
        onExternalNameChange={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__external__' } })
    expect(onSetExternal).toHaveBeenCalledWith(true)
    expect(onSelect).toHaveBeenCalledWith('')
  })

  it('calls onSetExternal(false) when clicking Switch to system', () => {
    const onSetExternal = vi.fn()
    render(
      <ResourceOrExternalField
        label="Equipment"
        resources={RESOURCES}
        selectedId=""
        isExternal={true}
        externalName=""
        onSelectResource={() => {}}
        onSetExternal={onSetExternal}
        onExternalNameChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Switch to system'))
    expect(onSetExternal).toHaveBeenCalledWith(false)
  })
})
