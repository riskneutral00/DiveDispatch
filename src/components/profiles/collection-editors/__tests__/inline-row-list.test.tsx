// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../../../../../tests/helpers/render'
import { InlineRowList } from '../inline-row-list'

type Row = { id: string; label: string }

describe('InlineRowList', () => {
  it('renders empty state when items is empty', () => {
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span>{item.label}</span>}
        emptyMessage="No rows yet"
      />,
    )
    expect(screen.getByText('No rows yet')).toBeInTheDocument()
  })

  it('renders one ItemCard per item', () => {
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span data-testid={`row-${item.id}`}>{item.label}</span>}
      />,
    )
    expect(screen.getByTestId('row-a').textContent).toBe('Alpha')
    expect(screen.getByTestId('row-b').textContent).toBe('Beta')
  })

  it('calls onChange with appended row when add button clicked', () => {
    const onChange = vi.fn()
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add row"
        items={[{ id: 'a', label: 'Alpha' }]}
        onChange={onChange}
        emptyItem={() => ({ id: 'new', label: 'New' })}
        renderRow={(item) => <span>{item.label}</span>}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add row/i }))
    expect(onChange).toHaveBeenCalledWith([
      { id: 'a', label: 'Alpha' },
      { id: 'new', label: 'New' },
    ])
  })

  it('calls onChange with item removed when trash icon clicked', () => {
    const onChange = vi.fn()
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        onChange={onChange}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span>{item.label}</span>}
        removeAriaLabel={(item) => `Remove ${item.label}`}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }))
    expect(onChange).toHaveBeenCalledWith([{ id: 'b', label: 'Beta' }])
  })

  it('disables add button when items.length === maxItems', () => {
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[{ id: 'a', label: 'Alpha' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span>{item.label}</span>}
        maxItems={1}
      />,
    )
    const addButton = screen.getByRole('button', { name: /add/i })
    expect((addButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('hides remove button when items.length === minItems', () => {
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[{ id: 'a', label: 'Alpha' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span>{item.label}</span>}
        minItems={1}
      />,
    )
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })

  it('passes update closure to renderRow that mutates only the indexed item', () => {
    const onChange = vi.fn()
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        onChange={onChange}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item, update) => (
          <button
            type="button"
            data-testid={`update-${item.id}`}
            onClick={() => update({ ...item, label: `${item.label}!` })}
          >
            {item.label}
          </button>
        )}
      />,
    )
    fireEvent.click(screen.getByTestId('update-b'))
    expect(onChange).toHaveBeenCalledWith([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta!' },
    ])
  })

  it('uses itemKey prop for stable React keys', () => {
    const itemKey = vi.fn((item: Row) => item.id)
    render(
      <InlineRowList<Row>
        label="Items"
        addLabel="Add"
        items={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', label: '' })}
        renderRow={(item) => <span>{item.label}</span>}
        itemKey={itemKey}
      />,
    )
    expect(itemKey).toHaveBeenCalled()
  })
})
