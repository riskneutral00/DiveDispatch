// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveButton } from '@/components/ui/save-button'

describe('SaveButton', () => {
  it('shows "Save" label for updates', () => {
    render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={true} />)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('shows "Create Profile" for new profiles', () => {
    render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={false} />)
    expect(screen.getByText('Create Profile')).toBeTruthy()
  })

  it('shows custom label when provided', () => {
    render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={true} label="Update" />)
    expect(screen.getByText('Update')).toBeTruthy()
  })

  it('shows "Saved" with green style when saved=true', () => {
    const { container } = render(<SaveButton saving={false} saved={true} isDirty={false} isUpdate={true} />)
    expect(screen.getByText('Saved')).toBeTruthy()
    const button = container.querySelector('button')!
    expect(button.style.background).toBe('var(--color-active-fg)')
  })

  it('disabled when isUpdate and not dirty', () => {
    const { container } = render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={true} />)
    expect(container.querySelector('button')!.disabled).toBe(true)
  })

  it('disabled when saving', () => {
    const { container } = render(<SaveButton saving={true} saved={false} isDirty={true} isUpdate={true} />)
    expect(container.querySelector('button')!.disabled).toBe(true)
  })

  it('enabled when dirty and not saving', () => {
    const { container } = render(<SaveButton saving={false} saved={false} isDirty={true} isUpdate={true} />)
    expect(container.querySelector('button')!.disabled).toBe(false)
  })

  it('no green state on initial mount with saved=false', () => {
    const { container } = render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={true} />)
    const button = container.querySelector('button')!
    expect(button.style.background).not.toBe('var(--color-active-fg)')
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('not disabled for create when not saving', () => {
    const { container } = render(<SaveButton saving={false} saved={false} isDirty={false} isUpdate={false} />)
    expect(container.querySelector('button')!.disabled).toBe(false)
  })
})
