import { renderBrandIcon } from '@/lib/brand-icon'

export const dynamic = 'force-static'

// Large PWA manifest icon (splash screen / install). Full-bleed so it works as
// both an `any` and a `maskable` icon.
export function GET() {
  return renderBrandIcon(512)
}
