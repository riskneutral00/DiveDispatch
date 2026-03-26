'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

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

  const value = useMemo(() => ({ isSwitching, setSwitching }), [isSwitching, setSwitching])

  return (
    <DevSwitchContext.Provider value={value}>
      {children}
    </DevSwitchContext.Provider>
  )
}
