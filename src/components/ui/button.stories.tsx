import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './button'
import { Plus, Trash2, Settings } from 'lucide-react'

const meta = {
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive', 'destructive-ghost'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { variant: 'primary', children: 'Primary' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } }
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } }
export const DestructiveGhost: Story = { args: { variant: 'destructive-ghost', children: 'Remove' } }

export const Small: Story = { args: { size: 'sm', children: 'Small' } }
export const Medium: Story = { args: { size: 'md', children: 'Medium' } }
export const Large: Story = { args: { size: 'lg', children: 'Large' } }

export const WithIcon: Story = {
  args: { variant: 'primary', children: <><Plus size={16} /> Add Item</> },
}
export const Loading: Story = { args: { variant: 'primary', loading: true, children: 'Saving...' } }
export const Disabled: Story = { args: { variant: 'primary', disabled: true, children: 'Disabled' } }
export const FullWidth: Story = { args: { variant: 'primary', fullWidth: true, children: 'Full Width' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="destructive-ghost">Destructive Ghost</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon"><Settings size={18} /></Button>
    </div>
  ),
}
