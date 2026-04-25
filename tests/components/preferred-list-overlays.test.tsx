// @vitest-environment jsdom
/**
 * Preferred overlay components — venue/boat, equipment, compressor
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
  { slug: 'pool-a', name: 'Crystal Pool', placeName: 'Phuket', country: 'TH', verified: true, role: 'Venue', kind: "pool", maxDepth: 5, maxCapacity: 20, hasCompressor: false },
  { slug: 'reef-b', name: 'Shark Point', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'Venue', kind: "dive_site", hasCompressor: true, confinedCapable: false },
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
  { slug: 'air-station', name: 'Air Station', placeName: 'Phuket', country: 'TH', verified: true, role: 'Compressor', gasMixes: ['air'] },
  { slug: 'deep-fills', name: 'Deep Fills', placeName: 'Koh Tao', country: 'TH', verified: true, role: 'Compressor', gasMixes: ['air', 'nitrox'] },
]

// ─── Convex mock — return role-specific entries ─────────────────────────────

const ROLE_DATA: Record<string, DirectoryEntry[]> = {
  Venue: VENUES,
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

// ─── Venue tests ───────────────────────────────────────────────────────────

describe('PreferredVenueList', () => {
  it('shows Add button when empty', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add venue/i })).toBeInTheDocument()
  })

  it('renders ranked venues with badges', () => {
    render(<PreferredVenueList slugs={['pool-a']} onChange={() => {}} />)
    expect(screen.getByText('Crystal Pool')).toBeInTheDocument()
  })

  it('shows only venues in overlay (no boats)', () => {
    render(<PreferredVenueList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add venue/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Crystal Pool')).toBeInTheDocument()
    expect(screen.getByText('Shark Point')).toBeInTheDocument()
    expect(screen.queryByText('MV Seatran')).not.toBeInTheDocument()
    expect(screen.queryByText('Long Tail Express')).not.toBeInTheDocument()
  })
})

// ─── Boat tests ────────────────────────────────────────────────────────────

describe('PreferredBoatList', () => {
  it('shows Add button when empty', () => {
    render(<PreferredBoatList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add boat/i })).toBeInTheDocument()
  })

  it('renders ranked boats with badges', () => {
    render(<PreferredBoatList slugs={['mv-seatran']} onChange={() => {}} />)
    expect(screen.getByText('MV Seatran')).toBeInTheDocument()
  })

  it('shows only boats in overlay (no venues)', () => {
    render(<PreferredBoatList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add boat/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('MV Seatran')).toBeInTheDocument()
    expect(screen.getByText('Long Tail Express')).toBeInTheDocument()
    expect(screen.queryByText('Crystal Pool')).not.toBeInTheDocument()
    expect(screen.queryByText('Shark Point')).not.toBeInTheDocument()
  })
})

// ─── Equipment tests ────────────────────────────────────────────────────────

describe('PreferredEquipmentList', () => {
  it('shows Add Equipment Provider button when empty', () => {
    render(<PreferredEquipmentList slugs={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /add equipment/i })).toBeInTheDocument()
  })

  it('renders ranked equipment with gear type counts', () => {
    render(<PreferredEquipmentList slugs={['gear-house']} onChange={() => {}} />)
    expect(screen.getByText('Gear House')).toBeInTheDocument()
    expect(screen.getByText(/Fins x20/)).toBeInTheDocument()
    expect(screen.getByText(/Wetsuit x15/)).toBeInTheDocument()
    expect(screen.getByText(/BCD x10/)).toBeInTheDocument()
  })

  it('shows all equipment in overlay by default', () => {
    render(<PreferredEquipmentList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Gear House')).toBeInTheDocument()
    expect(screen.getByText('Dive Supply Co')).toBeInTheDocument()
  })

  it('opens overlay with gear type chips', () => {
    render(<PreferredEquipmentList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }))
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
    expect(screen.queryByText('Trimix')).not.toBeInTheDocument()
  })

  it('shows all compressors in overlay by default', () => {
    render(<PreferredCompressorList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add compressor/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Air Station')).toBeInTheDocument()
    expect(screen.getByText('Deep Fills')).toBeInTheDocument()
  })

  it('filters by gas mix chip', () => {
    render(<PreferredCompressorList slugs={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add compressor/i }))
    const nitroxChips = screen.getAllByText('Nitrox')
    fireEvent.click(nitroxChips[0])
    expect(screen.getByText('Deep Fills')).toBeInTheDocument()
    expect(screen.queryByText('Air Station')).not.toBeInTheDocument()
  })
})
