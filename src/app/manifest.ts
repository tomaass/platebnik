import type { MetadataRoute } from 'next'
import { DEFAULT_THEME, THEME_GRADIENTS } from '@/design/themes'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/site'

// Web app manifest — drives Android "Add to home screen" / PWA install with a
// proper name, brand colours and 192/512 icons. Next.js auto-links this at
// /manifest.webmanifest. Theme/background colours mirror the sunset theme.
const [gradFrom] = THEME_GRADIENTS[DEFAULT_THEME]

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    lang: 'cs',
    background_color: '#fff9f7',
    theme_color: gradFrom,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
