// @vitest-environment jsdom
import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { z } from 'zod'
import { toast } from 'sonner'
import { useProfileForm, type UseProfileFormOptions } from '../use-profile-form'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params?.action) return `${params.action} failed. Try again.`
    return key
  },
}))

function computeIsDirty<T>(current: T, baseline: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline)
}

describe('useProfileForm isDirty logic', () => {
  const baseline = {
    name: 'Hug Ocean',
    email: 'hug@ocean.com',
    associations: [{ agency: 'PADI', number: 'S-34782' }],
    verified: true,
  }

  it('returns false when form matches baseline', () => {
    const current = { ...baseline }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })

  it('returns true when a string field changes', () => {
    const current = { ...baseline, name: 'Hug Ocean Updated' }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when a boolean field changes', () => {
    const current = { ...baseline, verified: false }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when an array element is added', () => {
    const current = {
      ...baseline,
      associations: [...baseline.associations, { agency: 'SSI', number: 'DC-999' }],
    }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns true when an array element is removed', () => {
    const current = { ...baseline, associations: [] }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns false when object is reconstructed with same values', () => {
    const current = {
      name: 'Hug Ocean',
      email: 'hug@ocean.com',
      associations: [{ agency: 'PADI', number: 'S-34782' }],
      verified: true,
    }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })

  it('returns false after baseline is updated to match current', () => {
    const current = { ...baseline, name: 'Changed' }
    expect(computeIsDirty(current, baseline)).toBe(true)

    const newBaseline = { ...current }
    expect(computeIsDirty(current, newBaseline)).toBe(false)
  })

  it('returns true when field is changed then changed back to a different value', () => {
    const current = { ...baseline, email: 'new@ocean.com' }
    expect(computeIsDirty(current, baseline)).toBe(true)
  })

  it('returns false when field is changed back to original value', () => {
    const current = { ...baseline, email: 'hug@ocean.com' }
    expect(computeIsDirty(current, baseline)).toBe(false)
  })
})

describe('useProfileForm type safety', () => {
  type TestForm = { name: string; age: number }
  type TestPayload = { name: string; age: number; slug: string }

  it('profile type is Record<string, unknown>, not Record<string, any>', () => {
    type Opts = UseProfileFormOptions<TestForm, TestPayload>
    expectTypeOf<Opts['profile']>().toEqualTypeOf<Record<string, unknown> | null | undefined>()
  })

  it('create and update accept TPayload, not any', () => {
    type Opts = UseProfileFormOptions<TestForm, TestPayload>
    expectTypeOf<Opts['create']>().toEqualTypeOf<
      ((payload: TestPayload) => Promise<unknown>) | undefined
    >()
    expectTypeOf<Opts['update']>().toEqualTypeOf<(payload: TestPayload) => Promise<unknown>>()
  })

  it('toPayload returns TPayload, tying it to create/update', () => {
    type Opts = UseProfileFormOptions<TestForm, TestPayload>
    expectTypeOf<Opts['toPayload']>().toEqualTypeOf<(form: TestForm) => TestPayload>()
  })

  it('fromProfile receives profile + optional me', () => {
    type Opts = UseProfileFormOptions<TestForm, TestPayload>
    type Me = NonNullable<Opts['me']>
    expectTypeOf<Opts['fromProfile']>().toEqualTypeOf<
      (profile: Record<string, unknown>, me?: Me) => TestForm
    >()
  })
})

const testSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
})

type TestForm = { name: string; email: string }
type TestPayload = { name: string; email: string }

function makeOptions(overrides?: Partial<UseProfileFormOptions<TestForm, TestPayload>>): UseProfileFormOptions<TestForm, TestPayload> {
  return {
    profile: undefined,
    schema: testSchema,
    defaults: { name: '', email: '' },
    fromProfile: (p) => ({ name: String(p.name ?? ''), email: String(p.email ?? '') }),
    toPayload: (f) => f,
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useProfileForm', () => {
  it('starts in loading state when profile is undefined', () => {
    const { result } = renderHook(() => useProfileForm(makeOptions()))
    expect(result.current.loading).toBe(true)
    expect(result.current.isUpdate).toBe(false)
  })

  it('initializes from profile when profile loads', () => {
    const opts = makeOptions({ profile: { name: 'Test', email: 'a@b.com' } })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form).toEqual({ name: 'Test', email: 'a@b.com' })
    expect(result.current.loading).toBe(false)
    expect(result.current.isUpdate).toBe(true)
  })

  it('uses defaults when profile is null (new profile)', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form).toEqual({ name: '', email: '' })
    expect(result.current.isUpdate).toBe(false)
  })

  it('pre-fills from me when no profile exists and fromMe is provided', () => {
    const opts = makeOptions({
      profile: null,
      me: { email: 'me@test.com' },
      fromMe: (me, defs) => ({ ...defs, name: 'prefilled', email: me.email ?? '' }),
    })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.form.name).toBe('prefilled')
    expect(result.current.form.email).toBe('me@test.com')
  })

  it('setField updates a field and clears its error', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => {
      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
      result.current.handleSubmit(fakeEvent)
    })

    expect(result.current.errors.name).toBe('Name required')

    act(() => { result.current.setField('name', 'Updated') })
    expect(result.current.form.name).toBe('Updated')
    expect(result.current.errors.name).toBeUndefined()
  })

  it('isValid tracks schema compliance', () => {
    const opts = makeOptions({ profile: null })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.isValid).toBe(false)

    act(() => { result.current.setField('name', 'Valid') })
    act(() => { result.current.setField('email', 'valid@test.com') })
    expect(result.current.isValid).toBe(true)
  })

  it('isDirty detects changes from baseline', () => {
    const opts = makeOptions({ profile: { name: 'Original', email: 'orig@test.com' } })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.isDirty).toBe(false)

    act(() => { result.current.setField('name', 'Changed') })
    expect(result.current.isDirty).toBe(true)
  })

  it('handleSubmit validates before saving', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent

    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(createMock).not.toHaveBeenCalled()
    expect(result.current.errors.name).toBe('Name required')
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('handleSubmit calls create for new profile', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(createMock).toHaveBeenCalledWith({ name: 'New', email: 'new@test.com' })
    expect(result.current.saved).toBe(true)
    expect(result.current.saving).toBe(false)
  })

  it('calls afterSuccessfulSave after successful create', async () => {
    const afterSave = vi.fn().mockResolvedValue(undefined)
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock, afterSuccessfulSave: afterSave })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(afterSave).toHaveBeenCalledWith({ name: 'New', email: 'new@test.com' })
  })

  it('stays loading when waitForMeBeforeInit and me is still undefined', () => {
    const opts = makeOptions({
      profile: null,
      waitForMeBeforeInit: true,
      me: undefined,
    })
    const { result } = renderHook(() => useProfileForm(opts))
    expect(result.current.loading).toBe(true)
  })

  it('handleSubmit calls update for existing profile', async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({
      profile: { name: 'Existing', email: 'e@test.com' },
      update: updateMock,
    })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'Updated') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(updateMock).toHaveBeenCalledWith({ name: 'Updated', email: 'e@test.com' })
    expect(result.current.saved).toBe(true)
  })

  it('handleSubmit captures server error on mutation failure', async () => {
    const { ConvexError } = await import('convex/values')
    const createMock = vi.fn().mockRejectedValue(new ConvexError({ reason: 'Duplicate name' }))
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'Dup') })
    act(() => { result.current.setField('email', 'dup@test.com') })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(result.current.serverError).toBe('Duplicate name')
    expect(result.current.footerErrorMessage).toBe('Duplicate name')
    expect(result.current.saving).toBe(false)
    expect(result.current.saved).toBe(false)
  })

  it('footerErrorMessage surfaces schema _form path without server error', async () => {
    const formSchema = z
      .object({ name: z.string(), email: z.string().email() })
      .superRefine((data, ctx) => {
        if (data.name === '__BAD__') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Form-level issue',
            path: ['_form'],
          })
        }
      })
    const opts = makeOptions({
      profile: { name: 'Ok', email: 'ok@test.com' },
      schema: formSchema,
      fromProfile: (p) => ({ name: String(p.name ?? ''), email: String(p.email ?? '') }),
    })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => {
      result.current.setField('name', '__BAD__')
    })

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => {
      await result.current.handleSubmit(fakeEvent)
    })

    expect(result.current.errors['_form']).toBe('Form-level issue')
    expect(result.current.footerErrorMessage).toBe('Form-level issue')
    expect(result.current.serverError).toBeNull()
  })

  it('isDirty resets to false after successful save', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const opts = makeOptions({ profile: null, create: createMock })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => { result.current.setField('name', 'New') })
    act(() => { result.current.setField('email', 'new@test.com') })
    expect(result.current.isDirty).toBe(true)

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })

    expect(result.current.isDirty).toBe(false)
  })
})

const optimisticSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

type OptimisticForm = z.infer<typeof optimisticSchema>
type OptimisticPayload = OptimisticForm & { slug: string }

function makeOptimisticOptions(overrides: {
  profile?: Record<string, unknown> | null
  createFn?: (payload: OptimisticPayload) => Promise<unknown>
  updateFn?: (payload: OptimisticPayload) => Promise<unknown>
  afterSuccessfulSave?: (form: OptimisticForm) => Promise<void>
} = {}) {
  const defaults: OptimisticForm = { name: '', email: '' }
  return {
    profile: overrides.profile ?? { name: 'Dive Shop', email: 'dive@shop.com' },
    me: undefined,
    schema: optimisticSchema,
    defaults,
    fromProfile: (p: Record<string, unknown>) => ({
      name: p.name as string,
      email: p.email as string,
    }),
    toPayload: (f: OptimisticForm): OptimisticPayload => ({
      ...f,
      slug: 'test-slug',
    }),
    create: overrides.createFn ?? vi.fn().mockResolvedValue(undefined),
    update: overrides.updateFn ?? vi.fn().mockResolvedValue(undefined),
    ...(overrides.afterSuccessfulSave !== undefined
      ? { afterSuccessfulSave: overrides.afterSuccessfulSave }
      : {}),
  }
}

describe('useProfileForm validateField (on-blur)', () => {
  const blurSchema = z.object({
    name: z.string().min(1, 'Name required'),
    email: z.string().email('Invalid email'),
  })

  function blurOptions(overrides?: Partial<UseProfileFormOptions<TestForm, TestPayload>>) {
    return makeOptions({ profile: null, schema: blurSchema, ...overrides })
  }

  it('validateField does NOT surface an error when field is untouched', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    act(() => { result.current.validateField('name') })
    expect(result.current.errors.name).toBe('Name required')
  })

  it('validateField surfaces error when blurring an invalid touched field', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    act(() => { result.current.setField('email', 'not-an-email') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('validateField clears error when a touched field becomes valid', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    act(() => { result.current.setField('email', 'bad') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBe('Invalid email')
    act(() => { result.current.setField('email', 'good@test.com') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('cross-field sweep clears a stale superRefine error after sibling fix', () => {
    const refineSchema = z
      .object({ name: z.string(), email: z.string() })
      .superRefine((data, ctx) => {
        if (data.name && data.email && data.name === data.email) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Name must differ from email',
            path: ['email'],
          })
        }
      })
    const { result } = renderHook(() => useProfileForm(blurOptions({ schema: refineSchema })))
    act(() => { result.current.setField('name', 'same@x.com') })
    act(() => { result.current.setField('email', 'same@x.com') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBe('Name must differ from email')
    act(() => { result.current.setField('name', 'different') })
    act(() => { result.current.validateField('name') })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('cross-field sweep does not introduce errors on silent untouched fields', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    act(() => { result.current.setField('email', 'good@test.com') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.name).toBeUndefined()
  })

  it('cross-field sweep preserves errors._form (G1 reserved-key regression)', () => {
    const refineSchema = z
      .object({ name: z.string().min(1), email: z.string().email() })
      .superRefine((data, ctx) => {
        if (data.name === '__BAD__') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Form-level issue',
            path: ['_form'],
          })
        }
      })
    const { result } = renderHook(() => useProfileForm(blurOptions({ schema: refineSchema })))
    act(() => { result.current.setField('name', '__BAD__') })
    act(() => { result.current.setField('email', 'good@test.com') })
    act(() => {
      const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
      result.current.handleSubmit(fakeEvent)
    })
    expect(result.current.errors._form).toBe('Form-level issue')
    act(() => { result.current.validateField('email') })
    expect(result.current.errors._form).toBe('Form-level issue')
  })

  it('composite path: validateField(parent) surfaces issue at parent.child via prefix match (G2)', () => {
    const compositeSchema = z.object({
      location: z.object({
        address: z.object({
          street: z.string().min(1, 'Street required'),
        }),
      }),
    })
    type CForm = { location: { address: { street: string } } }
    const opts: UseProfileFormOptions<CForm, CForm> = {
      profile: null,
      schema: compositeSchema,
      defaults: { location: { address: { street: '' } } },
      fromProfile: () => ({ location: { address: { street: '' } } }),
      toPayload: (f) => f,
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    }
    const { result } = renderHook(() => useProfileForm(opts))
    act(() => { result.current.setField('location', { address: { street: '' } }) })
    act(() => { result.current.validateField('location') })
    expect(result.current.errors.location).toBe('Street required')
  })

  it('handleSubmit on success preserves touched state (G3 sticky)', async () => {
    const createMock = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useProfileForm(blurOptions({ create: createMock })))
    act(() => { result.current.setField('name', 'Hug') })
    act(() => { result.current.setField('email', 'hug@x.com') })
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })
    expect(result.current.saved).toBe(true)
    act(() => { result.current.setField('email', 'bad') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('setForm does NOT mark fields touched (G4)', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    act(() => { result.current.setForm({ name: '', email: 'not-email' }) })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.name).toBeUndefined()
  })

  it('resetToBaseline clears touched and errors', () => {
    const { result } = renderHook(() =>
      useProfileForm(blurOptions({ profile: { name: 'Original', email: 'orig@test.com' } })),
    )
    act(() => { result.current.setField('email', 'bad') })
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBe('Invalid email')
    act(() => { result.current.resetToBaseline() })
    expect(result.current.errors.email).toBeUndefined()
    act(() => { result.current.validateField('email') })
    expect(result.current.errors.email).toBeUndefined()
  })

  it('fieldProps returns value, onChange, onBlur, error and onBlur triggers validation', () => {
    const { result } = renderHook(() => useProfileForm(blurOptions()))
    const props = result.current.fieldProps('email')
    expect(props.value).toBe('')
    expect(typeof props.onChange).toBe('function')
    expect(typeof props.onBlur).toBe('function')
    expect(props.error).toBeUndefined()
    act(() => { result.current.setField('email', 'bad') })
    act(() => { result.current.fieldProps('email').onBlur() })
    expect(result.current.errors.email).toBe('Invalid email')
  })

  it('full schema runs on submit regardless of touched state', async () => {
    const createMock = vi.fn()
    const { result } = renderHook(() => useProfileForm(blurOptions({ create: createMock })))
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent
    await act(async () => { await result.current.handleSubmit(fakeEvent) })
    expect(result.current.errors.name).toBe('Name required')
    expect(result.current.errors.email).toBe('Invalid email')
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe('useProfileForm optimistic save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isDirty becomes false immediately after save completes (baseline updated)', async () => {
    let resolveUpdate!: (v: unknown) => void
    const updateFn = vi.fn<(payload: OptimisticPayload) => Promise<unknown>>(
      () => new Promise((resolve) => { resolveUpdate = resolve }),
    )

    const opts = makeOptimisticOptions({ updateFn })
    const { result } = renderHook(() => useProfileForm(opts))

    expect(result.current.loading).toBe(false)

    act(() => {
      result.current.setField('name', 'Updated Dive Shop')
    })
    expect(result.current.isDirty).toBe(true)

    let submitPromise: Promise<void>
    act(() => {
      submitPromise = result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent)
    })

    expect(result.current.saving).toBe(true)

    await act(async () => {
      resolveUpdate(undefined)
      await submitPromise!
    })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.saved).toBe(true)
  })

  it('isDirty reverts to true when update rejects', async () => {
    const updateFn = vi.fn<(payload: OptimisticPayload) => Promise<unknown>>()
      .mockRejectedValue(new Error('Server error'))

    const opts = makeOptimisticOptions({ updateFn })
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

    expect(result.current.isDirty).toBe(true)
    expect(result.current.saved).toBe(false)
    expect(result.current.serverError).toBe('save failed. Try again.')
    expect(result.current.footerErrorMessage).toBe('save failed. Try again.')
  })

  it('toast.warning when validation fails', async () => {
    const updateFn = vi.fn()
    const opts = makeOptimisticOptions({ updateFn })
    const { result } = renderHook(() => useProfileForm(opts))

    act(() => {
      result.current.setField('name', '')
    })

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent)
    })

    expect(updateFn).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('fixHighlightedFields', { duration: 4000 })
  })

  it('toast.warning when primary save succeeds but afterSuccessfulSave fails', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined)
    const afterSave = vi.fn().mockRejectedValue(new Error('secondary fail'))
    const opts = makeOptimisticOptions({ updateFn, afterSuccessfulSave: afterSave })
    const { result } = renderHook(() => useProfileForm(opts))

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent)
    })

    expect(updateFn).toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith(
      'profileSavedExtraStepFailed',
      expect.objectContaining({ duration: 6000 }),
    )
    expect(result.current.saved).toBe(true)
  })
})
