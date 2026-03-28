// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '../helpers/render'
import PrivacyPage from '@/app/privacy/page'

describe('PrivacyPage', () => {
  it('1 — renders the page heading', () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/privacy policy/i)
  })

  it('2 — lists data collection types: contact, passport, medical, signature', () => {
    render(<PrivacyPage />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('contact')
    expect(text).toContain('passport')
    expect(text).toContain('medical')
    expect(text).toContain('signature')
  })

  it('3 — explains purpose: coordinate dive bookings and ensure diver safety', () => {
    render(<PrivacyPage />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/dive bookings/i)
    expect(text).toMatch(/diver safety/i)
  })

  it('4 — explains who sees data: the dive center operating the booking', () => {
    render(<PrivacyPage />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/dive center/i)
  })

  it('5 — includes retention and deletion rights section', () => {
    render(<PrivacyPage />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/retention/i)
    expect(text).toMatch(/delet/i)
  })

  it('6 — includes PDPA/GDPR language', () => {
    render(<PrivacyPage />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/PDPA|GDPR/i)
  })
})
