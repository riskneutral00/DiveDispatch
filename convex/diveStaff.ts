import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  profileMine,
  profileByUserId,
  profileUpdate,
  profileCreate,
} from './lib/profileHelpers'
import { getAuthUser } from './lib/auth'
import { BASE_PROFILE_CREATE_FIELDS, BASE_PROFILE_UPDATE_FIELDS, ACCESS_CONTROL_FIELDS } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'

const credentialValidator = v.object({
  agency: v.string(),
  level: v.string(),
  agencyID: v.string(),
  specialtyRatings: v.optional(v.array(v.string())),
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
    autoAccept: v.optional(v.boolean()),
    nitroxCertified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.teachingLanguages.length === 0) {
      throw new ConvexError({ code: ErrorCode.TEACHING_LANGUAGES_REQUIRED })
    }
    const user = await getAuthUser(ctx)
    const name = user ? deriveStaffName(user) : ''
    return profileCreate(
      ctx,
      { ...args, name, role: 'Instructor', autoAccept: args.autoAccept ?? true },
      'diveStaff',
      'Instructor',
      { verified: false },
    )
  },
})

export const update = mutation({
  args: {
    ...BASE_PROFILE_UPDATE_FIELDS,
    ...ACCESS_CONTROL_FIELDS,
    credential: v.optional(v.array(credentialValidator)),
    teachingLanguages: v.optional(v.array(v.string())),
    autoAccept: v.optional(v.boolean()),
    nitroxCertified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.teachingLanguages !== undefined && args.teachingLanguages.length === 0) {
      throw new ConvexError({ code: ErrorCode.TEACHING_LANGUAGES_REQUIRED })
    }
    const user = await getAuthUser(ctx)
    const name = user ? deriveStaffName(user) : undefined
    return profileUpdate(ctx, { ...args, ...(name ? { name } : {}) }, 'diveStaff', 'diveStaff')
  },
})

export const byUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    profileByUserId(ctx, args.userId, 'diveStaff'),
})

export const mine = query({
  args: {},
  handler: async (ctx) => profileMine(ctx, 'diveStaff'),
})
