export type BaseProfileSectionProps = {
  profile: Record<string, unknown> | null | undefined
  me?: Record<string, unknown> | null | undefined
  create: (payload: Record<string, unknown>) => Promise<unknown>
  update: (payload: Record<string, unknown>) => Promise<unknown>
  onSaved?: () => void
  onClose?: () => void
}
