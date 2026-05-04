// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '../helpers/render'

const diveCenters = [
  { slug: 'dc-alpha', name: 'Alpha Divers' },
  { slug: 'dc-bravo', name: 'Bravo Divers' },
]

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
      compressors: moduleStub('compressors', roleApi),
      venues: moduleStub('venues', [...roleApi, 'visibleToMe']),
      directory: {
        listByRole: stub('directory.listByRole'),
      },
    },
  }
})

vi.mock('@/lib/convex-generated', () => ({
  api: API_REFS,
}))

// mock-ok: component-level jsdom render. Backend behavior of api.directory.listByRole is covered by tests/directory.test.ts (convex-test + makeT). This suite asserts UI wiring: mutual-exclusion + payload derivation.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: (ref: unknown) => {
      const tag = (ref as { _tag?: string } | null)?._tag
      if (tag === 'directory.listByRole') return diveCenters
      return null
    },
    useMutation: () => vi.fn(),
  }
})

import {
  AccessControlSection,
  INITIAL_ACCESS_CONTROL,
  accessFromProfile,
  accessToPayload,
  deriveAccessMode,
  type AccessControlState,
} from '@/components/profiles/access-control-section'

beforeEach(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

function getAccessCheckboxes(name: string) {
  const label = screen.getByText(name, { selector: 'span' })
  const row = label.parentElement as HTMLElement
  const boxes = within(row).getAllByRole('checkbox', { hidden: true }) as HTMLInputElement[]
  expect(boxes).toHaveLength(2)
  return { allow: boxes[0]!, block: boxes[1]! }
}

describe('deriveAccessMode', () => {
  it('returns "open" when both arrays are empty', () => {
    expect(deriveAccessMode({ isAllowed: [], notAllowed: [] })).toBe('open')
  })
  it('returns "allowlist" when isAllowed is non-empty', () => {
    expect(deriveAccessMode({ isAllowed: ['dc-alpha'], notAllowed: [] })).toBe('allowlist')
  })
  it('returns "blocklist" when notAllowed is non-empty and isAllowed is empty', () => {
    expect(deriveAccessMode({ isAllowed: [], notAllowed: ['dc-bravo'] })).toBe('blocklist')
  })
  it('returns "allowlist" when both are non-empty (isAllowed takes priority)', () => {
    expect(deriveAccessMode({ isAllowed: ['dc-alpha'], notAllowed: ['dc-bravo'] })).toBe('allowlist')
  })
})

describe('accessFromProfile', () => {
  it('reads isAllowed/notAllowed arrays from the profile', () => {
    const state = accessFromProfile({ isAllowed: ['dc-alpha'], notAllowed: [] })
    expect(state.isAllowed).toEqual(['dc-alpha'])
    expect(state.notAllowed).toEqual([])
    expect(state.mode).toBe('allowlist')
  })
  it('returns empty arrays + open mode when profile fields are missing', () => {
    const state = accessFromProfile({})
    expect(state.isAllowed).toEqual([])
    expect(state.notAllowed).toEqual([])
    expect(state.mode).toBe('open')
  })
  it('ignores non-array isAllowed/notAllowed values', () => {
    const state = accessFromProfile({ isAllowed: 'not-array', notAllowed: 42 })
    expect(state.isAllowed).toEqual([])
    expect(state.notAllowed).toEqual([])
  })
})

describe('accessToPayload', () => {
  it('returns the isAllowed/notAllowed arrays unchanged', () => {
    const state: AccessControlState = {
      mode: 'blocklist',
      isAllowed: [],
      notAllowed: ['dc-bravo'],
    }
    expect(accessToPayload(state)).toEqual({ isAllowed: [], notAllowed: ['dc-bravo'] })
  })
})

describe('AccessControlSection — UI wiring', () => {
  function renderSection(initial: Partial<AccessControlState> = {}) {
    const state: AccessControlState = { ...INITIAL_ACCESS_CONTROL, ...initial }
    const onChange = vi.fn()
    const utils = render(<AccessControlSection value={state} onChange={onChange} />)
    return { onChange, ...utils }
  }

  it('starts with both columns unchecked when isAllowed and notAllowed are empty', () => {
    renderSection()
    const alpha = getAccessCheckboxes('Alpha Divers')
    const bravo = getAccessCheckboxes('Bravo Divers')
    expect(alpha.allow.checked).toBe(false)
    expect(alpha.block.checked).toBe(false)
    expect(bravo.allow.checked).toBe(false)
    expect(bravo.block.checked).toBe(false)
  })

  it('reflects seeded isAllowed by rendering Allow checked, Block unchecked', () => {
    renderSection({ isAllowed: ['dc-alpha'] })
    const alpha = getAccessCheckboxes('Alpha Divers')
    expect(alpha.allow.checked).toBe(true)
    expect(alpha.block.checked).toBe(false)
  })

  it('clicking Allow emits onChange with the slug added to isAllowed', () => {
    const { onChange } = renderSection()
    const alpha = getAccessCheckboxes('Alpha Divers')
    fireEvent.click(alpha.allow)
    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0]![0] as AccessControlState
    expect(call.isAllowed).toEqual(['dc-alpha'])
    expect(call.notAllowed).toEqual([])
    expect(call.mode).toBe('allowlist')
  })

  it('clicking Block after Allow is set unchecks Allow and checks Block (mutual exclusion)', () => {
    const { onChange } = renderSection({ isAllowed: ['dc-alpha'] })
    const alpha = getAccessCheckboxes('Alpha Divers')
    fireEvent.click(alpha.block)
    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0]![0] as AccessControlState
    expect(call.isAllowed).toEqual([])
    expect(call.notAllowed).toEqual(['dc-alpha'])
    expect(call.mode).toBe('blocklist')
  })

  it('clicking Allow after Block is set unchecks Block and checks Allow', () => {
    const { onChange } = renderSection({ notAllowed: ['dc-bravo'] })
    const bravo = getAccessCheckboxes('Bravo Divers')
    fireEvent.click(bravo.allow)
    const call = onChange.mock.calls[0]![0] as AccessControlState
    expect(call.isAllowed).toEqual(['dc-bravo'])
    expect(call.notAllowed).toEqual([])
    expect(call.mode).toBe('allowlist')
  })

  it('unchecking the sole allow entry transitions back to open mode', () => {
    const { onChange } = renderSection({ isAllowed: ['dc-alpha'] })
    const alpha = getAccessCheckboxes('Alpha Divers')
    fireEvent.click(alpha.allow)
    const call = onChange.mock.calls[0]![0] as AccessControlState
    expect(call.isAllowed).toEqual([])
    expect(call.notAllowed).toEqual([])
    expect(call.mode).toBe('open')
  })
})
