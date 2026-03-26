// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockRoles: Array<{ role: string }> | undefined

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockRoles,
  }
})

// ─── Import after mocks ─────────────────────────────────────────────────────
import { HierarchySubBar } from '@/components/dashboard/hierarchy-sub-bar'

beforeEach(() => {
  vi.clearAllMocks()
  mockRoles = undefined
})

describe('HierarchySubBar', () => {
  it('renders nothing while roles are loading', () => {
    mockRoles = undefined

    const { container } = render(
      <HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when user has only one role', () => {
    mockRoles = [{ role: 'DiveCenter' }]

    const { container } = render(
      <HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders role icons for multi-role user', () => {
    mockRoles = [
      { role: 'DiveCenter' },
      { role: 'Boat' },
      { role: 'Pool' },
      { role: 'Equipment' },
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    expect(screen.getByLabelText('Dive Center')).toBeInTheDocument()
    expect(screen.getByLabelText('Boat')).toBeInTheDocument()
    expect(screen.getByLabelText('Pool')).toBeInTheDocument()
    expect(screen.getByLabelText('Equipment')).toBeInTheDocument()
  })

  it('marks active role with aria-current="page"', () => {
    mockRoles = [
      { role: 'DiveCenter' },
      { role: 'Boat' },
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const dcLink = screen.getByLabelText('Dive Center')
    const boatLink = screen.getByLabelText('Boat')

    expect(dcLink).toHaveAttribute('aria-current', 'page')
    expect(boatLink).not.toHaveAttribute('aria-current')
  })

  it('generates correct navigation hrefs using shared slug', () => {
    mockRoles = [
      { role: 'DiveCenter' },
      { role: 'Equipment' },
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const dcLink = screen.getByLabelText('Dive Center')
    const eqLink = screen.getByLabelText('Equipment')

    expect(dcLink).toHaveAttribute('href', '/n7rq5j/dive-center/dashboard')
    expect(eqLink).toHaveAttribute('href', '/n7rq5j/equipment/dashboard')
  })

  it('places highest-precedence role first', () => {
    mockRoles = [
      { role: 'Equipment' },
      { role: 'DiveCenter' },
      { role: 'Boat' },
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('aria-label', 'Dive Center')
  })
})
