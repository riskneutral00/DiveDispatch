import { redirect } from 'next/navigation'

// /slug/roleSlug has no page — redirect to the dashboard sub-route.
// The layout already validates roleSlug against ROLE_BY_KEY and calls
// notFound() for invalid roles, so this only fires for valid ones.
export default async function RoleRootRedirect({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { slug, roleSlug } = await params
  redirect(`/${slug}/${roleSlug}/dashboard`)
}
