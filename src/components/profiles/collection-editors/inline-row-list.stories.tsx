import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InlineRowList } from './inline-row-list'
import { Input } from '@/components/ui/input'

type Credential = {
  agency: string
  level: string
  agencyID: string
}

function makeEmpty(): Credential {
  return { agency: '', level: '', agencyID: '' }
}

function CredentialRow({
  cred,
  update,
}: {
  cred: Credential
  update: (next: Credential) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        label="Agency"
        value={cred.agency}
        onChange={(e) => update({ ...cred, agency: e.target.value })}
        className="field-sm"
      />
      <Input
        label="Level"
        value={cred.level}
        onChange={(e) => update({ ...cred, level: e.target.value })}
        className="field-sm"
      />
      <Input
        label="Agency ID"
        value={cred.agencyID}
        onChange={(e) => update({ ...cred, agencyID: e.target.value })}
        className="field-md"
      />
    </div>
  )
}

const meta = {
  component: InlineRowList<Credential>,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof InlineRowList<Credential>>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper(props: { initial: Credential[]; minItems?: number; maxItems?: number }) {
  const [items, setItems] = useState<Credential[]>(props.initial)
  return (
    <InlineRowList<Credential>
      label="Dive Credentials"
      addLabel="Add Credential"
      items={items}
      onChange={setItems}
      emptyItem={makeEmpty}
      minItems={props.minItems}
      maxItems={props.maxItems}
      removeAriaLabel={() => 'Remove credential'}
      renderRow={(cred, update) => <CredentialRow cred={cred} update={update} />}
    />
  )
}

export const Empty: Story = {
  args: {
    label: 'Dive Credentials',
    addLabel: 'Add Credential',
    items: [],
    onChange: () => {},
    emptyItem: makeEmpty,
    renderRow: () => null,
    emptyMessage: 'No credentials yet — add your first.',
  },
  render: () => <Wrapper initial={[]} />,
}

export const Seeded: Story = {
  args: {
    label: 'Dive Credentials',
    addLabel: 'Add Credential',
    items: [],
    onChange: () => {},
    emptyItem: makeEmpty,
    renderRow: () => null,
  },
  render: () => (
    <Wrapper
      initial={[
        { agency: 'PADI', level: 'OWSI', agencyID: 'PADI-1' },
        { agency: 'SSI', level: 'OWI', agencyID: 'SSI-2' },
      ]}
    />
  ),
}

export const MinItemsOne: Story = {
  args: {
    label: 'Dive Credentials',
    addLabel: 'Add Credential',
    items: [],
    onChange: () => {},
    emptyItem: makeEmpty,
    renderRow: () => null,
  },
  render: () => <Wrapper initial={[makeEmpty()]} minItems={1} />,
}

export const MaxItemsTwo: Story = {
  args: {
    label: 'Dive Credentials',
    addLabel: 'Add Credential',
    items: [],
    onChange: () => {},
    emptyItem: makeEmpty,
    renderRow: () => null,
  },
  render: () => <Wrapper initial={[makeEmpty()]} maxItems={2} />,
}
