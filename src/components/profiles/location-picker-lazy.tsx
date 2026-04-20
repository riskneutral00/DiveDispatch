import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/spinner'

export type { LocationValue, AddressLocationValue } from './location-picker'

export const LocationPicker = dynamic(
  () => import('./location-picker').then((mod) => mod.LocationPicker),
  { ssr: false, loading: () => <Spinner /> },
)
