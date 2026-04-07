import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { IconButton } from './icon-button'
import { Settings, X, Menu, Bell, Search } from 'lucide-react'

const meta = {
  component: IconButton,
  argTypes: {
    variant: { control: 'select', options: ['glass', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof IconButton>
export default meta
type Story = StoryObj<typeof meta>

export const Glass: Story = {
  args: { variant: 'glass', children: <Settings size={18} /> },
}
export const Ghost: Story = {
  args: { variant: 'ghost', children: <X size={18} /> },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-3">
      <IconButton variant="glass"><Settings size={18} /></IconButton>
      <IconButton variant="ghost"><X size={18} /></IconButton>
      <IconButton variant="glass"><Menu size={18} /></IconButton>
      <IconButton variant="ghost"><Bell size={18} /></IconButton>
      <IconButton variant="glass"><Search size={18} /></IconButton>
    </div>
  ),
}

export const Disabled: Story = {
  args: { variant: 'glass', disabled: true, children: <Settings size={18} /> },
}
