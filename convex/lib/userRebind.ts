import type { UserIdentity } from 'convex/server'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { isAllowedRebind, parseTokenIdentifier } from './tokenIdentifier'
import { normalizeEmail } from './validators'

export type RebindOutcome =
  | { kind: 'matched'; user: Doc<'users'> }
  | { kind: 'rebound'; user: Doc<'users'> }
  | { kind: 'rejected' }
  | { kind: 'none' }

export async function resolveOrRebindUser(
  ctx: MutationCtx,
  identity: UserIdentity,
): Promise<RebindOutcome> {
  const byToken = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique()
  if (byToken) return { kind: 'matched', user: byToken }

  const email = normalizeEmail(identity.email)
  if (!email) return { kind: 'none' }

  const byEmail = await ctx.db
    .query('users')
    .withIndex('by_email', (q) => q.eq('email', email))
    .unique()
  if (!byEmail) return { kind: 'none' }

  const existingParsed = parseTokenIdentifier(byEmail.tokenIdentifier)
  const incomingParsed = parseTokenIdentifier(identity.tokenIdentifier)
  const oldIssuer = existingParsed?.issuer ?? '(unparseable)'
  const newIssuer = incomingParsed?.issuer ?? '(unparseable)'
  const now = Date.now()

  if (!isAllowedRebind(byEmail.tokenIdentifier, identity.tokenIdentifier)) {
    await ctx.db.insert('webhookAuditLog', {
      eventType: 'user_rebind_rejected',
      userId: byEmail._id,
      oldTokenIdentifier: byEmail.tokenIdentifier,
      newTokenIdentifier: identity.tokenIdentifier,
      oldIssuer,
      newIssuer,
      email,
      at: now,
    })
    return { kind: 'rejected' }
  }

  await ctx.db.patch(byEmail._id, { tokenIdentifier: identity.tokenIdentifier })
  await ctx.db.insert('webhookAuditLog', {
    eventType: 'user_rebind_via_auth',
    userId: byEmail._id,
    oldTokenIdentifier: byEmail.tokenIdentifier,
    newTokenIdentifier: identity.tokenIdentifier,
    oldIssuer,
    newIssuer,
    email,
    at: now,
  })

  const reloaded = await ctx.db.get(byEmail._id)
  return { kind: 'rebound', user: reloaded ?? byEmail }
}
