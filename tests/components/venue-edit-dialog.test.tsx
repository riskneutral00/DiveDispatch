// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '../helpers/render'

const diveCenters = [
  { slug: 'dc-alpha', name: 'Alpha Divers' },
  { slug: 'dc-bravo', name: 'Bravo Divers' },
]

// mock-ok: component-level jsdom render test. Backend behavior of api.directory.listByRole is covered by tests/directory.test.ts (convex-test + makeT). This suite asserts UI wiring: DiveCenterAccessPicker Allow/Block mutual-exclusion invariant in response to user clicks.
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('convex/react')>()
  return {
    ...actual,
    useQuery: () => diveCenters,
    useMutation: () => vi.fn(),
  }
})

vi.mock('@/components/profiles/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (v: unknown) => void }) => (
    <button
      data-testid="location-picker"
      onClick={() =>
        onChange({ address: { city: 'Koh Tao', country: 'TH' }, lat: 10, lng: 99 })
      }
    >
      Pick Location
    </button>
  ),
}))

import {
  VenueEditDialog,
  EMPTY_VENUE_EDIT,
  type VenueEditValue,
} from '@/components/profiles/venue-edit-dialog'

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

function renderDialog(initial: Partial<VenueEditValue> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <VenueEditDialog
      open={true}
      onClose={onClose}
      mode="create"
      lockedKind="dive_site"
      initialValue={{ ...EMPTY_VENUE_EDIT, kind: 'dive_site', ...initial }}
      onSubmit={onSubmit}
    />,
  )
  const accessTab = screen.queryByText('Access')
  if (accessTab) fireEvent.click(accessTab)
  return { onSubmit, onClose }
}

describe('VenueEditDialog — DiveCenterAccessPicker mutual exclusion', () => {
  it('starts with both columns unchecked when isAllowed and notAllowed are empty', () => {
    renderDialog()
    const alpha = getAccessCheckboxes('Alpha Divers')
    const bravo = getAccessCheckboxes('Bravo Divers')
    expect(alpha.allow.checked).toBe(false)
    expect(alpha.block.checked).toBe(false)
    expect(bravo.allow.checked).toBe(false)
    expect(bravo.block.checked).toBe(false)
  })

  it('reflects initial state — seeded isAllowed renders Allow checked, Block unchecked', () => {
    renderDialog({ isAllowed: ['dc-alpha'], notAllowed: [] })
    const alpha = getAccessCheckboxes('Alpha Divers')
    expect(alpha.allow.checked).toBe(true)
    expect(alpha.block.checked).toBe(false)
  })

  it('Allow → Block transition unchecks Allow and checks Block (mutual exclusion)', () => {
    renderDialog({ isAllowed: ['dc-alpha'], notAllowed: [] })
    const alpha = getAccessCheckboxes('Alpha Divers')
    expect(alpha.allow.checked).toBe(true)
    expect(alpha.block.checked).toBe(false)

    fireEvent.click(alpha.block)

    const after = getAccessCheckboxes('Alpha Divers')
    expect(after.allow.checked).toBe(false)
    expect(after.block.checked).toBe(true)
  })

  it('Block → Allow transition unchecks Block and checks Allow (mutual exclusion)', () => {
    renderDialog({ isAllowed: [], notAllowed: ['dc-bravo'] })
    const bravo = getAccessCheckboxes('Bravo Divers')
    expect(bravo.allow.checked).toBe(false)
    expect(bravo.block.checked).toBe(true)

    fireEvent.click(bravo.allow)

    const after = getAccessCheckboxes('Bravo Divers')
    expect(after.allow.checked).toBe(true)
    expect(after.block.checked).toBe(false)
  })

  it('toggling one dive center does not affect the other', () => {
    renderDialog()

    const alphaBefore = getAccessCheckboxes('Alpha Divers')
    fireEvent.click(alphaBefore.allow)

    const alphaAfter = getAccessCheckboxes('Alpha Divers')
    const bravoAfter = getAccessCheckboxes('Bravo Divers')
    expect(alphaAfter.allow.checked).toBe(true)
    expect(bravoAfter.allow.checked).toBe(false)
    expect(bravoAfter.block.checked).toBe(false)
  })
})
