import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FieldShell } from './field-shell'

const meta = {
  component: FieldShell,
  args: {
    id: 'demo-field',
  },
} satisfies Meta<typeof FieldShell>
export default meta
type Story = StoryObj<typeof meta>

export const WithLabel: Story = {
  args: {
    label: 'Field label',
    children: <input className="field-underline w-full px-0 py-2.5 text-body" placeholder="Input inside shell" />,
  },
}
export const Required: Story = {
  args: {
    label: 'Required field',
    required: true,
    children: <input className="field-underline w-full px-0 py-2.5 text-body" placeholder="Required" />,
  },
}
export const WithError: Story = {
  args: {
    label: 'Email',
    error: 'Invalid email address',
    children: <input className="field-underline w-full px-0 py-2.5 text-body" defaultValue="bad-email" />,
  },
}
export const WithHelperText: Story = {
  args: {
    label: 'Phone',
    helperText: 'Include country code',
    children: <input className="field-underline w-full px-0 py-2.5 text-body" placeholder="+66..." />,
  },
}
