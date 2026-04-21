'use client'

import { useEffect, useState } from 'react'

interface UseFloatingLabelOptions {
  value: string | number | readonly string[] | undefined
  focused?: boolean
  required?: boolean
}

export function useFloatingLabel({ value, focused = false, required = false }: UseFloatingLabelOptions) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t) }, [])

  const filled = typeof value === 'string' ? value.length > 0 : !!value
  const floated = required || (mounted && (focused || filled))

  return { floated, filled, mounted }
}
