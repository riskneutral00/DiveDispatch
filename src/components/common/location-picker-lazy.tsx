import dynamic from 'next/dynamic'
import { Spinner } from '@/components/common/spinner'

export type { LocationValue } from './location-picker'

export const LocationPicker = dynamic(
  () => import('./location-picker').then((mod) => mod.LocationPicker),
  { ssr: false, loading: () => <Spinner /> },
)
