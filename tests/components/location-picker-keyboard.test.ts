import { describe, it, expect } from 'vitest'
import {
  autocompleteKeyboardReducer,
  INITIAL_STATE,
  type AutocompleteKbState,
} from '../../src/components/common/autocomplete-keyboard'

describe('autocompleteKeyboardReducer', () => {
  describe('ARROW_DOWN', () => {
    it('moves from -1 to 0 on first press', () => {
      const result = autocompleteKeyboardReducer(INITIAL_STATE, {
        type: 'ARROW_DOWN',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(0)
    })

    it('increments highlighted index', () => {
      const state: AutocompleteKbState = { highlightedIndex: 0, isOpen: true }
      const result = autocompleteKeyboardReducer(state, {
        type: 'ARROW_DOWN',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(1)
    })

    it('wraps from last item to first', () => {
      const state: AutocompleteKbState = { highlightedIndex: 2, isOpen: true }
      const result = autocompleteKeyboardReducer(state, {
        type: 'ARROW_DOWN',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(0)
    })

    it('no-ops when itemCount is 0', () => {
      const result = autocompleteKeyboardReducer(INITIAL_STATE, {
        type: 'ARROW_DOWN',
        itemCount: 0,
      })
      expect(result).toEqual(INITIAL_STATE)
    })
  })

  describe('ARROW_UP', () => {
    it('wraps from -1 to last item', () => {
      const result = autocompleteKeyboardReducer(INITIAL_STATE, {
        type: 'ARROW_UP',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(2)
    })

    it('decrements highlighted index', () => {
      const state: AutocompleteKbState = { highlightedIndex: 2, isOpen: true }
      const result = autocompleteKeyboardReducer(state, {
        type: 'ARROW_UP',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(1)
    })

    it('wraps from first item to last', () => {
      const state: AutocompleteKbState = { highlightedIndex: 0, isOpen: true }
      const result = autocompleteKeyboardReducer(state, {
        type: 'ARROW_UP',
        itemCount: 3,
      })
      expect(result.highlightedIndex).toBe(2)
    })

    it('no-ops when itemCount is 0', () => {
      const result = autocompleteKeyboardReducer(INITIAL_STATE, {
        type: 'ARROW_UP',
        itemCount: 0,
      })
      expect(result).toEqual(INITIAL_STATE)
    })
  })

  describe('ESCAPE', () => {
    it('resets highlight to -1', () => {
      const state: AutocompleteKbState = { highlightedIndex: 1, isOpen: true }
      const result = autocompleteKeyboardReducer(state, { type: 'ESCAPE' })
      expect(result).toEqual(INITIAL_STATE)
    })
  })

  describe('CLOSE', () => {
    it('resets highlight to -1', () => {
      const state: AutocompleteKbState = { highlightedIndex: 2, isOpen: true }
      const result = autocompleteKeyboardReducer(state, { type: 'CLOSE' })
      expect(result).toEqual(INITIAL_STATE)
    })
  })

  describe('SET_INDEX', () => {
    it('sets highlighted index directly (for mouse hover)', () => {
      const result = autocompleteKeyboardReducer(INITIAL_STATE, {
        type: 'SET_INDEX',
        index: 2,
      })
      expect(result.highlightedIndex).toBe(2)
    })

    it('resets highlight on mouse leave', () => {
      const state: AutocompleteKbState = { highlightedIndex: 2, isOpen: true }
      const result = autocompleteKeyboardReducer(state, {
        type: 'SET_INDEX',
        index: -1,
      })
      expect(result.highlightedIndex).toBe(-1)
    })
  })

  describe('RESET', () => {
    it('returns initial state', () => {
      const state: AutocompleteKbState = { highlightedIndex: 2, isOpen: true }
      const result = autocompleteKeyboardReducer(state, { type: 'RESET' })
      expect(result).toEqual(INITIAL_STATE)
    })
  })

  describe('full navigation sequence', () => {
    it('simulates a complete keyboard interaction', () => {
      let state: AutocompleteKbState = INITIAL_STATE
      const itemCount = 3

      // Arrow down to first item
      state = autocompleteKeyboardReducer(state, { type: 'ARROW_DOWN', itemCount })
      expect(state.highlightedIndex).toBe(0)

      // Arrow down to second
      state = autocompleteKeyboardReducer(state, { type: 'ARROW_DOWN', itemCount })
      expect(state.highlightedIndex).toBe(1)

      // Arrow up back to first
      state = autocompleteKeyboardReducer(state, { type: 'ARROW_UP', itemCount })
      expect(state.highlightedIndex).toBe(0)

      // Escape resets
      state = autocompleteKeyboardReducer(state, { type: 'ESCAPE' })
      expect(state.highlightedIndex).toBe(-1)
    })

    it('escape during navigation resets everything', () => {
      let state: AutocompleteKbState = INITIAL_STATE

      state = autocompleteKeyboardReducer(state, { type: 'ARROW_DOWN', itemCount: 3 })
      state = autocompleteKeyboardReducer(state, { type: 'ARROW_DOWN', itemCount: 3 })
      expect(state.highlightedIndex).toBe(1)

      state = autocompleteKeyboardReducer(state, { type: 'ESCAPE' })
      expect(state).toEqual(INITIAL_STATE)
    })
  })
})
