import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DiveDispatch',
    short_name: 'DiveDispatch',
    description: 'Multi-stakeholder booking platform for scuba diving',
    start_url: '/',
    display: 'standalone',
    theme_color: '#0F172A',
    background_color: '#0F172A',
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
