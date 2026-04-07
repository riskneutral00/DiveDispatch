const CLERK_DOMAINS = '*.clerk.accounts.dev *.clerk.com'
const CONVEX_HTTPS = '*.convex.cloud'
const CONVEX_CONNECT = '*.convex.cloud wss://*.convex.cloud'
const GOOGLE_MAPS_SCRIPT = 'maps.googleapis.com'
const GOOGLE_PLACES_API = 'places.googleapis.com'
const GOOGLE_MAPS_STATIC = 'maps.gstatic.com'

const CLERK_INLINE = "'unsafe-inline'"

const DEV_EVAL = process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''

const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' ${CLERK_INLINE} ${CLERK_DOMAINS} ${GOOGLE_MAPS_SCRIPT} ${DEV_EVAL}`.trim(),
  `style-src 'self' ${CLERK_INLINE} fonts.googleapis.com`,
  `img-src 'self' data: blob: ${CONVEX_HTTPS} ${GOOGLE_MAPS_SCRIPT} ${GOOGLE_MAPS_STATIC} ${CLERK_DOMAINS}`,
  `font-src 'self' fonts.gstatic.com`,
  `connect-src 'self' ${CONVEX_CONNECT} ${CLERK_DOMAINS} ${GOOGLE_MAPS_SCRIPT} ${GOOGLE_PLACES_API}`,
  `worker-src 'self' blob:`,
  `frame-src 'self' ${CLERK_DOMAINS}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
]

const contentSecurityPolicy = cspDirectives.join('; ')

export interface SecurityHeader {
  key: string
  value: string
}

export const securityHeaders: SecurityHeader[] = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
]
