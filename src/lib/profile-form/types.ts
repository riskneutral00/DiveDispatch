import type { Doc } from '@/lib/convex-generated'

export type MeContext = Pick<Doc<'users'>, 'email' | 'phone' | 'appLanguage'>

export interface BaseProfileSectionProps<
  TProfile extends Record<string, unknown> = Record<string, unknown>,
  TCreateArgs extends Record<string, unknown> = Record<string, unknown>,
  TUpdateArgs extends Record<string, unknown> = Record<string, unknown>,
> {
  profile: TProfile | null | undefined
  me?: MeContext | null
  create: (payload: TCreateArgs) => Promise<unknown>
  update: (payload: TUpdateArgs) => Promise<unknown>
  onSaved?: () => void
  onClose?: () => void
}
