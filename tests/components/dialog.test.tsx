// @vitest-environment jsdom
/**
 * Dialog — behavior tests
 *
 * Scroll lock and content fade are now CSS-only (body:has(dialog[open]) and
 * html:has(dialog[open]) .app-shell). No JS mutations on body.style.overflow
 * or data-dialog-open — those leaks were the source of hydration errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { render } from '../helpers/render'
import { Dialog } from '@/components/ui/dialog'

// jsdom doesn't implement HTMLDialogElement.show / .showModal / .close
beforeEach(() => {
  HTMLDialogElement.prototype.show ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute('open')
  }
  // Ensure clean state between tests
  document.documentElement.removeAttribute('data-dialog-open')
  document.body.style.overflow = ''
})

describe('Dialog — CSS-only scroll lock (no JS body mutations)', () => {
  it('does NOT set body.style.overflow when a dialog opens', () => {
    render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    // CSS handles scroll lock via body:has(dialog[open]) { overflow: hidden }
    // JS must not touch body.style.overflow
    expect(document.body.style.overflow).toBe('')
  })

  it('does NOT leave body.style.overflow set after dialog closes', () => {
    const { rerender } = render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    rerender(
      <Dialog open={false} onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('does NOT set body.style.overflow on unmount while open', () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    act(() => { unmount() })
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Dialog — cleanup on unmount (error boundary safety)', () => {
  it('closes the native dialog element when component unmounts while open', () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    const dialog = document.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(true)

    act(() => { unmount() })

    // After unmount, the dialog's open attribute must be removed
    // so CSS :has(dialog[open]) evaluates to false and scroll lock releases
    expect(dialog.open).toBe(false)
  })
})

describe('Dialog — no data-dialog-open JS attribute (CSS :has() handles fade)', () => {
  it('does NOT set data-dialog-open on html when a dialog opens', () => {
    render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(document.documentElement.hasAttribute('data-dialog-open')).toBe(false)
  })

  it('does NOT leave data-dialog-open after dialog closes', () => {
    const { rerender } = render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    rerender(
      <Dialog open={false} onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(document.documentElement.hasAttribute('data-dialog-open')).toBe(false)
  })

  it('does NOT leave data-dialog-open after unmount while open', () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    act(() => { unmount() })
    expect(document.documentElement.hasAttribute('data-dialog-open')).toBe(false)
  })
})

describe('Dialog a11y', () => {
  it('has aria-modal="true" on the dialog element', () => {
    render(
      <Dialog open onClose={() => {}}>
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when Escape fires the cancel event', () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose}>
        <p>Content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    dialog.dispatchEvent(new Event('cancel', { cancelable: true, bubbles: false }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('Dialog design compliance', () => {
  it('standard dialog panel has no inline backdropFilter', () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <p>Content</p>
      </Dialog>,
    )
    const panel = document.querySelector('.glass-container') as HTMLElement
    expect(panel).toBeInTheDocument()
    expect(panel.style.backdropFilter).toBe('')
    expect(panel.style.getPropertyValue('-webkit-backdrop-filter')).toBe('')
  })

  it('fullScreen dialog panel has no inline backdropFilter', () => {
    render(
      <Dialog open onClose={() => {}} title="Test" fullScreen>
        <p>Content</p>
      </Dialog>,
    )
    const panel = document.querySelector('.dialog-fullscreen-panel') as HTMLElement
    expect(panel).toBeInTheDocument()
    expect(panel.style.backdropFilter).toBe('')
    expect(panel.style.getPropertyValue('-webkit-backdrop-filter')).toBe('')
  })

  it('close button has adequate touch target (p-2)', () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <p>Content</p>
      </Dialog>,
    )
    const closeBtn = screen.getByLabelText('Close dialog')
    expect(closeBtn.className).toContain('p-2')
    expect(closeBtn.className).not.toContain('p-1')
  })

  it('fullScreen close button has adequate touch target (p-2)', () => {
    render(
      <Dialog open onClose={() => {}} title="Test" fullScreen>
        <p>Content</p>
      </Dialog>,
    )
    const closeBtn = screen.getByLabelText('Close dialog')
    expect(closeBtn.className).toContain('p-2')
    expect(closeBtn.className).not.toContain('p-1')
  })
})
