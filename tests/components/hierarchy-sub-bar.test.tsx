// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../helpers/render'

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockRoles: Array<{ _id: string; role: string; createdAt: number }> | undefined

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: () => mockRoles,
  }
})

// ─── Import after mocks ─────────────────────────────────────────────────────
import { HierarchySubBar } from '@/components/layout/hierarchy-sub-bar'

function R(role: string, createdAt: number, id: string) {
  return { _id: id, role, createdAt }
}

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
    mockRoles = [R('DiveCenter', 1, 'a')]

    const { container } = render(
      <HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders operator then resources with a divider when both sides exist', () => {
    mockRoles = [
      R('DiveCenter', 100, 'a'),
      R('Boat', 200, 'b'),
      R('Pool', 300, 'c'),
      R('Equipment', 400, 'd'),
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    expect(screen.getByTestId('hierarchy-sub-bar')).toBeInTheDocument()
    expect(screen.getByTestId('role-hierarchy-divider')).toBeInTheDocument()
    expect(screen.getByLabelText('Dive Center')).toBeInTheDocument()
    expect(screen.getByLabelText('Boat')).toBeInTheDocument()
    expect(screen.getByLabelText('Pool')).toBeInTheDocument()
    expect(screen.getByLabelText('Equipment')).toBeInTheDocument()

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Dive Center',
      'Boat',
      'Pool',
      'Equipment',
    ])
  })

  it('renders two operators with no divider', () => {
    mockRoles = [R('DiveCenter', 100, 'a'), R('Agent', 200, 'b')]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    expect(screen.queryByTestId('role-hierarchy-divider')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dive Center')).toBeInTheDocument()
    expect(screen.getByLabelText('Agent')).toBeInTheDocument()
  })

  it('renders two resources with no divider', () => {
    mockRoles = [R('Instructor', 100, 'a'), R('Boat', 200, 'b')]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="instructor" />)

    expect(screen.queryByTestId('role-hierarchy-divider')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Instructor')).toBeInTheDocument()
    expect(screen.getByLabelText('Boat')).toBeInTheDocument()
  })

  it('orders roles by createdAt within each group (append order)', () => {
    mockRoles = [
      R('Equipment', 500, 'e'),
      R('DiveCenter', 100, 'a'),
      R('Boat', 300, 'c'),
    ]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Dive Center',
      'Boat',
      'Equipment',
    ])
  })

  it('marks active role with aria-current="page"', () => {
    mockRoles = [R('DiveCenter', 100, 'a'), R('Boat', 200, 'b')]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const dcLink = screen.getByLabelText('Dive Center')
    const boatLink = screen.getByLabelText('Boat')

    expect(dcLink).toHaveAttribute('aria-current', 'page')
    expect(boatLink).not.toHaveAttribute('aria-current')
  })

  it('generates correct navigation hrefs using shared slug', () => {
    mockRoles = [R('DiveCenter', 100, 'a'), R('Equipment', 200, 'b')]

    render(<HierarchySubBar slug="n7rq5j" roleSlug="dive-center" />)

    const dcLink = screen.getByLabelText('Dive Center')
    const eqLink = screen.getByLabelText('Equipment')

    expect(dcLink).toHaveAttribute('href', '/n7rq5j/dive-center/dashboard')
    expect(eqLink).toHaveAttribute('href', '/n7rq5j/equipment/dashboard')
  })
})
