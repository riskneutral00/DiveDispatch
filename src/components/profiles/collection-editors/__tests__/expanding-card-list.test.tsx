// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../../../../../tests/helpers/render'
import { ExpandingCardList } from '../expanding-card-list'

type Vessel = { id: string; name: string }

describe('ExpandingCardList', () => {
  it('renders empty state when no items', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add vessel"
        items={[]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        emptyMessage="No vessels yet"
      />,
    )
    expect(screen.getByText('No vessels yet')).toBeInTheDocument()
  })

  it('renders card titles for every item', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[
          { id: 'a', name: 'Sea Raptor' },
          { id: 'b', name: 'Dragon' },
        ]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
      />,
    )
    expect(screen.getByText('Sea Raptor')).toBeInTheDocument()
    expect(screen.getByText('Dragon')).toBeInTheDocument()
  })

  it('renders expanded body only for expanded cards', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body for {item.name}</span>
        )}
        itemKey={(item) => item.id}
      />,
    )
    expect(screen.queryByTestId('body-a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(screen.getByTestId('body-a')).toBeInTheDocument()
  })

  it('toggles expand state on title click', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body</span>
        )}
        itemKey={(item) => item.id}
      />,
    )
    const toggle = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(toggle)
    expect(screen.getByTestId('body-a')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByTestId('body-a')).toBeNull()
  })

  it('expands the first item when defaultExpandFirst is true', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[
          { id: 'a', name: 'Sea Raptor' },
          { id: 'b', name: 'Dragon' },
        ]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body</span>
        )}
        itemKey={(item) => item.id}
        defaultExpandFirst
      />,
    )
    expect(screen.getByTestId('body-a')).toBeInTheDocument()
    expect(screen.queryByTestId('body-b')).toBeNull()
  })

  it('appends a new item and expands it on add click', () => {
    const onChange = vi.fn()
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add vessel"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={onChange}
        emptyItem={() => ({ id: 'new', name: 'New' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add vessel/i }))
    expect(onChange).toHaveBeenCalledWith([
      { id: 'a', name: 'Sea Raptor' },
      { id: 'new', name: 'New' },
    ])
  })

  it('calls onSave with the item and index when save icon clicks', () => {
    const onSave = vi.fn()
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }))
    expect(onSave).toHaveBeenCalledWith({ id: 'a', name: 'Sea Raptor' }, 0)
  })

  it('shows loader when savingKeys contains the item key', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        onSave={() => {}}
        savingKeys={new Set(['a'])}
      />,
    )
    const saveButton = screen.getByRole('button', { name: 'Save item' })
    expect(saveButton.querySelector('.animate-spin')).not.toBeNull()
  })

  it('shows save error per row keyed by itemKey', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        onSave={() => {}}
        saveErrors={{ a: 'Save failed' }}
      />,
    )
    expect(screen.getByText('Save failed')).toBeInTheDocument()
  })

  it('controlled mode: expanded follows expandedKeys prop and onExpandedKeysChange fires on toggle', () => {
    const onExpandedKeysChange = vi.fn()
    const { rerender } = render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[
          { id: 'a', name: 'Sea Raptor' },
          { id: 'b', name: 'Dragon' },
        ]}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body</span>
        )}
        itemKey={(item) => item.id}
        expandedKeys={new Set(['a'])}
        onExpandedKeysChange={onExpandedKeysChange}
      />,
    )
    expect(screen.getByTestId('body-a')).toBeInTheDocument()
    expect(screen.queryByTestId('body-b')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    expect(onExpandedKeysChange).toHaveBeenCalled()
    const lastCall = onExpandedKeysChange.mock.calls.at(-1)![0] as Set<string>
    expect(lastCall.has('a')).toBe(true)
    expect(lastCall.has('b')).toBe(true)

    rerender(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[
          { id: 'a', name: 'Sea Raptor' },
          { id: 'b', name: 'Dragon' },
        ]}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body</span>
        )}
        itemKey={(item) => item.id}
        expandedKeys={new Set(['a'])}
        onExpandedKeysChange={onExpandedKeysChange}
      />,
    )
    expect(screen.queryByTestId('body-b')).toBeNull()
  })

  it('controlled mode: onExpandedKeysChange fires on add', () => {
    const onExpandedKeysChange = vi.fn()
    const onAdd = vi.fn()
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add vessel"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        expandedKeys={new Set()}
        onExpandedKeysChange={onExpandedKeysChange}
        onAdd={onAdd}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add vessel/i }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('uncontrolled mode: defaultExpandFirst still expands the first item (backwards compat)', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[
          { id: 'a', name: 'Sea Raptor' },
          { id: 'b', name: 'Dragon' },
        ]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={(item) => (
          <span data-testid={`body-${item.id}`}>body</span>
        )}
        itemKey={(item) => item.id}
        defaultExpandFirst
      />,
    )
    expect(screen.getByTestId('body-a')).toBeInTheDocument()
  })

  it('hides remove button when items.length === minItems', () => {
    render(
      <ExpandingCardList<Vessel>
        label="Fleet"
        addLabel="Add"
        items={[{ id: 'a', name: 'Sea Raptor' }]}
        onChange={() => {}}
        emptyItem={() => ({ id: 'x', name: '' })}
        renderCardTitle={(item) => <span>{item.name}</span>}
        renderExpandedBody={() => null}
        itemKey={(item) => item.id}
        minItems={1}
        removeAriaLabel={(item) => `Remove ${item.name}`}
      />,
    )
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })
})
