import { HelpCircle, MessageSquare } from 'lucide-react'
import { FaqSection } from '@/components/help/faq-section'
import { ContactForm } from '@/components/help/contact-form'

export default function HelpPage() {
  return (
    <div
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <HelpCircle size={26} style={{ color: 'var(--color-primary)' }} />
            <h1
              className="font-bold text-primary"
              style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--font-size-page-title)' }}
            >
              Help &amp; Support
            </h1>
          </div>
          <p className="text-sm mt-2 text-secondary">
            Browse common questions or send us a message and we&apos;ll get back to you.
          </p>
        </div>

        {/* FAQ */}
        <section>
          <h2
            className="text-base font-semibold mb-4 text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Frequently Asked Questions
          </h2>
          <FaqSection />
        </section>

        {/* Contact form */}
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
      </div>
    </div>
  )
}
