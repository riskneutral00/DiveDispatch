import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from '../convex/schema'
import { api } from '../convex/_generated/api'

const modules = import.meta.glob('../convex/**/*.ts')

describe('createUser mutation', () => {
  it('persists phone and preferredChannel', async () => {
    const t = convexTest(schema, modules)
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|phone-user' })
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Test DC',
        phone: '+66123456789',
        preferredChannel: 'WhatsApp',
      })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.phone).toBe('+66123456789')
    expect(user?.preferredChannel).toBe('WhatsApp')
  })

  it('persists explicit firstName, lastName, nickname', async () => {
    const t = convexTest(schema, modules)
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|named-user' })
      .mutation(api.users.createUser, {
        role: 'Instructor',
        businessName: 'Captain Mike',
        firstName: 'Mike',
        lastName: 'Johnson',
        nickname: 'Captain Mike',
      })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.firstName).toBe('Mike')
    expect(user?.lastName).toBe('Johnson')
    expect(user?.nickname).toBe('Captain Mike')
  })

  it('defaults phone and preferredChannel to undefined when omitted', async () => {
    const t = convexTest(schema, modules)
    const userId = await t
      .withIdentity({ tokenIdentifier: 'clerk|no-phone' })
      .mutation(api.users.createUser, {
        role: 'DiveCenter',
        businessName: 'Test DC',
      })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.phone).toBeUndefined()
    expect(user?.preferredChannel).toBeUndefined()
  })

  it('patches existing user with new fields on idempotent call', async () => {
    const t = convexTest(schema, modules)
    const identity = { tokenIdentifier: 'clerk|idem-user' }

    // First call creates the user
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Old Biz',
    })

    // Second call patches with new data
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'Agent',
      businessName: 'New Biz',
      phone: '+1234567890',
      preferredChannel: 'LINE',
      nickname: 'Updated Nick',
    })

    const user = await t
      .withIdentity(identity)
      .query(api.users.me, {})
    expect(user?.role).toBe('Agent')
    expect(user?.businessName).toBe('New Biz')
    expect(user?.phone).toBe('+1234567890')
    expect(user?.preferredChannel).toBe('LINE')
    expect(user?.nickname).toBe('Updated Nick')
  })
})

describe('updateBusinessInfo mutation', () => {
  it('patches businessName and customerLanguages on existing user', async () => {
    const t = convexTest(schema, modules)
    const identity = { tokenIdentifier: 'clerk|biz-user' }

    // Create user first
    await t.withIdentity(identity).mutation(api.users.createUser, {
      role: 'DiveCenter',
      businessName: 'Placeholder',
    })

    // Patch business info
    await t.withIdentity(identity).mutation(api.users.updateBusinessInfo, {
      businessName: 'Real Dive Shop',
      customerLanguages: ['en', 'th', 'ja'],
    })

    const user = await t.withIdentity(identity).query(api.users.me, {})
    expect(user?.businessName).toBe('Real Dive Shop')
    expect(user?.customerLanguages).toEqual(['en', 'th', 'ja'])
  })

  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.mutation(api.users.updateBusinessInfo, {
        businessName: 'Hacker',
        customerLanguages: [],
      }),
    ).rejects.toThrow()
  })

  it('rejects when no user record exists', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t
        .withIdentity({ tokenIdentifier: 'clerk|ghost' })
        .mutation(api.users.updateBusinessInfo, {
          businessName: 'Ghost Biz',
          customerLanguages: [],
        }),
    ).rejects.toThrow()
  })
})
