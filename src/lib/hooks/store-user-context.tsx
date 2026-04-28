'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useStoreUser, type StoreUserStatus } from './use-store-user'

const StoreUserContext = createContext<StoreUserStatus>('done')

export function StoreUserProvider({ children }: { children: ReactNode }) {
  const status = useStoreUser()
  return <StoreUserContext.Provider value={status}>{children}</StoreUserContext.Provider>
}

export function useStoreUserStatus(): StoreUserStatus {
  return useContext(StoreUserContext)
}
