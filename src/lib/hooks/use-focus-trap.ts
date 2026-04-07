'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface UseFocusTrapOptions {
  onClose: () => void
  enabled?: boolean
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions,
): void {
  const { onClose, enabled = true } = options

  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    if (ref.current) {
      const firstFocusable = ref.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }
    return () => {
      previouslyFocusedRef.current?.focus()
    }
  }, [ref, enabled])

  useEffect(() => {
    if (!enabled) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, onClose, enabled])

  useEffect(() => {
    if (!enabled) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && ref.current?.contains(document.activeElement)) {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [ref, onClose, enabled])

  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !ref.current) return

      const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [ref, enabled])
}
