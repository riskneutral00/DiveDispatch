// @vitest-environment jsdom
/**
 * Tests for shared common components extracted from profile forms.
 * One test home for all simple presentational components.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── FormSectionHeader ───────────────────────────────────────────────────────

describe('FormSectionHeader', () => {
  it('renders label as heading', async () => {
    const { FormSectionHeader } = await import('@/components/common/form-section-header')
    render(<FormSectionHeader label="Basic Information" />)
    expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeTruthy()
  })

  it('renders action slot alongside label', async () => {
    const { FormSectionHeader } = await import('@/components/common/form-section-header')
    render(<FormSectionHeader label="Affiliations" action={<button>+ Add</button>} />)
    expect(screen.getByRole('heading', { name: 'Affiliations' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add' })).toBeTruthy()
  })

  it('accepts ReactNode as label', async () => {
    const { FormSectionHeader } = await import('@/components/common/form-section-header')
    render(<FormSectionHeader label={<span data-testid="custom">Custom Label</span>} />)
    expect(screen.getByTestId('custom')).toBeTruthy()
  })
})

// ── PillToggle ──────────────────────────────────────────────────────────────

describe('PillToggle', () => {
  it('renders checkbox with label', async () => {
    const { PillToggle } = await import('@/components/common/pill-toggle')
    render(<PillToggle label="Deep" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Deep' })).toBeTruthy()
  })

  it('calls onChange when clicked', async () => {
    const { PillToggle } = await import('@/components/common/pill-toggle')
    let toggled = false
    render(<PillToggle label="Wreck" checked={false} onChange={() => { toggled = true }} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wreck' }))
    expect(toggled).toBe(true)
  })

  it('disables checkbox when locked', async () => {
    const { PillToggle } = await import('@/components/common/pill-toggle')
    render(<PillToggle label="Navigation" checked={true} locked onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Navigation' })).toBeDisabled()
  })
})

// ── PillToggleGroup ─────────────────────────────────────────────────────────

describe('PillToggleGroup', () => {
  it('renders children and shows More button when overflow provided', async () => {
    const { PillToggleGroup, PillToggle } = await import('@/components/common/pill-toggle')
    render(
      <PillToggleGroup overflowItems={<PillToggle label="Hidden" checked={false} onChange={() => {}} />}>
        <PillToggle label="Visible" checked={false} onChange={() => {}} />
      </PillToggleGroup>
    )
    expect(screen.getByRole('checkbox', { name: 'Visible' })).toBeTruthy()
    expect(screen.getByText('More…')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Hidden' })).toBeNull()
  })

  it('reveals overflow items when More is clicked', async () => {
    const { PillToggleGroup, PillToggle } = await import('@/components/common/pill-toggle')
    render(
      <PillToggleGroup overflowItems={<PillToggle label="Hidden" checked={false} onChange={() => {}} />}>
        <PillToggle label="Visible" checked={false} onChange={() => {}} />
      </PillToggleGroup>
    )
    fireEvent.click(screen.getByText('More…'))
    expect(screen.getByRole('checkbox', { name: 'Hidden' })).toBeTruthy()
    // More… button stays visible (dropdown toggle, not inline expansion)
    expect(screen.getByText('More…')).toBeTruthy()
  })
})

// ── ItemCard ────────────────────────────────────────────────────────────────

describe('ItemCard', () => {
  it('renders children', async () => {
    const { ItemCard } = await import('@/components/common/item-card')
    render(<ItemCard><p>Content</p></ItemCard>)
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('shows remove button when onRemove and canRemove are provided', async () => {
    const { ItemCard } = await import('@/components/common/item-card')
    render(<ItemCard onRemove={() => {}} canRemove aria-label="Remove item"><p>Content</p></ItemCard>)
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeTruthy()
  })

  it('hides remove button when canRemove is false', async () => {
    const { ItemCard } = await import('@/components/common/item-card')
    render(<ItemCard onRemove={() => {}} canRemove={false}><p>Content</p></ItemCard>)
    expect(screen.queryByRole('button', { name: 'Remove item' })).toBeNull()
  })

  it('calls onRemove when remove button clicked', async () => {
    const { ItemCard } = await import('@/components/common/item-card')
    let removed = false
    render(<ItemCard onRemove={() => { removed = true }} canRemove><p>Content</p></ItemCard>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }))
    expect(removed).toBe(true)
  })
})

// ── SaveButton ──────────────────────────────────────────────────────────────

describe('SaveButton', () => {
  it('shows Save for update mode', async () => {
    const { SaveButton } = await import('@/components/common/save-button')
    render(<SaveButton saving={false} saved={false} isDirty={true} isUpdate={true} />)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('shows Create Profile for create mode', async () => {
    const { SaveButton } = await import('@/components/common/save-button')
    render(<SaveButton saving={false} saved={false} isDirty={true} isUpdate={false} />)
    expect(screen.getByText('Create Profile')).toBeTruthy()
  })

  it('shows Saved when saved is true', async () => {
    const { SaveButton } = await import('@/components/common/save-button')
    render(<SaveButton saving={false} saved={true} isDirty={false} isUpdate={true} />)
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('disables when not dirty in update mode', async () => {
    const { SaveButton } = await import('@/components/common/save-button')
    render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={true} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

// ── EmptyState ──────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders message text', async () => {
    const { EmptyState } = await import('@/components/common/empty-state')
    render(<EmptyState message="No affiliations added." />)
    expect(screen.getByText('No affiliations added.')).toBeTruthy()
  })
})
