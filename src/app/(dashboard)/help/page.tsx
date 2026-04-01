import { HelpCircle, MessageSquare } from 'lucide-react'
import { FaqSection } from '@/components/help/faq-section'
import { ContactForm } from '@/components/help/contact-form'
import { DashboardPageFrame } from '@/components/layout/dashboard-page-frame'
import { SessionDashboardShell } from '@/components/layout/session-dashboard-shell'

export default function HelpPage() {
  return (
    <SessionDashboardShell>
      <DashboardPageFrame
        maxWidth="2xl"
        padding="none"
        leading={<HelpCircle size={26} style={{ color: 'var(--color-primary)' }} />}
        title="Help & Support"
        description="Browse common questions or send us a message and we'll get back to you."
        className="space-y-10"
      >
        <section>
          <h2
            className="text-base font-semibold mb-4 text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Frequently Asked Questions
          </h2>
          <FaqSection />
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} style={{ color: 'var(--color-primary)' }} />
            <h2
              className="text-base font-semibold text-primary"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Contact Support
            </h2>
          </div>
          <ContactForm />
        </section>
      </DashboardPageFrame>
    </SessionDashboardShell>
  )
}
