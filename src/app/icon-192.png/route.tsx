import { renderBrandIcon } from '@/lib/brand-icon'

export const dynamic = 'force-static'

// PWA manifest icon (Android home screen / install). Full-bleed gradient so it
// doubles as a maskable icon — the centred "P" stays inside the safe zone.
export function GET() {
  return renderBrandIcon(192)
}
