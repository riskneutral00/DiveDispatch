'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { z } from 'zod'
import { api } from '@/lib/convex-generated'
import { ROLE_BY_CLERK_ROLE, type ClerkRole } from '@/lib/constants/roles'
import { deriveDefaultRole } from '@/lib/utils/role'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassInput } from '@/components/ui/glass-input'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'
import { useProfileForm } from '@/lib/hooks/use-profile-form'

const PERSONAL_ROLE_KEYS = new Set(['instructor', 'dive-master'])

const accountSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  nickname: z.string(),
})

type AccountFormValues = z.infer<typeof accountSchema>

const ACCOUNT_DEFAULTS: AccountFormValues = {
  businessName: '',
  nickname: '',
}

export function AccountForm() {
  const user = useQuery(api.users.me)
  const userRoles = useQuery(api.userRoles.myRoles)
  const createUser = useMutation(api.users.createUser)

  const defaultRole = useMemo(
    () =>
      userRoles && userRoles.length > 0 ? deriveDefaultRole(userRoles.map((r) => r.role)) : null,
    [userRoles],
  )

  const roleConfig = defaultRole ? ROLE_BY_CLERK_ROLE[defaultRole as ClerkRole] : undefined
  const hasPersonalOnlyRole = roleConfig ? PERSONAL_ROLE_KEYS.has(roleConfig.key) : false
  const showBusinessName = !hasPersonalOnlyRole

  const upsertAccount = useCallback(
    async (payload: { businessName: string; nickname?: string }) => {
      await createUser({
        role: (defaultRole ?? 'DiveCenter') as ClerkRole,
        businessName: payload.businessName,
        nickname: payload.nickname,
      })
    },
    [createUser, defaultRole],
  )

  const { form, setField, errors, footerErrorMessage, saving, saved, isDirty, loading, isUpdate, handleSubmit, isValid } =
    useProfileForm<AccountFormValues, { businessName: string; nickname?: string }>({
      profile: user === undefined ? undefined : (user as Record<string, unknown> | null),
      schema: accountSchema,
      defaults: ACCOUNT_DEFAULTS,
      fromProfile: (p) => ({
        businessName: typeof p.businessName === 'string' ? p.businessName : '',
        nickname: typeof p.nickname === 'string' ? p.nickname : '',
      }),
      toPayload: (f) => ({
        businessName: f.businessName.trim(),
        nickname: f.nickname.trim() || undefined,
      }),
      create: upsertAccount,
      update: upsertAccount,
    })

  if (user === null) return null
  if (user && !showBusinessName) return null

  return (
    <ProfileFormShell
      loading={user === undefined || loading}
      onSubmit={handleSubmit}
      footerErrorMessage={footerErrorMessage}
      saving={saving}
      saved={saved}
      isDirty={isDirty}
      isUpdate={isUpdate}
      disableSaveWhenInvalid
      isValid={isValid}
      className="flex flex-col gap-6"
    >
      <GlassCard>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Nickname"
              value={form.nickname}
              onChange={(e) => setField('nickname', e.target.value)}
              autoComplete="nickname"
              error={errors.nickname}
            />
            <GlassInput
              label="Business name"
              value={form.businessName}
              onChange={(e) => setField('businessName', e.target.value)}
              autoComplete="organization"
              required
              error={errors.businessName}
            />
          </div>
        </div>
      </GlassCard>
    </ProfileFormShell>
  )
}
