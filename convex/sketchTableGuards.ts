import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

type StakeholderProfileData = {
  userId: Id<'users'>
  organizationId: Id<'organizations'>
  name: string
  placeName: string
  country: string
  lat: number
  lng: number
  email: string
  phone: string
  isAllowed?: string[]
  notAllowed?: string[]
  verified: boolean
}

export async function insertLiveaboard(ctx: MutationCtx, data: StakeholderProfileData) {
  return ctx.db.insert('liveaboards', data)
}

export async function insertDiveResort(ctx: MutationCtx, data: StakeholderProfileData) {
  return ctx.db.insert('diveResorts', data)
}

export async function insertDiveHostel(
  ctx: MutationCtx,
  data: StakeholderProfileData & { bedCount: number; dormCount: number },
) {
  return ctx.db.insert('diveHostels', data)
}

export async function insertCabin(
  ctx: MutationCtx,
  data: {
    liveaboardId: Id<'liveaboards'>
    name: string
    cabinType: 'Single' | 'Double' | 'Twin' | 'Quad' | 'Dormitory'
    totalBerths: number
    amenities: string[]
  },
) {
  return ctx.db.insert('cabins', data)
}

export async function insertTripSchedule(
  ctx: MutationCtx,
  data: {
    liveaboardId: Id<'liveaboards'>
    name: string
    startDate: string
    endDate: string
    itinerary: string
    maxPassengers: number
    currentPassengers: number
    status: 'Scheduled' | 'Full' | 'Completed' | 'Cancelled'
  },
) {
  return ctx.db.insert('tripSchedules', data)
}
