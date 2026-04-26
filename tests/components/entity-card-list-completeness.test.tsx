// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EntityCardList } from '@/components/ui/entity-card-list'

describe('EntityCardList — getCompleteness badge', () => {
  it('renders no badge when getCompleteness is omitted', () => {
    render(
      <EntityCardList
        label="Things"
        items={[{ id: 'a', name: 'A' }]}
        addLabel="Add"
        renderCard={(item) => <span>{item.name}</span>}
      />,
    )
    expect(screen.queryByText('Complete')).toBeNull()
    expect(screen.queryByText('Incomplete')).toBeNull()
  })

  it('renders Complete pill when getCompleteness returns complete=true', () => {
    render(
      <EntityCardList
        label="Things"
        items={[{ id: 'a', name: 'A' }]}
        addLabel="Add"
        renderCard={(item) => <span>{item.name}</span>}
        getCompleteness={() => ({ complete: true, incomplete: [] })}
        completeLabel="Complete"
        incompleteLabel="Incomplete"
      />,
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('renders Incomplete pill with title=missing fields when complete=false', () => {
    render(
      <EntityCardList
        label="Things"
        items={[{ id: 'a', name: 'A' }]}
        addLabel="Add"
        renderCard={(item) => <span>{item.name}</span>}
        getCompleteness={() => ({ complete: false, incomplete: ['address.city', 'phone'] })}
        completeLabel="Complete"
        incompleteLabel="Incomplete"
      />,
    )
    const pill = screen.getByText('Incomplete')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveAttribute('title', 'address.city, phone')
  })

  it('renders distinct pill states across multiple cards', () => {
    const items = [
      { id: 'a', name: 'A', complete: true },
      { id: 'b', name: 'B', complete: false },
      { id: 'c', name: 'C', complete: true },
    ]
    render(
      <EntityCardList
        label="Things"
        items={items}
        addLabel="Add"
        renderCard={(item) => <span>{item.name}</span>}
        getCompleteness={(item) => ({
          complete: item.complete,
          incomplete: item.complete ? [] : ['x'],
        })}
        completeLabel="Complete"
        incompleteLabel="Incomplete"
      />,
    )
    expect(screen.getAllByText('Complete')).toHaveLength(2)
    expect(screen.getAllByText('Incomplete')).toHaveLength(1)
  })
})
