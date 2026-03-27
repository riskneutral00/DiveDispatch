'use client'

export function PreferencesTab() {
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Preferences
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Notification settings and app behavior.
        </p>
      </div>

      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Coming soon — notification and display preferences will appear here.
        </p>
      </div>
    </div>
  )
}
