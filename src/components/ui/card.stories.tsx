import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card } from './card'

const meta = {
  component: Card,
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: <p className="text-primary">Default card content</p>,
  },
}
export const SmallPadding: Story = {
  args: {
    padding: 'sm',
    children: <p className="text-primary">Small padding</p>,
  },
}
export const MediumPadding: Story = {
  args: {
    padding: 'md',
    children: <p className="text-primary">Medium padding</p>,
  },
}
export const LargePadding: Story = {
  args: {
    padding: 'lg',
    children: <p className="text-primary">Large padding</p>,
  },
}
export const Hoverable: Story = {
  args: {
    hoverable: true,
    children: <p className="text-primary">Hover me</p>,
  },
}
