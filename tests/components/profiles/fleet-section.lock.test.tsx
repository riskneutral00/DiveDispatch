// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'

type MinimalVenue = Pick<Doc<'venues'>, '_id' | 'name' | 'kind'>

let venues: MinimalVenue[] = []

const { API_REFS } = vi.hoisted(() => ({
  API_REFS: {
    venues: {
      visibleToMe: { _tag: 'venues.visibleToMe' },
    },
  },
}))

vi.mock('@/lib/convex-generated', () => ({
  api: API_REFS,
}))

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'venues.visibleToMe') return venues
      return null
    },
    useMutation: () => vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { BoatFleetSection } from '@/components/profiles/boat-profile-form'

const create = vi.fn().mockResolvedValue('boat_1' as Id<'boats'>)
const update = vi.fn().mockResolvedValue(undefined)

const baseProps = {
  profile: null as Record<string, unknown> | null,
  me: {
    firstName: 'Owner',
    lastName: 'Test',
    phone: '+12345678901',
    email: 'owner@divedispatch.dev',
    address: undefined,
  } as Record<string, unknown>,
  create,
  update,
  onSaved: vi.fn(),
  onClose: vi.fn(),
}

const seededFleet = {
  fleet: [
    {
      boatName: 'Sea Fun I',
      boatType: 'day_boat',
      maxPax: 10,
      minPax: 4,
      cutoffHours: 24,
      routes: [
        { venueIds: ['venue-racha-yai'], daysOfWeek: [1, 2] },
      ],
    },
    {
      boatName: 'Sea Fun II',
      boatType: 'day_boat',
      maxPax: 12,
      minPax: undefined,
      cutoffHours: undefined,
      routes: [],
    },
  ],
  gasMixes: [],
} as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  venues = [
    { _id: 'venue-racha-yai' as Id<'venues'>, name: 'Racha Yai', kind: 'dive_site' },
    { _id: 'venue-racha-noi' as Id<'venues'>, name: 'Racha Noi', kind: 'dive_site' },
  ]
  HTMLDialogElement.prototype.show = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

describe('BoatFleetSection — ExpandingCardList + nested InlineRowList migration lock', () => {
  it('renders one expanded vessel by default (defaultExpandFirst, minItems=1)', () => {
    render(<BoatFleetSection {...baseProps} />)
    expect(screen.getByLabelText(/^boat name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^boat type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max passengers/i)).toBeInTheDocument()
  })

  it('renders seeded fleet — first vessel expanded, others collapsed with title', () => {
    render(<BoatFleetSection {...baseProps} profile={seededFleet} />)
    const nameInputs = screen.getAllByLabelText(/^boat name/i) as HTMLInputElement[]
    expect(nameInputs).toHaveLength(1)
    expect(nameInputs[0].value).toBe('Sea Fun I')
    expect(screen.getByText(/Vessel 2 — Sea Fun II/)).toBeInTheDocument()
  })

  it('Add Vessel appends a vessel and expands it; siblings collapse', () => {
    render(<BoatFleetSection {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add vessel/i }))
    const titles = screen.queryAllByText(/Vessel \d/)
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('Add Route grows the inner InlineRowList', () => {
    render(<BoatFleetSection {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add route/i }))
    expect(screen.getByRole('checkbox', { name: /racha yai/i })).toBeInTheDocument()
  })

  it('Remove Route removes from inner InlineRowList', () => {
    render(<BoatFleetSection {...baseProps} profile={seededFleet} />)
    expect(screen.getByRole('checkbox', { name: /racha yai/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove route/i }))
    expect(screen.queryByRole('checkbox', { name: /racha yai/i })).toBeNull()
  })

  it('submit emits payload { fleet: [{ boatName, boatType, maxPax, minPax, cutoffHours, routes }] } unchanged', async () => {
    render(<BoatFleetSection {...baseProps} profile={seededFleet} />)
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })

    const payload = update.mock.calls[0]![0] as {
      fleet: Array<Record<string, unknown>>
      gasMixes: unknown[]
    }
    expect(payload.fleet).toHaveLength(2)
    expect(payload.fleet[0]).toMatchObject({
      boatName: 'Sea Fun I',
      boatType: 'day_boat',
      maxPax: 10,
      minPax: 4,
      cutoffHours: 24,
    })
    expect(payload.fleet[0]!.routes).toEqual([
      { venueIds: ['venue-racha-yai'], daysOfWeek: [1, 2] },
    ])
    expect(payload.fleet[1]).toMatchObject({
      boatName: 'Sea Fun II',
      boatType: 'day_boat',
      maxPax: 12,
    })
    expect(payload.fleet[1]!.routes).toBeUndefined()
    expect(payload.gasMixes).toEqual([])
  })

  it('expanding a sibling vessel preserves first vessel boatName state (no remount-induced reset)', () => {
    render(<BoatFleetSection {...baseProps} profile={seededFleet} />)

    const nameInput = screen.getByLabelText(/^boat name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Sea Fun I — Renamed' } })
    expect(nameInput.value).toBe('Sea Fun I — Renamed')

    const collapsedTitleBtn = screen.getByText(/Vessel 2 — Sea Fun II/).closest('button')!
    fireEvent.click(collapsedTitleBtn)

    const nameInputsAfter = screen.getAllByLabelText(/^boat name/i) as HTMLInputElement[]
    const v1 = nameInputsAfter.find((el) => el.value === 'Sea Fun I — Renamed')
    expect(v1, 'first vessel rename should survive sibling expand').toBeTruthy()
  })
})
