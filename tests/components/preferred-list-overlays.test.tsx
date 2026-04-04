// @vitest-environment jsdom
/**
 * Preferred overlay components — venue, boat, equipment, compressor
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../helpers/render'
import { screen, fireEvent } from '@testing-library/react'
import type { DirectoryEntry } from '../../convex/directory'

// ─── Dialog polyfill ─────────────────────────────────────────────────────────

beforeEach(() => {
  HTMLDialogElement.prototype.show ??= function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open') }
})

// ─── Mock data ───────────────────────────────────────────────────────────────

const VENUES: DirectoryEntry[] = [
  { slug: 'pool-a', name: 'Crystal Pool', placeName: 'Phuket', country: 'TH', verified: true, role: 'Pool', venueType: 'Pool', maxDepth: 5, maxCapacity: 20, hasCompressor: false, confinedCapable: true },
  { slug: 'reef-b', name: 'Shark Point', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'DiveSite', venueType: 'Reef', hasCompressor: true, confinedCapable: false },
]

const BOATS: DirectoryEntry[] = [
  { slug: 'mv-seatran', name: 'MV Seatran', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'Boat', boatType: 'day_boat', boatTypes: ['day_boat', 'liveaboard'], boatCapacity: 30, hasCompressor: true },
  { slug: 'longtail-1', name: 'Long Tail Express', placeName: 'Phuket', country: 'TH', verified: true, role: 'Boat', boatType: 'longtail', boatTypes: ['longtail'], boatCapacity: 8, hasCompressor: false },
]

const EQUIPMENT: DirectoryEntry[] = [
  { slug: 'gear-house', name: 'Gear House', placeName: 'Phuket', country: 'TH', verified: true, role: 'Equipment', inventoryCounts: { bcd: 10, wetsuit: 15, fins: 20 } },
  { slug: 'dive-supply', name: 'Dive Supply Co', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'Equipment', inventoryCounts: { regulator: 5, mask: 8 } },
]

const COMPRESSORS: DirectoryEntry[] = [
  { slug: 'air-station', name: 'Air Station', placeName: 'Phuket', country: 'TH', verified: true, role: 'Compressor', gasMixes: ['air', 'nitrox'] },
  { slug: 'deep-fills', name: 'Deep Fills', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'Compressor', gasMixes: ['air', 'nitrox', 'trimix'] },
]

// ─── Convex mock — return role-specific entries ─────────────────────────────

const ROLE_DATA: Record<string, DirectoryEntry[]> = {
  Pool: VENUES.filter((v) => v.role === 'Pool'),
  DiveSite: VENUES.filter((v) => v.role === 'DiveSite'),
  Boat: BOATS,
  Equipment: EQUIPMENT,
  Compressor: COMPRESSORS,
}

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useQuery: (_query: unknown, args?: { role?: string }) => {
      if (args?.role) return ROLE_DATA[args.role] ?? []
      return []
    },
    useMutation: () => vi.fn(),
  }
})

// ─── Imports after mocks ────────────────────────────────────────────────────

import {
  PreferredVenueList,
  PreferredBoatList,
  PreferredEquipmentList,
  PreferredCompressorList,
} from '../../src/components/profiles/preferred-list'

// ─── Venue tests ────────────────────────────────────────────────────────────

describe('PreferredVenueList', () => {
  it('shows Add Venue button when empty', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add venue/i })).toBeInTheDocument()
  })

  it('shows Add Venue button', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add venue/i })).toBeInTheDocument()
  })

  it('renders ranked venues without placeName', () => {
    render(<PreferredVenueList slugs={['pool-a']} onChange={() => {}} />)
    expect(screen.getByText('Crystal Pool')).toBeInTheDocument()
    expect(screen.queryByText('Phuket')).not.toBeInTheDocument()
  })

  it('shows venue type badge on ranked card', () => {
    render(<PreferredVenueList slugs={['pool-a']} onChange={() => {}} />)
    expect(screen.getByText('Pool')).toBeInTheDocument()
  })

  it('opens overlay with filter chips', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Reef')).toBeInTheDocument()
    expect(screen.getByText('Shore')).toBeInTheDocument()
    expect(screen.getByText('Has Compressor')).toBeInTheDocument()
  })

  it('shows no results before filter interaction', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))
    expect(screen.getByText(/select filters above to browse venues/i)).toBeInTheDocument()
  })
})

// ─── Boat tests ─────────────────────────────────────────────────────────────

describe('PreferredBoatList', () => {
  it('shows Add Boat button when empty', () => {
    render(<PreferredBoatList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add boat/i })).toBeInTheDocument()
  })

  it('renders ranked boats with deduplicated type badges', () => {
    render(<PreferredBoatList slugs={['mv-seatran']} onChange={() => {}} />)
    expect(screen.getByText('MV Seatran')).toBeInTheDocument()
    expect(screen.getByText('Day Boat · Liveaboard')).toBeInTheDocument()
  })

  it('shows pax badge on ranked card', () => {
    render(<PreferredBoatList slugs={['mv-seatran']} onChange={() => {}} />)
    expect(screen.getByText('30 pax')).toBeInTheDocument()
  })

  it('opens overlay with boat type chips', () => {
    render(<PreferredBoatList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add boat/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Day Boat')).toBeInTheDocument()
    expect(screen.getByText('Liveaboard')).toBeInTheDocument()
  })
})

// ─── Equipment tests ────────────────────────────────────────────────────────

describe('PreferredEquipmentList', () => {
  it('shows Add Equipment button when empty', () => {
    render(<PreferredEquipmentList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add equipment/i })).toBeInTheDocument()
  })

  it('renders ranked equipment with gear type counts', () => {
    render(<PreferredEquipmentList slugs={['gear-house']} onChange={() => {}} />)
    expect(screen.getByText('Gear House')).toBeInTheDocument()
    expect(screen.getByText('Fins ×20')).toBeInTheDocument()
    expect(screen.getByText('Wetsuit ×15')).toBeInTheDocument()
    expect(screen.getByText('BCD ×10')).toBeInTheDocument()
  })

  it('opens overlay with gear type chips', () => {
    render(<PreferredEquipmentList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('BCD')).toBeInTheDocument()
    expect(screen.getByText('Wetsuit')).toBeInTheDocument()
  })
})

// ─── Compressor tests ───────────────────────────────────────────────────────

describe('PreferredCompressorList', () => {
  it('shows Add Compressor button when empty', () => {
    render(<PreferredCompressorList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add compressor/i })).toBeInTheDocument()
  })

  it('renders ranked compressor with gas mix pills', () => {
    render(<PreferredCompressorList slugs={['deep-fills']} onChange={() => {}} />)
    expect(screen.getByText('Deep Fills')).toBeInTheDocument()
    expect(screen.getByText('Air')).toBeInTheDocument()
    expect(screen.getByText('Nitrox')).toBeInTheDocument()
    expect(screen.getByText('Trimix')).toBeInTheDocument()
  })

  it('opens overlay with gas mix chips', () => {
    render(<PreferredCompressorList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add compressor/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Gas mix filter chips
    // Gas mix chips in filter bar: Air, Nitrox, Trimix
    expect(screen.getAllByText('Air')).toHaveLength(1)
    expect(screen.getAllByText('Nitrox')).toHaveLength(1)
  })

  it('filters by gas mix chip', () => {
    render(<PreferredCompressorList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add compressor/i }))
    // Click Trimix chip to filter
    const trimixChips = screen.getAllByText('Trimix')
    fireEvent.click(trimixChips[0])
    // Only Deep Fills has trimix
    expect(screen.getByText('Deep Fills')).toBeInTheDocument()
    expect(screen.queryByText('Air Station')).not.toBeInTheDocument()
  })
})
