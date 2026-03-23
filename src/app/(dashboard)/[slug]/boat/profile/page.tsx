'use client'

import { BoatProfileForm } from '@/components/dashboard/boat-profile-form'

export default function BoatProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Profile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Boat
        </p>
      </div>

      <BoatProfileForm />
    </div>
  )
}
