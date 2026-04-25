// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'

type MinimalCompressor = Pick<
  Doc<'compressors'>,
  '_id' | 'name' | 'location' | 'boatId' | 'venueId' | 'gasMixes' | 'nitroxMin' | 'nitroxMax' | 'address' | 'placeId' | 'lat' | 'lng'
>

let compressors: MinimalCompressor[] = []
let boats: Pick<Doc<'boats'>, '_id' | 'fleet'> | null = null
let venues: Pick<Doc<'venues'>, '_id' | 'name'>[] = []

const createCompressor = vi.fn().mockResolvedValue(undefined)
const updateCompressor = vi.fn().mockResolvedValue(undefined)
const removeCompressor = vi.fn().mockResolvedValue(undefined)

const { API_REFS } = vi.hoisted(() => ({
  API_REFS: {
    boats: { mine: { _tag: 'boats.mine' } },
    venues: { mine: { _tag: 'venues.mine' } },
    compressors: {
      mine: { _tag: 'compressors.mine' },
      create: { _tag: 'compressors.create' },
      update: { _tag: 'compressors.update' },
      remove: { _tag: 'compressors.remove' },
    },
  },
}))

vi.mock('@/lib/convex-generated', () => ({
  api: API_REFS,
}))

// mock-ok: component-level jsdom render. Backend behavior of api.compressors.* is covered by tests/compressors.test.ts (convex-test). This suite asserts UI wiring: multi-row list, add/edit/remove invoke correct mutations.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'boats.mine') return boats
      if (tag === 'venues.mine') return venues
      if (tag === 'compressors.mine') return compressors
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

import { CompressorContactSection } from '@/components/profiles/compressor-profile-form'

const baseProps = {
  profile: null,
  me: null,
  create: vi.fn(),
  update: vi.fn(),
  onSaved: vi.fn(),
  onClose: vi.fn(),
}

function baseCompressor(overrides: Partial<MinimalCompressor> = {}): MinimalCompressor {
  return {
    _id: 'c1' as Id<'compressors'>,
    name: 'Scuba Market',
    location: 'fixed',
    gasMixes: ['air'],
    address: { city: 'Phuket', country: 'TH' },
    lat: 7.82,
    lng: 98.3,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  compressors = []
  boats = null
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

describe('CompressorContactSection — list rendering', () => {
  it('renders each compressor as a card with its location label and gas mix badges', () => {
    compressors = [
      baseCompressor({ _id: 'c1' as Id<'compressors'>, name: 'Scuba Market', location: 'fixed', gasMixes: ['air', 'nitrox'], nitroxMin: 22, nitroxMax: 40 }),
      baseCompressor({ _id: 'c2' as Id<'compressors'>, name: 'Sea Fun Shop Compressor', location: 'fixed', gasMixes: ['air'] }),
    ]

    render(<CompressorContactSection {...baseProps} />)

    expect(screen.getByText('Scuba Market')).toBeTruthy()
    expect(screen.getByText('Sea Fun Shop Compressor')).toBeTruthy()
    expect(screen.getAllByText(/Fixed/)).toHaveLength(2)
    expect(screen.getByText(/Nitrox 22–40%/)).toBeTruthy()
  })

  it('renders empty-state message when no compressors exist', () => {
    compressors = []
    render(<CompressorContactSection {...baseProps} />)
    expect(screen.getByText(/No compressors yet/i)).toBeTruthy()
  })
})

describe('CompressorContactSection — add flow', () => {
  it('invokes compressors.create with location=fixed + gas mixes when submitted', async () => {
    compressors = []

    render(<CompressorContactSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /add compressor/i }))

    const nameInput = screen.getByLabelText(/compressor name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'New Compressor' } })

    const gasGroup = screen.getByRole('group', { name: /gas mixes/i })
    const airCheckbox = within(gasGroup).getByRole('checkbox', { name: /^air$/i })
    fireEvent.click(airCheckbox)

    const dialog = screen.getByRole('dialog')
    const submitBtn = within(dialog).getAllByRole('button', { name: /add compressor/i }).pop()!
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createCompressor).toHaveBeenCalledTimes(1)
    })

    const payload = createCompressor.mock.calls[0]![0] as {
      name: string
      location: string
      gasMixes: string[]
    }
    expect(payload.name).toBe('New Compressor')
    expect(payload.location).toBe('fixed')
    expect(payload.gasMixes).toEqual(['air'])
  })
})

describe('CompressorContactSection — edit flow', () => {
  it('opens dialog pre-populated with compressor data and submits update via compressors.update', async () => {
    const compressorId = 'c-edit' as Id<'compressors'>
    compressors = [
      baseCompressor({
        _id: compressorId,
        name: 'Scuba Market',
        location: 'fixed',
        gasMixes: ['air', 'nitrox'],
        nitroxMin: 22,
        nitroxMax: 40,
      }),
    ]

    render(<CompressorContactSection {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    const nameInput = screen.getByLabelText(/compressor name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Scuba Market')
    fireEvent.change(nameInput, { target: { value: 'Scuba Market Renamed' } })

    const dialog = screen.getByRole('dialog')
    const saveBtn = within(dialog).getAllByRole('button', { name: /^save$/i })[0]!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateCompressor).toHaveBeenCalledTimes(1)
    })

    const payload = updateCompressor.mock.calls[0]![0] as {
      compressorId: string
      name: string
      location: string
    }
    expect(payload.compressorId).toBe(compressorId)
    expect(payload.name).toBe('Scuba Market Renamed')
    expect(payload.location).toBe('fixed')
  })
})

describe('CompressorContactSection — remove flow', () => {
  it('opens a confirm dialog and calls compressors.remove when confirmed', async () => {
    const compressorId = 'c-remove' as Id<'compressors'>
    compressors = [
      baseCompressor({ _id: compressorId, name: 'To Be Removed' }),
    ]

    render(<CompressorContactSection {...baseProps} />)

    const removeButton = screen.getByRole('button', { name: /remove to be removed/i })
    fireEvent.click(removeButton)

    const confirmDialog = await screen.findByRole('dialog', { name: /remove compressor/i })
    const confirmBtn = within(confirmDialog).getByRole('button', { name: /^remove$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(removeCompressor).toHaveBeenCalledTimes(1)
    })
    expect(removeCompressor.mock.calls[0]![0]).toEqual({ compressorId })
  })
})
