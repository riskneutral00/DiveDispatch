import { describe, it, expect } from 'vitest'
import { firstIncompleteTab } from '../first-incomplete-tab'

describe('firstIncompleteTab', () => {
  it('returns profile tab when incomplete is empty', () => {
    expect(firstIncompleteTab('dive-center', [])).toEqual({ tab: 'profile' })
  })

  it('returns profile tab when a global user field is missing', () => {
    expect(firstIncompleteTab('dive-center', ['phone'])).toEqual({ tab: 'profile' })
  })

  it('returns profile tab when appLanguage (settings) is missing', () => {
    expect(firstIncompleteTab('instructor', ['appLanguage'])).toEqual({ tab: 'profile' })
  })

  it('routes to the first role tab owning a missing field', () => {
    expect(firstIncompleteTab('dive-center', ['associations'])).toEqual({
      tab: 'role:dive-center',
      section: 'associations',
    })
  })

  it('routes to contact tab for role-scoped name/address', () => {
    expect(firstIncompleteTab('instructor', ['name'])).toEqual({
      tab: 'role:instructor',
      section: 'contact',
    })
  })

  it('routes to credentials tab for Instructor credential field', () => {
    expect(firstIncompleteTab('instructor', ['credential'])).toEqual({
      tab: 'role:instructor',
      section: 'credentials',
    })
  })

  it('routes to resources tab for operator preferred* fields', () => {
    expect(firstIncompleteTab('dive-center', ['preferredInstructor'])).toEqual({
      tab: 'role:dive-center',
      section: 'resources',
    })
  })

  it('routes to booking tab for acceptanceMode', () => {
    expect(firstIncompleteTab('dive-center', ['acceptanceMode'])).toEqual({
      tab: 'role:dive-center',
      section: 'booking',
    })
  })

  it('global field wins over role field when both are missing', () => {
    expect(firstIncompleteTab('dive-center', ['phone', 'associations'])).toEqual({
      tab: 'profile',
    })
  })

  it('picks the earliest tab in profileTabs order when multiple role fields are missing', () => {
    expect(
      firstIncompleteTab('dive-center', ['acceptanceMode', 'associations']),
    ).toEqual({ tab: 'role:dive-center', section: 'associations' })
  })

  it('falls through to role tab without section for unknown role fields', () => {
    expect(firstIncompleteTab('venue', ['some-unknown-field'])).toEqual({
      tab: 'role:venue',
    })
  })

  it('routes Boat fleet field to fleet tab', () => {
    expect(firstIncompleteTab('boat', ['fleet'])).toEqual({
      tab: 'role:boat',
      section: 'fleet',
    })
  })

  it('routes Equipment gear:* slugs to gear tab', () => {
    expect(firstIncompleteTab('equipment', ['gear:wetsuit'])).toEqual({
      tab: 'role:equipment',
      section: 'gear',
    })
    expect(firstIncompleteTab('equipment', ['gear:regulator'])).toEqual({
      tab: 'role:equipment',
      section: 'gear',
    })
  })

  it('routes Compressor gasMixes to gas-mixes tab', () => {
    expect(firstIncompleteTab('compressor', ['gasMixes'])).toEqual({
      tab: 'role:compressor',
      section: 'gas-mixes',
    })
  })

  it('routes Venue kind to capabilities tab', () => {
    expect(firstIncompleteTab('venue', ['kind'])).toEqual({
      tab: 'role:venue',
      section: 'capabilities',
    })
  })
})
