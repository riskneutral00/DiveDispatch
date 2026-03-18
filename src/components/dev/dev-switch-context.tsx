'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface DevSwitchContextValue {
  isSwitching: boolean
  setSwitching: (v: boolean) => void
}

const DevSwitchContext = createContext<DevSwitchContextValue>({
  isSwitching: false,
  setSwitching: () => {},
})

export function useDevSwitching() {
  return useContext(DevSwitchContext)
}

export function DevSwitchProvider({ children }: { children: React.ReactNode }) {
  const [isSwitching, setIsSwitching] = useState(false)
  const setSwitching = useCallback((v: boolean) => setIsSwitching(v), [])

  return (
    <DevSwitchContext.Provider value={{ isSwitching, setSwitching }}>
      {children}
    </DevSwitchContext.Provider>
  )
}
