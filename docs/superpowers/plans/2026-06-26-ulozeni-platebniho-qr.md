# Uložení platebního QR do mobilu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat na veřejnou platební stránku tlačítko „Uložit QR", které host na mobilu uloží/sdílí platební QR jako PNG kartu, aby ho šlo načíst v bankovní appce z galerie.

**Architecture:** Zobrazený QR zůstává inline SVG beze změny. Po kliknutí na tlačítko se až na vyžádání (lazy) složí na `<canvas>` minimální brandovaná karta (wordmark „Platebník" + QR + popisek), exportuje se jako PNG blob a nabídne přes Web Share API (`navigator.share` se souborem) s fallbackem na `<a download>`. Veškerá browser logika žije v izolovaném `save-qr.ts`, čisté pomocné funkce jsou unit-testované.

**Tech Stack:** Next.js 15 (App Router, client component), React 19, TypeScript, knihovna `qrcode` (v1.5.4, `toCanvas`), Vitest (env `node`), Remeda.

## Global Constraints

- Žádná nová npm závislost — `qrcode` už je v projektu.
- Styling pouze přes inline `style` props (projekt nemá CSS soubory).
- Coding style: immutable/pipeline, žádné `let`/`for` v app kódu; preferovat early-return.
- Texty pro uživatele česky.
- Zobrazený QR na stránce zůstává SVG (`dangerouslySetInnerHTML`) — neměnit.
- Error-correction QR zůstává default (`M`).
- Vitest běží v `node` env → automaticky testovat jen čisté funkce bez DOM; canvas/share ověřit manuálně.
- Soubor s browser logikou nesmí volat `document`/`navigator`/`File` na úrovni modulu (jen uvnitř funkcí), aby šel importovat v node testech.

---

### Task 1: Čisté pomocné funkce (popisek karty + název souboru)

**Files:**
- Create: `src/app/b/[token]/save-qr.ts`
- Test: `src/app/b/[token]/save-qr.test.ts`

**Interfaces:**
- Consumes: nic (čisté funkce, žádné importy z projektu).
- Produces:
  - `qrCaption(input: { title: string; amountFormatted: string }): string` — spodní popisek karty.
  - `qrFileName(title: string): string` — název PNG souboru, slug z titulku, fallback `platebnik-qr.png`.

- [ ] **Step 1: Napsat padající test**

Create `src/app/b/[token]/save-qr.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { qrCaption, qrFileName } from './save-qr'

describe('qrCaption', () => {
  test('skládá název a částku', () => {
    expect(qrCaption({ title: 'Pátek u Toma', amountFormatted: '350.00' }))
      .toBe('Pátek u Toma • 350.00 Kč')
  })
})

describe('qrFileName', () => {
  test('slugifikuje název', () => {
    expect(qrFileName('Pátek u Toma')).toBe('platebnik-patek-u-toma.png')
  })
  test('odstraní diakritiku a speciální znaky', () => {
    expect(qrFileName('Žluťoučký kůň!!')).toBe('platebnik-zlutoucky-kun.png')
  })
  test('fallback pro prázdný/neslugovatelný název', () => {
    expect(qrFileName('   ')).toBe('platebnik-qr.png')
  })
})
```

- [ ] **Step 2: Spustit test, ověřit že padá**

Run: `npm test -- src/app/b/\[token\]/save-qr.test.ts`
Expected: FAIL — `qrCaption`/`qrFileName` is not defined (modul ještě neexistuje).

- [ ] **Step 3: Napsat minimální implementaci**

Create `src/app/b/[token]/save-qr.ts`:

```ts
export interface QrCardInput {
  spayd: string
  title: string
  amountFormatted: string
}

export const qrCaption = (input: { title: string; amountFormatted: string }): string =>
  `${input.title} • ${input.amountFormatted} Kč`

export const qrFileName = (title: string): string => {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `platebnik-${slug}.png` : 'platebnik-qr.png'
}
```

- [ ] **Step 4: Spustit test, ověřit že prochází**

Run: `npm test -- src/app/b/\[token\]/save-qr.test.ts`
Expected: PASS (4 testy).

- [ ] **Step 5: Commit**

```bash
git add src/app/b/\[token\]/save-qr.ts src/app/b/\[token\]/save-qr.test.ts
git commit -m "feat: pure helpers for QR card caption and filename"
```

---

### Task 2: Canvas karta + Web Share/download + napojení tlačítka do UI

**Files:**
- Modify: `src/app/b/[token]/save-qr.ts` (přidat browser funkce)
- Modify: `src/app/b/[token]/BoardClient.tsx` (tlačítko + hint + `saving` state)

**Interfaces:**
- Consumes: `QrCardInput`, `qrCaption`, `qrFileName` z Tasku 1; `QRCode.toCanvas` z `qrcode`; `formatAmount` (už importovaný v `BoardClient.tsx:7`).
- Produces:
  - `renderQrCard(input: QrCardInput): Promise<Blob>` — složí kartu na canvas, vrátí PNG blob.
  - `saveQrPng(input: QrCardInput): Promise<void>` — share (Web Share API) s fallbackem na download.

- [ ] **Step 1: Doplnit browser funkce do `save-qr.ts`**

Na začátek souboru přidat import a pod stávající čisté funkce přidat `renderQrCard`, `downloadBlob` a `saveQrPng`. Top-level kód nesmí sahat na `document`/`navigator`/`File`.

```ts
import QRCode from 'qrcode'
```

```ts
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const PADDING = 48
const QR_SIZE = 480
const BRAND_H = 44
const CAPTION_H = 40
const GAP = 24
const CARD_W = QR_SIZE + PADDING * 2
const CARD_H = PADDING + BRAND_H + GAP + QR_SIZE + GAP + CAPTION_H + PADDING

export const renderQrCard = async (input: QrCardInput): Promise<Blob> => {
  const qrCanvas = await QRCode.toCanvas(input.spayd, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  })

  const card = document.createElement('canvas')
  card.width = CARD_W
  card.height = CARD_H
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context není dostupný.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#111111'
  ctx.font = `600 28px ${FONT_STACK}`
  ctx.fillText('Platebník', CARD_W / 2, PADDING + 30)

  const qrY = PADDING + BRAND_H + GAP
  ctx.drawImage(qrCanvas, PADDING, qrY, QR_SIZE, QR_SIZE)

  ctx.fillStyle = '#555555'
  ctx.font = `400 22px ${FONT_STACK}`
  ctx.fillText(qrCaption(input), CARD_W / 2, qrY + QR_SIZE + GAP + 22)

  return new Promise<Blob>((resolve, reject) =>
    card.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nepodařilo se vytvořit PNG.'))),
      'image/png',
    ),
  )
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export const saveQrPng = async (input: QrCardInput): Promise<void> => {
  const blob = await renderQrCard(input)
  const file = new File([blob], qrFileName(input.title), { type: 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Platebník — QR platba' })
      return
    } catch (err) {
      // Uživatel zavřel share sheet → nedělat nic. Jiná chyba → fallback na download.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  downloadBlob(blob, file.name)
}
```

- [ ] **Step 2: Ověřit, že čisté testy a typecheck stále procházejí**

Run: `npm test -- src/app/b/\[token\]/save-qr.test.ts`
Expected: PASS (4 testy) — import browser funkcí modul nerozbije v node env.

Run: `npx tsc --noEmit`
Expected: Bez chyb v `save-qr.ts`.

- [ ] **Step 3: Napojit tlačítko a hint do `BoardClient.tsx`**

Přidat import (pod stávající importy, `formatAmount` už importovaný na ř. 7):

```ts
import { saveQrPng } from './save-qr'
```

Přidat state vedle ostatních `useState` (u ř. 23):

```ts
const [saving, setSaving] = useState(false)
```

Přidat handler (vedle `sign`, např. nad `return`):

```ts
const saveQr = async () => {
  setSaving(true)
  try {
    await saveQrPng({ spayd, title: props.title, amountFormatted: formatAmount(total) })
  } finally {
    setSaving(false)
  }
}
```

Nahradit blok zobrazení QR (ř. 104–106):

```tsx
{qr
  ? <div role="img" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Platba" />
  : <p>Vyber položky nebo zadej dýško.</p>}
```

za:

```tsx
{qr
  ? (
    <>
      <div role="img" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Platba" />
      <button onClick={saveQr} disabled={saving}>
        {saving ? 'Ukládám…' : 'Uložit QR'}
      </button>
      <p style={{ fontSize: '0.85rem', color: '#555' }}>
        Ulož QR a načti ho v bankovní appce z galerie.
      </p>
    </>
  )
  : <p>Vyber položky nebo zadej dýško.</p>}
```

- [ ] **Step 4: Ověřit build a typecheck**

Run: `npx tsc --noEmit`
Expected: Bez chyb.

Run: `npm run build`
Expected: Build projde bez chyb.

- [ ] **Step 5: Manuální ověření v prohlížeči**

Run: `npm run dev` (potřebuje `.env.local` s `DATABASE_URL`; existuje-li testovací board, otevřít `/b/<token>`).

Ověřit:
- Vybrat položku → objeví se QR + tlačítko „Uložit QR" + hint.
- Desktop: klik → stáhne se `platebnik-*.png`; otevřít obrázek → bílá karta, nahoře „Platebník", uprostřed QR, dole `{název} • {částka} Kč`.
- Při `total = 0` (nic vybráno) → tlačítko ani hint se nezobrazí.
- **Mobil (reálný iOS i Android):** klik → otevře se share sheet → *Uložit do fotek*; pak v bankovní appce „načíst QR z galerie" → částka i účet sedí.

- [ ] **Step 6: Commit**

```bash
git add src/app/b/\[token\]/save-qr.ts src/app/b/\[token\]/BoardClient.tsx
git commit -m "feat: save payment QR as branded PNG via share sheet with download fallback"
```

---

## Self-Review

**Spec coverage:**
- Uložený obrázek = minimální karta přes canvas (wordmark + QR + popisek) → Task 2 `renderQrCard`. ✅
- Zobrazený QR zůstává SVG, karta lazy na klik → Task 2 (blok QR ponechán jako SVG, `saveQrPng` volán až onClick). ✅
- Tlačítko „Uložit QR" jen při `total > 0` → Task 2 Step 3 (uvnitř `qr ? …`). ✅
- Web Share + fallback, `AbortError` tiše → Task 2 `saveQrPng`. ✅
- Hint pod tlačítkem → Task 2 Step 3. ✅
- Izolace v `save-qr.ts` → Task 1 + 2. ✅
- Error-correction `M` (default) → v `toCanvas` options nenastavujeme `errorCorrectionLevel`. ✅
- Žádná nová závislost → použito `qrcode`. ✅
- Test SPAYD pokrytý jinde; popisek/název souboru unit-testován → Task 1. ✅

**Placeholder scan:** Žádné TBD/TODO; veškerý kód a příkazy konkrétní. ✅

**Type consistency:** `QrCardInput` definován v Tasku 1, použit v Tasku 2; `qrCaption`/`qrFileName`/`renderQrCard`/`saveQrPng` mají konzistentní signatury napříč úkoly. `formatAmount` vrací string (`spayd.ts:11`), předáván do `amountFormatted: string`. ✅
