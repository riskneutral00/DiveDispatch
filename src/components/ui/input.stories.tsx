import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from './input'
import { Search, Mail } from 'lucide-react'

const meta = {
  component: Input,
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
}
export const WithLabel: Story = {
  args: { label: 'Email', placeholder: 'you@example.com', type: 'email' },
}
export const WithError: Story = {
  args: { label: 'Email', error: 'Invalid email address', defaultValue: 'not-an-email' },
}
export const Disabled: Story = {
  args: { label: 'Name', disabled: true, defaultValue: 'Disabled input' },
}
export const WithLeadingIcon: Story = {
  args: { label: 'Search', leadingIcon: <Search size={16} />, placeholder: 'Search...' },
}
export const WithTrailingIcon: Story = {
  args: { label: 'Email', trailingIcon: <Mail size={16} />, placeholder: 'Enter email' },
}
export const Required: Story = {
  args: { label: 'Required field', required: true, placeholder: 'This is required' },
}
export const DateInput: Story = {
  args: { label: 'Start date', type: 'date' },
}
export const TelInput: Story = {
  args: { label: 'Phone', type: 'tel', placeholder: '+66 8X XXX XXXX' },
}
