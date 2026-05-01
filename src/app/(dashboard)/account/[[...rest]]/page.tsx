'use client'

import { UserProfile } from '@clerk/nextjs'
import { clerkGlassAppearance } from '../../../(auth)/clerk-glass-appearance'

export default function AccountSecurityPage() {
  return (
    <div className="flex justify-center p-6">
      <UserProfile
        routing="path"
        path="/account"
        appearance={clerkGlassAppearance}
      />
    </div>
  )
}
