import { BookingWizard } from '@/components/booking/booking-wizard'

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  return <BookingWizard bookingId={bookingId} />
}
