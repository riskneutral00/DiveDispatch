import { describe, it, expect } from 'vitest'
import {
  autocompleteKeyboardReducer,
  INITIAL_STATE,
} from '../src/components/ui/autocomplete-keyboard'

describe('autocompleteKeyboardReducer', () => {
  it('ARROW_DOWN from initial state highlights first item and opens', () => {
    const result = autocompleteKeyboardReducer(INITIAL_STATE, { type: 'ARROW_DOWN', itemCount: 3 })
    expect(result.highlightedIndex).toBe(0)
    expect(result.isOpen).toBe(true)
  })

  it('ARROW_DOWN wraps around to 0 at end of list', () => {
    const state = { highlightedIndex: 2, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'ARROW_DOWN', itemCount: 3 })
    expect(result.highlightedIndex).toBe(0)
  })

  it('ARROW_DOWN does nothing when itemCount is 0', () => {
    const result = autocompleteKeyboardReducer(INITIAL_STATE, { type: 'ARROW_DOWN', itemCount: 0 })
    expect(result).toBe(INITIAL_STATE)
  })

  it('ARROW_UP from initial state wraps to last item', () => {
    const result = autocompleteKeyboardReducer(INITIAL_STATE, { type: 'ARROW_UP', itemCount: 3 })
    expect(result.highlightedIndex).toBe(2)
  })

  it('ARROW_UP from first item wraps to last', () => {
    const state = { highlightedIndex: 0, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'ARROW_UP', itemCount: 5 })
    expect(result.highlightedIndex).toBe(4)
  })

  it('ARROW_UP does nothing when itemCount is 0', () => {
    const result = autocompleteKeyboardReducer(INITIAL_STATE, { type: 'ARROW_UP', itemCount: 0 })
    expect(result).toBe(INITIAL_STATE)
  })

  it('SET_INDEX sets the highlighted index', () => {
    const result = autocompleteKeyboardReducer(INITIAL_STATE, { type: 'SET_INDEX', index: 2 })
    expect(result.highlightedIndex).toBe(2)
  })

  it('ENTER returns state unchanged', () => {
    const state = { highlightedIndex: 1, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'ENTER' })
    expect(result).toBe(state)
  })

  it('ESCAPE resets to initial state', () => {
    const state = { highlightedIndex: 2, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'ESCAPE' })
    expect(result).toEqual(INITIAL_STATE)
  })

  it('RESET resets to initial state', () => {
    const state = { highlightedIndex: 3, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'RESET' })
    expect(result).toEqual(INITIAL_STATE)
  })

  it('CLOSE resets to initial state', () => {
    const state = { highlightedIndex: 1, isOpen: true }
    const result = autocompleteKeyboardReducer(state, { type: 'CLOSE' })
    expect(result).toEqual(INITIAL_STATE)
  })

  it('OPEN sets isOpen to true without changing index', () => {
    const state = { highlightedIndex: -1, isOpen: false }
    const result = autocompleteKeyboardReducer(state, { type: 'OPEN' })
    expect(result.isOpen).toBe(true)
    expect(result.highlightedIndex).toBe(-1)
  })
})

describe('INITIAL_STATE', () => {
  it('starts with index -1 and closed', () => {
    expect(INITIAL_STATE.highlightedIndex).toBe(-1)
    expect(INITIAL_STATE.isOpen).toBe(false)
  })
})
