import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type StakeholderProfileData = {
  organizationId: Id<'organizations'>
  name: string
  address: {
    street?: string
    city: string
    state?: string
    country: string
    postalCode?: string
  }
  placeId?: string
  lat: number
  lng: number
  email: string
  phone: string
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

export async function insertLiveaboard(ctx: MutationCtx, data: StakeholderProfileData) {
  return ctx.db.insert('liveaboards', data) // orgid-helper-ok
}

export async function insertDiveResort(ctx: MutationCtx, data: StakeholderProfileData) {
  return ctx.db.insert('diveResorts', data) // orgid-helper-ok
}
