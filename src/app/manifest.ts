import type { MetadataRoute } from 'next'
import { BRAND_DARK_BG } from '@/lib/constants/brand-colors'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DiveDispatch',
    short_name: 'DiveDispatch',
    description: 'Multi-stakeholder booking platform for scuba diving',
    start_url: '/',
    display: 'standalone',
    theme_color: BRAND_DARK_BG,
    background_color: BRAND_DARK_BG,
    icons: [
      {
        src: '/branding/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
