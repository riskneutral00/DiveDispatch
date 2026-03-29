export interface NotificationDoc {
  _id: string
  type: string
  message: string
  createdAt: number
  readAt?: number
}
