'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { GlassCard } from '@/components/ui'

interface FaqItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I set up my account after signing up?',
    answer:
      'After signing up, you will be prompted to select your role (e.g. Dive Center, Instructor, Boat). Complete your profile by filling in your business name, contact details, and any credentials. Once your profile is saved, your dashboard will be ready to use.',
  },
  {
    question: 'How do I create a new booking?',
    answer:
      'From your operator dashboard, click "New Booking" to open the booking wizard. Step through the form: choose activity types and divers, select a date range, assign resources (instructor, boat, pool, etc.), and review the summary before submitting. The booking starts in Draft status and advances automatically once all parties confirm.',
  },
  {
    question: 'How do portal links work for customers?',
    answer:
      'Once a booking is created, you can generate a tokenized portal link from the booking detail page. Share this link with your customer — it lets them fill in their contact info, medical questionnaire, and waiver without needing a DiveDispatch account. Links expire after 12 hours by default.',
  },
  {
    question: 'How do I manage resources like instructors and boats?',
    answer:
      'Resources are discovered through the Directory. As an operator, you can search and select in-system stakeholders (instructors, boats, equipment managers, etc.) when building a booking. Resources receive reservation requests and can confirm or decline from their own dashboard.',
  },
  {
    question: 'What happens when a booking expires?',
    answer:
      'Bookings in Draft status with an expired hold TTL (12 hours by default) are lazily expired when next accessed. Expiry releases all held reservations and deletes the booking. Bookings that have advanced to "Upcoming" status are never expired.',
  },
  {
    question: 'How do I switch themes or change the visual style?',
    answer:
      'Use the theme switcher icon in the top-right corner of the sidebar (or top bar on mobile). Available themes are loaded from your admin configuration. The selected theme persists to your account and applies across all sessions.',
  },
  {
    question: 'Why is my booking stuck in Draft?',
    answer:
      'A booking advances from Draft to Upcoming automatically when: the booking form is complete, the customer portal form is complete, all in-system resource reservations are confirmed, and there is no medical hard block. Check each of these conditions — typically a pending resource confirmation or an incomplete customer portal form is the cause.',
  },
  {
    question: 'Can I book external resources not listed in the directory?',
    answer:
      'Yes. When selecting a resource in the booking wizard, toggle to "External" mode and type the name manually. External resources skip the reservation and confirmation flow — the booking can advance immediately without waiting for their confirmation.',
  },
  {
    question: 'What does a medical hard block mean?',
    answer:
      'If a customer answers "Yes" to any question on the PADI medical questionnaire, a medical hard block is placed on the booking. The booking cannot advance to Upcoming until a physician clearance is submitted and recorded. You will receive a notification when this happens.',
  },
  {
    question: 'How do I report a bug or request a feature?',
    answer:
      'Use the contact form below. Select "Bug" for unexpected errors or "Feature Request" for new functionality ideas. Attach a screenshot if helpful. Our team reviews all submissions and will follow up via email.',
  },
]

interface FaqItemRowProps {
  item: FaqItem
}

function FaqItemRow({ item }: FaqItemRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <GlassCard padding="none" className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-all text-primary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
          {item.question}
        </span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 transition-transform duration-200 text-secondary"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div
          className="px-5 pb-4 text-sm leading-relaxed text-secondary"
          style={{ borderTop: '1px solid var(--color-glass-border)',
            paddingTop: '12px' }}
        >
          {item.answer}
        </div>
      )}
    </GlassCard>
  )
}

export function FaqSection() {
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item) => (
        <FaqItemRow key={item.question} item={item} />
      ))}
    </div>
  )
}
