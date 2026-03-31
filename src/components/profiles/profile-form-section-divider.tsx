'use client'

/** Horizontal rule between tabbed profile sections when the full form is shown (`section` unset). */
export function ProfileFormSectionDivider({ show }: { show: boolean }) {
  if (!show) return null
  return <hr className="form-divider" />
}
