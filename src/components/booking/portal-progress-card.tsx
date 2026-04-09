'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { FormSectionHeader } from '@/components/ui/form-section-header'
import type { BookingDetailCustomerProfile } from '../../../convex/bookings'

interface PortalProgressCardProps {
  portalContact: boolean
  portalMedical: boolean
  portalWaiver: boolean
  customerFormComplete: boolean
  customerProfiles: BookingDetailCustomerProfile[]
}

interface StepRowProps {
  label: string
  required: boolean
  complete: boolean
}

function StepRow({ label, required, complete }: StepRowProps) {
  const t = useTranslations('common')
  const icon = complete ? (
    <CheckCircle2 size={16} className="text-success" />
  ) : required ? (
    <Circle className="text-secondary" size={16} />
  ) : (
    <AlertCircle className="text-secondary opacity-40" size={16} />
  )

  return (
    <div className="flex items-center gap-3">
      {icon}
      <span
        className={`text-body flex-1 ${complete ? 'text-primary' : 'text-secondary'} ${!required && !complete ? 'opacity-50' : ''}`}
      >
        {label}
        {!required && (
          <span className="text-label ml-1 text-secondary">
            ({t('notRequired')})
          </span>
        )}
      </span>
      {complete && (
        <span className="text-label font-medium text-success">
          {t('done')}
        </span>
      )}
    </div>
  )
}

export function PortalProgressCard({
  portalContact,
  portalMedical,
  portalWaiver,
  customerFormComplete,
  customerProfiles,
}: PortalProgressCardProps) {
  const tPortal = useTranslations('portal')
  const tCommon = useTranslations('common')
  const submittedCount = customerProfiles.filter((p) => p.submittedAt != null).length
  const totalProfiles = customerProfiles.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-body text-secondary">
          {totalProfiles > 0
            ? tPortal('submitted', { count: String(submittedCount), total: String(totalProfiles) })
            : tPortal('noSubmissions')}
        </span>
        {customerFormComplete && (
          <span className="text-label font-semibold text-success">
            {tCommon('complete')}
          </span>
        )}
      </div>

      <div className="space-y-2 pt-1">
        <StepRow label={tPortal('contactInfo')} required={portalContact} complete={portalContact} />
        <StepRow label={tPortal('medicalQuestionnaire')} required={portalMedical} complete={portalMedical} />
        <StepRow label={tPortal('waiverSignature')} required={portalWaiver} complete={portalWaiver} />
      </div>

      {customerProfiles.length > 0 && (
        <div className="pt-2 border-t border-glass-border">
          <FormSectionHeader label={tPortal('diverSubmissions')} className="mb-2" />
          <div className="space-y-1">
            {customerProfiles.map((profile, i) => {
              const submitted = profile.submittedAt != null
              return (
                <div key={profile._id} className="flex items-center gap-2 text-body">
                  {submitted ? (
                    <CheckCircle2 size={14} className="text-success" />
                  ) : (
                    <Circle className="text-secondary" size={14} />
                  )}
                  <span className="text-primary">{tPortal('diver', { number: String(i + 1) })}</span>
                  <span className="text-label text-secondary">
                    {submitted
                      ? tPortal('submittedOn', { date: new Date(profile.submittedAt!).toLocaleDateString() })
                      : profile.waiverSignedAt
                        ? tPortal('waiverSigned')
                        : tCommon('pending')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
