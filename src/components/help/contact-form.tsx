'use client'

import { Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { GlassButton } from '@/components/glass/glass-button'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'

const CATEGORIES = [
  { value: 'Bug', label: 'Bug' },
  { value: 'Feature Request', label: 'Feature Request' },
  { value: 'Question', label: 'Question' },
  { value: 'Account Issue', label: 'Account Issue' },
] as const

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface FormState {
  subject: string
  category: string
  message: string
}

interface FormErrors {
  subject?: string
  category?: string
  message?: string
  screenshot?: string
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.subject.trim()) errors.subject = 'Subject is required.'
  if (!form.category) errors.category = 'Category is required.'
  if (!form.message.trim()) errors.message = 'Message is required.'
  else if (form.message.trim().length < 10) errors.message = 'Message must be at least 10 characters.'
  return errors
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>({ subject: '', category: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotError, setScreenshotError] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setScreenshotError('')
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setScreenshot(null)
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setScreenshotError('Only PNG, JPG, and WEBP images are allowed.')
      setScreenshot(null)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setScreenshotError('Image must be under 5 MB.')
      setScreenshot(null)
      return
    }
    setScreenshot(file)
  }

  function clearScreenshot() {
    setScreenshot(null)
    setScreenshotError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validate(form)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }
    setErrors({})
    setSubmitting(true)

    try {
      // TODO: Wire to support backend when implemented
      setSubmitted(true)
    } catch {
      setErrors({ subject: 'Submission failed. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <GlassCard padding="lg" className="text-center">
        <p
          className="font-semibold text-base mb-1 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Request submitted
        </p>
        <p className="text-sm text-secondary">
          {"Your request has been submitted. We'll get back to you soon."}
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Subject */}
        <GlassInput
          label="Subject"
          placeholder="Brief summary of your issue"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          error={errors.subject}
        />

        {/* Category */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            className="text-sm font-medium text-secondary"
          >
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="glass w-full text-sm pl-3 pr-3 py-2.5 focus:outline-none focus:ring-2"
            style={{
              color: form.category ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              outlineColor: errors.category ? 'var(--color-destructive)' : 'var(--color-accent)',
              ...(errors.category
                ? { boxShadow: '0 0 0 2px var(--color-destructive)' }
                : {}),
            }}
            aria-invalid={!!errors.category}
          >
            <option value="" disabled>
              Select a category
            </option>
            {CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {errors.category}
            </p>
          )}
        </div>

        {/* Message */}
        <div className="flex flex-col gap-1.5 w-full">
          <label
            className="text-sm font-medium text-secondary"
          >
            Message
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Describe your issue in detail (minimum 10 characters)"
            rows={5}
            className="glass w-full text-sm px-3 py-2.5 focus:outline-none focus:ring-2 resize-y text-primary"
            style={{ outlineColor: errors.message ? 'var(--color-destructive)' : 'var(--color-accent)',
              ...(errors.message
                ? { boxShadow: '0 0 0 2px var(--color-destructive)' }
                : {}) }}
            aria-invalid={!!errors.message}
          />
          {errors.message && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {errors.message}
            </p>
          )}
        </div>

        {/* Screenshot upload */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-secondary">
            Screenshot{' '}
            <span className="text-secondary" style={{ fontWeight: 400 }}>
              (optional — PNG, JPG, WEBP, max 5 MB)
            </span>
          </span>

          {screenshot ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 glass text-sm text-primary"
            >
              <Upload className="text-secondary" size={15} />
              <span className="flex-1 truncate">{screenshot.name}</span>
              <button className="text-secondary"
                type="button"
                onClick={clearScreenshot}
                aria-label="Remove screenshot"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2.5 glass text-sm transition-all hover:opacity-80 text-secondary"
            >
              <Upload size={15} />
              <span>Attach screenshot</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Screenshot upload"
          />

          {screenshotError && (
            <p className="text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
              {screenshotError}
            </p>
          )}
        </div>

        <GlassButton type="submit" fullWidth loading={submitting}>
          Submit request
        </GlassButton>
      </form>
    </GlassCard>
  )
}
