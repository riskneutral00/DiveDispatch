import { NotFoundCard } from '@/components/ui/not-found-card'

export default async function GlobalNotFound() {
  return (
    <NotFoundCard
      href="/dashboard"
      linkText="Back to dashboard"
    />
  )
}
