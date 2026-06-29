// Single source of truth for site identity — used by metadata, OG images,
// robots and sitemap.

// Base URL for absolute links in metadata and OG images. In production the
// domain is fixed; on Vercel previews we fall back to VERCEL_URL.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === 'production'
    ? 'https://platebnik.cz'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://platebnik.cz')

// Bare hostname (no scheme) for the robots.txt Host directive.
export const SITE_HOST = new URL(SITE_URL).host

export const SITE_NAME = 'Platebník'

export const SITE_TAGLINE = 'Naťukej, co sis dal. Zbytek zařídí QR.'

// Full "name — tagline" title, shared by the PWA manifest name and the OG
// image alt text so the two can't drift apart.
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

export const SITE_DESCRIPTION =
  'Udělej ceník na grilovačku nebo sešlost, nasdílej QR a nech partu naťukat, ' +
  'co si dali. Každý zaplatí přímo tobě přes QR Platbu — bez kalkulačky a bez poplatků.'
