import { redirect } from 'next/navigation'

export default async function RoleRootRedirect({
  params,
}: {
  params: Promise<{ slug: string; roleSlug: string }>
}) {
  const { slug, roleSlug } = await params
  redirect(`/${slug}/${roleSlug}/dashboard`)
}
