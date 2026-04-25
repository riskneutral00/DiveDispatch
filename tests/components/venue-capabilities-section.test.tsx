// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'
import type { VenueFeature } from '@/lib/constants/venue-subtypes'

const createVenue = vi.fn().mockResolvedValue('venue-new' as Id<'venues'>)
const updateVenue = vi.fn().mockResolvedValue(undefined)
const removeVenue = vi.fn().mockResolvedValue(undefined)
const createCompressor = vi.fn().mockResolvedValue(undefined)
const updateCompressor = vi.fn().mockResolvedValue(undefined)
const removeCompressor = vi.fn().mockResolvedValue(undefined)

type MinimalVenue = Pick<
  Doc<'venues'>,
  | '_id'
  | 'name'
  | 'kind'
  | 'features'
  | 'maxDepth'
  | 'maxCapacity'
  | 'confinedCapable'
  | 'address'
  | 'isAllowed'
  | 'notAllowed'
>

type MinimalCompressor = Pick<
  Doc<'compressors'>,
  '_id' | 'name' | 'location' | 'venueId' | 'boatId' | 'gasMixes' | 'nitroxMin' | 'nitroxMax'
>

let venues: MinimalVenue[] = []
let compressors: MinimalCompressor[] = []
const diveCenters = [{ slug: 'dc-alpha', name: 'Alpha Divers' }]

const { API_REFS } = vi.hoisted(() => ({
  API_REFS: {
    venues: {
      mine: { _tag: 'venues.mine' },
      create: { _tag: 'venues.create' },
      update: { _tag: 'venues.update' },
      remove: { _tag: 'venues.remove' },
    },
    compressors: {
      mine: { _tag: 'compressors.mine' },
      create: { _tag: 'compressors.create' },
      update: { _tag: 'compressors.update' },
      remove: { _tag: 'compressors.remove' },
    },
    directory: {
      listByRole: { _tag: 'directory.listByRole' },
    },
  },
}))

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

vi.mock('@/components/profiles/location-picker-lazy', () => ({
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

import {
  VenueCapabilitiesSection,
  venueCapabilitiesFromProfile,
  venueCapabilitiesToPayload,
  INITIAL_VENUE_CAPABILITIES_FORM,
  type VenueCapabilitiesFormState,
} from '@/components/profiles/venue-capabilities-section'
import { venueCapabilitiesSchema } from '@/lib/schemas/profile-shared'

function baseVenue(overrides: Partial<MinimalVenue> = {}): MinimalVenue {
  return {
    _id: 'venue1' as Doc<'venues'>['_id'],
    name: 'Sea Fun Pool',
    kind: 'pool',
    features: [],
    maxDepth: 3,
    maxCapacity: 10,
    confinedCapable: true,
    address: { city: 'Koh Tao', country: 'TH' },
    isAllowed: [],
    notAllowed: [],
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

describe('VenueCapabilitiesSection — feature badges', () => {
  it('renders feature chips when venue.features is non-empty', () => {
    venues = [
      baseVenue({
        name: 'Reef Pool',
        features: ['reef', 'wreck'] as VenueFeature[],
      }),
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.getByText('Reef')).toBeTruthy()
    expect(screen.getByText('Wreck')).toBeTruthy()
  })

  it('does not render feature row when venue.features is empty', () => {
    venues = [baseVenue({ features: [] })]

    render(<VenueCapabilitiesSection {...baseProps} />)

    expect(screen.queryByText('Reef')).toBeNull()
    expect(screen.queryByText('Wreck')).toBeNull()
  })
})

describe('VenueCapabilitiesSection — create payload includes features', () => {
  it('submits features selected in the dialog', async () => {
    venues = []

    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))

    const nameInput = screen.getByLabelText(/venue name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Dive Site' } })

    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))

    const kindSelect = screen.getByLabelText(/venue type/i) as HTMLSelectElement
    fireEvent.change(kindSelect, { target: { value: 'dive_site' } })

    const featuresGroup = screen.getByRole('group', { name: /features/i })
    const reef = within(featuresGroup).getByRole('checkbox', { name: /^reef$/i })
    const wreck = within(featuresGroup).getByRole('checkbox', { name: /^wreck$/i })
    fireEvent.click(reef)
    fireEvent.click(wreck)

    const footer = screen.getByRole('dialog')
    const submit = within(footer).getAllByRole('button', { name: /add venue/i }).pop()!
    fireEvent.click(submit)

    await new Promise((r) => setTimeout(r, 0))

    expect(createVenue).toHaveBeenCalledTimes(1)
    const payload = createVenue.mock.calls[0]![0] as { features: string[] }
    expect(payload.features).toEqual(['reef', 'wreck'])
  })
})

describe('VenueCapabilitiesSection — edit seeds features from venue', () => {
  it('preloads venue.features into CheckboxGroup state and emits edits', async () => {
    venues = [
      baseVenue({
        features: ['cave'] as VenueFeature[],
      }),
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    const featuresGroup = screen.getByRole('group', { name: /features/i })
    const cave = within(featuresGroup).getByRole('checkbox', { name: /^cave$/i }) as HTMLInputElement
    const wreck = within(featuresGroup).getByRole('checkbox', { name: /^wreck$/i })
    expect(cave.checked).toBe(true)

    fireEvent.click(cave)
    fireEvent.click(wreck)

    const footer = screen.getByRole('dialog')
    const submit = within(footer).getAllByRole('button', { name: /^save$/i })[0]!
    fireEvent.click(submit)

    await new Promise((r) => setTimeout(r, 0))

    expect(updateVenue).toHaveBeenCalledTimes(1)
    const payload = updateVenue.mock.calls[0]![0] as { features: string[] }
    expect(payload.features).toEqual(['wreck'])
  })
})

describe('VenueCapabilitiesSection — has-compressor-on-site checkbox', () => {
  it('toggles the inline compressor fields when the checkbox is clicked', async () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))

    expect(screen.queryByRole('group', { name: /gas mixes available/i })).toBeNull()

    const checkbox = screen.getByLabelText(/has compressor on-site/i)
    fireEvent.click(checkbox)

    expect(screen.getByRole('group', { name: /gas mixes available/i })).toBeTruthy()
    const airBox = screen.getByRole('checkbox', { name: /^air$/i }) as HTMLInputElement
    expect(airBox.checked).toBe(true)
  })

  it('creates venue then compressor when checkbox is on during create', async () => {
    venues = []
    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))

    const nameInput = screen.getByLabelText(/venue name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Reef Site' } })
    fireEvent.click(screen.getByRole('button', { name: /pick location/i }))

    const kindSelect = screen.getByLabelText(/venue type/i) as HTMLSelectElement
    fireEvent.change(kindSelect, { target: { value: 'dive_site' } })

    fireEvent.click(screen.getByLabelText(/has compressor on-site/i))

    const dialog = screen.getByRole('dialog')
    const submit = within(dialog).getAllByRole('button', { name: /add venue/i }).pop()!
    fireEvent.click(submit)

    await waitFor(() => {
      expect(createVenue).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(createCompressor).toHaveBeenCalledTimes(1)
    })
    const payload = createCompressor.mock.calls[0]![0] as {
      name: string
      location: string
      venueId: string
      gasMixes: string[]
    }
    expect(payload.name).toBe('Reef Site')
    expect(payload.location).toBe('venue')
    expect(payload.venueId).toBe('venue-new')
    expect(payload.gasMixes).toEqual(['air'])
  })

  it('removes the linked compressor when checkbox is turned off during edit', async () => {
    const venueId = 'venue-1' as Id<'venues'>
    const compressorId = 'compressor-site' as Id<'compressors'>
    venues = [baseVenue({ _id: venueId })]
    compressors = [
      {
        _id: compressorId,
        name: 'Reef Pool Compressor',
        location: 'venue',
        venueId,
        gasMixes: ['air'],
      },
    ]

    render(<VenueCapabilitiesSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/has compressor on-site/i) as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    fireEvent.click(screen.getByLabelText(/has compressor on-site/i))

    const dialog = screen.getByRole('dialog')
    const submit = within(dialog).getAllByRole('button', { name: /^save$/i })[0]!
    fireEvent.click(submit)

    await waitFor(() => {
      expect(updateVenue).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(removeCompressor).toHaveBeenCalledTimes(1)
    })
    expect(removeCompressor.mock.calls[0]![0]).toEqual({ compressorId })
  })
})

describe('venueCapabilitiesFromProfile', () => {
  it('maps a pool profile with features and caps to form state', () => {
    const form = venueCapabilitiesFromProfile({
      kind: 'pool',
      features: ['reef', 'wreck'],
      confinedCapable: true,
      maxDepth: 5,
      maxCapacity: 20,
    })
    expect(form).toEqual({
      kind: 'pool',
      features: ['reef', 'wreck'],
      confinedCapable: true,
      maxDepth: 5,
      maxCapacity: 20,
    })
  })

  it('falls back to pool kind with zero caps when profile is empty', () => {
    const form = venueCapabilitiesFromProfile({})
    expect(form).toEqual({
      kind: 'pool',
      features: [],
      confinedCapable: false,
      maxDepth: 0,
      maxCapacity: 0,
    })
  })

  it('preserves dive_site kind', () => {
    const form = venueCapabilitiesFromProfile({
      kind: 'dive_site',
      features: ['cave'],
      maxDepth: 40,
    })
    expect(form.kind).toBe('dive_site')
    expect(form.features).toEqual(['cave'])
    expect(form.maxDepth).toBe(40)
  })
})

describe('venueCapabilitiesToPayload', () => {
  it('round-trips complete form state into a schema-valid payload', () => {
    const form: VenueCapabilitiesFormState = {
      kind: 'pool',
      features: ['reef'],
      confinedCapable: true,
      maxDepth: 5,
      maxCapacity: 20,
    }
    const payload = venueCapabilitiesToPayload(form)
    expect(payload).toEqual({
      kind: 'pool',
      features: ['reef'],
      confinedCapable: true,
      maxDepth: 5,
      maxCapacity: 20,
    })
    expect(venueCapabilitiesSchema.safeParse(payload).success).toBe(true)
  })

  it('omits maxDepth and maxCapacity when zero', () => {
    const payload = venueCapabilitiesToPayload({
      kind: 'dive_site',
      features: [],
      maxDepth: 0,
      maxCapacity: 0,
    })
    expect(payload).not.toHaveProperty('maxDepth')
    expect(payload).not.toHaveProperty('maxCapacity')
    expect(payload.kind).toBe('dive_site')
    expect(payload.features).toEqual([])
  })

  it('passes confinedCapable through when defined (including false)', () => {
    const payload = venueCapabilitiesToPayload({
      kind: 'dive_site',
      features: [],
      confinedCapable: false,
      maxDepth: 0,
      maxCapacity: 0,
    })
    expect(payload.confinedCapable).toBe(false)
  })
})

describe('INITIAL_VENUE_CAPABILITIES_FORM', () => {
  it('defaults to pool kind with empty features and zero caps', () => {
    expect(INITIAL_VENUE_CAPABILITIES_FORM.kind).toBe('pool')
    expect(INITIAL_VENUE_CAPABILITIES_FORM.features).toEqual([])
    expect(INITIAL_VENUE_CAPABILITIES_FORM.confinedCapable).toBe(false)
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxDepth).toBe(0)
    expect(INITIAL_VENUE_CAPABILITIES_FORM.maxCapacity).toBe(0)
  })
})
