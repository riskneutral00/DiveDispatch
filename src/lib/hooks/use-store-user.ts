'use client'

import { useEffect, useRef, useState } from 'react'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '@/lib/convex-generated'

export type StoreUserStatus = 'pending' | 'done' | 'rejected'

export function useStoreUser(): StoreUserStatus {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const storeUser = useMutation(api.users.store)
  const [status, setStatus] = useState<StoreUserStatus>('pending')
  const hasRun = useRef(false)

  useEffect(() => {
    if (isAuthLoading) return
    if (!isAuthenticated) {
      setStatus('done')
      return
    }
    if (hasRun.current) return
    hasRun.current = true
    void storeUser({})
      .then((id) => setStatus(id === null ? 'rejected' : 'done'))
      .catch(() => setStatus('rejected'))
  }, [isAuthLoading, isAuthenticated, storeUser])

  return status
}
