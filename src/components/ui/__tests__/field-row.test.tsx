// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldRow } from '../field-row'

const CANONICAL_LITERAL =
  'grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4'

describe('FieldRow', () => {
  describe('unlabeled mode (no label prop)', () => {
    it('renders children', () => {
      render(
        <FieldRow>
          <span data-testid="child">hello</span>
        </FieldRow>,
      )
      expect(screen.getByTestId('child')).toHaveTextContent('hello')
    })

    it('does not render a fieldset or legend', () => {
      const { container } = render(
        <FieldRow>
          <span>x</span>
        </FieldRow>,
      )
      expect(container.querySelector('fieldset')).toBeNull()
      expect(container.querySelector('legend')).toBeNull()
    })

    it('outer wrapper is a div with the canonical literal including sm:items-end', () => {
      const { container } = render(
        <FieldRow>
          <span>x</span>
        </FieldRow>,
      )
      const outer = container.firstElementChild as HTMLElement
      expect(outer.tagName).toBe('DIV')
      for (const cls of CANONICAL_LITERAL.split(' ')) {
        expect(outer.className).toContain(cls)
      }
    })

    it('merges className into outer wrapper', () => {
      const { container } = render(
        <FieldRow className="mt-4 custom-unlabeled">
          <span>x</span>
        </FieldRow>,
      )
      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('mt-4')
      expect(outer.className).toContain('custom-unlabeled')
    })

    it('allows callsite className to override baked classes via tailwind-merge (gear-matrix gap case)', () => {
      const { container } = render(
        <FieldRow className="sm:gap-3">
          <span>x</span>
        </FieldRow>,
      )
      const outer = container.firstElementChild as HTMLElement
      expect(outer.className).toContain('sm:gap-3')
      expect(outer.className).not.toContain('sm:gap-4')
    })
  })

  describe('labeled mode (label prop set)', () => {
    it('renders fieldset with legend containing the label', () => {
      render(
        <FieldRow label="Group label">
          <span>x</span>
        </FieldRow>,
      )
      const fieldset = screen.getByRole('group')
      expect(fieldset.tagName).toBe('FIELDSET')
      const legend = fieldset.querySelector('legend')
      expect(legend).not.toBeNull()
      expect(legend).toHaveTextContent('Group label')
    })

    it('labeled fieldset carries role="group"', () => {
      render(
        <FieldRow label="G">
          <span>x</span>
        </FieldRow>,
      )
      expect(screen.getByRole('group')).toBeInTheDocument()
    })

    it('renders RequiredAsterisk when required is true', () => {
      render(
        <FieldRow label="G" required>
          <span>x</span>
        </FieldRow>,
      )
      const legend = screen.getByRole('group').querySelector('legend')!
      const asterisk = legend.querySelector('[aria-hidden="true"]')
      expect(asterisk).not.toBeNull()
      expect(asterisk!.textContent).toContain('*')
    })

    it('does not render an asterisk when required is false/undefined', () => {
      render(
        <FieldRow label="G">
          <span>x</span>
        </FieldRow>,
      )
      const legend = screen.getByRole('group').querySelector('legend')!
      const asterisk = legend.querySelector('[aria-hidden="true"]')
      expect(asterisk).toBeNull()
    })

    it('inner grid uses the canonical literal (including sm:items-end)', () => {
      render(
        <FieldRow label="G">
          <span data-testid="child">x</span>
        </FieldRow>,
      )
      const child = screen.getByTestId('child')
      const innerGrid = child.parentElement as HTMLElement
      for (const cls of CANONICAL_LITERAL.split(' ')) {
        expect(innerGrid.className).toContain(cls)
      }
    })

    it('merges className into the outer fieldset, not the inner grid', () => {
      const { container } = render(
        <FieldRow label="G" className="mt-6 outer-only">
          <span>x</span>
        </FieldRow>,
      )
      const fieldset = container.querySelector('fieldset') as HTMLElement
      expect(fieldset.className).toContain('mt-6')
      expect(fieldset.className).toContain('outer-only')
      const innerGrid = fieldset.querySelector('div') as HTMLElement
      expect(innerGrid.className).not.toContain('mt-6')
      expect(innerGrid.className).not.toContain('outer-only')
    })

    it('does not set aria-invalid on the fieldset', () => {
      render(
        <FieldRow label="G" error="Bad input">
          <span>x</span>
        </FieldRow>,
      )
      const fieldset = screen.getByRole('group')
      expect(fieldset.hasAttribute('aria-invalid')).toBe(false)
    })

    it('wires aria-describedby to the error paragraph id when error is set', () => {
      render(
        <FieldRow label="G" error="Broken">
          <span>x</span>
        </FieldRow>,
      )
      const fieldset = screen.getByRole('group')
      const describedBy = fieldset.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      const errorPara = document.getElementById(describedBy!)
      expect(errorPara).not.toBeNull()
      expect(errorPara).toHaveTextContent('Broken')
      expect(errorPara).toHaveAttribute('role', 'alert')
    })

    it('does not set aria-describedby when no error is present', () => {
      render(
        <FieldRow label="G">
          <span>x</span>
        </FieldRow>,
      )
      const fieldset = screen.getByRole('group')
      expect(fieldset.hasAttribute('aria-describedby')).toBe(false)
      expect(fieldset.querySelector('[role="alert"]')).toBeNull()
    })

    it('renders children unmodified inside the inner grid', () => {
      render(
        <FieldRow label="G">
          <span data-testid="a">A</span>
          <span data-testid="b">B</span>
        </FieldRow>,
      )
      expect(screen.getByTestId('a')).toHaveTextContent('A')
      expect(screen.getByTestId('b')).toHaveTextContent('B')
    })

    it('FieldRow does not call useTranslations (label passes through unchanged)', () => {
      render(
        <FieldRow label="raw-literal-not-a-key">
          <span>x</span>
        </FieldRow>,
      )
      const legend = screen.getByRole('group').querySelector('legend')!
      expect(legend.textContent).toContain('raw-literal-not-a-key')
    })
  })
})
