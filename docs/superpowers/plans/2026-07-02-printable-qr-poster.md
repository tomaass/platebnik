# Printable QR poster (A4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a host generate a branded, print-ready A4 PDF poster carrying a board's QR code, so people at a table can scan it, open the board, and pay.

**Architecture:** A Node-runtime route handler `GET /b/[token]/print.pdf` loads the board's title+theme, encodes the board URL as a QR PNG, and renders a single-page A4 poster with `@react-pdf/renderer`. Pure slug/QR helpers are shared with the existing "Uložit QR" card. The host reaches it from a link in `SharePanel`.

**Tech Stack:** Next.js 15 App Router (Route Handlers), `@react-pdf/renderer`, `qrcode`, Drizzle, PostHog (`posthog-node`), Vitest.

## Global Constraints

- **Czech** for all user-facing copy; **English** for code comments, commit messages, PR text.
- QR encodes the **board URL** (`{SITE_URL}/b/{token}`), never a fixed-amount SPAYD.
- **Print design:** white background, no full-bleed fill. Color appears only as accents (top bar, wordmark, heading) using the board theme's primary/`from` stop. QR is pure black `#111111` on white. Every load-bearing element (QR, instructions, fallback link) is black so grayscale prints stay fully functional.
- Accent color for V1 is a **flat** tone: `THEME_GRADIENTS[board.theme][0]` (default sunset `#ff9a3d`). No gradient in V1.
- Route runs on **Node.js runtime** (`export const runtime = 'nodejs'`).
- Unknown / missing token → **404**.
- PDF filename: `platebnik-<slug>.pdf`; `Content-Disposition: inline`.
- Fire PostHog event **`board_print_pdf`** with the board token.
- Wordmark in the PDF is the plain text `Platebník` (no 🍺 emoji — the Inter font has no emoji glyph and an emoji source needs a CDN, out of V1 scope).

---

## File Structure

- **Create** `src/lib/qr.ts` — pure, runtime-neutral helpers: `boardSlug`, `boardFileName`, `qrPngDataUrl`. Shared by the client card and the server PDF route.
- **Create** `src/lib/qr.test.ts` — unit tests for the helpers.
- **Modify** `src/app/b/[token]/save-qr.ts` — delegate `qrFileName`/`renderQrDataUrl` to the shared helpers (DRY, no duplication).
- **Create** `src/pdf/fonts/Inter-Regular.ttf`, `src/pdf/fonts/Inter-Bold.ttf` — bundled TTFs (Czech-capable; committed binary assets).
- **Create** `src/pdf/poster.tsx` — registers fonts, defines the `PosterDocument` React-PDF component, exports `renderPosterPdf(props) => Promise<Buffer>`.
- **Create** `src/pdf/poster.test.ts` — asserts `renderPosterPdf` returns a real PDF buffer with Czech text (no throw).
- **Create** `src/app/b/[token]/print.pdf/route.ts` — the route handler (loads board, renders, tracks).
- **Create** `src/app/b/[token]/print.pdf/route.test.ts` — 200/PDF for a valid token, 404 for unknown.
- **Modify** `src/lib/analytics.ts` — add `'board_print_pdf'` to the event union.
- **Modify** `next.config.ts` — mark `@react-pdf/renderer` external and bundle the font files into the route's serverless trace.
- **Modify** `src/app/(host)/boards/SharePanel.tsx` — add the "Vytisknout QR na stůl" link.
- **Modify** `src/app/(host)/host.module.css` — style the print link.

---

### Task 1: Shared slug + QR helpers

**Files:**
- Create: `src/lib/qr.ts`
- Test: `src/lib/qr.test.ts`
- Modify: `src/app/b/[token]/save-qr.ts`

**Interfaces:**
- Consumes: `stripDiacritics` from `@/domain/spayd`; `QRCode` from `qrcode`.
- Produces:
  - `boardSlug(title: string): string` — lowercase, diacritics-stripped, non-alphanumerics collapsed to `-`, trimmed. `''` when nothing sluggable remains.
  - `boardFileName(title: string, ext: string): string` — `platebnik-<slug>.<ext>`, or `platebnik-qr.<ext>` when the slug is empty.
  - `qrPngDataUrl(text: string, width?: number): Promise<string>` — a `data:image/png;base64,…` QR, black on white, default `width` 720.

- [ ] **Step 1: Write the failing test**

Create `src/lib/qr.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { boardSlug, boardFileName, qrPngDataUrl } from './qr'

describe('boardSlug', () => {
  test('slugifies a title', () => {
    expect(boardSlug('Pátek u Toma')).toBe('patek-u-toma')
  })
  test('strips diacritics and special characters', () => {
    expect(boardSlug('Žluťoučký kůň!!')).toBe('zlutoucky-kun')
  })
  test('empty string when nothing sluggable remains', () => {
    expect(boardSlug('   ')).toBe('')
  })
})

describe('boardFileName', () => {
  test('builds a name with the given extension', () => {
    expect(boardFileName('Pátek u Toma', 'pdf')).toBe('platebnik-patek-u-toma.pdf')
    expect(boardFileName('Pátek u Toma', 'png')).toBe('platebnik-patek-u-toma.png')
  })
  test('falls back for an unsluggable title', () => {
    expect(boardFileName('   ', 'pdf')).toBe('platebnik-qr.pdf')
  })
})

describe('qrPngDataUrl', () => {
  test('returns a PNG data URL', async () => {
    const url = await qrPngDataUrl('https://platebnik.cz/b/abc')
    expect(url.startsWith('data:image/png')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: FAIL — `Failed to resolve import "./qr"`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/qr.ts`:

```ts
import QRCode from 'qrcode'
import { stripDiacritics } from '@/domain/spayd'

const QR_COLOR = { dark: '#111111', light: '#ffffff' }

// Slug from a board title: diacritics dropped, lowercased, non-alphanumerics
// collapsed to single dashes, trimmed. Empty string when nothing remains.
export const boardSlug = (title: string): string =>
  stripDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Branded download filename, e.g. "platebnik-patek-u-toma.pdf".
export const boardFileName = (title: string, ext: string): string => {
  const slug = boardSlug(title)
  return slug ? `platebnik-${slug}.${ext}` : `platebnik-qr.${ext}`
}

// PNG data URL for a QR code, black on white. Works in Node and the browser
// (the `qrcode` package renders PNGs without a DOM canvas). Rendered larger
// than displayed so it stays crisp on hi-DPI screens and in print.
export const qrPngDataUrl = (text: string, width = 720): Promise<string> =>
  QRCode.toDataURL(text, { width, margin: 1, color: QR_COLOR })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/qr.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Refactor `save-qr.ts` to delegate (DRY)**

In `src/app/b/[token]/save-qr.ts`:

1. Add the import near the top:

```ts
import { boardFileName, qrPngDataUrl } from '@/lib/qr'
```

2. Replace the body of `qrFileName` so it delegates (keep the exported name/signature — callers and its existing tests are unchanged):

```ts
export const qrFileName = (title: string): string => boardFileName(title, 'png')
```

3. Replace the body of `renderQrDataUrl` so it delegates:

```ts
// Plain QR for on-screen display (no branding). A data: URL is reliably long-pressable on iOS
// ("Add to Photos"), unlike inline SVG. Rendered larger than shown so it stays crisp on hi-DPI.
export const renderQrDataUrl = (spayd: string): Promise<string> => qrPngDataUrl(spayd, 720)
```

4. Delete the now-unused local helpers/constants: the old inline slug logic inside `qrFileName`, and — only if nothing else in the file still references them — the `QR_COLOR` constant and the `stripDiacritics` import. (`qrCaption` still uses `stripDiacritics`? No — `qrCaption` does not; `qrFileName` was the only user. Verify with a search before deleting: `grep -n "stripDiacritics\|QR_COLOR" src/app/b/\[token\]/save-qr.ts`. Keep whichever is still referenced, e.g. `QR_COLOR` is still used by `renderQrSvg` and `renderQrCard` — keep it; `stripDiacritics` becomes unused — remove its import.)

- [ ] **Step 6: Run the existing + new tests to verify nothing broke**

Run: `npx vitest run src/app/b/\[token\]/save-qr.test.ts src/lib/qr.test.ts`
Expected: PASS. The existing `qrFileName` tests (`platebnik-patek-u-toma.png`, `platebnik-zlutoucky-kun.png`, `platebnik-qr.png`) still pass through the delegated implementation.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no "unused import" if `noUnusedLocals` is on — confirm the `stripDiacritics` import was removed from `save-qr.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/qr.ts src/lib/qr.test.ts src/app/b/\[token\]/save-qr.ts
git commit -m "refactor: extract shared board slug + QR PNG helpers into lib/qr"
```

---

### Task 2: PDF poster component + fonts

**Files:**
- Create: `src/pdf/fonts/Inter-Regular.ttf`, `src/pdf/fonts/Inter-Bold.ttf`
- Create: `src/pdf/poster.tsx`
- Test: `src/pdf/poster.test.ts`
- Modify: `package.json` (add `@react-pdf/renderer`)

**Interfaces:**
- Consumes: `THEME_GRADIENTS`, `ThemeKey` from `@/design/themes`.
- Produces:
  - `interface PosterProps { title: string; theme: ThemeKey; qrDataUrl: string; shortUrl: string }`
  - `renderPosterPdf(props: PosterProps): Promise<Buffer>` — renders the A4 poster to a PDF buffer.

- [ ] **Step 1: Install the PDF library**

Run: `npm install @react-pdf/renderer`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Add the bundled Czech-capable fonts**

The built-in PDF fonts (Helvetica) use WinAnsi encoding and **cannot render** Czech letters (č, ř, š, ž, ě, ů, …). Bundle static Inter TTFs, which cover Latin Extended-A.

Download the Inter static TTFs and copy `Inter-Regular.ttf` and `Inter-Bold.ttf` into `src/pdf/fonts/`. Concrete method (stable release asset):

```bash
mkdir -p src/pdf/fonts
cd "$(mktemp -d)" && \
  curl -fsSL -o inter.zip https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip && \
  unzip -o inter.zip -d inter && \
  find inter -name 'Inter-Regular.ttf' -exec cp {} "$OLDPWD/src/pdf/fonts/Inter-Regular.ttf" \; && \
  find inter -name 'Inter-Bold.ttf' -exec cp {} "$OLDPWD/src/pdf/fonts/Inter-Bold.ttf" \;
```

Then verify both files exist and are non-trivial:

Run: `ls -l src/pdf/fonts/Inter-Regular.ttf src/pdf/fonts/Inter-Bold.ttf`
Expected: two `.ttf` files, each well over 100 KB.

(If that release URL is unavailable, obtain the same two static TTFs from Google Fonts' Inter export — any Inter Regular/Bold static TTF works. Do **not** use woff2; fontkit in `@react-pdf/renderer` needs TTF/OTF.)

- [ ] **Step 3: Write the failing test**

Create `src/pdf/poster.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { renderPosterPdf } from './poster'

describe('renderPosterPdf', () => {
  test('renders a PDF buffer without throwing on Czech text', async () => {
    const buffer = await renderPosterPdf({
      title: 'Žluťoučký táborák u Bédi',
      theme: 'sunset',
      shortUrl: 'platebnik.cz/b/ABC123',
      // 1x1 transparent PNG stand-in for the QR image
      qrDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42m\
NkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    // Every PDF starts with the "%PDF" magic bytes.
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/pdf/poster.test.ts`
Expected: FAIL — `Failed to resolve import "./poster"`.

- [ ] **Step 5: Write the poster component**

Create `src/pdf/poster.tsx`:

```tsx
import path from 'node:path'
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { THEME_GRADIENTS, type ThemeKey } from '@/design/themes'

// Register Czech-capable Inter (the built-in Helvetica cannot render č/ř/š/ž/…).
// Read from the bundled TTFs; next.config.ts ensures they ship in the route's
// serverless trace on Vercel.
const fontDir = path.join(process.cwd(), 'src/pdf/fonts')
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontDir, 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontDir, 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
})
// Keep long words intact (URLs, board titles) instead of hyphenating.
Font.registerHyphenationCallback((word) => [word])

const BLACK = '#111111'
const MUTED = '#555555'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', fontFamily: 'Inter' },
  accentBar: { height: 10, width: '100%' },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 48,
  },
  wordmark: { fontSize: 26, fontWeight: 700, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, color: BLACK, marginBottom: 28, textAlign: 'center' },
  qr: { width: 300, height: 300, marginBottom: 28 },
  heading: { fontSize: 28, fontWeight: 700, marginBottom: 12, textAlign: 'center' },
  instruction: {
    fontSize: 15,
    color: BLACK,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 1.4,
    marginBottom: 24,
  },
  fallback: { fontSize: 13, color: BLACK, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },
})

export interface PosterProps {
  title: string
  theme: ThemeKey
  qrDataUrl: string
  shortUrl: string
}

// Single A4 portrait poster. Accent is the theme's flat primary (`from`) stop.
function PosterDocument({ title, theme, qrDataUrl, shortUrl }: PosterProps) {
  const accent = THEME_GRADIENTS[theme][0]
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.body}>
          <Text style={[styles.wordmark, { color: accent }]}>Platebník</Text>
          <Text style={styles.title}>{title}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image style={styles.qr} src={qrDataUrl} />
          <Text style={[styles.heading, { color: accent }]}>Zaplať svoji útratu</Text>
          <Text style={styles.instruction}>
            Naskenuj telefonem → naklikej, co sis dal → zaplať QR platbou.
          </Text>
          <Text style={styles.fallback}>{shortUrl}</Text>
        </View>
        <Text style={styles.footer}>platebnik.cz</Text>
      </Page>
    </Document>
  )
}

export const renderPosterPdf = (props: PosterProps): Promise<Buffer> =>
  renderToBuffer(<PosterDocument {...props} />)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/pdf/poster.test.ts`
Expected: PASS — buffer starts with `%PDF`, length > 1000. (If it throws "Unknown font format", the wrong file type was downloaded in Step 2 — must be TTF, not woff2.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/pdf/fonts/Inter-Regular.ttf src/pdf/fonts/Inter-Bold.ttf src/pdf/poster.tsx src/pdf/poster.test.ts
git commit -m "feat: A4 QR poster PDF component with Czech-capable font"
```

---

### Task 3: Route handler + analytics + build config

**Files:**
- Modify: `src/lib/analytics.ts`
- Create: `src/app/b/[token]/print.pdf/route.ts`
- Test: `src/app/b/[token]/print.pdf/route.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `getBoardMeta` from `@/db/boards` (`(token) => Promise<{ title: string; theme: ThemeKey } | null>`); `renderPosterPdf`, `PosterProps` from `@/pdf/poster`; `qrPngDataUrl`, `boardFileName` from `@/lib/qr`; `track` from `@/lib/analytics`; `SITE_URL`, `SITE_HOST` from `@/lib/site`.
- Produces: `GET(req: Request, ctx: { params: Promise<{ token: string }> }) => Promise<Response>`.

- [ ] **Step 1: Add the analytics event name**

In `src/lib/analytics.ts`, extend the union:

```ts
type AnalyticsEvent =
  | 'user_registered'
  | 'board_created'
  | 'board_signed'
  | 'board_paid'
  | 'board_print_pdf'
```

- [ ] **Step 2: Write the failing route test**

Create `src/app/b/[token]/print.pdf/route.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'

vi.mock('@/db/boards', () => ({ getBoardMeta: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

import { getBoardMeta } from '@/db/boards'
import { track } from '@/lib/analytics'
import { GET } from './route'

const call = (token: string) =>
  GET(new Request(`https://platebnik.cz/b/${token}/print.pdf`), {
    params: Promise.resolve({ token }),
  })

describe('GET /b/[token]/print.pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns a PDF for a known board and tracks the event', async () => {
    vi.mocked(getBoardMeta).mockResolvedValue({ title: 'Táborák u Bédi', theme: 'sunset' })
    const res = await call('ABC123')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('platebnik-taborak-u-bedi.pdf')
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(track).toHaveBeenCalledWith('board_print_pdf', 'ABC123', { token: 'ABC123' })
  })

  test('returns 404 for an unknown board', async () => {
    vi.mocked(getBoardMeta).mockResolvedValue(null)
    const res = await call('nope')
    expect(res.status).toBe(404)
    expect(track).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run "src/app/b/[token]/print.pdf/route.test.ts"`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 4: Write the route handler**

Create `src/app/b/[token]/print.pdf/route.ts`:

```ts
import { getBoardMeta } from '@/db/boards'
import { renderPosterPdf } from '@/pdf/poster'
import { qrPngDataUrl, boardFileName } from '@/lib/qr'
import { track } from '@/lib/analytics'
import { SITE_URL, SITE_HOST } from '@/lib/site'

// @react-pdf/renderer needs Node APIs (fs, fontkit) — force the Node runtime.
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params
  const board = await getBoardMeta(token)
  if (!board) return new Response('Not found', { status: 404 })

  const boardUrl = `${SITE_URL}/b/${token}`
  const qrDataUrl = await qrPngDataUrl(boardUrl, 1000)

  const pdf = await renderPosterPdf({
    title: board.title,
    theme: board.theme,
    qrDataUrl,
    shortUrl: `${SITE_HOST}/b/${token}`,
  })

  await track('board_print_pdf', token, { token })

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${boardFileName(board.title, 'pdf')}"`,
    },
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "src/app/b/[token]/print.pdf/route.test.ts"`
Expected: PASS (both cases). The real `renderPosterPdf` runs here, so the Task 2 fonts must be present.

- [ ] **Step 6: Configure Next for the PDF route**

In `next.config.ts`, add two settings to the `config` object so `@react-pdf/renderer` isn't mangled by bundling and the font files ship in the route's serverless trace on Vercel:

```ts
const config: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: {
    '/b/[token]/print.pdf': ['./src/pdf/fonts/**'],
  },
  async redirects() {
    // …unchanged…
  },
  async headers() {
    // …unchanged…
  },
}
```

(Keep the existing `redirects`/`headers`; only add the two new top-level keys.)

- [ ] **Step 7: Verify the build compiles the route**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds; the route `/b/[token]/print.pdf` appears in the build output as a dynamic function (ƒ). If the build fails resolving `@react-pdf/renderer`, confirm `serverExternalPackages` was added.

- [ ] **Step 8: Commit**

```bash
git add src/lib/analytics.ts "src/app/b/[token]/print.pdf/route.ts" "src/app/b/[token]/print.pdf/route.test.ts" next.config.ts
git commit -m "feat: /b/[token]/print.pdf poster route + board_print_pdf event"
```

---

### Task 4: Host entry point in SharePanel

**Files:**
- Modify: `src/app/(host)/boards/SharePanel.tsx`
- Modify: `src/app/(host)/host.module.css`

**Interfaces:**
- Consumes: the existing `SharePanel({ token })` prop; the route `/b/[token]/print.pdf` from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Add the print link to `SharePanel`**

In `src/app/(host)/boards/SharePanel.tsx`, add a link below the existing `shareRow`. The full updated `return` block:

```tsx
  return (
    <div className={s.share}>
      <div className={s.shareTitle}>Hotovo! Nasdílej partě 🎉</div>
      <div className={s.shareRow}>
        <QrSvg className={s.shareQr} markup={svg} label="QR kód na board" />
        <a className={s.shareUrl} href={url}>{url}</a>
      </div>
      <a className={s.sharePrint} href={`/b/${token}/print.pdf`} target="_blank" rel="noopener noreferrer">
        Vytisknout QR na stůl (PDF)
      </a>
    </div>
  )
```

- [ ] **Step 2: Style the print link**

In `src/app/(host)/host.module.css`, add after the `.shareUrl` block (line ~106). It sits on the gradient `.share` panel, so use a white "chip" look consistent with `.shareQr`:

```css
.sharePrint {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 14px;
  background: #fff;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 13px;
  color: #111;
  text-decoration: none;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in, open a board's host page (`/boards/<token>`). Confirm the "Vytisknout QR na stůl (PDF)" link appears on the share panel and opens `/b/<token>/print.pdf` in a new tab showing the A4 poster with correct Czech text and a scannable QR.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(host)/boards/SharePanel.tsx" "src/app/(host)/host.module.css"
git commit -m "feat: add 'Vytisknout QR na stůl' link to host share panel"
```

---

## Final verification (whole feature)

- [ ] Run the full suite: `npm run test` → all green.
- [ ] `npx tsc --noEmit` → clean.
- [ ] `npm run build` → succeeds, route listed.
- [ ] Open a real poster PDF and check:
  - Czech letters (ř, ě, ž, ů) render correctly — **not** boxes/tofu.
  - Accent color matches the board's theme (sunset vs. green); QR is pure black on white.
  - Scan the QR → opens `/b/<token>` in a phone browser.
  - Print (or "Save as PDF") in **grayscale** and confirm QR, heading, instructions and fallback link are all fully legible.

## Spec coverage check

- Route `GET /b/[token]/print.pdf`, Node runtime, 404 on unknown token → Task 3. ✅
- QR encodes board URL via `qrPngDataUrl` → Tasks 1, 3. ✅
- `Content-Type: application/pdf`, `inline`, `platebnik-<slug>.pdf` → Task 3. ✅
- Single A4 poster: wordmark, board title, large QR, heading, instruction, fallback link, footer → Task 2. ✅
- Print design: white bg, flat theme accent, pure-black QR, grayscale-safe → Task 2 (styles) + final verification. ✅
- Czech copy ("Zaplať svoji útratu", instruction line) and Czech-capable font → Task 2. ✅
- `SharePanel` entry point → Task 4. ✅
- PostHog `board_print_pdf` event → Task 3. ✅
- `@react-pdf/renderer` dependency + build config → Tasks 2, 3. ✅
- DRY slug/QR helpers shared with the existing card → Task 1. ✅
