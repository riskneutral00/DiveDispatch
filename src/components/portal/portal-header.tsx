'use client'

import { useTranslations } from 'next-intl'
import { MapPin, Users } from 'lucide-react'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'

interface PortalHeaderProps {
  customerName: string
  operatorName: string
  activityType: string[]
  startDate: string
  endDate: string
  diverCount: number
}

export function PortalHeader({
  customerName,
  operatorName,
  activityType,
  startDate,
  endDate,
  diverCount,
}: PortalHeaderProps) {
  const t = useTranslations('portal')

  return (
    <>
      <header className="text-center space-y-2">
        <p
          className="text-body font-medium uppercase tracking-widest text-secondary"
        >
          {operatorName}
        </p>
        <h1
          className="text-page-title font-bold text-primary font-heading"
        >
          {t('welcome', { name: customerName })}
        </h1>
        <p className="text-body text-secondary">
          {t('subtitle')}
        </p>
      </header>

      <Card padding="md">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {activityType.map((type) => (
              <Badge key={type} variant="info" size="sm">
                {type}
              </Badge>
            ))}
          </div>
          <div
            className="flex flex-col gap-1.5 text-body text-secondary"
          >
            <div className="flex items-center gap-2">
              <MapPin size={14} />
              <span>{startDate === endDate ? startDate : `${startDate} – ${endDate}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} />
              <span>
                {t('diverCount', { count: diverCount })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}
