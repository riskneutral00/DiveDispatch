import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — DiveDispatch',
  description: 'How DiveDispatch collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen relative">
      <div className="bg-image" />
      <div className="bg-overlay" />
      <main className="app-shell min-h-screen flex flex-col items-start px-4 py-16 relative max-w-3xl mx-auto">
        <h1
          className="text-3xl font-bold tracking-tight text-primary mb-8"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Privacy Policy
        </h1>

        <div className="flex flex-col gap-8 text-sm leading-relaxed text-primary">
          {/* What data is collected */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Data We Collect</h2>
            <p className="text-secondary">
              When you complete a booking portal, DiveDispatch collects the following information:
            </p>
            <ul className="list-disc ml-6 mt-2 text-secondary space-y-1">
              <li>Contact details (name, email, phone number)</li>
              <li>Passport or identification information (nationality, passport number, date of birth)</li>
              <li>Medical questionnaire responses (PADI Medical Statement 10346)</li>
              <li>Digital signature acknowledging liability and medical declarations</li>
            </ul>
          </section>

          {/* Why — purpose */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Why We Collect It</h2>
            <p className="text-secondary">
              Your data is collected to coordinate dive bookings and ensure diver safety.
              Medical information is required by PADI standards to assess fitness to dive.
              This is the same information collected on paper forms at dive centers worldwide
              — DiveDispatch digitizes this existing process.
            </p>
          </section>

          {/* Who sees it */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Who Sees Your Data</h2>
            <p className="text-secondary">
              Your information is shared with the dive center operating your booking.
              Dive center staff who manage your booking can view your contact details,
              identification, medical responses, and signature. This mirrors the existing
              paper-based process where you hand completed forms directly to the dive center.
            </p>
          </section>

          {/* Retention */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Data Retention</h2>
            <p className="text-secondary">
              Your data is retained for as long as necessary to fulfill the booking and
              comply with legal obligations. Dive centers may retain records as required
              by local diving safety regulations and insurance requirements. Once a booking
              is completed and any applicable retention period has passed, personal data
              is deleted or anonymized.
            </p>
          </section>

          {/* Deletion rights */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Your Rights</h2>
            <p className="text-secondary">
              Under the GDPR (General Data Protection Regulation) and PDPA (Personal Data
              Protection Act), you have the right to:
            </p>
            <ul className="list-disc ml-6 mt-2 text-secondary space-y-1">
              <li>Request access to the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data, subject to legal retention requirements</li>
              <li>Withdraw consent for data processing</li>
              <li>Lodge a complaint with your local data protection authority</li>
            </ul>
            <p className="mt-2 text-secondary">
              To exercise any of these rights, contact the dive center that manages your
              booking or email us at privacy@divedispatch.com.
            </p>
          </section>

          {/* Legal basis */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Legal Basis</h2>
            <p className="text-secondary">
              We process your data under legitimate interest (coordinating your dive booking)
              and legal obligation (dive safety regulations). Medical data is processed
              under the basis of vital interest and compliance with PADI safety standards.
              Data deletion requests are processed in accordance with GDPR Article 17 and
              PDPA requirements. Account deletion is handled natively through our
              authentication provider.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg font-semibold text-primary mb-2">Contact</h2>
            <p className="text-secondary">
              For privacy-related inquiries, contact us at privacy@divedispatch.com.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
