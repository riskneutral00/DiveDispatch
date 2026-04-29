// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'

type MinimalCompressor = Pick<
  Doc<'compressors'>,
  '_id' | 'name' | 'gasMixes' | 'nitroxMin' | 'nitroxMax'
>

type MinimalVenue = Pick<Doc<'venues'>, '_id' | 'name' | 'kind'>

let boatProfile: Array<Pick<Doc<'boats'>, '_id'>> = []
let compressors: MinimalCompressor[] = []
let venues: MinimalVenue[] = []

const createCompressor = vi.fn().mockResolvedValue(undefined)
const updateCompressor = vi.fn().mockResolvedValue(undefined)
const removeCompressor = vi.fn().mockResolvedValue(undefined)

// mock-ok: component-level jsdom render. Backend behavior of api.compressors.* is covered by tests/compressors.test.ts (convex-test). This suite asserts UI wiring: per-vessel has-compressor checkbox + post-save compressor reconciliation.
const { API_REFS } = vi.hoisted(() => ({
  API_REFS: {
    boats: { mine: { _tag: 'boats.mine' } },
    compressors: {
      mine: { _tag: 'compressors.mine' },
      create: { _tag: 'compressors.create' },
      update: { _tag: 'compressors.update' },
      remove: { _tag: 'compressors.remove' },
    },
    venues: {
      mine: { _tag: 'venues.mine' },
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
      if (tag === 'boats.mine') return boatProfile
      if (tag === 'compressors.mine') return compressors
      if (tag === 'venues.mine') return venues
      if (tag === 'venues.visibleToMe') return venues
      return null
    },
    useMutation: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'compressors.create') return createCompressor
      if (tag === 'compressors.update') return updateCompressor
      if (tag === 'compressors.remove') return removeCompressor
      return vi.fn()
    },
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { BoatFleetSection } from '@/components/profiles/boat-profile-form'

const createBoat = vi.fn().mockResolvedValue('boat-1' as Id<'boats'>)
const updateBoat = vi.fn().mockResolvedValue(undefined)

const baseProps = {
  profile: null,
  me: null,
  create: createBoat,
  update: updateBoat,
  onSaved: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  boatProfile = []
  compressors = []
  venues = []
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

function fillVesselBasics(name: string) {
  const nameInput = screen.getByLabelText(/^boat name/i) as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: name } })

  const typeSelect = screen.getByLabelText(/^boat type/i) as HTMLSelectElement
  fireEvent.change(typeSelect, { target: { value: 'day_boat' } })

  const maxPaxInput = screen.getByLabelText(/max passengers/i) as HTMLInputElement
  fireEvent.change(maxPaxInput, { target: { value: '10' } })
}

describe('BoatFleetSection — venue multi-select populates routes[].venueIds', () => {
  it('submits payload with routes[].venueIds when venues are picked', async () => {
    venues = [
      { _id: 'venue-racha-yai' as Id<'venues'>, name: 'Racha Yai', kind: 'dive_site' },
      { _id: 'venue-racha-noi' as Id<'venues'>, name: 'Racha Noi', kind: 'dive_site' },
    ]

    render(<BoatFleetSection {...baseProps} />)

    fillVesselBasics('M.V. Sea Fun Divers')

    fireEvent.click(screen.getByRole('button', { name: /add route/i }))

    const rachaYai = screen.getByRole('checkbox', { name: /racha yai/i }) as HTMLInputElement
    const rachaNoi = screen.getByRole('checkbox', { name: /racha noi/i }) as HTMLInputElement
    fireEvent.click(rachaYai)
    fireEvent.click(rachaNoi)
    expect(rachaYai.checked).toBe(true)
    expect(rachaNoi.checked).toBe(true)

    const dayButtons = screen.getAllByRole('button', { pressed: false }).filter((b) => /^(mon|tue|wed|thu|fri|sat|sun)/i.test(b.textContent ?? ''))
    if (dayButtons[0]) fireEvent.click(dayButtons[0])

    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createBoat).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })

    const payload = createBoat.mock.calls[0]![0] as { fleet: Array<{ routes?: Array<{ venueIds: string[]; daysOfWeek: number[] }> }> }
    expect(payload.fleet[0].routes).toBeDefined()
    expect(payload.fleet[0].routes![0].venueIds).toEqual(['venue-racha-yai', 'venue-racha-noi'])
    expect(payload.fleet[0].routes![0].daysOfWeek.length).toBeGreaterThan(0)
  })

  it('renders the venue checkbox group only after Add Route', () => {
    venues = [{ _id: 'venue-x' as Id<'venues'>, name: 'Venue X', kind: 'dive_site' }]
    render(<BoatFleetSection {...baseProps} />)
    expect(screen.queryByRole('checkbox', { name: /venue x/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add route/i }))
    expect(screen.getByRole('checkbox', { name: /venue x/i })).toBeTruthy()
  })

  it('excludes pool venues from the route picker', () => {
    venues = [
      { _id: 'venue-pool' as Id<'venues'>, name: 'Training Pool', kind: 'pool' },
      { _id: 'venue-site' as Id<'venues'>, name: 'Sail Rock', kind: 'dive_site' },
    ]
    render(<BoatFleetSection {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add route/i }))
    expect(screen.queryByRole('checkbox', { name: /training pool/i })).toBeNull()
    expect(screen.getByRole('checkbox', { name: /sail rock/i })).toBeInTheDocument()
  })
})

