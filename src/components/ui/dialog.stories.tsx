import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Dialog } from './dialog'
import { Button } from './button'

const meta = {
  component: Dialog,
  args: {
    open: true,
    onClose: () => {},
    title: 'Dialog Title',
    children: <p className="text-primary">Dialog content goes here.</p>,
  },
} satisfies Meta<typeof Dialog>
export default meta
type Story = StoryObj<typeof meta>

export const Small: Story = { args: { size: 'sm', title: 'Small Dialog' } }
export const Medium: Story = { args: { size: 'md', title: 'Medium Dialog' } }
export const Large: Story = { args: { size: 'lg', title: 'Large Dialog' } }

export const WithDescription: Story = {
  args: {
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    children: (
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </div>
    ),
  },
}

export const FullScreen: Story = {
  args: {
    fullScreen: true,
    title: 'Full Screen Dialog',
    children: <p className="text-primary">This dialog is full screen on mobile.</p>,
  },
}

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Interactive Dialog">
          <p className="text-primary mb-4">Click the X or press Escape to close.</p>
          <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
        </Dialog>
      </>
    )
  },
}
