'use client'

import { useTranslations } from 'next-intl'
import { useQuery } from 'convex/react'
import { api } from '@/lib/convex-generated'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldLabel } from '@/components/ui/field-shell'

export type AccessMode = 'open' | 'allowlist' | 'blocklist'

export type AccessControlState = {
  mode: AccessMode
  isAllowed: string[]
  notAllowed: string[]
}

export const INITIAL_ACCESS_CONTROL: AccessControlState = {
  mode: 'open',
  isAllowed: [],
  notAllowed: [],
}

export function deriveAccessMode(state: Pick<AccessControlState, 'isAllowed' | 'notAllowed'>): AccessMode {
  if (state.isAllowed.length > 0) return 'allowlist'
  if (state.notAllowed.length > 0) return 'blocklist'
  return 'open'
}

export function accessFromProfile(p: Record<string, unknown>): AccessControlState {
  const isAllowed = Array.isArray(p.isAllowed) ? (p.isAllowed as string[]) : []
  const notAllowed = Array.isArray(p.notAllowed) ? (p.notAllowed as string[]) : []
  return {
    mode: deriveAccessMode({ isAllowed, notAllowed }),
    isAllowed,
    notAllowed,
  }
}

export function accessToPayload(state: AccessControlState): { isAllowed: string[]; notAllowed: string[] } {
  return {
    isAllowed: state.isAllowed,
    notAllowed: state.notAllowed,
  }
}

interface AccessControlSectionProps {
  value: AccessControlState
  onChange: (next: AccessControlState) => void
}

export function AccessControlSection({ value, onChange }: AccessControlSectionProps) {
  const t = useTranslations('common')
  const diveCenters = useQuery(api.directory.listByRole, { role: 'DiveCenter' })
  const allowedSet = new Set(value.isAllowed)
  const blockedSet = new Set(value.notAllowed)

  const emit = (isAllowed: string[], notAllowed: string[]) => {
    onChange({
      mode: deriveAccessMode({ isAllowed, notAllowed }),
      isAllowed,
      notAllowed,
    })
  }

  const toggleAllowed = (slug: string) => {
    const next = new Set(allowedSet)
    if (next.has(slug)) {
      next.delete(slug)
      emit(Array.from(next), Array.from(blockedSet))
      return
    }
    next.add(slug)
    const nextBlocked = new Set(blockedSet)
    nextBlocked.delete(slug)
    emit(Array.from(next), Array.from(nextBlocked))
  }

  const toggleBlocked = (slug: string) => {
    const next = new Set(blockedSet)
    if (next.has(slug)) {
      next.delete(slug)
      emit(Array.from(allowedSet), Array.from(next))
      return
    }
    next.add(slug)
    const nextAllowed = new Set(allowedSet)
    nextAllowed.delete(slug)
    emit(Array.from(nextAllowed), Array.from(next))
  }

  if (diveCenters == null) {
    return <p className="text-body-sm text-secondary">{t('loadingDiveCenters')}</p>
  }

  if (!Array.isArray(diveCenters) || diveCenters.length === 0) {
    return <p className="text-body-sm text-secondary">{t('noDiveCentersFound')}</p>
  }

  return (
    <div className="space-y-2">
      <FieldLabel htmlFor="dc-access">{t('diveCenterAccess')}</FieldLabel>
      <p className="text-body-sm text-secondary">{t('diveCenterAccessHint')}</p>
      <div
        id="dc-access"
        className="glass-container rounded-theme p-3 space-y-2 max-h-64 overflow-y-auto overflow-x-hidden"
      >
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-body-sm font-medium text-secondary pb-1 border-b border-glass-border">
          <span>{t('diveCenter')}</span>
          <span className="w-12 text-center">{t('allow')}</span>
          <span className="w-12 text-center">{t('block')}</span>
        </div>
        {diveCenters.map((dc) => (
          <div
            key={dc.slug}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center"
          >
            <span className="truncate text-body">{dc.name}</span>
            <div className="w-12 flex justify-center">
              <Checkbox
                label=""
                checked={allowedSet.has(dc.slug)}
                onChange={() => toggleAllowed(dc.slug)}
                aria-label={t('allowDiveCenter', { name: dc.name })}
              />
            </div>
            <div className="w-12 flex justify-center">
              <Checkbox
                label=""
                checked={blockedSet.has(dc.slug)}
                onChange={() => toggleBlocked(dc.slug)}
                aria-label={t('blockDiveCenter', { name: dc.name })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
