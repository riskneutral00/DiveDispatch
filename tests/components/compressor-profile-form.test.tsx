// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '../helpers/render'
import type { Doc, Id } from '@/lib/convex-generated'

import {
  CompressorGasMixesSection,
  compressorGasMixesFromProfile,
  compressorGasMixesToPayload,
  INITIAL_COMPRESSOR_GAS_MIXES_FORM,
} from '@/components/profiles/compressor-profile-form'

type MinimalCompressor = Pick<
  Doc<'compressors'>,
  '_id' | 'name' | 'gasMixes' | 'nitroxMin' | 'nitroxMax'
>

const create = vi.fn().mockResolvedValue(undefined)
const update = vi.fn().mockResolvedValue(undefined)
const onSaved = vi.fn()
const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function mountWith(profile: MinimalCompressor | null) {
  return render(
    <CompressorGasMixesSection
      profile={profile as Record<string, unknown> | null}
      me={null}
      create={create}
      update={update}
      onSaved={onSaved}
      onClose={onClose}
    />,
  )
}

function airOnlyCompressor(): MinimalCompressor {
  return {
    _id: 'c1' as Id<'compressors'>,
    name: 'Scuba Market',
    gasMixes: ['air'],
  }
}

function nitroxCompressor(): MinimalCompressor {
  return {
    _id: 'c2' as Id<'compressors'>,
    name: 'Scuba Market',
    gasMixes: ['air', 'nitrox'],
    nitroxMin: 32,
    nitroxMax: 36,
  }
}

describe('CompressorGasMixesSection — initial render', () => {
  it('renders Air + Nitrox checkboxes', () => {
    mountWith(null)
    const group = screen.getByRole('group', { name: /gas mixes/i })
    expect(within(group).getByRole('checkbox', { name: /^air$/i })).toBeTruthy()
    expect(within(group).getByRole('checkbox', { name: /^nitrox$/i })).toBeTruthy()
  })

  it('does not render Min/Max inputs before Nitrox is selected', () => {
    mountWith(airOnlyCompressor())
    expect(screen.queryByLabelText(/nitrox min/i)).toBeNull()
    expect(screen.queryByLabelText(/nitrox max/i)).toBeNull()
  })

  it('preloads Air checked from profile.gasMixes', () => {
    mountWith(airOnlyCompressor())
    const group = screen.getByRole('group', { name: /gas mixes/i })
    const air = within(group).getByRole('checkbox', { name: /^air$/i }) as HTMLInputElement
    expect(air.checked).toBe(true)
  })
})

describe('CompressorGasMixesSection — Nitrox toggle', () => {
  it('checking Nitrox reveals Min/Max with default 32/36', () => {
    mountWith(airOnlyCompressor())
    const group = screen.getByRole('group', { name: /gas mixes/i })
    const nitrox = within(group).getByRole('checkbox', { name: /^nitrox$/i })
    fireEvent.click(nitrox)

    const min = screen.getByLabelText(/nitrox min/i) as HTMLSelectElement
    const max = screen.getByLabelText(/nitrox max/i) as HTMLSelectElement
    expect(min.value).toBe('32')
    expect(max.value).toBe('36')
  })

  it('unchecking Nitrox unmounts Min/Max row', () => {
    mountWith(nitroxCompressor())
    expect(screen.getByLabelText(/nitrox min/i)).toBeTruthy()

    const group = screen.getByRole('group', { name: /gas mixes/i })
    const nitrox = within(group).getByRole('checkbox', { name: /^nitrox$/i })
    fireEvent.click(nitrox)

    expect(screen.queryByLabelText(/nitrox min/i)).toBeNull()
    expect(screen.queryByLabelText(/nitrox max/i)).toBeNull()
  })
})

describe('CompressorGasMixesSection — submit', () => {
  it('calls update with { gasMixes, nitroxMin, nitroxMax } when nitrox + profile exists', async () => {
    mountWith(nitroxCompressor())

    const min = screen.getByLabelText(/nitrox min/i) as HTMLSelectElement
    fireEvent.change(min, { target: { value: '28' } })

    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1)
    })
    const payload = update.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.gasMixes).toEqual(['air', 'nitrox'])
    expect(payload.nitroxMin).toBe(28)
    expect(payload.nitroxMax).toBe(36)
  })

  it('calls create with { gasMixes: [air] } only when profile is null and air-only', async () => {
    mountWith(null)

    const group = screen.getByRole('group', { name: /gas mixes/i })
    const air = within(group).getByRole('checkbox', { name: /^air$/i })
    fireEvent.click(air)

    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1)
    })
    const payload = create.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.gasMixes).toEqual(['air'])
    expect(payload).not.toHaveProperty('nitroxMin')
    expect(payload).not.toHaveProperty('nitroxMax')
  })

  it('Save is disabled while gasMixes is empty (required)', () => {
    mountWith(null)
    const saveBtn = screen.getByRole('button', { name: /^save$/i }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })
})

describe('compressorGasMixesFromProfile', () => {
  it('maps a profile with air + nitrox into form state', () => {
    expect(
      compressorGasMixesFromProfile({ gasMixes: ['air', 'nitrox'], nitroxMin: 22, nitroxMax: 40 }),
    ).toEqual({
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 22,
      nitroxMax: 40,
    })
  })

  it('falls back to empty defaults for an empty profile', () => {
    expect(compressorGasMixesFromProfile({})).toEqual({
      gasMixes: [],
      nitroxMin: undefined,
      nitroxMax: undefined,
    })
  })
})

describe('compressorGasMixesToPayload', () => {
  it('round-trips air-only without nitrox fields', () => {
    expect(compressorGasMixesToPayload({ gasMixes: ['air'], nitroxMin: undefined, nitroxMax: undefined })).toEqual({
      gasMixes: ['air'],
    })
  })

  it('includes nitrox min/max when nitrox is selected', () => {
    expect(compressorGasMixesToPayload({ gasMixes: ['air', 'nitrox'], nitroxMin: 28, nitroxMax: 36 })).toEqual({
      gasMixes: ['air', 'nitrox'],
      nitroxMin: 28,
      nitroxMax: 36,
    })
  })

  it('drops nitrox min/max when nitrox is NOT selected even if values are present', () => {
    expect(compressorGasMixesToPayload({ gasMixes: ['air'], nitroxMin: 28, nitroxMax: 36 })).toEqual({
      gasMixes: ['air'],
    })
  })
})

describe('INITIAL_COMPRESSOR_GAS_MIXES_FORM', () => {
  it('defaults to empty gas mixes and undefined nitrox bounds', () => {
    expect(INITIAL_COMPRESSOR_GAS_MIXES_FORM).toEqual({
      gasMixes: [],
      nitroxMin: undefined,
      nitroxMax: undefined,
    })
  })
})
