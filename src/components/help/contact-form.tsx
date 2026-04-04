'use client'

import { Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import type { Id } from '@/lib/convex-generated'
import { api } from '@/lib/convex-generated'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { getConvexErrorCode, parseConvexError } from '@/lib/utils/convex-error'

const CATEGORIES = [
  { value: 'Bug', label: 'Bug' },
  { value: 'Feature Request', label: 'Feature Request' },
  { value: 'Question', label: 'Question' },
  { value: 'Account Issue', label: 'Account Issue' },
] as const

type SupportCategory = (typeof CATEGORIES)[number]['value']

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

async function uploadScreenshotToConvex(
  generateUploadUrl: () => Promise<string>,
  file: File,
): Promise<Id<'_storage'>> {
  const postUrl = await generateUploadUrl()
  const result = await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!result.ok) {
    throw new Error('Upload failed')
  }
  const json = (await result.json()) as { storageId: Id<'_storage'> }
  return json.storageId
}

export function ContactForm() {
  const submitSupportRequest = useMutation(api.support.submitSupportRequest)
  const generateUploadUrl = useMutation(api.support.generateUploadUrl)

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
      let screenshotStorageId: Id<'_storage'> | undefined
      if (screenshot) {
        screenshotStorageId = await uploadScreenshotToConvex(generateUploadUrl, screenshot)
      }
      await submitSupportRequest({
        subject: form.subject.trim(),
        category: form.category as SupportCategory,
        message: form.message.trim(),
        screenshotStorageId,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      const code = getConvexErrorCode(err)
      if (code === 'RATE_LIMITED') {
        setErrors({
          subject: 'Too many requests. Please wait a minute and try again.',
        })
      } else {
        setErrors({
          subject: parseConvexError(err, 'Submission failed. Please try again.'),
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card padding="lg" className="text-center">
        <p
          className="font-semibold text-base mb-1 text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Request submitted
        </p>
        <p className="text-sm text-secondary">
          {"Your request has been submitted. We'll get back to you soon."}
        </p>
      </Card>
    )
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Brief summary of your issue"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          error={errors.subject}
        />

        {/* Category */}
        <SimpleSelect
          label="Category"
          value={form.category}
          onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          options={CATEGORIES.map(({ value, label }) => ({ value, label }))}
          placeholder="Select a category"
          error={errors.category}
        />

        {/* Message */}
        <Textarea
          label="Message"
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Describe your issue in detail (minimum 10 characters)"
          rows={5}
          error={errors.message}
        />

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

        <Button type="submit" fullWidth loading={submitting}>
          Submit request
        </Button>
      </form>
    </Card>
  )
}
