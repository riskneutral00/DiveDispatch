export default function PortalGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <div className="bg-image" />
      <div className="bg-overlay" />
      <div className="app-shell min-h-screen">{children}</div>
    </div>
  )
}
