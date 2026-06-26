import type { MetadataRoute } from 'next'
import { SITE_HOST, SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private event links and the authenticated admin stay out of the index.
      disallow: ['/b/', '/boards', '/profile', '/signin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    // The Host directive expects a bare hostname, not a scheme-prefixed URL.
    host: SITE_HOST,
  }
}
