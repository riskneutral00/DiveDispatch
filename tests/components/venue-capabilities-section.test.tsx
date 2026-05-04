// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'

const createVenue = vi.fn().mockResolvedValue('venue-new' as Id<'venues'>)
const updateVenue = vi.fn().mockResolvedValue(undefined)
const removeVenue = vi.fn().mockResolvedValue(undefined)
const createCompressor = vi.fn().mockResolvedValue(undefined)
const updateCompressor = vi.fn().mockResolvedValue(undefined)
const removeCompressor = vi.fn().mockResolvedValue(undefined)

type MinimalVenue = Pick<
  Doc<'venues'>,
  | '_id'
  | '_creationTime'
  | 'name'
  | 'kind'
  | 'features'
  | 'maxDepth'
  | 'maxCapacity'
  | 'confinedCapable'
  | 'address'
  | 'isAllowed'
  | 'notAllowed'
  | 'email'
  | 'phone'
  | 'lat'
  | 'lng'
>

type MinimalCompressor = Pick<
  Doc<'compressors'>,
  '_id' | 'name' | 'gasMixes' | 'nitroxMin' | 'nitroxMax'
>

let venues: MinimalVenue[] = []
let compressors: MinimalCompressor[] = []
const diveCenters = [{ slug: 'dc-alpha', name: 'Alpha Divers' }]

const { API_REFS } = vi.hoisted(() => {
  const stub = (tag: string) => ({ _tag: tag })
  const moduleStub = (m: string, fns: string[]) =>
    Object.fromEntries(fns.map((f) => [f, stub(`${m}.${f}`)]))
  const roleApi = ['mine', 'create', 'update']
  return {
    API_REFS: {
      diveCenters: moduleStub('diveCenters', roleApi),
      agents: moduleStub('agents', roleApi),
      diveStaff: moduleStub('diveStaff', roleApi),
      boats: moduleStub('boats', roleApi),
      equipment: moduleStub('equipment', roleApi),
      compressors: { ...moduleStub('compressors', roleApi), remove: stub('compressors.remove') },
      venues: { ...moduleStub('venues', roleApi), remove: stub('venues.remove') },
      directory: {
        listByRole: stub('directory.listByRole'),
      },
      users: {
        inheritedContactDefaults: stub('users.inheritedContactDefaults'),
      },
    },
  }
})

vi.mock('@/lib/convex-generated', () => ({
  api: API_REFS,
}))

// mock-ok: component-level jsdom render. Backend behavior of api.venues.{mine,create,update} is covered by tests/venues.test.ts (convex-test). This suite asserts UI wiring: features[] CheckboxGroup, Badge rendering, and hasCompressorOnSite reconciliation against api.compressors.*.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'venues.mine') return venues
      if (tag === 'compressors.mine') return compressors
      if (tag === 'directory.listByRole') return diveCenters
      return null
    },
    useMutation: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'venues.create') return createVenue
      if (tag === 'venues.update') return updateVenue
      if (tag === 'venues.remove') return removeVenue
      if (tag === 'compressors.create') return createCompressor
      if (tag === 'compressors.update') return updateCompressor
      if (tag === 'compressors.remove') return removeCompressor
      return vi.fn()
    },
  }
})

vi.mock('@/components/profiles/location-picker', () => ({
  LocationPicker: ({
    value,
    onChange,
  }: {
    value: unknown
    onChange: (v: unknown) => void
  }) => (
    <button
      data-testid="location-picker"
      data-has-value={value !== null ? 'yes' : 'no'}
      onClick={() =>
        onChange({ address: { city: 'Koh Tao', country: 'TH' }, lat: 10, lng: 99 })
      }
    >
      Pick Location
    </button>
  ),
}))

import { VenueCapabilitiesSection } from '@/components/profiles/venue-capabilities-section'
import { VENUE_SIGNUP_INTENT_STORAGE_KEY } from '@/lib/constants/signup-role-tiles'

function baseVenue(overrides: Partial<MinimalVenue> = {}): MinimalVenue {
  return {
    _id: 'venue1' as Doc<'venues'>['_id'],
    _creationTime: 1_700_000_000_000,
    name: 'Sea Fun Pool',
    kind: 'pool',
    features: [],
    maxDepth: 3,
    maxCapacity: 10,
    confinedCapable: true,
    address: { city: 'Koh Tao', country: 'TH' },
    isAllowed: [],
    notAllowed: [],
    email: 'venue@test.com',
    phone: '+66100000050',
    lat: 10.09,
    lng: 99.84,
    ...overrides,
  }
}

const baseProps = {
  profile: null,
  me: null,
  create: vi.fn(),
  update: vi.fn(),
  onSaved: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  venues = []
  compressors = []
  createVenue.mockResolvedValue('venue-new' as Id<'venues'>)
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

describe('VenueCapabilitiesSection — empty pre-seed', () => {
  it('renders one expanded draft pool row when no venues exist', () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)
    expect(screen.getByLabelText(/pool name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max depth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max capacity/i)).toBeInTheDocument()
  })

  it('does not pre-seed a draft when at least one pool exists; existing card stays collapsed', () => {
    venues = [baseVenue({ kind: 'pool', name: 'Existing Pool' })]
    render(<VenueCapabilitiesSection {...baseProps} />)
    expect(screen.getByText('Existing Pool')).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })
})

describe('VenueCapabilitiesSection — Dive Site sub-tab is selectable', () => {
  it('Dive Site sub-tab renders without aria-disabled', () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)
    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    expect(diveSiteTab).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('clicking the Dive Site sub-tab switches activeTab and pre-seeds a dive_site draft', () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)
    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    fireEvent.click(diveSiteTab)
    expect(diveSiteTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByLabelText(/dive site name/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
    expect(screen.queryByLabelText(/max capacity/i)).toBeNull()
  })

  it('switching back from Dive Site to Pool restores the pool draft', () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)
    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    const poolTab = screen.getByRole('tab', { name: /^pool$/i })
    fireEvent.click(diveSiteTab)
    expect(screen.getByLabelText(/dive site name/i)).toBeInTheDocument()
    fireEvent.click(poolTab)
    expect(screen.getByLabelText(/pool name/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/dive site name/i)).toBeNull()
  })

  it('existing single dive_site row lands on Dive Site tab on first render (no click required)', () => {
    venues = [baseVenue({ kind: 'dive_site', name: 'Reef Site' })]
    render(<VenueCapabilitiesSection {...baseProps} />)
    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    expect(diveSiteTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Reef Site')).toBeInTheDocument()
    const poolTab = screen.getByRole('tab', { name: /^pool$/i })
    fireEvent.click(poolTab)
    expect(screen.queryByText('Reef Site')).toBeNull()
  })
})

describe('VenueCapabilitiesSection — remediation: initial-tab precedence', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('valid stored intent + no rows selects matching tab and renders one matching draft', () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    expect(diveSiteTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByLabelText(/dive site name/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })

  it('only pool rows exist forces pool tab even when stale intent says dive_site', () => {
    venues = [baseVenue({ kind: 'pool', name: 'My Pool' })]
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    const poolTab = screen.getByRole('tab', { name: /^pool$/i })
    expect(poolTab.getAttribute('aria-selected')).toBe('true')
  })

  it('both kinds + valid stored intent uses intent', () => {
    venues = [
      baseVenue({ _id: 'v1' as Doc<'venues'>['_id'], kind: 'pool', name: 'My Pool' }),
      baseVenue({ _id: 'v2' as Doc<'venues'>['_id'], kind: 'dive_site', name: 'My Site' }),
    ]
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    expect(diveSiteTab.getAttribute('aria-selected')).toBe('true')
  })

  it('both kinds + no intent defaults to pool', () => {
    venues = [
      baseVenue({ _id: 'v1' as Doc<'venues'>['_id'], kind: 'pool', name: 'My Pool' }),
      baseVenue({ _id: 'v2' as Doc<'venues'>['_id'], kind: 'dive_site', name: 'My Site' }),
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    const poolTab = screen.getByRole('tab', { name: /^pool$/i })
    expect(poolTab.getAttribute('aria-selected')).toBe('true')
  })
})

describe('VenueCapabilitiesSection — remediation: draft inheritance precedence', () => {
  it('latest same-kind row inherits email/phone/location into a new pool draft (name not copied)', () => {
    venues = [
      baseVenue({
        _id: 'v-old' as Doc<'venues'>['_id'],
        _creationTime: 1_700_000_000_000,
        kind: 'pool',
        name: 'Old Pool',
        email: 'old@test.com',
        phone: '+66100000111',
      }),
      baseVenue({
        _id: 'v-latest' as Doc<'venues'>['_id'],
        _creationTime: 1_700_000_500_000,
        kind: 'pool',
        name: 'Latest Pool',
        email: 'latest@test.com',
        phone: '+66100000222',
      }),
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add pool/i }))

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput.value).toBe('latest@test.com')

    const phoneInputs = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneInputs.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    expect(phoneInput.value.length).toBeGreaterThan(0)
    expect(phoneInput.value).not.toBe('')
  })

  it('falls back to latest any-kind row when no same-kind row exists', () => {
    venues = [
      baseVenue({
        _id: 'v-pool' as Doc<'venues'>['_id'],
        _creationTime: 1_700_000_500_000,
        kind: 'pool',
        name: 'My Pool',
        email: 'pool@test.com',
        phone: '+66100000333',
      }),
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    fireEvent.click(diveSiteTab)

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput.value).toBe('pool@test.com')

    const nameInput = screen.getByLabelText(/dive site name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')

    expect(screen.queryByLabelText(/max capacity/i)).toBeNull()
  })

  it('no prior rows falls back to inherited contact defaults only', () => {
    venues = []

    render(<VenueCapabilitiesSection {...baseProps} />)

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput.value).toBe('')
  })
})

describe('VenueCapabilitiesSection — remediation: auto-seed lifecycle', () => {
  it('successful create does not spawn a phantom blank draft before query refresh', async () => {
    venues = []

    render(<VenueCapabilitiesSection {...baseProps} />)

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Pool' } })
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'pool@test.com' } })
    const phoneInputs = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneInputs.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '+66100000077' } })
    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))
    const depthInput = screen.getByLabelText(/max depth/i) as HTMLInputElement
    fireEvent.change(depthInput, { target: { value: '5' } })
    fireEvent.blur(depthInput)
    const capacityInput = screen.getByLabelText(/max capacity/i) as HTMLInputElement
    fireEvent.change(capacityInput, { target: { value: '10' } })
    fireEvent.blur(capacityInput)

    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    await new Promise((r) => setTimeout(r, 0))

    expect(createVenue).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })

  it('post-create phantom suppression: re-rendering with the saved row produces no duplicate draft', async () => {
    venues = []

    const { rerender } = render(<VenueCapabilitiesSection {...baseProps} />)

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Pool' } })
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'pool@test.com' } })
    const phoneInputs = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneInputs.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '+66100000077' } })
    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))
    const depthInput = screen.getByLabelText(/max depth/i) as HTMLInputElement
    fireEvent.change(depthInput, { target: { value: '5' } })
    fireEvent.blur(depthInput)
    const capacityInput = screen.getByLabelText(/max capacity/i) as HTMLInputElement
    fireEvent.change(capacityInput, { target: { value: '10' } })
    fireEvent.blur(capacityInput)

    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    await new Promise((r) => setTimeout(r, 0))

    venues = [baseVenue({ kind: 'pool', name: 'New Pool' })]
    rerender(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.getByText('New Pool')).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })

  it('removing a non-last row does not duplicate any blank draft', async () => {
    venues = [
      baseVenue({ _id: 'v1' as Doc<'venues'>['_id'], kind: 'pool', name: 'Pool A' }),
      baseVenue({ _id: 'v2' as Doc<'venues'>['_id'], kind: 'pool', name: 'Pool B' }),
    ]

    const { rerender } = render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.getByText('Pool A')).toBeInTheDocument()
    expect(screen.getByText('Pool B')).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()

    venues = [baseVenue({ _id: 'v2' as Doc<'venues'>['_id'], kind: 'pool', name: 'Pool B' })]
    rerender(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.queryByText('Pool A')).toBeNull()
    expect(screen.getByText('Pool B')).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })

  it('removing the last row reseeds exactly one fresh draft once state settles', async () => {
    venues = [baseVenue({ kind: 'pool', name: 'Lonely Pool' })]

    const { rerender } = render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.queryByLabelText(/pool name/i)).toBeNull()

    venues = []
    rerender(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.getAllByLabelText(/pool name/i)).toHaveLength(1)
  })
})

describe('VenueCapabilitiesSection — dive_site create via inline Save', () => {
  it('per-card Save dispatches venues.create with kind: "dive_site"', async () => {
    venues = []

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    fireEvent.click(diveSiteTab)

    const nameInput = screen.getByLabelText(/dive site name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Reef Paradise' } })

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'site@test.com' } })

    const phoneLabels = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneLabels.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '+66100000077' } })

    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))

    const depthInput = screen.getByLabelText(/max depth/i) as HTMLInputElement
    fireEvent.change(depthInput, { target: { value: '30' } })
    fireEvent.blur(depthInput)

    expect(screen.queryByLabelText(/max capacity/i)).toBeNull()

    const saveButton = screen.getByRole('button', { name: /save item/i })
    fireEvent.click(saveButton)

    await new Promise((r) => setTimeout(r, 0))

    expect(createVenue).toHaveBeenCalledTimes(1)
    const payload = createVenue.mock.calls[0]![0] as { kind: string; name: string; maxCapacity?: number }
    expect(payload.kind).toBe('dive_site')
    expect(payload.name).toBe('Reef Paradise')
    expect(payload.maxCapacity).toBeUndefined()
  })

  it('editing an existing dive_site row dispatches venues.update without kind flip', async () => {
    venues = [baseVenue({ kind: 'dive_site', name: 'Existing Site' })]

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    fireEvent.click(diveSiteTab)

    fireEvent.click(screen.getByRole('button', { name: /^expand$/i }))

    const nameInput = screen.getByLabelText(/dive site name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Renamed Site' } })

    const saveButton = screen.getByRole('button', { name: /save item/i })
    fireEvent.click(saveButton)

    await new Promise((r) => setTimeout(r, 0))

    expect(updateVenue).toHaveBeenCalledTimes(1)
    const payload = updateVenue.mock.calls[0]![0] as { kind: string; name: string; venueId: string }
    expect(payload.kind).toBe('dive_site')
    expect(payload.name).toBe('Renamed Site')
  })
})

describe('VenueCapabilitiesSection — pool create via inline Save', () => {
  it('per-card Save dispatches venues.create with kind: "pool"', async () => {
    venues = []

    render(<VenueCapabilitiesSection {...baseProps} />)

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Pool' } })

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'pool@test.com' } })

    const phoneLabels = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneLabels.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '+66100000099' } })

    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))

    const depthInput = screen.getByLabelText(/max depth/i) as HTMLInputElement
    fireEvent.change(depthInput, { target: { value: '5' } })
    fireEvent.blur(depthInput)

    const capacityInput = screen.getByLabelText(/max capacity/i) as HTMLInputElement
    fireEvent.change(capacityInput, { target: { value: '10' } })
    fireEvent.blur(capacityInput)

    const saveButton = screen.getByRole('button', { name: /save item/i })
    fireEvent.click(saveButton)

    await new Promise((r) => setTimeout(r, 0))

    expect(createVenue).toHaveBeenCalledTimes(1)
    const payload = createVenue.mock.calls[0]![0] as { kind: string; name: string }
    expect(payload.kind).toBe('pool')
    expect(payload.name).toBe('New Pool')
  })
})



describe('VenueCapabilitiesSection — signup intent consumption', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('seeds active sub-tab from "pool" intent when no venues exist', () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')

    render(<VenueCapabilitiesSection {...baseProps} />)

    const poolTab = screen.getByRole('tab', { name: /pool/i })
    expect(poolTab.getAttribute('aria-selected')).toBe('true')
  })

  it('seeds active sub-tab from "dive_site" intent when no venues exist', () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    const diveSiteTab = screen.getByRole('tab', { name: /dive site/i })
    expect(diveSiteTab.getAttribute('aria-selected')).toBe('true')
  })

  it('renders dive site form fields when "dive_site" intent is stored', async () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    await new Promise((r) => setTimeout(r, 0))

    expect(screen.getByLabelText(/dive site name/i)).toBeInTheDocument()
  })

  it('does not pre-seed an extra draft when intent kind already has a venue row', () => {
    venues = [baseVenue({ kind: 'pool', name: 'Existing Pool' })]
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')

    render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.getByText('Existing Pool')).toBeInTheDocument()
    expect(screen.queryByLabelText(/pool name/i)).toBeNull()
  })

  it('clears stored intent immediately when a matching venue row already exists (no sticky state)', async () => {
    venues = [baseVenue({ kind: 'pool' })]
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')

    render(<VenueCapabilitiesSection {...baseProps} />)

    await new Promise((r) => setTimeout(r, 0))

    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe(null)
  })

  it('clears stored "dive_site" intent immediately when a matching dive_site row already exists', async () => {
    venues = [baseVenue({ kind: 'dive_site' })]
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'dive_site')

    render(<VenueCapabilitiesSection {...baseProps} />)

    await new Promise((r) => setTimeout(r, 0))

    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe(null)
  })

  it('ignores invalid stored intent value (no dive site form, pool draft still pre-seeded)', () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'garbage')

    render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.queryByLabelText(/dive site name/i)).toBeNull()
    expect(screen.getByLabelText(/pool name/i)).toBeInTheDocument()
  })

  it('clears stored intent after a successful inline Save', async () => {
    venues = []
    window.sessionStorage.setItem(VENUE_SIGNUP_INTENT_STORAGE_KEY, 'pool')

    render(<VenueCapabilitiesSection {...baseProps} />)

    await new Promise((r) => setTimeout(r, 0))

    const nameInput = screen.getByLabelText(/pool name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Auto Pool' } })
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'pool@test.com' } })
    const phoneLabels = screen.getAllByLabelText(/phone/i)
    const phoneInput = phoneLabels.find((el) => (el as HTMLInputElement).type === 'tel') as HTMLInputElement
    fireEvent.change(phoneInput, { target: { value: '+66100000077' } })
    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))
    const depthInput = screen.getByLabelText(/max depth/i) as HTMLInputElement
    fireEvent.change(depthInput, { target: { value: '5' } })
    fireEvent.blur(depthInput)
    const capacityInput = screen.getByLabelText(/max capacity/i) as HTMLInputElement
    fireEvent.change(capacityInput, { target: { value: '10' } })
    fireEvent.blur(capacityInput)

    const saveButton = screen.getByRole('button', { name: /save item/i })
    fireEvent.click(saveButton)

    await new Promise((r) => setTimeout(r, 0))

    expect(createVenue).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(VENUE_SIGNUP_INTENT_STORAGE_KEY)).toBe(null)
  })
})
