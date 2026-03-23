import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://divedispatch.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/sign-in', '/sign-up'],
        disallow: [
          '/dashboard/',
          '/portal/',
          '/api/',
          '/onboarding',
          '/account',
          '/help',
          '/booking/',
          '/directory',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
