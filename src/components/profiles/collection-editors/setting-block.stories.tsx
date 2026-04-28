import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SettingBlock } from './setting-block'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const meta = {
  component: SettingBlock,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof SettingBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Plain: Story = {
  args: {
    label: 'Business Name',
    children: <Input value="Sea Fun Divers" onChange={() => {}} className="field-md" />,
  },
}

export const WithNote: Story = {
  args: {
    label: 'Email',
    note: "We'll only use this for booking confirmations.",
    children: <Input type="email" value="contact@example.com" onChange={() => {}} className="field-lg" />,
  },
}

export const WithAction: Story = {
  args: {
    label: 'Phone',
    action: <Button variant="ghost" size="sm">Verify</Button>,
    children: <Input value="+12345678901" onChange={() => {}} className="field-md" />,
  },
}

export const Required: Story = {
  args: {
    label: 'Country',
    required: true,
    children: <Input value="US" onChange={() => {}} className="field-md" />,
  },
}

export const Glass: Story = {
  args: {
    label: 'Languages Spoken',
    surface: 'glass',
    children: <div className="text-secondary">English, Thai, Mandarin</div>,
  },
}
