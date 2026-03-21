import { redirect } from 'next/navigation'

// L7-06: Booking creation moved to overlay on dashboard — this route is deprecated.
// Old links and bookmarks are redirected to the dashboard.
export const dynamic = 'force-dynamic'

export default function NewBookingPage() {
  redirect('/dashboard')
}
