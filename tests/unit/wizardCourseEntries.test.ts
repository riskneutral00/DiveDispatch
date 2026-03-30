import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type CustomerData,
  type CourseEntry,
} from '../../src/lib/booking/wizard-state'

function stateWithCustomers(customers: CustomerData[]): WizardState {
  return { ...makeInitialState(), customers }
}

describe('REMOVE_COURSE_ENTRY', () => {
  it('removes a course entry by entryId', () => {
    const entries: CourseEntry[] = [
      { id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' },
      { id: 'e2', activityCode: 'AOW', dates: ['2026-04-04'], agency: 'PADI' },
    ]
    const state = stateWithCustomers([{ id: 'c1', name: 'Alice', courseEntries: entries }])
    const next = wizardReducer(state, { type: 'REMOVE_COURSE_ENTRY', customerId: 'c1', entryId: 'e1' })
    expect(next.customers[0].courseEntries).toHaveLength(1)
    expect(next.customers[0].courseEntries![0].id).toBe('e2')
  })

  it('does not remove the last course entry (preserves at least one)', () => {
    const entries: CourseEntry[] = [
      { id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' },
    ]
    const state = stateWithCustomers([{ id: 'c1', name: 'Alice', courseEntries: entries }])
    const next = wizardReducer(state, { type: 'REMOVE_COURSE_ENTRY', customerId: 'c1', entryId: 'e1' })
    expect(next.customers[0].courseEntries).toHaveLength(1)
    expect(next.customers[0].courseEntries![0].id).toBe('e1')
  })

  it('does not modify other customers', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' },
        { id: 'e2', activityCode: 'AOW', dates: ['2026-04-04'], agency: 'PADI' },
      ]},
      { id: 'c2', name: 'Bob', courseEntries: [
        { id: 'e3', activityCode: 'DSD', dates: ['2026-04-01'], agency: 'PADI' },
      ]},
    ])
    const next = wizardReducer(state, { type: 'REMOVE_COURSE_ENTRY', customerId: 'c1', entryId: 'e1' })
    expect(next.customers[1].courseEntries).toHaveLength(1)
    expect(next.customers[1].courseEntries![0].id).toBe('e3')
  })

  it('updates selectedCourses after removal', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' },
        { id: 'e2', activityCode: 'AOW', dates: ['2026-04-04'], agency: 'PADI' },
      ]},
    ])
    const next = wizardReducer(state, { type: 'REMOVE_COURSE_ENTRY', customerId: 'c1', entryId: 'e1' })
    expect(next.selectedCourses).toContain('AOW')
    expect(next.selectedCourses).not.toContain('OW')
  })

  it('updates derived dates after removal', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: ['2026-04-01', '2026-04-02'], agency: 'PADI' },
        { id: 'e2', activityCode: 'AOW', dates: ['2026-04-05', '2026-04-06'], agency: 'PADI' },
      ]},
    ])
    const next = wizardReducer(state, { type: 'REMOVE_COURSE_ENTRY', customerId: 'c1', entryId: 'e1' })
    expect(next.startDate).toBe('2026-04-05')
    expect(next.endDate).toBe('2026-04-06')
  })
})

describe('ADD_COURSE_ENTRY', () => {
  it('adds a course entry with generated id', () => {
    const state = stateWithCustomers([{ id: 'c1', name: 'Alice' }])
    const next = wizardReducer(state, { type: 'ADD_COURSE_ENTRY', customerId: 'c1' })
    expect(next.customers[0].courseEntries).toHaveLength(1)
    expect(next.customers[0].courseEntries![0].id).toBeTruthy()
    expect(next.customers[0].courseEntries![0].activityCode).toBe('')
  })

  it('adds entry with initialData override', () => {
    const state = stateWithCustomers([{ id: 'c1', name: 'Alice' }])
    const next = wizardReducer(state, {
      type: 'ADD_COURSE_ENTRY',
      customerId: 'c1',
      initialData: { activityCode: 'OW', agency: 'PADI' },
    })
    expect(next.customers[0].courseEntries![0].activityCode).toBe('OW')
    expect(next.customers[0].courseEntries![0].agency).toBe('PADI')
  })

  it('appends to existing entries', () => {
    const state = stateWithCustomers([{
      id: 'c1',
      name: 'Alice',
      courseEntries: [{ id: 'e1', activityCode: 'OW', dates: [], agency: 'PADI' }],
    }])
    const next = wizardReducer(state, { type: 'ADD_COURSE_ENTRY', customerId: 'c1' })
    expect(next.customers[0].courseEntries).toHaveLength(2)
    expect(next.customers[0].courseEntries![0].id).toBe('e1')
  })

  it('does not modify other customers', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice' },
      { id: 'c2', name: 'Bob' },
    ])
    const next = wizardReducer(state, { type: 'ADD_COURSE_ENTRY', customerId: 'c1' })
    expect(next.customers[1].courseEntries).toBeUndefined()
  })

  it('derives selectedCourses from added entry', () => {
    const state = stateWithCustomers([{ id: 'c1', name: 'Alice' }])
    const next = wizardReducer(state, {
      type: 'ADD_COURSE_ENTRY',
      customerId: 'c1',
      initialData: { activityCode: 'AOW' },
    })
    expect(next.selectedCourses).toContain('AOW')
  })
})

describe('UPDATE_COURSE_ENTRY', () => {
  it('patches an existing entry', () => {
    const state = stateWithCustomers([{
      id: 'c1',
      name: 'Alice',
      courseEntries: [{ id: 'e1', activityCode: 'OW', dates: [], agency: '' }],
    }])
    const next = wizardReducer(state, {
      type: 'UPDATE_COURSE_ENTRY',
      customerId: 'c1',
      entryId: 'e1',
      patch: { agency: 'SSI', dates: ['2026-04-01'] },
    })
    expect(next.customers[0].courseEntries![0].agency).toBe('SSI')
    expect(next.customers[0].courseEntries![0].dates).toEqual(['2026-04-01'])
    expect(next.customers[0].courseEntries![0].activityCode).toBe('OW')
  })

  it('updates derived dates after entry date change', () => {
    const state = stateWithCustomers([{
      id: 'c1',
      name: 'Alice',
      courseEntries: [{ id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' }],
    }])
    const next = wizardReducer(state, {
      type: 'UPDATE_COURSE_ENTRY',
      customerId: 'c1',
      entryId: 'e1',
      patch: { dates: ['2026-05-10', '2026-05-12'] },
    })
    expect(next.startDate).toBe('2026-05-10')
    expect(next.endDate).toBe('2026-05-12')
  })

  it('updates selectedCourses when activityCode changes', () => {
    const state = stateWithCustomers([{
      id: 'c1',
      name: 'Alice',
      courseEntries: [{ id: 'e1', activityCode: 'OW', dates: [], agency: 'PADI' }],
    }])
    const next = wizardReducer(state, {
      type: 'UPDATE_COURSE_ENTRY',
      customerId: 'c1',
      entryId: 'e1',
      patch: { activityCode: 'AOW' },
    })
    expect(next.selectedCourses).toContain('AOW')
    expect(next.selectedCourses).not.toContain('OW')
  })
})

describe('COPY_COURSE_ENTRIES_TO_ALL', () => {
  it('copies first customer entries to all others', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: ['2026-04-01'], agency: 'PADI' },
      ]},
      { id: 'c2', name: 'Bob' },
      { id: 'c3', name: 'Charlie' },
    ])
    const next = wizardReducer(state, { type: 'COPY_COURSE_ENTRIES_TO_ALL' })
    expect(next.customers[1].courseEntries).toHaveLength(1)
    expect(next.customers[1].courseEntries![0].activityCode).toBe('OW')
    expect(next.customers[2].courseEntries).toHaveLength(1)
    expect(next.customers[2].courseEntries![0].activityCode).toBe('OW')
  })

  it('generates unique IDs for copied entries', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: [], agency: 'PADI' },
      ]},
      { id: 'c2', name: 'Bob' },
    ])
    const next = wizardReducer(state, { type: 'COPY_COURSE_ENTRIES_TO_ALL' })
    const aliceId = next.customers[0].courseEntries![0].id
    const bobId = next.customers[1].courseEntries![0].id
    expect(aliceId).not.toBe(bobId)
  })

  it('does not modify the first customer', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: [], agency: 'PADI' },
      ]},
      { id: 'c2', name: 'Bob' },
    ])
    const next = wizardReducer(state, { type: 'COPY_COURSE_ENTRIES_TO_ALL' })
    expect(next.customers[0].courseEntries![0].id).toBe('e1')
  })

  it('handles empty source entries gracefully', () => {
    const state = stateWithCustomers([
      { id: 'c1', name: 'Alice' },
      { id: 'c2', name: 'Bob', courseEntries: [
        { id: 'e1', activityCode: 'OW', dates: [], agency: 'PADI' },
      ]},
    ])
    const next = wizardReducer(state, { type: 'COPY_COURSE_ENTRIES_TO_ALL' })
    expect(next.customers[1].courseEntries).toHaveLength(0)
  })
})
