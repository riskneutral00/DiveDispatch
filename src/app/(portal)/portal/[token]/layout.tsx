// Portal token layout — no dashboard shell, no nav, no auth.
// Customers arrive here via tokenized link. Mobile-first.
export default function PortalTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-surface)' }}
    >
      {children}
    </div>
  )
}
