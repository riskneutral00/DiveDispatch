// @vitest-environment jsdom
import type { FormEvent } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../helpers/render'
import { ProfileFormShell } from '@/components/profiles/profile-form-shell'

const noopSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
}

describe('ProfileFormShell', () => {
  it('shows loading UI instead of form when loading', () => {
    const { container } = render(
      <ProfileFormShell
        loading
        onSubmit={noopSubmit}
        saving={false}
        saved={false}
        isDirty={false}
        isUpdate={false}
      >
        <p>Fields</p>
      </ProfileFormShell>,
    )
    expect(screen.queryByText('Fields')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders form with children and submit handler when not loading', () => {
    const onSubmit = vi.fn((e: FormEvent<HTMLFormElement>) => e.preventDefault())
    render(
      <ProfileFormShell
        loading={false}
        onSubmit={onSubmit}
        saving={false}
        saved={false}
        isDirty
        isUpdate
        errorMessage="Server says no"
      >
        <p>Fields</p>
      </ProfileFormShell>,
    )
    expect(screen.getByText('Fields')).toBeInTheDocument()
    expect(screen.getByText('Server says no')).toBeInTheDocument()
    const form = document.querySelector('form')
    expect(form).toBeTruthy()
    fireEvent.submit(form!)
    expect(onSubmit).toHaveBeenCalled()
  })

  it('uses footerErrorMessage as the canonical footer error', () => {
    render(
      <ProfileFormShell
        loading={false}
        onSubmit={noopSubmit}
        saving={false}
        saved={false}
        isDirty
        isUpdate
        errorMessage="Legacy error"
        footerErrorMessage="Canonical error"
      >
        <p>Fields</p>
      </ProfileFormShell>,
    )
    expect(screen.getByText('Canonical error')).toBeInTheDocument()
    expect(screen.queryByText('Legacy error')).not.toBeInTheDocument()
  })

  it('disables save when disableSaveWhenInvalid and not isValid', () => {
    render(
      <ProfileFormShell
        loading={false}
        onSubmit={noopSubmit}
        saving={false}
        saved={false}
        isDirty
        isUpdate
        disableSaveWhenInvalid
        isValid={false}
      >
        <p>Fields</p>
      </ProfileFormShell>,
    )
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled()
  })
})
