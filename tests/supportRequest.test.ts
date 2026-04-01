import { describe, it, expect, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { makeT } from './helpers/convex-helpers'

describe('submitSupportRequest', () => {
  it('persists a support request for authenticated user', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|support-req-1' }
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Support Test DC',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await t.withIdentity(identity).mutation(api.support.submitSupportRequest, {
      subject: 'Login issue',
      category: 'Bug',
      message: 'Cannot log in on mobile Safari.',
    })

    const rows = await t.run(async (ctx) =>
      ctx.db.query('supportRequests').collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].subject).toBe('Login issue')
    expect(rows[0].category).toBe('Bug')
    expect(rows[0].message).toBe('Cannot log in on mobile Safari.')
    expect(rows[0].screenshotStorageId).toBeUndefined()
  })

  it('rejects message shorter than 10 characters after trim', async () => {
    const t = makeT()
    const identity = { tokenIdentifier: 'clerk|support-short-msg' }
    vi.useFakeTimers({ now: Date.now() })
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Short Msg DC',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    vi.useRealTimers()

    await expect(
      t.withIdentity(identity).mutation(api.support.submitSupportRequest, {
        subject: 'Hi',
        category: 'Question',
        message: 'short',
      }),
    ).rejects.toThrow()
  })
})
