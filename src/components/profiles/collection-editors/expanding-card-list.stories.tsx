import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ExpandingCardList } from './expanding-card-list'
import { Input } from '@/components/ui/input'

type Vessel = {
  name: string
  type: string
  capacity: number
}

function emptyVessel(): Vessel {
  return { name: '', type: '', capacity: 0 }
}

const meta = {
  component: ExpandingCardList<Vessel>,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof ExpandingCardList<Vessel>>

export default meta
type Story = StoryObj<typeof meta>

function VesselBody({
  vessel,
  update,
}: {
  vessel: Vessel
  update: (next: Vessel) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        label="Boat Name"
        value={vessel.name}
        onChange={(e) => update({ ...vessel, name: e.target.value })}
        className="field-md"
      />
      <Input
        label="Boat Type"
        value={vessel.type}
        onChange={(e) => update({ ...vessel, type: e.target.value })}
        className="field-md"
      />
      <Input
        label="Capacity"
        value={String(vessel.capacity)}
        onChange={(e) => update({ ...vessel, capacity: Number(e.target.value) })}
        className="field-xs"
      />
    </div>
  )
}

function Wrapper(props: { initial: Vessel[]; defaultExpandFirst?: boolean; minItems?: number }) {
  const [items, setItems] = useState<Vessel[]>(props.initial)
  return (
    <ExpandingCardList<Vessel>
      label="Fleet"
      addLabel="Add Vessel"
      items={items}
      onChange={setItems}
      emptyItem={emptyVessel}
      itemKey={(_v, i) => String(i)}
      defaultExpandFirst={props.defaultExpandFirst}
      minItems={props.minItems}
      removeAriaLabel={(_v, i) => `Remove vessel ${i + 1}`}
      renderCardTitle={(v, i) => `Vessel ${i + 1}${v.name ? ` — ${v.name}` : ''}`}
      renderExpandedBody={(v, update) => <VesselBody vessel={v} update={update} />}
    />
  )
}

export const Empty: Story = {
  args: {
    label: 'Fleet',
    addLabel: 'Add Vessel',
    items: [],
    renderCardTitle: () => '',
    renderExpandedBody: () => null,
    itemKey: (_v, i) => String(i),
    emptyMessage: 'No vessels yet — add your first.',
  },
  render: () => <Wrapper initial={[]} />,
}

export const FirstExpanded: Story = {
  args: {
    label: 'Fleet',
    addLabel: 'Add Vessel',
    items: [],
    renderCardTitle: () => '',
    renderExpandedBody: () => null,
    itemKey: (_v, i) => String(i),
  },
  render: () => (
    <Wrapper
      defaultExpandFirst
      initial={[
        { name: 'Sea Fun I', type: 'Day Boat', capacity: 12 },
        { name: 'Sea Fun II', type: 'Day Boat', capacity: 8 },
      ]}
    />
  ),
}

export const MinItemsOne: Story = {
  args: {
    label: 'Fleet',
    addLabel: 'Add Vessel',
    items: [],
    renderCardTitle: () => '',
    renderExpandedBody: () => null,
    itemKey: (_v, i) => String(i),
  },
  render: () => <Wrapper initial={[emptyVessel()]} minItems={1} defaultExpandFirst />,
}
