import { describe, it, expect, vi } from 'vitest'
import { ConvexError } from 'convex/values'

// Vitest mock for the Convex generated server module (not present in worktree)
vi.mock('../convex/_generated/server', () => ({
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}))

import {
  _generateUploadUrlHandler,
  _submitSupportRequestHandler,
} from '../convex/support'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER = {
  _id: 'u1',
  slug: 'dc-slug',
  tokenIdentifier: 'user|123',
  role: 'DiveCenter',
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeCtx({
  identity = { tokenIdentifier: 'user|123' } as unknown,
  userByToken = USER as unknown,
  uploadUrl = 'https://upload.convex.cloud/test',
} = {}) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    storage: {
      generateUploadUrl: vi.fn().mockResolvedValue(uploadUrl),
    },
    db: {
      insert: vi.fn().mockResolvedValue('req-id-1'),
      query: vi.fn().mockImplementation((table: string) => {
        let uniqueResult: unknown = null
        if (table === 'users') uniqueResult = userByToken

        const chain = {
          withIndex: vi.fn(),
          unique: vi.fn().mockResolvedValue(uniqueResult),
        }
        chain.withIndex.mockReturnValue(chain)
        return chain
      }),
    },
  }
}

function expectConvexError(err: unknown, code: string) {
  expect(err).toBeInstanceOf(ConvexError)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((err as ConvexError<any>).data).toMatchObject({ code })
}

// ─── generateUploadUrl ────────────────────────────────────────────────────────

describe('generateUploadUrl', () => {
  it('returns the upload URL when authenticated', async () => {
    const ctx = makeCtx()
    const url = await _generateUploadUrlHandler(ctx)
    expect(url).toBe('https://upload.convex.cloud/test')
    expect(ctx.storage.generateUploadUrl).toHaveBeenCalledOnce()
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const ctx = makeCtx({ identity: null })
    await expect(_generateUploadUrlHandler(ctx)).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })
})

// ─── submitSupportRequest ─────────────────────────────────────────────────────

describe('submitSupportRequest', () => {
  it('inserts a support request with correct fields', async () => {
    const ctx = makeCtx()

    const id = await _submitSupportRequestHandler(ctx, {
      subject: 'Test subject',
      category: 'Bug',
      message: 'Something is broken here',
    })

    expect(id).toBe('req-id-1')
    expect(ctx.db.insert).toHaveBeenCalledWith(
      'supportRequests',
      expect.objectContaining({
        userId: 'dc-slug',
        subject: 'Test subject',
        category: 'Bug',
        message: 'Something is broken here',
        status: 'Open',
        createdAt: expect.any(Number),
      }),
    )
  })

  it('includes screenshotFileId when provided', async () => {
    const ctx = makeCtx()

    await _submitSupportRequestHandler(ctx, {
      subject: 'Screenshot test',
      category: 'Bug',
      message: 'See attached screenshot',
      screenshotFileId: 'storage-id-abc',
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'supportRequests',
      expect.objectContaining({
        screenshotFileId: 'storage-id-abc',
      }),
    )
  })

  it('sets status to Open', async () => {
    const ctx = makeCtx()

    await _submitSupportRequestHandler(ctx, {
      subject: 'Status check',
      category: 'Question',
      message: 'What is the status default?',
    })

    expect(ctx.db.insert).toHaveBeenCalledWith(
      'supportRequests',
      expect.objectContaining({ status: 'Open' }),
    )
  })

  it('throws UNAUTHENTICATED when there is no identity', async () => {
    const ctx = makeCtx({ identity: null })

    await expect(
      _submitSupportRequestHandler(ctx, {
        subject: 'Test',
        category: 'Bug',
        message: 'Some message here',
      }),
    ).rejects.toSatisfy((err) => {
      expectConvexError(err, 'UNAUTHENTICATED')
      return true
    })
  })

  it('throws NOT_FOUND when user does not exist in Convex', async () => {
    const ctx = makeCtx({ userByToken: null })

    await expect(
      _submitSupportRequestHandler(ctx, {
        subject: 'Test',
        category: 'Bug',
        message: 'Some message here',
      }),
    ).rejects.toSatisfy((err) => {
      expectConvexError(err, 'NOT_FOUND')
      return true
    })
  })
})
