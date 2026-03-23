// Portal token layout — no dashboard shell, no nav, no auth.
// Customers arrive here via tokenized link. Mobile-first.
export default function PortalTokenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {/* Background layers — glass needs a photo to float above */}
      <div className="bg-image" />
      <div className="bg-overlay" />

      <div className="app-shell" style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  )
}
