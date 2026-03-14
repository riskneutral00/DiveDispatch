// Role selection is now integrated into the sign-up page (L5-33).
// Redirect any stale links to /sign-up.
import { redirect } from 'next/navigation'

export default function RoleSelectPage() {
  redirect('/sign-up')
}
