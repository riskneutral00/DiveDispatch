export interface NotificationLogistics {
  pickupTime?: string
  pickupLocation?: string
  departureTime?: string
  departureLocation?: string
  boatName?: string
  meetingPoint?: string
}

export interface NotificationDoc {
  _id: string
  type: string
  message: string
  createdAt: number
  readAt?: number
  logistics?: NotificationLogistics
}
