// Dashboard route group — auth is enforced by middleware (clerkMiddleware).
// This layout is a passthrough; inner [roleSlug]/[slug] layouts add the shell.
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
