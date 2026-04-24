import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InstructorPicker } from './instructor-picker'

const meta = {
  component: InstructorPicker,
} satisfies Meta<typeof InstructorPicker>
export default meta
type Story = StoryObj<typeof meta>

const sampleOptions = [
  { id: 'instructor-1', label: 'John Smith' },
  { id: 'instructor-2', label: 'Jane Doe' },
  { id: 'instructor-3', label: 'Mike Johnson' },
]

export const Default: Story = {
  args: { value: '', onChange: () => {}, options: sampleOptions },
  render: () => {
    const [value, setValue] = useState('')
    return (
      <InstructorPicker
        label="Instructor"
        value={value}
        onChange={setValue}
        options={sampleOptions}
      />
    )
  },
}

export const WithSelection: Story = {
  args: { value: 'instructor-1', onChange: () => {}, options: sampleOptions },
  render: () => {
    const [value, setValue] = useState('instructor-1')
    return (
      <InstructorPicker
        label="Instructor"
        value={value}
        onChange={setValue}
        options={sampleOptions}
      />
    )
  },
}

export const WithError: Story = {
  args: { value: '', onChange: () => {}, options: sampleOptions },
  render: () => {
    const [value, setValue] = useState('')
    return (
      <InstructorPicker
        label="Instructor"
        value={value}
        onChange={setValue}
        options={sampleOptions}
        error="Selection required"
        required
      />
    )
  },
}

export const WithHelperText: Story = {
  args: { value: '', onChange: () => {}, options: [] },
  render: () => {
    const [value, setValue] = useState('')
    return (
      <InstructorPicker
        label="Boat"
        value={value}
        onChange={setValue}
        options={[
          { id: 'boat-1', label: 'MV Sea Rider' },
          { id: 'boat-2', label: 'MV Ocean Spirit' },
        ]}
        helperText="Choose the vessel for this trip"
      />
    )
  },
}
