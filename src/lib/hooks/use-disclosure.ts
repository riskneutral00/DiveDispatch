import { useCallback, useState } from 'react'

interface Disclosure {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  set: (value: boolean) => void
}

export function useDisclosure(initial = false): Disclosure {
  const [isOpen, setIsOpen] = useState(initial)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  return { isOpen, open, close, toggle, set: setIsOpen }
}
