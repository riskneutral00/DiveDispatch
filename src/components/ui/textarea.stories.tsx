import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Textarea } from './textarea'

const meta = {
  component: Textarea,
} satisfies Meta<typeof Textarea>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Enter notes...' },
}
export const WithLabel: Story = {
  args: { label: 'Notes', placeholder: 'Additional information...' },
}
export const WithError: Story = {
  args: { label: 'Notes', error: 'Notes are required', defaultValue: '' },
}
export const Disabled: Story = {
  args: { label: 'Notes', disabled: true, defaultValue: 'Cannot edit this' },
}
export const Required: Story = {
  args: { label: 'Description', required: true, placeholder: 'Required field' },
}
