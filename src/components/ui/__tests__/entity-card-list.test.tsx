// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EntityCardList } from '../entity-card-list'

interface Fruit {
  name: string
}

function renderList(props: {
  items: Fruit[]
  onChange?: (next: Fruit[]) => void
  minItems?: number
  maxItems?: number
}) {
  const onChange = props.onChange ?? vi.fn()
  render(
    <EntityCardList<Fruit>
      label="Fruits"
      items={props.items}
      onChange={onChange}
      emptyItem={() => ({ name: '' })}
      addLabel="Add fruit"
      emptyMessage="No fruits yet"
      minItems={props.minItems}
      maxItems={props.maxItems}
      renderCard={(item, update) => (
        <input
          aria-label="fruit-name"
          value={item.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      )}
    />,
  )
  return { onChange }
}

describe('EntityCardList', () => {
  it('renders section header and add button', () => {
    renderList({ items: [] })
    expect(screen.getByText('Fruits')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add fruit/i })).toBeInTheDocument()
  })

  it('shows empty-state message when items is empty', () => {
    renderList({ items: [] })
    expect(screen.getByText('No fruits yet')).toBeInTheDocument()
  })

  it('renders one card per item', () => {
    renderList({ items: [{ name: 'apple' }, { name: 'banana' }] })
    const inputs = screen.getAllByLabelText('fruit-name')
    expect(inputs).toHaveLength(2)
    expect((inputs[0] as HTMLInputElement).value).toBe('apple')
    expect((inputs[1] as HTMLInputElement).value).toBe('banana')
  })

  it('add button appends an empty item via onChange', () => {
    const { onChange } = renderList({ items: [{ name: 'apple' }] })
    fireEvent.click(screen.getByRole('button', { name: /add fruit/i }))
    expect(onChange).toHaveBeenCalledWith([{ name: 'apple' }, { name: '' }])
  })

  it('trash button removes the correct index via onChange', () => {
    const { onChange } = renderList({
      items: [{ name: 'apple' }, { name: 'banana' }, { name: 'cherry' }],
    })
    const removeButtons = screen.getAllByRole('button', { name: /remove item/i })
    fireEvent.click(removeButtons[1])
    expect(onChange).toHaveBeenCalledWith([{ name: 'apple' }, { name: 'cherry' }])
  })

  it('disables add button when items.length >= maxItems', () => {
    renderList({ items: [{ name: 'a' }, { name: 'b' }], maxItems: 2 })
    expect(screen.getByRole('button', { name: /add fruit/i })).toBeDisabled()
  })

  it('enables add button when items.length < maxItems', () => {
    renderList({ items: [{ name: 'a' }], maxItems: 2 })
    expect(screen.getByRole('button', { name: /add fruit/i })).not.toBeDisabled()
  })

  it('hides remove buttons when items.length === minItems', () => {
    renderList({ items: [{ name: 'a' }], minItems: 1 })
    expect(screen.queryByRole('button', { name: /remove item/i })).not.toBeInTheDocument()
  })

  it('shows remove buttons when items.length > minItems', () => {
    renderList({ items: [{ name: 'a' }, { name: 'b' }], minItems: 1 })
    expect(screen.getAllByRole('button', { name: /remove item/i })).toHaveLength(2)
  })

  it('renderCard update function patches only that index', () => {
    const { onChange } = renderList({
      items: [{ name: 'apple' }, { name: 'banana' }],
    })
    const inputs = screen.getAllByLabelText('fruit-name')
    fireEvent.change(inputs[0], { target: { value: 'apricot' } })
    expect(onChange).toHaveBeenCalledWith([{ name: 'apricot' }, { name: 'banana' }])
  })

  it('uses responsive grid with mobile-first breakpoints', () => {
    const { container } = render(
      <EntityCardList<Fruit>
        label="F"
        items={[{ name: 'a' }]}
        onChange={vi.fn()}
        emptyItem={() => ({ name: '' })}
        addLabel="Add"
        renderCard={() => <div />}
      />,
    )
    const grid = container.querySelector('.grid') as HTMLElement
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
    expect(grid.className).toContain('xl:grid-cols-3')
  })
})
