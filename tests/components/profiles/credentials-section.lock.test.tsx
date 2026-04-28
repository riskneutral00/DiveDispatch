// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../helpers/render'
import { PersonalCredentialsSection } from '@/components/profiles/personal-profile-form'

const create = vi.fn().mockResolvedValue('staff_1')
const update = vi.fn().mockResolvedValue(undefined)

const baseProps = {
  profile: null as Record<string, unknown> | null,
  me: {
    firstName: 'Test',
    lastName: 'User',
    phone: '+12345678901',
    email: 'test@divedispatch.dev',
    dateOfBirth: '1990-01-01',
    appLanguage: 'en',
    address: undefined,
  } as Record<string, unknown>,
  create,
  update,
  onSaved: vi.fn(),
  onClose: vi.fn(),
}

const seeded = {
  credential: [
    { agency: 'PADI', level: 'OWSI', agencyID: 'PADI-1', specialtyRatings: ['DSD'] },
    { agency: 'SSI', level: 'OWI', agencyID: 'SSI-2', specialtyRatings: [] },
  ],
} as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PersonalCredentialsSection — InlineRowList migration lock', () => {
  it('renders one empty credential row by default', () => {
    render(<PersonalCredentialsSection {...baseProps} />)
    const agencySelects = screen.getAllByLabelText(/^Agency \*$/)
    expect(agencySelects).toHaveLength(1)
  })

  it('renders one row per seeded credential, in order', () => {
    render(<PersonalCredentialsSection {...baseProps} profile={seeded} />)
    const agencySelects = screen.getAllByLabelText(/^Agency \*$/) as HTMLSelectElement[]
    expect(agencySelects).toHaveLength(2)
    expect(agencySelects[0].value).toBe('PADI')
    expect(agencySelects[1].value).toBe('SSI')
  })

  it('Add Credential appends a fresh row', () => {
    render(<PersonalCredentialsSection {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add credential/i }))
    expect(screen.getAllByLabelText(/^Agency \*$/)).toHaveLength(2)
  })

  it('Remove credential keeps minItems=1 — last row cannot be removed', () => {
    render(<PersonalCredentialsSection {...baseProps} />)
    const removeBtns = screen.queryAllByRole('button', { name: /remove credential/i })
    expect(removeBtns).toHaveLength(0)
  })

  it('Remove credential removes a row when more than one exists', () => {
    render(<PersonalCredentialsSection {...baseProps} profile={seeded} />)
    expect(screen.getAllByLabelText(/^Agency \*$/)).toHaveLength(2)
    const removeBtns = screen.getAllByRole('button', { name: /remove credential/i })
    fireEvent.click(removeBtns[0])
    expect(screen.getAllByLabelText(/^Agency \*$/)).toHaveLength(1)
  })

  it('changing agency clears level + agencyID for that row', () => {
    render(<PersonalCredentialsSection {...baseProps} profile={seeded} />)
    const agencySelects = screen.getAllByLabelText(/^Agency \*$/) as HTMLSelectElement[]
    const levelSelects = screen.getAllByLabelText(/^Level \*$/) as HTMLSelectElement[]
    const idInputs = screen.getAllByLabelText(/^Agency ID \*$/) as HTMLInputElement[]
    expect(levelSelects[0].value).toBe('OWSI')
    expect(idInputs[0].value).toBe('PADI-1')
    fireEvent.change(agencySelects[0], { target: { value: 'SSI' } })
    expect(levelSelects[0].value).toBe('')
    expect(idInputs[0].value).toBe('')
  })

  it('submit emits payload shape { credential: [{ agency, level, agencyID, specialtyRatings }] } unchanged', async () => {
    render(<PersonalCredentialsSection {...baseProps} profile={seeded} />)
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })

    const payload = update.mock.calls[0]![0] as { credential: Array<Record<string, unknown>> }
    expect(payload.credential).toHaveLength(2)
    expect(payload.credential[0]).toEqual({
      agency: 'PADI',
      level: 'OWSI',
      agencyID: 'PADI-1',
      specialtyRatings: ['DSD'],
    })
    expect(payload.credential[1]).toEqual({
      agency: 'SSI',
      level: 'OWI',
      agencyID: 'SSI-2',
      specialtyRatings: [],
    })
  })

  it('submit on a new profile (no profile prop) routes through create with credential[]', async () => {
    render(<PersonalCredentialsSection {...baseProps} />)
    const agencySelect = screen.getByLabelText(/^Agency \*$/) as HTMLSelectElement
    fireEvent.change(agencySelect, { target: { value: 'PADI' } })
    const levelSelect = screen.getByLabelText(/^Level \*$/) as HTMLSelectElement
    fireEvent.change(levelSelect, { target: { value: 'OWSI' } })
    const idInput = screen.getByLabelText(/^Agency ID \*$/) as HTMLInputElement
    fireEvent.change(idInput, { target: { value: 'PADI-NEW' } })

    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1)
    }, { timeout: 3000 })

    const payload = create.mock.calls[0]![0] as { credential: Array<Record<string, unknown>> }
    expect(payload.credential).toHaveLength(1)
    expect(payload.credential[0]!.agency).toBe('PADI')
    expect(payload.credential[0]!.level).toBe('OWSI')
    expect(payload.credential[0]!.agencyID).toBe('PADI-NEW')
  })
})
