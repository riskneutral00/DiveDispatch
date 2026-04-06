'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface UseFocusTrapOptions {
  onClose: () => void
  enabled?: boolean
}

/**
 * Traps focus within a container element.
 *
 * Handles:
 * - Focus-on-mount (first focusable child)
 * - Focus-restore-on-unmount (previously focused element)
 * - Outside click detection (calls onClose)
 * - Escape key handling (calls onClose)
 * - Tab/Shift+Tab wrapping within the container
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions,
): void {
  const { onClose, enabled = true } = options

  // Capture previously-focused element synchronously (before effects move focus)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  if (enabled && previouslyFocusedRef.current === null) {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
  }

  // Focus first focusable child on mount
  useEffect(() => {
    if (!enabled) return
    if (ref.current) {
      const firstFocusable = ref.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }
  }, [ref, enabled])

  // Restore focus to previously-focused element on unmount
  useEffect(() => {
    if (!enabled) return
    return () => {
      previouslyFocusedRef.current?.focus()
    }
  }, [enabled])

  // Close on outside click
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

  // Close on Escape (scoped — only when container has focus)
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

  // Tab / Shift+Tab wrapping within the container
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
