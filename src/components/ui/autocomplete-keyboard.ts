export interface AutocompleteKeyboardState {
  highlightedIndex: number
  isOpen: boolean
}

export type AutocompleteKbAction =
  | { type: 'ARROW_DOWN'; itemCount: number }
  | { type: 'ARROW_UP'; itemCount: number }
  | { type: 'SET_INDEX'; index: number }
  | { type: 'ENTER' }
  | { type: 'RESET' }
  | { type: 'ESCAPE' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }

export const INITIAL_STATE: AutocompleteKeyboardState = {
  highlightedIndex: -1,
  isOpen: false,
}

export type AutocompleteKbState = AutocompleteKeyboardState

export function autocompleteKeyboardReducer(
  state: AutocompleteKeyboardState,
  action: AutocompleteKbAction,
): AutocompleteKeyboardState {
  switch (action.type) {
    case 'ARROW_DOWN': {
      if (action.itemCount === 0) return state
      const next = state.highlightedIndex + 1
      return {
        highlightedIndex: next >= action.itemCount ? 0 : next,
        isOpen: true,
      }
    }
    case 'ARROW_UP': {
      if (action.itemCount === 0) return state
      const prev = state.highlightedIndex <= 0
        ? action.itemCount - 1
        : state.highlightedIndex - 1
      return { highlightedIndex: prev, isOpen: state.isOpen }
    }
    case 'SET_INDEX':
      return { highlightedIndex: action.index, isOpen: state.isOpen }
    case 'ENTER':
      return state
    case 'OPEN':
      return { ...state, isOpen: true }
    case 'RESET':
    case 'ESCAPE':
    case 'CLOSE':
      return INITIAL_STATE
  }
}
