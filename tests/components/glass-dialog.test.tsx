// @vitest-environment jsdom
/**
 * GlassDialog — backdrop content fade behavior
 *
 * When a GlassDialog opens, it sets [data-dialog-open] on <html> so CSS can
 * fade the .app-shell content to zero opacity. Ref-counted so nested dialogs
 * (e.g., booking detail > cancel confirmation) don't flash content on inner close.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '../helpers/render'
import { GlassDialog } from '@/components/glass/glass-dialog'

// jsdom doesn't implement HTMLDialogElement.showModal / .close
beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute('open')
  }
  // Clean up attribute between tests
  document.documentElement.removeAttribute('data-dialog-open')
})

describe('GlassDialog backdrop content fade', () => {
  it('adds [data-dialog-open] to <html> when opened', () => {
    render(
      <GlassDialog open onClose={() => {}}>
        <p>Content</p>
      </GlassDialog>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')
  })

  it('removes [data-dialog-open] from <html> when closed', () => {
    const { rerender } = render(
      <GlassDialog open onClose={() => {}}>
        <p>Content</p>
      </GlassDialog>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')

    rerender(
      <GlassDialog open={false} onClose={() => {}}>
        <p>Content</p>
      </GlassDialog>,
    )
    expect(document.documentElement).not.toHaveAttribute('data-dialog-open')
  })

  it('ref-counts: two dialogs open, closing one keeps the attribute', () => {
    const { rerender } = render(
      <>
        <GlassDialog open onClose={() => {}}>
          <p>Dialog A</p>
        </GlassDialog>
        <GlassDialog open onClose={() => {}}>
          <p>Dialog B</p>
        </GlassDialog>
      </>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')

    // Close dialog B, dialog A still open
    rerender(
      <>
        <GlassDialog open onClose={() => {}}>
          <p>Dialog A</p>
        </GlassDialog>
        <GlassDialog open={false} onClose={() => {}}>
          <p>Dialog B</p>
        </GlassDialog>
      </>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')
  })

  it('ref-counts: closing all dialogs removes the attribute', () => {
    const { rerender } = render(
      <>
        <GlassDialog open onClose={() => {}}>
          <p>Dialog A</p>
        </GlassDialog>
        <GlassDialog open onClose={() => {}}>
          <p>Dialog B</p>
        </GlassDialog>
      </>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')

    rerender(
      <>
        <GlassDialog open={false} onClose={() => {}}>
          <p>Dialog A</p>
        </GlassDialog>
        <GlassDialog open={false} onClose={() => {}}>
          <p>Dialog B</p>
        </GlassDialog>
      </>,
    )
    expect(document.documentElement).not.toHaveAttribute('data-dialog-open')
  })

  it('cleans up on unmount while open', () => {
    const { unmount } = render(
      <GlassDialog open onClose={() => {}}>
        <p>Content</p>
      </GlassDialog>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')

    unmount()
    expect(document.documentElement).not.toHaveAttribute('data-dialog-open')
  })

  it('nested unmount with outer still open preserves attribute', () => {
    const Inner = ({ show }: { show: boolean }) =>
      show ? (
        <GlassDialog open onClose={() => {}}>
          <p>Inner</p>
        </GlassDialog>
      ) : null

    const { rerender } = render(
      <>
        <GlassDialog open onClose={() => {}}>
          <p>Outer</p>
        </GlassDialog>
        <Inner show />
      </>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')

    rerender(
      <>
        <GlassDialog open onClose={() => {}}>
          <p>Outer</p>
        </GlassDialog>
        <Inner show={false} />
      </>,
    )
    expect(document.documentElement).toHaveAttribute('data-dialog-open')
  })
})
