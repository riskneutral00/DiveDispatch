'use client'

export function ProfileFormHeader({ isUpdate, roleName }: { isUpdate: boolean; roleName: string }) {
  return (
    <div>
      <h1
        className="text-2xl font-bold mb-1 text-primary font-heading"
      >
        {isUpdate ? 'Update Profile' : 'Complete Your Profile'}
      </h1>
      <p className="text-body text-secondary">
        {isUpdate
          ? 'Keep your profile current so dive centers can find you.'
          : `Set up your ${roleName} profile to start receiving booking requests.`}
      </p>
    </div>
  )
}
