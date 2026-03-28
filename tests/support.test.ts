import { describe, it, expect, beforeEach } from 'vitest'
import type { Id } from '../convex/_generated/dataModel'
import {
  _generateUploadUrlHandler,
  _submitSupportRequestHandler,
} from '../convex/support'
import { TEST_TOKENS, TEST_SLUGS, seedUser } from './fixtures'
import { makeT } from './helpers/convex-helpers'

let t = makeT()
beforeEach(() => {
  t = makeT()
})

// ─── generateUploadUrl ────────────────────────────────────────────────────────

describe('generateUploadUrl', () => {
  it('returns an upload URL string when authenticated', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const url = await _generateUploadUrlHandler(ctx)
      expect(typeof url).toBe('string')
      expect(url.length).toBeGreaterThan(0)
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(_generateUploadUrlHandler(ctx)).rejects.toMatchObject({
        data: { code: 'UNAUTHENTICATED' },
      })
    })
  })
})

// ─── submitSupportRequest ─────────────────────────────────────────────────────

describe('submitSupportRequest', () => {
  it('inserts a support request with correct fields', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const id = await _submitSupportRequestHandler(ctx, {
        subject: 'Test subject',
        category: 'Bug',
        message: 'Something is broken here',
      })

      expect(id).toBeTruthy()
      const request = await ctx.db.get(id as Id<'supportRequests'>)
      expect(request).toMatchObject({
        userId: TEST_SLUGS.diveCenter,
        subject: 'Test subject',
        category: 'Bug',
        message: 'Something is broken here',
        status: 'Open',
        createdAt: expect.any(Number),
      })
    })
  })

  it('includes screenshotFileId when provided', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      // Upload a file to get a valid storage ID
      const blob = new Blob(['screenshot'], { type: 'image/png' })
      const fileId = await ctx.storage.store(blob)

      const id = await _submitSupportRequestHandler(ctx, {
        subject: 'Screenshot test',
        category: 'Bug',
        message: 'See attached screenshot',
        screenshotFileId: fileId,
      })

      const request = await ctx.db.get(id as Id<'supportRequests'>)
      expect(request?.screenshotFileId).toBe(fileId)
    })
  })

  it('sets status to Open', async () => {
    await t.withIdentity({ tokenIdentifier: TEST_TOKENS.diveCenter }).run(async (ctx) => {
      await seedUser(ctx)

      const id = await _submitSupportRequestHandler(ctx, {
        subject: 'Status check',
        category: 'Question',
        message: 'What is the status default?',
      })

      const request = await ctx.db.get(id as Id<'supportRequests'>)
      expect(request?.status).toBe('Open')
    })
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    await t.run(async (ctx) => {
      await expect(
        _submitSupportRequestHandler(ctx, {
          subject: 'Test',
          category: 'Bug',
          message: 'Some message here',
        }),
      ).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
    })
  })

  it('throws NOT_FOUND when user does not exist in Convex', async () => {
    // Identity present but no matching user record in DB
    await t.withIdentity({ tokenIdentifier: 'test|ghost-user' }).run(async (ctx) => {
      await expect(
        _submitSupportRequestHandler(ctx, {
          subject: 'Test',
          category: 'Bug',
          message: 'Some message here',
        }),
      ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    })
  })
})
