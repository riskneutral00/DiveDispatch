import { ConvexError } from 'convex/values'
import { ErrorCode } from './errorCodes'

export function validateNitroxRange(args: { nitroxMin?: number; nitroxMax?: number }) {
  if (args.nitroxMin !== undefined || args.nitroxMax !== undefined) {
    const min = args.nitroxMin ?? 21
    const max = args.nitroxMax ?? 40
    if (min < 21 || max > 40 || min > max) {
      throw new ConvexError({ code: ErrorCode.VALIDATION, reason: 'nitroxMin must be 21–40, nitroxMax must be 21–40, min ≤ max' })
    }
  }
}
