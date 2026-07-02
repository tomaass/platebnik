import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: {
    '/b/[token]/print.pdf': ['./src/pdf/fonts/**'],
  },
  async redirects() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'www.platebnik.cz' }],
      destination: 'https://platebnik.cz/:path*',
      permanent: true,
    }]
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }]
  },
}
export default config
