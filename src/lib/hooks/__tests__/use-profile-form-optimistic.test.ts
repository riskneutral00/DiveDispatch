// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'
import { useProfileForm } from '../use-profile-form'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const testSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

type TestForm = z.infer<typeof testSchema>
type TestPayload = TestForm & { slug: string }

function makeOptions(overrides: {
  profile?: Record<string, unknown> | null
  createFn?: (payload: TestPayload) => Promise<unknown>
  updateFn?: (payload: TestPayload) => Promise<unknown>
} = {}) {
  const defaults: TestForm = { name: '', email: '' }
  return {
    profile: overrides.profile ?? { name: 'Dive Shop', email: 'dive@shop.com' },
    me: undefined,
    schema: testSchema,
    defaults,
    fromProfile: (p: Record<string, unknown>) => ({
      name: p.name as string,
      email: p.email as string,
    }),
    toPayload: (f: TestForm): TestPayload => ({
      ...f,
      slug: 'test-slug',
    }),
    create: overrides.createFn ?? vi.fn().mockResolvedValue(undefined),
    update: overrides.updateFn ?? vi.fn().mockResolvedValue(undefined),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useProfileForm optimistic save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isDirty becomes false immediately after save starts (optimistic baseline update)', async () => {
    let resolveUpdate!: (v: unknown) => void
    const updateFn = vi.fn<(payload: TestPayload) => Promise<unknown>>(
      () => new Promise((resolve) => { resolveUpdate = resolve }),
    )

    const opts = makeOptions({ updateFn })
    const { result } = renderHook(() => useProfileForm(opts))

    // Wait for initialization
    expect(result.current.loading).toBe(false)

    // Make a change
    act(() => {
      result.current.setField('name', 'Updated Dive Shop')
    })
    expect(result.current.isDirty).toBe(true)

    // Start save
    let submitPromise: Promise<void>
    act(() => {
      submitPromise = result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent)
    })

    // During save: should show saving state
    expect(result.current.saving).toBe(true)

    // Resolve
    await act(async () => {
      resolveUpdate(undefined)
      await submitPromise!
    })

    // After save: isDirty should be false (baseline updated)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.saved).toBe(true)
  })

  it('isDirty reverts to true when update rejects', async () => {
    const updateFn = vi.fn<(payload: TestPayload) => Promise<unknown>>()
      .mockRejectedValue(new Error('Server error'))

    const opts = makeOptions({ updateFn })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => {
      result.current.setField('name', 'Changed Name')
    })
    expect(result.current.isDirty).toBe(true)

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent)
    })

    // After rejection: still dirty because save failed
    expect(result.current.isDirty).toBe(true)
    expect(result.current.saved).toBe(false)
    expect(result.current.serverError).toBe('Save failed')
  })
})
