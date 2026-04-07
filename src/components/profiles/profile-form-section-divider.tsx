'use client'

export function ProfileFormSectionDivider({ show }: { show: boolean }) {
  if (!show) return null
  return <hr className="form-divider" />
}
