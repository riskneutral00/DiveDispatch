import { ConvexError, v } from 'convex/values'
import { z } from 'zod'
import { mutation, query } from './_generated/server'
import { tryAutoAdvance, computeMedicalDeadline } from './bookings/_shared'
import { resolvePortalToken, resolvePortalTokenSoft } from './lib/portal'
import { checkRateLimit } from './lib/rateLimiter'
import { assertZodSchema } from './lib/validators'
import { ErrorCode } from './lib/errorCodes'
import { safeDecryptMedical } from './lib/crypto'
import { notify } from './notifications'
import { logBookingChange } from './lib/auditLog'
import { NOTIFICATION_TYPE } from './shared/statuses'

const _medicalAnswersSchema = z.object({
  medical_q1: z.boolean(),
  medical_q2: z.boolean(),
  medical_q3: z.boolean(),
  medical_q4: z.boolean(),
  medical_q5: z.boolean(),
  medical_q6: z.boolean(),
  medical_q7: z.boolean(),
  medical_q8: z.boolean(),
  medical_q9: z.boolean(),
  medical_q10: z.boolean(),
})

export const getPortalStatus = query({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    contactComplete: boolean
    medicalComplete: boolean
    waiverComplete: boolean
    medicalHardBlock: boolean
    portalContact: boolean
    portalMedical: boolean
    portalWaiver: boolean
    alreadySubmitted: boolean
  } | null> => {
    const resolved = await resolvePortalTokenSoft(ctx, args.token)
    if (!resolved) return null
    const { booking, profile } = resolved

    const medicalAnswers = profile.medicalAnswers
      ? await safeDecryptMedical(profile.medicalAnswers)
      : {}
    const medicalComplete = Object.keys(medicalAnswers).length > 0

    return {
      contactComplete: profile.customerId != null,
      medicalComplete,
      waiverComplete: profile.waiverSignedAt != null,
      medicalHardBlock: booking.medicalHardBlock as boolean,
      portalContact: booking.portalContact as boolean,
      portalMedical: booking.portalMedical as boolean,
      portalWaiver: booking.portalWaiver as boolean,
      alreadySubmitted: profile.submittedAt != null,
    }
  },
})

export const submitPortal = mutation({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ medicalHardBlock: boolean }> => {
    await checkRateLimit(ctx, 'submitPortal', args.token)

    const { link, booking, profile } = await resolvePortalToken(ctx, args.token)

    if (booking.portalContact && !profile.customerId) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
        reason: 'Contact form not submitted',
      })
    }
    if (booking.portalMedical && (!profile.medicalAnswers || profile.medicalAnswers === '')) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
        reason: 'Medical questionnaire not submitted',
      })
    }
    if (booking.portalWaiver && !profile.waiverSignedAt) {
      throw new ConvexError({
        code: ErrorCode.FORMS_INCOMPLETE,
        reason: 'Liability waiver not signed',
      })
    }

    let medicalHardBlock = false
    if (booking.portalMedical && profile.medicalAnswers) {
      const decryptedAnswers = await safeDecryptMedical(profile.medicalAnswers)
      const validatedAnswers = assertZodSchema(_medicalAnswersSchema, decryptedAnswers)
      medicalHardBlock = Object.values(validatedAnswers).some((v) => v === true)
      if ((booking.medicalHardBlock as boolean) !== medicalHardBlock) {
        const bookingPatch: Record<string, unknown> = { medicalHardBlock }

        if (medicalHardBlock) {
          const sessions = await ctx.db
            .query('bookingSessions')
            .withIndex('by_bookingId', (q) => q.eq('bookingId', link.bookingId))
            .collect() // bounded: per-booking profiles

          if (sessions.length > 0) {
            const earliest = sessions.reduce((min, s) =>
              s.date < min.date ? s : min,
            )
            const newExpiresAt = computeMedicalDeadline(
              booking._creationTime,
              earliest.date,
              earliest.timezone ?? 'Asia/Bangkok',
            )
            if (newExpiresAt > ((booking.expiresAt as number) ?? 0)) {
              bookingPatch.expiresAt = newExpiresAt
            }
          }
        }

        await ctx.db.patch(link.bookingId, bookingPatch)
      }
    }

    const now = Date.now()

    await ctx.db.patch(profile._id, { submittedAt: now })

    await ctx.db.patch(link.bookingId, { customerFormComplete: true })

    await ctx.db.patch(link._id, { usedAt: now })

    await logBookingChange(ctx, {
      bookingId: link.bookingId,
      action: 'portal_submitted',
      actorSlug: link.customerName,
      actorType: 'customer',
    })

    await notify(ctx, {
      userId: booking.ownerId,
      type: NOTIFICATION_TYPE.PortalComplete,
      bookingId: link.bookingId,
      code: 'portal_complete',
      params: { customerName: link.customerName },
      message: `${link.customerName} has completed the customer portal.`,
    })

    await tryAutoAdvance(ctx, link.bookingId)

    return { medicalHardBlock }
  },
})
