// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '../helpers/render'

vi.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-signin">Clerk Sign In</div>,
}))

vi.mock('@/app/(auth)/clerk-glass-appearance', () => ({
  clerkGlassAppearance: {},
}))

import SignInPage from '@/app/(auth)/sign-in/[[...sign-in]]/page'

describe('Sign-in page', () => {
  it('renders Clerk SignIn widget immediately', () => {
    const { getByTestId } = render(<SignInPage />)
    expect(getByTestId('clerk-signin')).toBeInTheDocument()
  })
})
