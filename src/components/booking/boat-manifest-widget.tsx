'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Ship, ChevronDown, ChevronRight, AlertTriangle, Heart } from 'lucide-react'
import { api } from '@/lib/convex-generated'
import { Card, EmptyState } from '@/components/ui'
import { SimpleSelect } from '@/components/ui/simple-select'

import { LoadingCard } from '@/components/ui/loading-card'
import type {
  ManifestData,
  ManifestVessel,
  ManifestDateEntry,
  ManifestGroup,
  ManifestDiver,
} from '../../../convex/boatWidget'
import { countryCodeToEmoji } from '@/components/ui/flag-emoji'

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function isPassportExpiringSoon(expirationDate?: string): boolean {
  if (!expirationDate) return false
  const sixMonths = new Date()
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  return new Date(expirationDate) < sixMonths
}

type GroupByMode = 'operator' | 'activity'

function DiverDetailRow({ diver }: { diver: ManifestDiver }) {
  const passportExpiring = isPassportExpiringSoon(diver.passportExpirationDate)

  return (
    <tr className="border-t border-white/5 text-label">
      <td className="py-1.5 px-2 text-primary">
        {diver.legalFirstName && diver.legalLastName
          ? `${diver.legalFirstName} ${diver.legalLastName}`
          : diver.name}
        {diver.preferredName && (
          <span className="text-secondary ml-1">({diver.preferredName})</span>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary">
        {diver.nationality && (
          <>
            {diver.nationality.length === 2 && countryCodeToEmoji(diver.nationality)}{' '}
            <span className="text-[10px]">{diver.nationality}</span> {/* design-ok */}
          </>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary font-mono text-[11px]"> {/* design-ok */}
        {diver.passportNumber ?? '—'}
        {diver.passportIssuingCountry && (
          <span className="ml-1 text-[10px]" /* design-ok */>{diver.passportIssuingCountry}</span>
        )}
      </td>
      <td className={`py-1.5 px-2 font-mono text-[11px] ${passportExpiring ? 'font-bold text-destructive' : 'text-secondary'}`} /* design-ok */>
        {diver.passportExpirationDate ?? '—'}
        {passportExpiring && (
          <span role="alert" className="ml-1" title="Expires within 6 months">
            <AlertTriangle size={10} className="inline" />
          </span>
        )}
      </td>
      <td className="py-1.5 px-2 text-secondary">{diver.gender ?? '—'}</td>
      <td className="py-1.5 px-2 text-secondary font-mono text-[11px]">{diver.dateOfBirth ?? '—'}</td> {/* design-ok */}
      <td className="py-1.5 px-2 text-secondary text-[11px]"> {/* design-ok */}
        {diver.emergencyContactName
          ? `${diver.emergencyContactName} ${diver.emergencyContactPhone ?? ''} (${diver.emergencyContactRelation ?? ''})`
          : '—'}
      </td>
      <td className="py-1.5 px-2 text-secondary text-[11px]"> {/* design-ok */}
        {diver.agency ?? '—'}
        {diver.certLevel && <span className="ml-1">{diver.certLevel}</span>}
      </td>
      <td className="py-1.5 px-2">
        <span className="flex items-center gap-1">
          {diver.medicalFlags?.includes('medical_block') && (
            <span aria-label="Medical block"><Heart size={12} className="text-destructive" /></span>
          )}
          {diver.allergies && (
            <span aria-label={`Allergies: ${diver.allergies}`}><AlertTriangle size={12} className="text-warning" /></span>
          )}
          {!diver.medicalFlags?.length && !diver.allergies && (
            <span className="text-secondary text-[11px]" /* design-ok */>—</span>
          )}
        </span>
      </td>
    </tr>
  )
}

function deliveryWhereLabel(group: ManifestGroup): string | undefined {
  const parts: string[] = []
  if (group.diveSiteName) parts.push(group.diveSiteName)
  if (group.deliveryLocation) {
    const map: Record<string, string> = {
      BoatPier: 'Boat / pier',
      Pool: 'Pool',
      Beach: 'Shore / beach',
    }
    parts.push(map[group.deliveryLocation] ?? group.deliveryLocation)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function GroupSection({ group }: { group: ManifestGroup }) {
  const [expanded, setExpanded] = useState(true)
  const whereLine = deliveryWhereLabel(group)

  return (
    <div className="mb-2">
      {/* design-ok */}<button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-[var(--border-radius-button)] transition-colors duration-theme"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-body font-medium text-primary">{group.operatorName}</span>
        <span className="text-label text-secondary">
          {group.activityType.join(', ')} — {group.diverCount} diver{group.diverCount !== 1 ? 's' : ''}
        </span>
      </button>
      {whereLine && (
        <p className="text-[11px] text-secondary px-2 pb-1 pl-8 font-body" /* design-ok */>
          {whereLine}
        </p>
      )}

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-secondary"> {/* design-ok */}
                <th scope="col" className="text-left py-1 px-2 font-medium">Name</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Nationality</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Passport</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Pass. Exp</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Gender</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">DOB</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Emergency</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Cert</th>
                <th scope="col" className="text-left py-1 px-2 font-medium">Medical</th>
              </tr>
            </thead>
            <tbody>
              {group.divers.map((diver) => (
                <DiverDetailRow key={`${group.bookingId}-${diver.diverIndex}`} diver={diver} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DateSection({ entry, groupBy }: { entry: ManifestDateEntry; groupBy: GroupByMode }) {
  const groups = groupBy === 'activity'
    ? regroupByActivity(entry.groups)
    : entry.groups

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <h4 className="text-body font-semibold text-primary font-heading">
          {formatDate(entry.date)}
        </h4>
        <span className="text-label text-secondary">{entry.totalPax} pax</span>
      </div>
      {groups.map((group) => (
        <GroupSection key={`${group.bookingId}-${entry.date}`} group={group} />
      ))}
    </div>
  )
}

function VesselSection({ vessel, groupBy }: { vessel: ManifestVessel; groupBy: GroupByMode }) {
  const totalPax = vessel.dates.reduce((sum, d) => sum + d.totalPax, 0)

  return (
    <Card padding="md" className="mb-4">
      <div className="flex items-center gap-3 mb-3">
        <Ship size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-primary font-heading">
          {vessel.vesselName}
        </h3>
        <span className="text-label text-secondary px-2 py-0.5 rounded-[var(--border-radius-button)] glass-surface">
          {vessel.boatType.replace('_', ' ')}
        </span>
        <span className="text-label text-secondary ml-auto">{totalPax} pax total</span>
      </div>

      {vessel.dates.length === 0 ? (
        <EmptyState message="No bookings for this period." />
      ) : (
        vessel.dates.map((dateEntry) => (
          <DateSection key={dateEntry.date} entry={dateEntry} groupBy={groupBy} />
        ))
      )}
    </Card>
  )
}

function regroupByActivity(groups: ManifestGroup[]): ManifestGroup[] {
  const byActivity = new Map<string, ManifestDiver[]>()
  const metaMap = new Map<string, { operatorName: string; bookingId: string }>()

  for (const group of groups) {
    const key = group.activityType.join(',') || 'Other'
    const existing = byActivity.get(key) ?? []
    existing.push(...group.divers)
    byActivity.set(key, existing)
    if (!metaMap.has(key)) {
      metaMap.set(key, { operatorName: key, bookingId: group.bookingId })
    }
  }

  return Array.from(byActivity.entries()).map(([key, divers]) => ({
    bookingId: metaMap.get(key)!.bookingId,
    operatorName: key,
    activityType: key.split(','),
    diverCount: divers.length,
    divers,
  }))
}

interface BoatManifestWidgetProps {
  visibleRange: { start: string; end: string }
}

export function BoatManifestWidget({ visibleRange }: BoatManifestWidgetProps) {
  const [groupBy, setGroupBy] = useState<GroupByMode>('operator')

  const data: ManifestData | null | undefined = useQuery(
    api.boatWidget.getManifestData,
    { dateRangeStart: visibleRange.start, dateRangeEnd: visibleRange.end },
  )

  if (data === undefined) {
    return (
      <LoadingCard />
    )
  }

  if (!data || data.vessels.every((v) => v.dates.length === 0)) {
    return <EmptyState icon={Ship} message="No bookings for this period." />
  }

  return (
    <div data-testid="boat-manifest-widget" className="space-y-3">
      <div className="flex items-center gap-3">
        <SimpleSelect
          label="Group by"
          value={groupBy}
          onChange={(v) => setGroupBy(v as GroupByMode)}
          options={[
            { value: 'operator', label: 'By Dive Center' },
            { value: 'activity', label: 'By Activity' },
          ]}
          aria-label="Group manifest by"
        />
      </div>

      {data.vessels.map((vessel) => (
        <VesselSection key={vessel.vesselName} vessel={vessel} groupBy={groupBy} />
      ))}
    </div>
  )
}
