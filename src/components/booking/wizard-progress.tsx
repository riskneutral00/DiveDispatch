import { WIZARD_STEPS, WIZARD_STEP_LABELS, stepIndex, type WizardStep } from '@/lib/booking/wizard-state'
import { StepIndicator } from '@/components/ui/step-indicator'

const STEPS = WIZARD_STEPS.map((s) => ({ key: s, label: WIZARD_STEP_LABELS[s] }))

interface WizardProgressProps {
  currentStep: WizardStep
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <StepIndicator
      steps={STEPS}
      currentIndex={stepIndex(currentStep)}
      size="md"
      variant="filled"
      hideLabelsOnMobile
      connectorMode="flex"
    />
  )
}
