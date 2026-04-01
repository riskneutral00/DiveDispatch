'use client'

/** Optional title block for profile forms shown full-page (no section filter). */
export function ProfileFormHeader({ isUpdate, roleName }: { isUpdate: boolean; roleName: string }) {
  return (
    <div>
      <h1
        className="text-2xl font-bold mb-1 text-primary"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
      </h1>
      <p className="text-sm text-secondary">
        {isUpdate
          ? 'Keep your profile current so dive centers can find you.'
          : `Set up your ${roleName} profile to start receiving booking requests.`}
      </p>
    </div>
  )
}
