// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResourceStatusList, type ResourceStatusItem } from '../resource-status-list'

vi.mock('lucide-react', () => ({
  Calendar: (props: Record<string, unknown>) => <svg data-testid="calendar-icon" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="alert-triangle" {...props} />,
  Info: (props: Record<string, unknown>) => <svg data-testid="info" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="check-circle" {...props} />,
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid="alert-circle" {...props} />,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `[${key}]`,
}))

const sampleItem: ResourceStatusItem = {
  id: 'r1',
  primaryText: 'Air Tank 12L #04',
  secondaryText: 'Equipment · Alice Chen',
  badge: { variant: 'success', label: 'Confirmed', dot: true },
}

describe('ResourceStatusList', () => {
  it('items=[] renders EmptyState with translated message', () => {
    render(
      <ResourceStatusList
        items={[]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
      />,
    )
    expect(screen.getByText('[emptyStates.noResources]')).toBeInTheDocument()
  })

  it("variant='list' (default) renders ul with ListRow items", () => {
    const { container } = render(
      <ResourceStatusList
        items={[sampleItem]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
      />,
    )
    const ul = container.querySelector('ul')
    expect(ul).not.toBeNull()
    const li = ul?.querySelector('li')
    expect(li).not.toBeNull()
    expect(li?.className).toContain('glass-container')
  })

  it("variant='card' renders Card per item (no ul wrapper)", () => {
    const { container } = render(
      <ResourceStatusList
        items={[sampleItem]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
        variant="card"
      />,
    )
    expect(container.querySelector('ul')).toBeNull()
    const card = container.querySelector('.glass-container')
    expect(card).not.toBeNull()
  })

  it('renders primaryText + secondaryText + badge', () => {
    render(
      <ResourceStatusList
        items={[sampleItem]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
      />,
    )
    expect(screen.getByText('Air Tank 12L #04')).toBeInTheDocument()
    expect(screen.getByText('Equipment · Alice Chen')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('renders actions slot when provided', () => {
    render(
      <ResourceStatusList
        items={[
          {
            ...sampleItem,
            actions: <button>Accept</button>,
          },
        ]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
      />,
    )
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('globalError renders ErrorAlert above list', () => {
    render(
      <ResourceStatusList
        items={[sampleItem]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
        globalError="Server threw up"
      />,
    )
    expect(screen.getByText('Server threw up')).toBeInTheDocument()
  })

  it('dedupeBy filters duplicate items', () => {
    const items: ResourceStatusItem[] = [
      { id: 'a', primaryText: 'Dup 1' },
      { id: 'a', primaryText: 'Dup 2' },
      { id: 'b', primaryText: 'Unique' },
    ]
    render(
      <ResourceStatusList
        items={items}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
        dedupeBy={(item) => item.id}
      />,
    )
    expect(screen.getByText('Dup 1')).toBeInTheDocument()
    expect(screen.queryByText('Dup 2')).toBeNull()
    expect(screen.getByText('Unique')).toBeInTheDocument()
  })

  it('destructiveNote renders under secondaryText', () => {
    render(
      <ResourceStatusList
        items={[
          {
            ...sampleItem,
            destructiveNote: 'Reason: declined by resource owner',
          },
        ]}
        emptyMessageKey="emptyStates.noResources"
        namespace="booking"
      />,
    )
    expect(screen.getByText('Reason: declined by resource owner')).toBeInTheDocument()
  })
})
