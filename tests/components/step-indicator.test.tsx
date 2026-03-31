// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '../helpers/render'
import { StepIndicator } from '@/components/onboarding/step-indicator'

const STEPS = [
  { key: 'signup', label: 'Sign Up' },
  { key: 'role', label: 'Role' },
  { key: 'profile', label: 'Profile' },
]

describe('StepIndicator', () => {
  it('renders all step labels', () => {
    const { getByText } = render(
      <StepIndicator steps={STEPS} currentIndex={0} />,
    )
    expect(getByText('Sign Up')).toBeInTheDocument()
    expect(getByText('Role')).toBeInTheDocument()
    expect(getByText('Profile')).toBeInTheDocument()
  })

  it('marks the active step with aria-current="step"', () => {
    const { container } = render(
      <StepIndicator steps={STEPS} currentIndex={1} />,
    )
    const activeDots = container.querySelectorAll('[aria-current="step"]')
    expect(activeDots).toHaveLength(1)
  })

  it('renders step numbers for upcoming steps', () => {
    const { getByText } = render(
      <StepIndicator steps={STEPS} currentIndex={0} />,
    )
    // Steps 2 and 3 should show their number
    expect(getByText('2')).toBeInTheDocument()
    expect(getByText('3')).toBeInTheDocument()
  })

  it('renders connector lines between steps', () => {
    const { container } = render(
      <StepIndicator steps={STEPS} currentIndex={0} />,
    )
    // 3 steps → 2 connectors (the h-px divs between steps)
    const connectors = container.querySelectorAll('.h-px')
    expect(connectors).toHaveLength(2)
  })

  it('marks completed steps with a check icon (not a number)', () => {
    const { container, queryByText } = render(
      <StepIndicator steps={STEPS} currentIndex={2} />,
    )
    // Steps 0 and 1 are completed — they should NOT show "1" and "2"
    expect(queryByText('1')).not.toBeInTheDocument()
    expect(queryByText('2')).not.toBeInTheDocument()
    // They should have SVG check icons (lucide Check)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })

  it('has a progress nav with aria-label', () => {
    const { getByLabelText } = render(
      <StepIndicator steps={STEPS} currentIndex={0} />,
    )
    expect(getByLabelText('Progress')).toBeInTheDocument()
  })
})
