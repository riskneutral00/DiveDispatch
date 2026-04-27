import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  personProfileMine,
  personProfileUpdate,
  personProfileCreate,
} from './lib/profileHelpers'
import { authorize } from './lib/auth'
import { visibleOrgIds } from './lib/destinationScope'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'

const credentialValidator = v.object({
  agency: v.string(),
  level: v.string(),
  agencyID: v.string(),
  specialtyRatings: v.array(v.string()),
})

function deriveStaffName(user: { firstName?: string; lastName?: string }): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
}

export const create = mutation({
  args: {
    ...BASE_PROFILE_CREATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    credential: v.array(credentialValidator),
    teachingLanguages: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.teachingLanguages.length === 0) {
      throw new ConvexError({ code: ErrorCode.TEACHING_LANGUAGES_REQUIRED })
    }
    const actor = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const name = deriveStaffName(actor.user)
    return personProfileCreate(
      ctx,
      { ...args, name, role: 'Instructor' },
      'Instructor',
      { verified: false },
      actor,
    )
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    credential: v.optional(v.array(credentialValidator)),
    teachingLanguages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.teachingLanguages !== undefined && args.teachingLanguages.length === 0) {
      throw new ConvexError({ code: ErrorCode.TEACHING_LANGUAGES_REQUIRED })
    }
    const actor = await authorize(ctx, null, 'profile:manage', { type: 'profile' })
    const name = deriveStaffName(actor.user)
    return personProfileUpdate(ctx, { ...args, ...(name ? { name } : {}) }, 'Instructor', actor)
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => personProfileMine(ctx, 'Instructor'),
})

export const visibleToMe = query({
  args: {},
  handler: async (ctx) => {
    const orgIds = await visibleOrgIds(ctx)
    if (orgIds.length === 0) return []
    const results = await Promise.all(
      orgIds.map((orgId) =>
        ctx.db
          .query('diveStaff')
          .withIndex('by_organizationId', (q) => q.eq('organizationId', orgId))
          .collect(), // bounded: per-org instructor count, realistic cap ~20
      ),
    )
    return results.flat()
  },
})
