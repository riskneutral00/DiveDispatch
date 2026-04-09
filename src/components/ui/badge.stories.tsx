import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './badge'

const meta = {
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'destructive', 'info', 'muted'],
    },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Badge>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { variant: 'default', children: 'Default' } }
export const Success: Story = { args: { variant: 'success', children: 'Confirmed' } }
export const Warning: Story = { args: { variant: 'warning', children: 'Pending' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Cancelled' } }
export const Info: Story = { args: { variant: 'info', children: 'Info' } }
export const Muted: Story = { args: { variant: 'muted', children: 'Muted' } }

export const WithDot: Story = { args: { variant: 'success', dot: true, children: 'Active' } }
export const SmallSize: Story = { args: { variant: 'warning', size: 'sm', children: 'Small' } }

export const AllVariants: Story = {
  args: { children: '' },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success" dot>Confirmed</Badge>
      <Badge variant="warning" dot>Pending</Badge>
      <Badge variant="destructive" dot>Cancelled</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="muted">Muted</Badge>
    </div>
  ),
}

export const AllSizes: Story = {
  args: { children: '' },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="sm" variant="success">Small</Badge>
      <Badge size="md" variant="success">Medium</Badge>
    </div>
  ),
}
