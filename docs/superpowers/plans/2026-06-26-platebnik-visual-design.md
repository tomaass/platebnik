# Platebník Visual Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dát funkční, ale neostylované aplikaci Platebník kompletní vizuální identitu „české hospody" — světlou, moderní, mobile-first — včetně systému per-board motivů (Sunset výchozí + Zelená).

**Architecture:** Next.js 15 App Router, React 19, žádný CSS framework. Styling přes `next/font/google` (Bricolage Grotesque + Inter), globální CSS se **sémantickými tokeny** definovanými per motiv přes `[data-theme="…"]`, a per-obrazovkové **CSS Modules**. Motiv je vlastnost boardu (`Board.theme`), `data-theme` se nastavuje na obalu (root = výchozí `sunset`, veřejný board = motiv boardu, editor = živě dle volby).

**Tech Stack:** Next.js, React, TypeScript, Drizzle ORM + Neon Postgres, Zod, `next/font`, CSS Modules, Vitest (unit + DB integrace), Playwright (e2e).

## Global Constraints

- **Cílová obrazovka je mobil**, kontext „opilý palec": dotykové terče ≥ `44px`, vysoký kontrast, celková částka vždy viditelná.
- **QR kód vždy čistě černobílý** (`#1E1B17` na bílé) — barva motivu jen do rámu, nikdy do kódu.
- **Žádné slovo „trapné"/„trapnost"** v UI copy.
- **Finální headline landingu:** `Naťukej, co sis dal. Zbytek zařídí QR.`
- Motivy jen ze zdroje pravdy `src/design/themes.ts`; komponenty čtou jen tokeny (`var(--…)`), nikdy konkrétní hex.
- Výchozí motiv `sunset`. Nový board převezme motiv posledně vytvořeného boardu hostitele.
- Peníze v celých haléřích (`Haler`), nikdy float. Formátování přes existující `formatAmount` z `@/domain/spayd`.
- Commit messages anglicky, Conventional Commits. Práce probíhá na větvi `design/visual-identity` (už existuje).
- Fonty s podmnožinou `latin-ext` (česká diakritika).

### Token reference (závazné hodnoty pro Task 1)

```
Primitives (:root):
  --radius-sm: 9px; --radius: 14px; --radius-lg: 24px;
  --shadow-card: 0 14px 32px rgba(43,33,24,.16);
  --shadow-accent: 0 8px 18px rgba(0,0,0,.18);
  --tap: 44px;
  --font-display: var(--font-bricolage), system-ui, sans-serif;
  --font-body: var(--font-inter), system-ui, sans-serif;

[data-theme="sunset"]:
  --grad: linear-gradient(135deg, #FF9A3D, #F0407E);
  --accent: #F0407E; --accent-ink: #FFFFFF;
  --bg: #FFF9F7; --surface: #FFFFFF; --surface-alt: #FFF4F6;
  --border: #FFE1E8; --text: #2A1620; --text-muted: #9A7B8A;

[data-theme="green"]:
  --grad: linear-gradient(135deg, #34C759, #0E9E6E);
  --accent: #0E9E6E; --accent-ink: #FFFFFF;
  --bg: #F6FBF3; --surface: #FFFFFF; --surface-alt: #F4FAF0;
  --border: #D9EFDF; --text: #16331F; --text-muted: #5E6B53;
```

---

## File Structure

**Nové soubory:**
- `src/design/fonts.ts` — `next/font` setup (Bricolage Grotesque + Inter), exportuje `variable` třídy.
- `src/design/themes.ts` — zdroj pravdy motivů: `ThemeKey`, `THEME_KEYS`, `THEMES`, `DEFAULT_THEME`, `isThemeKey`.
- `src/design/themes.test.ts` — unit testy guardu.
- `src/app/globals.css` — reset, tokeny per motiv, base styly elementů.
- `src/design/ui.module.css` — sdílené atomy (`.btn`, `.btnPrimary`, `.btnGhost`, `.card`, `.field`, `.chip`, `.chipOn`, `.stepper`, `.stepBtn`, `.stepPlus`, `.stepMinus`, `.label`).
- `src/app/page.module.css` — landing.
- `src/app/b/[token]/BoardClient.module.css` — veřejný board.
- `src/app/(host)/boards/BoardEditor.module.css` — editor + theme picker.
- `src/app/(host)/host.module.css` — admin layout, seznam boardů, share, contributions, profil (sdílené pro admin obrazovky).
- `src/app/auth.module.css` — signin + not-found + jednoduché stavové stránky.

**Upravené soubory:**
- `src/app/layout.tsx` — import globals, fonty, `data-theme="sunset"` na `<html>`.
- `src/db/schema.ts` — sloupec `theme` na `boards`.
- `src/db/boards.ts` — `theme` v create/get/update, nová `getLatestBoardTheme`.
- `src/db/boards.test.ts` — test motivu + `getLatestBoardTheme`.
- `src/domain/validation.ts` — `theme` v `boardSchema`.
- `src/app/(host)/actions.ts` — `theme` v create/update akcích.
- `src/app/b/[token]/page.tsx` — předá `theme` do `BoardClient`.
- `src/app/b/[token]/BoardClient.tsx` — kompletní redesign.
- `src/app/b/[token]/not-found.tsx` — ostylování.
- `src/app/page.tsx` — redesign landingu.
- `src/app/(host)/boards/new/page.tsx` — async, načte `getLatestBoardTheme`.
- `src/app/(host)/boards/BoardEditor.tsx` — theme picker, redesign.
- `src/app/(host)/boards/[token]/page.tsx` — předá motiv editoru, ostylování.
- `src/app/(host)/boards/page.tsx` — redesign seznamu.
- `src/app/(host)/boards/SharePanel.tsx` — redesign.
- `src/app/(host)/boards/ContributionsList.tsx` — redesign.
- `src/app/(host)/layout.tsx` — redesign navigace.
- `src/app/(host)/profile/page.tsx` + `ProfileForm.tsx` — redesign.
- `src/app/signin/page.tsx` — redesign.
- `src/app/not-found.tsx` — redesign.
- `tests/e2e/board.spec.ts` — aktualizace textů na nové UI.

---

## Task 1: Foundation — fonty, tokeny, globální CSS

**Files:**
- Create: `src/design/fonts.ts`
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `bricolage`, `inter` (z `@/design/fonts`) — objekty s `.variable: string`. CSS tokeny `var(--accent)`, `var(--grad)`, `var(--bg)`, `var(--surface)`, `var(--surface-alt)`, `var(--border)`, `var(--text)`, `var(--text-muted)`, `var(--accent-ink)`, `var(--radius)`, `var(--radius-sm)`, `var(--radius-lg)`, `var(--shadow-card)`, `var(--shadow-accent)`, `var(--tap)`, `var(--font-display)`, `var(--font-body)` jsou dostupné globálně po nastavení `data-theme` na předku.

- [ ] **Step 1: Vytvoř `src/design/fonts.ts`**

```ts
import { Bricolage_Grotesque, Inter } from 'next/font/google'

// Variabilní fonty — neuvádíme weight, použije se celá osa.
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})
```

- [ ] **Step 2: Vytvoř `src/app/globals.css`**

```css
:root {
  --radius-sm: 9px;
  --radius: 14px;
  --radius-lg: 24px;
  --shadow-card: 0 14px 32px rgba(43, 33, 24, 0.16);
  --shadow-accent: 0 8px 18px rgba(0, 0, 0, 0.18);
  --tap: 44px;
  --font-display: var(--font-bricolage), system-ui, sans-serif;
  --font-body: var(--font-inter), system-ui, sans-serif;
}

[data-theme='sunset'] {
  --grad: linear-gradient(135deg, #ff9a3d, #f0407e);
  --accent: #f0407e;
  --accent-ink: #ffffff;
  --bg: #fff9f7;
  --surface: #ffffff;
  --surface-alt: #fff4f6;
  --border: #ffe1e8;
  --text: #2a1620;
  --text-muted: #9a7b8a;
}

[data-theme='green'] {
  --grad: linear-gradient(135deg, #34c759, #0e9e6e);
  --accent: #0e9e6e;
  --accent-ink: #ffffff;
  --bg: #f6fbf3;
  --surface: #ffffff;
  --surface-alt: #f4faf0;
  --border: #d9efdf;
  --text: #16331f;
  --text-muted: #5e6b53;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text);
  margin: 0 0 0.5em;
}

a {
  color: var(--accent);
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input,
textarea {
  font-family: inherit;
  color: var(--text);
}
```

- [ ] **Step 3: Uprav `src/app/layout.tsx`**

```tsx
import './globals.css'
import { bricolage, inter } from '@/design/fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-theme="sunset" className={`${bricolage.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Ověř build**

Run: `npm run build`
Expected: build projde bez chyb (fonty se stáhnou, CSS se zkompiluje).

- [ ] **Step 5: Commit**

```bash
git add src/design/fonts.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat(design): add fonts, theme tokens and global base styles"
```

---

## Task 2: Theme model (zdroj pravdy motivů)

**Files:**
- Create: `src/design/themes.ts`
- Test: `src/design/themes.test.ts`

**Interfaces:**
- Produces:
  - `THEME_KEYS: readonly ['sunset', 'green']`
  - `type ThemeKey = 'sunset' | 'green'`
  - `DEFAULT_THEME: ThemeKey` (= `'sunset'`)
  - `THEMES: { key: ThemeKey; label: string }[]`
  - `isThemeKey(v: unknown): v is ThemeKey`

- [ ] **Step 1: Napiš padající test `src/design/themes.test.ts`**

```ts
import { describe, expect, test } from 'vitest'
import { DEFAULT_THEME, isThemeKey, THEME_KEYS, THEMES } from './themes'

describe('themes', () => {
  test('DEFAULT_THEME je platný klíč', () => {
    expect(THEME_KEYS).toContain(DEFAULT_THEME)
  })

  test('THEMES pokrývá všechny klíče a má labely', () => {
    expect(THEMES.map((t) => t.key)).toEqual([...THEME_KEYS])
    expect(THEMES.every((t) => t.label.length > 0)).toBe(true)
  })

  test('isThemeKey rozliší platné a neplatné', () => {
    expect(isThemeKey('sunset')).toBe(true)
    expect(isThemeKey('green')).toBe(true)
    expect(isThemeKey('rainbow')).toBe(false)
    expect(isThemeKey(undefined)).toBe(false)
    expect(isThemeKey(42)).toBe(false)
  })
})
```

- [ ] **Step 2: Spusť test, ověř že padá**

Run: `npx vitest run src/design/themes.test.ts`
Expected: FAIL — `Cannot find module './themes'`.

- [ ] **Step 3: Vytvoř `src/design/themes.ts`**

```ts
export const THEME_KEYS = ['sunset', 'green'] as const

export type ThemeKey = (typeof THEME_KEYS)[number]

export const DEFAULT_THEME: ThemeKey = 'sunset'

export const THEMES: { key: ThemeKey; label: string }[] = [
  { key: 'sunset', label: 'Sunset' },
  { key: 'green', label: 'Zelená' },
]

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)
```

- [ ] **Step 4: Spusť test, ověř že prochází**

Run: `npx vitest run src/design/themes.test.ts`
Expected: PASS (3 testy).

- [ ] **Step 5: Commit**

```bash
git add src/design/themes.ts src/design/themes.test.ts
git commit -m "feat(design): add theme registry as single source of truth"
```

---

## Task 3: Datová vrstva — sloupec `theme`, plumbing, default-to-last

**Files:**
- Modify: `src/db/schema.ts` (tabulka `boards`)
- Modify: `src/db/boards.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/app/(host)/actions.ts`
- Test: `src/db/boards.test.ts`

**Interfaces:**
- Consumes: `ThemeKey`, `DEFAULT_THEME`, `isThemeKey`, `THEME_KEYS` z `@/design/themes`.
- Produces:
  - `BoardWithItems` nově obsahuje `theme: ThemeKey`.
  - `createBoard(input: { userId: string; title: string; items: ItemInput[]; theme?: ThemeKey }): Promise<string>`
  - `updateBoard(token, userId, input: { title: string; items: ItemInput[]; theme?: ThemeKey }): Promise<void>`
  - `getLatestBoardTheme(userId: string): Promise<ThemeKey>`
  - `boardSchema` nově obsahuje `theme: ThemeKey` (default `DEFAULT_THEME`).
  - `createBoardAction(input: { title: string; items: ItemInput[]; theme: ThemeKey })`
  - `updateBoardAction(token, input: { title: string; items: ItemInput[]; theme: ThemeKey })`

- [ ] **Step 1: Přidej sloupec `theme` do `boards` v `src/db/schema.ts`**

V definici `export const boards = pgTable('boards', { … })` přidej za `tipPercents` řádek:

```ts
  theme: text('theme').notNull().default('sunset'),
```

- [ ] **Step 2: Vygeneruj a aplikuj migraci**

Run: `npm run db:generate`
Expected: vznikne nový SQL soubor v `./drizzle/` přidávající sloupec `theme` s defaultem `'sunset'`.

Run: `npm run db:migrate`
Expected: migrace projde proti dev DB (existující boardy dostanou `theme='sunset'`).

- [ ] **Step 3: Napiš padající test do `src/db/boards.test.ts`**

Doplň import na začátku (přidej `getLatestBoardTheme` do existujícího importu z `./boards`):

```ts
import {
  createBoard, deleteBoard, getBoardByToken, getLatestBoardTheme, listBoardsByUser, updateBoard,
} from './boards'
```

Přidej nový `test` dovnitř `describe('boards repository', …)`:

```ts
  test('board nese motiv a getLatestBoardTheme vrátí poslední', async () => {
    const a = await createBoard({ userId, title: 'A', items: [], theme: 'green' })
    const boardA = await getBoardByToken(a)
    expect(boardA?.theme).toBe('green')

    expect(await getLatestBoardTheme(userId)).toBe('green')

    await updateBoard(a, userId, { title: 'A2', items: [], theme: 'sunset' })
    expect((await getBoardByToken(a))?.theme).toBe('sunset')

    await deleteBoard(a, userId)
  })

  test('getLatestBoardTheme bez boardů = výchozí', async () => {
    expect(await getLatestBoardTheme('nobody-here')).toBe('sunset')
  })

  test('createBoard bez motivu spadne na výchozí', async () => {
    const t = await createBoard({ userId, title: 'X', items: [] })
    expect((await getBoardByToken(t))?.theme).toBe('sunset')
    await deleteBoard(t, userId)
  })
```

- [ ] **Step 4: Spusť test, ověř že padá**

Run: `npx vitest run src/db/boards.test.ts`
Expected: FAIL — `getLatestBoardTheme` neexistuje / `theme` chybí v `BoardWithItems`.

- [ ] **Step 5: Uprav `src/db/boards.ts`**

Uprav importy (přidej `desc` a theme model):

```ts
import { asc, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, isThemeKey, type ThemeKey } from '@/design/themes'
import { generateVariableSymbol } from '@/lib/vs'
import { db } from './client'
import { boards, items } from './schema'
```

Do `interface BoardWithItems` přidej za `tipPercents`:

```ts
  theme: ThemeKey
```

Nahraď `createBoard`:

```ts
export const createBoard = async (input: {
  userId: string
  title: string
  items: ItemInput[]
  theme?: ThemeKey
}): Promise<string> => {
  const token = nanoid(16)
  await db.insert(boards).values({
    token, userId: input.userId, title: input.title,
    theme: input.theme ?? DEFAULT_THEME,
    variableSymbol: generateVariableSymbol(),
  })
  if (input.items.length > 0) await db.insert(items).values(itemRows(token, input.items))
  return token
}
```

V `getBoardByToken` nahraď `return { … }` tak, aby vracel motiv (přidej `theme` za `tipPercents`):

```ts
  return {
    token: board.token, userId: board.userId, title: board.title,
    variableSymbol: board.variableSymbol, tipPercents: board.tipPercents,
    theme: isThemeKey(board.theme) ? board.theme : DEFAULT_THEME,
    items: R.map(rows, (r) => ({
      id: r.id, name: r.name, priceHaler: r.priceHaler, position: r.position,
    })),
  }
```

Nahraď `updateBoard`:

```ts
export const updateBoard = async (
  token: string,
  userId: string,
  input: { title: string; items: ItemInput[]; theme?: ThemeKey },
): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards)
    .set({ title: input.title, theme: input.theme ?? DEFAULT_THEME, updatedAt: new Date() })
    .where(eq(boards.token, token))
  await db.delete(items).where(eq(items.boardId, token))
  if (input.items.length > 0) await db.insert(items).values(itemRows(token, input.items))
}
```

Přidej na konec souboru:

```ts
export const getLatestBoardTheme = async (userId: string): Promise<ThemeKey> => {
  const rows = await db.select({ theme: boards.theme }).from(boards)
    .where(eq(boards.userId, userId))
    .orderBy(desc(boards.createdAt))
    .limit(1)
  const theme = rows[0]?.theme
  return isThemeKey(theme) ? theme : DEFAULT_THEME
}
```

- [ ] **Step 6: Spusť test, ověř že prochází**

Run: `npx vitest run src/db/boards.test.ts`
Expected: PASS (všechny testy včetně nových).

- [ ] **Step 7: Přidej `theme` do `boardSchema` v `src/domain/validation.ts`**

Přidej import na začátek souboru:

```ts
import { DEFAULT_THEME, THEME_KEYS } from '@/design/themes'
```

V `boardSchema` přidej pole `theme` (za `items`):

```ts
export const boardSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(MAX_ITEM_NAME),
        priceHaler: z.number().int().min(0).max(MAX_PRICE_HALER),
      }),
    )
    .max(MAX_ITEMS),
  theme: z.enum(THEME_KEYS).default(DEFAULT_THEME),
})
```

- [ ] **Step 8: Uprav `src/app/(host)/actions.ts`**

Přidej import:

```ts
import type { ThemeKey } from '@/design/themes'
```

Uprav signaturu `createBoardAction` (typ `input`) — přidej `theme: ThemeKey`:

```ts
export const createBoardAction = async (
  input: { title: string; items: ItemInput[]; theme: ThemeKey },
): Promise<{ token: string } | { error: string }> => {
```

Uprav signaturu `updateBoardAction` (typ `input`):

```ts
export const updateBoardAction = async (
  token: string,
  input: { title: string; items: ItemInput[]; theme: ThemeKey },
): Promise<{ error?: string }> => {
```

(Těla funkcí zůstávají — `boardSchema.safeParse(input)` i `createBoard({ userId: user.id, ...parsed.data })` už motiv propustí.)

- [ ] **Step 9: Ověř typy a testy**

Run: `npx tsc --noEmit`
Expected: žádné chyby.

Run: `npx vitest run`
Expected: PASS (všechny unit + DB testy).

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts src/db/boards.ts src/db/boards.test.ts src/domain/validation.ts src/app/\(host\)/actions.ts drizzle/
git commit -m "feat(boards): add per-board theme column, validation and default-to-last logic"
```

---

## Task 4: Sdílené UI atomy (`ui.module.css`)

**Files:**
- Create: `src/design/ui.module.css`

**Interfaces:**
- Produces (CSS Module třídy, importovatelné v komponentách): `btn`, `btnPrimary`, `btnGhost`, `card`, `field`, `chip`, `chipOn`, `stepper`, `stepBtn`, `stepPlus`, `stepMinus`, `label`, `gradBar`, `qrFrame`.

- [ ] **Step 1: Vytvoř `src/design/ui.module.css`**

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--tap);
  padding: 14px 18px;
  border: none;
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 16px;
  line-height: 1;
}

.btnPrimary {
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: var(--shadow-accent);
}

.btnGhost {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn:disabled {
  opacity: 0.5;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.field {
  width: 100%;
  min-height: var(--tap);
  padding: 13px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 16px;
}

.field:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.label {
  display: block;
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 18px 2px 8px;
}

.chip {
  flex: 1;
  min-height: var(--tap);
  padding: 11px 0;
  text-align: center;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-weight: 700;
  font-size: 14px;
  color: var(--text);
}

.chipOn {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.stepBtn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 800;
  font-size: 20px;
  line-height: 1;
}

.stepMinus {
  background: var(--surface-alt);
  color: var(--text);
}

.stepPlus {
  background: var(--accent);
  color: var(--accent-ink);
}

.stepper .q {
  min-width: 24px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
}

.gradBar {
  background: var(--grad);
  color: #fff;
}

.qrFrame {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
}
```

- [ ] **Step 2: Ověř, že modul lze importovat (build)**

Run: `npm run build`
Expected: build projde (CSS Module je validní; zatím nepoužitý je v pořádku).

- [ ] **Step 3: Commit**

```bash
git add src/design/ui.module.css
git commit -m "feat(design): add shared UI atom styles (buttons, stepper, chips, card)"
```

---

## Task 5: Veřejný board — redesign (hlavní obrazovka)

**Files:**
- Modify: `src/app/b/[token]/page.tsx`
- Modify: `src/app/b/[token]/BoardClient.tsx`
- Create: `src/app/b/[token]/BoardClient.module.css`
- Modify: `src/app/b/[token]/not-found.tsx`
- Modify: `tests/e2e/board.spec.ts`

**Interfaces:**
- Consumes: `BoardWithItems.theme` (Task 3), `ThemeKey`, sdílené atomy z `src/design/ui.module.css`.
- `BoardClient` `Props` nově obsahuje `theme: ThemeKey`.

- [ ] **Step 1: Předej motiv v `src/app/b/[token]/page.tsx`**

V `return ( <BoardClient … /> )` přidej prop `theme={board.theme}`:

```tsx
  return (
    <BoardClient
      token={board.token}
      title={board.title}
      iban={host.bankAccountIban}
      variableSymbol={board.variableSymbol}
      items={board.items.map((it) => ({ id: it.id, name: it.name, priceHaler: it.priceHaler }))}
      tipPercents={board.tipPercents}
      theme={board.theme}
    />
  )
```

Také ostyluj stav „hostitel nemá účet" — nahraď řádek `return <main style={{ padding: '1rem' }}>…</main>`:

```tsx
  if (!host?.bankAccountIban) {
    return (
      <main data-theme={board.theme} style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <p>Hostitel ještě nenastavil platební údaje. Zkus to za chvíli. 🙂</p>
      </main>
    )
  }
```

- [ ] **Step 2: Vytvoř `src/app/b/[token]/BoardClient.module.css`**

```css
.page {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px 14px 120px;
  min-height: 100vh;
  background: var(--bg);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  color: var(--text);
}

.sub {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0 0 16px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 10px 10px 14px;
  margin-bottom: 8px;
}

.rowInfo {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name {
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.price {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-muted);
}

.tips {
  display: flex;
  gap: 7px;
}

.tipInput {
  flex: 1;
  min-height: var(--tap);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0 12px;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
}

.payCard {
  margin-top: 16px;
  padding: 16px;
  text-align: center;
}

.amtLabel {
  display: block;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.amt {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 30px;
  color: var(--text);
}

.qrWrap {
  width: 180px;
  height: 180px;
  margin: 12px auto 6px;
}

.qrWrap svg {
  width: 100%;
  height: 100%;
}

.qrBadge {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--accent);
}

.qrHint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 6px 0 0;
}

.emptyHint {
  text-align: center;
  color: var(--text-muted);
  padding: 24px 0;
}

.sign {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.signPrompt {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  margin: 0;
}

.signError {
  color: #c0392b;
  font-size: 13px;
}

.signDone {
  text-align: center;
  font-weight: 700;
  color: var(--accent);
  padding: 12px 0;
}

.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 480px;
  margin: 0 auto;
  background: var(--grad);
  padding: 12px 14px 16px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.barTotal {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: #fff;
  margin-bottom: 9px;
}

.barLabel {
  font-weight: 600;
  font-size: 14px;
  opacity: 0.85;
}

.barValue {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 24px;
}

.barPay {
  width: 100%;
  min-height: var(--tap);
  border: none;
  border-radius: var(--radius);
  background: #fff;
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 17px;
}
```

- [ ] **Step 3: Přepiš `src/app/b/[token]/BoardClient.tsx`**

Zachovává veškerou logiku (lokální výpočet, QR generování klientsky, podpis přes `signAction`); mění jen vzhled a texty. `data-theme={props.theme}` na kořenovém `<main>`. Celková částka je zároveň v textu `Celkem: …` (kvůli e2e i čtečkám) a vizuálně ve spodní liště.

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import * as R from 'remeda'
import type { ThemeKey } from '@/design/themes'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'
import ui from '@/design/ui.module.css'
import s from './BoardClient.module.css'

interface ClientItem { id: string; name: string; priceHaler: number }
interface Props {
  token: string
  title: string
  iban: string
  variableSymbol: string
  items: ClientItem[]
  tipPercents: number[]
  theme: ThemeKey
}

export default function BoardClient(props: Props) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [tipKc, setTipKc] = useState('')
  const [qr, setQr] = useState('')
  const [signed, setSigned] = useState(false)
  const [signError, setSignError] = useState<string | undefined>(undefined)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const entries = useMemo(
    () => R.pipe(
      props.items,
      R.map((it) => ({ ...it, itemId: it.id, quantity: qty[it.id] ?? 0 })),
      R.filter((e) => e.quantity > 0),
    ),
    [props.items, qty],
  )

  const subtotal = itemsSubtotal(entries)
  const tipKcNum = Number(tipKc)
  const tipHaler = Number.isFinite(tipKcNum) && tipKcNum > 0 ? Math.round(tipKcNum * 100) : 0
  const total = selectionTotal({ entries, tipHaler })

  const spayd = buildSpayd({
    iban: props.iban, amountHaler: total, variableSymbol: props.variableSymbol,
    message: `${name} ${props.title}`.trim(),
  })

  useEffect(() => {
    if (total <= 0) {
      setQr('')
      return
    }
    QRCode.toString(spayd, { type: 'svg', margin: 1 }).then(setQr)
  }, [spayd, total])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  const activeTipKc = (p: number) => String(tipFromPercent(subtotal, p) / 100)

  const sign = async () => {
    setSignError(undefined)
    const res = await signAction({
      token: props.token, name: name || undefined, message: message || undefined,
      selectionSnapshot: entries.map((e) => ({ name: e.name, quantity: e.quantity })),
      amountHaler: total, tipHaler,
    })
    if (res.ok) setSigned(true)
    else setSignError(res.error ?? 'Nastala chyba, zkuste to znovu.')
  }

  return (
    <main data-theme={props.theme} className={s.page}>
      <div className={s.head}>
        <span style={{ fontSize: 22 }}>🔥</span>
        <span className={s.title}>{props.title}</span>
      </div>
      <p className={s.sub}>Co sis dal? Naťukej a zaplať. 🍺</p>

      {props.items.map((it) => (
        <div key={it.id} className={s.row}>
          <span className={s.rowInfo}>
            <span className={s.name}>{it.name}</span>
            <span className={s.price}>{formatAmount(it.priceHaler)} Kč</span>
          </span>
          <span className={ui.stepper}>
            <button className={`${ui.stepBtn} ${ui.stepMinus}`} aria-label={`Ubrat ${it.name}`} onClick={() => setItemQty(it.id, -1)}>−</button>
            <span className="q">{qty[it.id] ?? 0}</span>
            <button className={`${ui.stepBtn} ${ui.stepPlus}`} aria-label={`Přidat ${it.name}`} onClick={() => setItemQty(it.id, +1)}>+</button>
          </span>
        </div>
      ))}

      <span className={ui.label}>Dýško (dobrovolné)</span>
      <div className={s.tips}>
        {props.tipPercents.map((p) => (
          <button key={p} className={ui.chip} onClick={() => setTipKc(activeTipKc(p))}>{p} %</button>
        ))}
        <input
          className={s.tipInput} type="number" inputMode="decimal" placeholder="vlastní Kč"
          value={tipKc} onChange={(e) => setTipKc(e.target.value)}
        />
      </div>

      {total > 0 ? (
        <div className={`${ui.card} ${s.payCard}`}>
          <span className={s.amtLabel}>K zaplacení vč. dýška</span>
          <span className={s.amt}>{formatAmount(total)} Kč</span>
          <p style={{ position: 'absolute', left: -9999 }}>Celkem: {formatAmount(total)} Kč</p>
          {qr && <div className={s.qrWrap} role="img" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Platba" />}
          <div className={s.qrBadge}>▢ QR Platba</div>
          <p className={s.qrHint}>Naskenuj v bankovní appce — IBAN, částka i VS jsou předvyplněné.</p>

          {!signed ? (
            <div className={s.sign}>
              <p className={s.signPrompt}>Podepiš se, ať hostitel ví, kdo platil 🙂</p>
              <input className={ui.field} placeholder="Jméno (třeba Pepa)" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={ui.field} placeholder="Vzkaz (nepovinné)" value={message} onChange={(e) => setMessage(e.target.value)} />
              <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={sign} disabled={total <= 0}>Podepsat se</button>
              {signError && <p className={s.signError}>{signError}</p>}
            </div>
          ) : (
            <p className={s.signDone}>Díky, podpis odeslán!</p>
          )}
        </div>
      ) : (
        <p className={s.emptyHint}>Vyber položky nebo zadej dýško. 👆</p>
      )}

      <div className={s.bar}>
        <div className={s.barTotal}>
          <span className={s.barLabel}>Tvůj účet</span>
          <span className={s.barValue}>{formatAmount(total)} Kč</span>
        </div>
        <button className={s.barPay} onClick={() => { if (typeof document !== 'undefined') document.querySelector(`.${s.payCard}`)?.scrollIntoView({ behavior: 'smooth' }) }}>
          Zaplatit přes QR →
        </button>
      </div>
    </main>
  )
}
```

> Poznámka k responzivitě (spec §7): na MVP používáme jednotnou jednostránkovou variantu pro všechna zařízení + lepkavou spodní lištu, která ke QR plynule sroluje. Plný „bottom sheet" na mobilu je vědomě odložen jako pozdější vylepšení (nemění datový model ani komponenty), aby zůstala zachována lehkost a žádný extra JS. Sticky lišta tak slouží jako mobilní fokus na platbu.

- [ ] **Step 4: Ostyluj `src/app/b/[token]/not-found.tsx`**

```tsx
export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
      <h1>Tahle akce tu není 🤔</h1>
      <p>Odkaz nejspíš vypršel nebo byl smazán. Zkus si ho nechat poslat znovu.</p>
    </main>
  )
}
```

- [ ] **Step 5: Aktualizuj e2e `tests/e2e/board.spec.ts`**

Nahraď tělo testu `'host vybere položku…'` (texty odpovídají novému UI; částka je v skrytém `Celkem:` odstavci i ve spodní liště):

```ts
test('host vybere položku, vidí cenu a QR, podepíše se', async ({ page }) => {
  await page.goto(`/b/${token}`)
  await expect(page.getByText('E2E Gril')).toBeVisible()
  await page.getByRole('button', { name: /Přidat/ }).first().click()
  await expect(page.getByText('Celkem: 45.00 Kč')).toBeVisible()
  await expect(page.getByLabel('QR Platba')).toBeVisible()
  await page.getByPlaceholder(/Jméno/).fill('Pepa')
  await page.getByRole('button', { name: 'Podepsat se' }).click()
  await expect(page.getByText('Díky, podpis odeslán!')).toBeVisible()
})
```

- [ ] **Step 6: Ověř typy, build a e2e**

Run: `npx tsc --noEmit`
Expected: žádné chyby.

Run: `npx playwright test`
Expected: PASS (e2e test projde proti dev serveru).

- [ ] **Step 7: Vizuální kontrola (mobilní viewport)**

Spusť dev server na pozadí: `npm run dev`
Vytvoř testovací board (přes editor po přihlášení) nebo použij e2e token z DB a otevři `/b/<token>`.
Run: `agent-browser open "http://localhost:3000/b/<token>"` → `agent-browser screenshot /tmp/board.png --full`
Expected: světlý Sunset board, velké steppery, lepkavá gradientová lišta dole, QR po výběru položky. Zkontroluj i zelený board (board s `theme='green'`).

- [ ] **Step 8: Commit**

```bash
git add src/app/b/\[token\]/ tests/e2e/board.spec.ts
git commit -m "feat(board): redesign public board with themed mobile-first UI"
```

---

## Task 6: Landing — redesign

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/page.module.css`

**Interfaces:**
- Consumes: tokeny + `next/link`. Žádné nové exporty.

- [ ] **Step 1: Vytvoř `src/app/page.module.css`**

```css
.page {
  max-width: 520px;
  margin: 0 auto;
  min-height: 100vh;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
}

.logo {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  color: var(--text);
}

.logo .dot {
  color: var(--accent);
}

.login {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
}

.hero {
  padding: 18px 20px 28px;
}

.kicker {
  display: inline-block;
  font-weight: 700;
  font-size: 12px;
  color: var(--accent);
  background: var(--surface-alt);
  border-radius: 20px;
  padding: 7px 12px;
  margin-bottom: 14px;
}

.h1 {
  font-size: 33px;
  line-height: 1.05;
  margin: 0 0 12px;
}

.lead {
  font-size: 16px;
  line-height: 1.45;
  color: var(--text-muted);
  margin: 0 0 20px;
}

.cta {
  display: block;
  text-align: center;
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: var(--radius);
  padding: 16px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 17px;
  box-shadow: var(--shadow-accent);
  margin-bottom: 10px;
}

.ctaSub {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.steps {
  background: #2a1620;
  padding: 26px 20px;
}

.stepsTitle {
  color: #fff;
  font-size: 20px;
  margin: 0 0 18px;
}

.step {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.stepN {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 17px;
  line-height: 34px;
  text-align: center;
}

.stepText b {
  display: block;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}

.stepText span {
  color: #fff;
  opacity: 0.75;
  font-size: 13px;
}

.trust {
  padding: 24px 20px;
}

.tcard {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 10px;
}

.tcard .ic {
  font-size: 22px;
}

.tcard b {
  display: block;
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
  margin: 6px 0 3px;
}

.tcard span {
  font-size: 13px;
  color: var(--text-muted);
}

.foot {
  text-align: center;
  padding: 18px;
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Přepiš `src/app/page.tsx`**

```tsx
import Link from 'next/link'
import s from './page.module.css'

export default function Home() {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <span className={s.logo}>Platebník<span className={s.dot}>.</span></span>
        <Link className={s.login} href="/signin">Přihlásit</Link>
      </nav>

      <section className={s.hero}>
        <span className={s.kicker}>🍺 Pro grilovačky a sešlosti</span>
        <h1 className={s.h1}>Naťukej, co sis dal. Zbytek zařídí QR.</h1>
        <p className={s.lead}>
          Udělej ceník, nasdílej QR a nech partu naťukat, co si dali.
          Každý zaplatí přímo tobě — bez kalkulačky.
        </p>
        <Link className={s.cta} href="/boards">Vytvořit akci →</Link>
        <div className={s.ctaSub}>Zdarma · bez instalace · platba přes QR do tvé banky</div>
      </section>

      <section className={s.steps}>
        <h2 className={s.stepsTitle}>Jak to chodí</h2>
        <div className={s.step}>
          <span className={s.stepN}>1</span>
          <span className={s.stepText}><b>Sepíšeš ceník</b><span>Pivo 40, klobása 60… nebo jen „dýško za grill".</span></span>
        </div>
        <div className={s.step}>
          <span className={s.stepN}>2</span>
          <span className={s.stepText}><b>Nasdílíš QR / odkaz</b><span>Parta ho naskenuje. Žádná registrace pro hosty.</span></span>
        </div>
        <div className={s.step}>
          <span className={s.stepN}>3</span>
          <span className={s.stepText}><b>Každý zaplatí sobě</b><span>Naťuká co měl → QR Platba → hotovo. Peníze jdou rovnou tobě.</span></span>
        </div>
      </section>

      <section className={s.trust}>
        <div className={s.tcard}>
          <span className={s.ic}>🏦</span>
          <b>Peníze jdou přímo k tobě</b>
          <span>Přes QR Platbu do tvé banky. Žádná brána, žádný poplatek, nic si nebereme.</span>
        </div>
        <div className={s.tcard}>
          <span className={s.ic}>📱</span>
          <b>Host nic neinstaluje</b>
          <span>Otevře odkaz, naťuká, naskenuje QR ve své bankovní appce. Funguje i na mobilních datech.</span>
        </div>
        <div className={s.tcard}>
          <span className={s.ic}>✍️</span>
          <b>Víš, kdo zaplatil</b>
          <span>Hosté se ti můžou podepsat a nechat vzkaz. Konec dohadování.</span>
        </div>
      </section>

      <div className={s.foot}>Platebník.cz · vyrobeno v Česku 🇨🇿</div>
    </main>
  )
}
```

- [ ] **Step 3: Ověř build a vizuál**

Run: `npm run build`
Expected: build projde.

Run (dev běží): `agent-browser open "http://localhost:3000/" && agent-browser screenshot /tmp/landing.png --full`
Expected: Sunset hero, tmavá sekce „Jak to chodí", tři důvěryhodnostní karty, headline bez „trapné".

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "feat(landing): redesign landing page with hero, steps and trust cards"
```

---

## Task 7: Admin — editor boardu + theme picker

**Files:**
- Modify: `src/app/(host)/boards/BoardEditor.tsx`
- Create: `src/app/(host)/boards/BoardEditor.module.css`
- Modify: `src/app/(host)/boards/new/page.tsx`
- Modify: `src/app/(host)/boards/[token]/page.tsx`

**Interfaces:**
- Consumes: `THEMES`, `DEFAULT_THEME`, `ThemeKey` z `@/design/themes`; `getLatestBoardTheme`, `BoardWithItems.theme` (Task 3); sdílené atomy.
- `BoardEditor` `Props` nově: `initialTheme?: ThemeKey`.

- [ ] **Step 1: Vytvoř `src/app/(host)/boards/BoardEditor.module.css`**

```css
.wrap {
  display: flex;
  flex-direction: column;
}

.itemRow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.itemName {
  flex: 1;
}

.itemPrice {
  width: 96px;
}

.del {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-sm);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  color: var(--accent);
  font-weight: 700;
  font-size: 18px;
}

.add {
  width: 100%;
  border: 1.5px dashed var(--accent);
  background: var(--surface-alt);
  color: var(--accent);
  border-radius: var(--radius);
  padding: 12px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 14px;
  margin-top: 2px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 8px 2px 0;
}

.themes {
  display: flex;
  gap: 10px;
}

.theme {
  flex: 1;
  border-radius: var(--radius);
  padding: 6px;
  border: 2px solid var(--border);
  background: var(--surface);
  cursor: pointer;
}

.themeOn {
  border-color: var(--accent);
}

.themePrev {
  height: 54px;
  border-radius: var(--radius-sm);
  background: var(--grad);
}

.themeName {
  text-align: center;
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
  padding: 7px 0 3px;
}

.error {
  color: #c0392b;
  font-size: 13px;
  margin-top: 8px;
}

.save {
  width: 100%;
  margin-top: 16px;
}
```

> Pozn.: aby náhled „themePrev" ukázal barvy daného motivu (ne aktuálně vybraného), každý `.theme` obal dostane vlastní `data-theme` (viz TSX).

- [ ] **Step 2: Přepiš `src/app/(host)/boards/BoardEditor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, THEMES, type ThemeKey } from '@/design/themes'
import { createBoardAction, updateBoardAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from './BoardEditor.module.css'

interface Props {
  token?: string
  initialTitle?: string
  initialItems?: ItemInput[]
  initialTheme?: ThemeKey
}

export default function BoardEditor({
  token, initialTitle = '', initialItems = [], initialTheme = DEFAULT_THEME,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<ItemInput[]>(initialItems)
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)
  const [error, setError] = useState('')

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { name: '', priceHaler: 0 }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setError('')
    const clean = R.pipe(items, R.filter((it) => it.name.trim().length > 0))
    if (token) {
      const res = await updateBoardAction(token, { title, items: clean, theme })
      if (res.error) return setError(res.error)
      router.refresh()
      return
    }
    const res = await createBoardAction({ title, items: clean, theme })
    if ('error' in res) return setError(res.error)
    router.push(`/boards/${res.token}`)
  }

  return (
    <div data-theme={theme} className={s.wrap}>
      <span className={ui.label}>Název akce</span>
      <input className={ui.field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grilovačka u Tomáše" />

      <span className={ui.label}>Ceník</span>
      {items.map((it, i) => (
        <div key={i} className={s.itemRow}>
          <input
            className={`${ui.field} ${s.itemName}`} value={it.name} placeholder="Pivo 🍺"
            onChange={(e) => setItem(i, { name: e.target.value })}
          />
          <input
            className={`${ui.field} ${s.itemPrice}`} type="number" inputMode="decimal" placeholder="Kč"
            value={it.priceHaler === 0 ? '' : it.priceHaler / 100}
            onChange={(e) => setItem(i, { priceHaler: Math.round(Number(e.target.value) * 100) })}
          />
          <button type="button" className={s.del} aria-label="Smazat položku" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" className={s.add} onClick={addItem}>+ Přidat položku</button>
      <p className={s.hint}>Bez položek? V pohodě — board pojede v režimu čistého dýška.</p>

      <span className={ui.label}>Styl akce</span>
      <div className={s.themes}>
        {THEMES.map((t) => (
          <div
            key={t.key} data-theme={t.key}
            className={`${s.theme} ${theme === t.key ? s.themeOn : ''}`}
            onClick={() => setTheme(t.key)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTheme(t.key) }}
          >
            <div className={s.themePrev} />
            <div className={s.themeName}>{t.label}{theme === t.key ? ' ✓' : ''}</div>
          </div>
        ))}
      </div>
      <p className={s.hint}>Nový board převezme tvůj poslední styl. 🔓 Další motivy přibydou v Premiu.</p>

      {error && <p className={s.error}>{error}</p>}
      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${s.save}`} onClick={save}>Uložit</button>
    </div>
  )
}
```

- [ ] **Step 3: Uprav `src/app/(host)/boards/new/page.tsx` (async, načte poslední motiv)**

```tsx
import { requireUser } from '@/auth/config'
import { getLatestBoardTheme } from '@/db/boards'
import BoardEditor from '../BoardEditor'

export default async function NewBoard() {
  const user = await requireUser()
  const initialTheme = await getLatestBoardTheme(user.id)
  return (
    <main>
      <h1>Nová akce</h1>
      <BoardEditor initialTheme={initialTheme} />
    </main>
  )
}
```

- [ ] **Step 4: Uprav `src/app/(host)/boards/[token]/page.tsx` (předá motiv editoru)**

V `<BoardEditor … />` přidej `initialTheme={board.theme}`:

```tsx
      <BoardEditor
        token={token}
        initialTitle={board.title}
        initialItems={board.items.map((it) => ({ name: it.name, priceHaler: it.priceHaler }))}
        initialTheme={board.theme}
      />
```

- [ ] **Step 5: Ověř typy a build**

Run: `npx tsc --noEmit`
Expected: žádné chyby.

Run: `npm run build`
Expected: build projde.

- [ ] **Step 6: Vizuální kontrola**

Run (dev běží, po přihlášení): `agent-browser open "http://localhost:3000/boards/new" && agent-browser screenshot /tmp/editor.png --full`
Expected: pole ceníku, „+ Přidat položku", přepínač „Styl akce" se dvěma náhledy (Sunset/Zelená), kliknutí přepne náhled celého editoru.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(host\)/boards/BoardEditor.tsx src/app/\(host\)/boards/BoardEditor.module.css src/app/\(host\)/boards/new/page.tsx src/app/\(host\)/boards/\[token\]/page.tsx
git commit -m "feat(admin): redesign board editor with per-board theme picker"
```

---

## Task 8: Admin — zbývající obrazovky (layout, seznam, share, podpisy, profil, signin, 404)

**Files:**
- Create: `src/app/(host)/host.module.css`
- Create: `src/app/auth.module.css`
- Modify: `src/app/(host)/layout.tsx`
- Modify: `src/app/(host)/boards/page.tsx`
- Modify: `src/app/(host)/boards/SharePanel.tsx`
- Modify: `src/app/(host)/boards/ContributionsList.tsx`
- Modify: `src/app/(host)/profile/page.tsx`
- Modify: `src/app/(host)/profile/ProfileForm.tsx`
- Modify: `src/app/signin/page.tsx`
- Modify: `src/app/not-found.tsx`

**Interfaces:**
- Consumes: sdílené atomy + tokeny. Žádné nové exporty ani změny signatur.

- [ ] **Step 1: Vytvoř `src/app/(host)/host.module.css`**

```css
.shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  color: var(--text);
  margin-right: auto;
}

.brand .dot {
  color: var(--accent);
}

.navLink {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

.signout {
  background: none;
  border: none;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 14px;
}

.newBtn {
  display: inline-block;
  margin-bottom: 16px;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.boardCard {
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 16px;
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.empty {
  color: var(--text-muted);
  padding: 24px 0;
}

.share {
  background: var(--grad);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin: 16px 0;
  color: #fff;
}

.shareTitle {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 15px;
  margin-bottom: 10px;
}

.shareRow {
  display: flex;
  gap: 12px;
  align-items: center;
}

.shareQr {
  width: 84px;
  height: 84px;
  flex: none;
  background: #fff;
  border-radius: var(--radius-sm);
  padding: 4px;
}

.shareQr svg {
  width: 100%;
  height: 100%;
}

.shareUrl {
  font-weight: 600;
  font-size: 13px;
  word-break: break-all;
  color: #fff;
}

.contribList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contrib {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
}

.contrib input {
  width: 22px;
  height: 22px;
  accent-color: var(--accent);
}

.contribName {
  font-weight: 700;
  color: var(--text);
}

.contribMsg {
  color: var(--text-muted);
  font-style: italic;
}

.iban {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 8px;
}
```

- [ ] **Step 2: Vytvoř `src/app/auth.module.css`**

```css
.page {
  max-width: 420px;
  margin: 0 auto;
  padding: 3rem 1.25rem;
}

.title {
  font-size: 28px;
  margin-bottom: 1rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.divider {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  margin: 8px 0;
}
```

- [ ] **Step 3: Přepiš `src/app/(host)/layout.tsx`**

```tsx
import Link from 'next/link'
import { requireUser, signOut } from '@/auth/config'
import s from './host.module.css'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link href="/boards" className={s.brand}>Platebník<span className={s.dot}>.</span></Link>
        <Link href="/boards" className={s.navLink}>Moje akce</Link>
        <Link href="/profile" className={s.navLink}>Profil</Link>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
          <button type="submit" className={s.signout}>Odhlásit</button>
        </form>
      </nav>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Přepiš `src/app/(host)/boards/page.tsx`**

```tsx
import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { listBoardsByUser } from '@/db/boards'
import ui from '@/design/ui.module.css'
import s from '../host.module.css'

export default async function Boards() {
  const user = await requireUser()
  const boards = await listBoardsByUser(user.id)
  return (
    <main>
      <h1>Moje akce</h1>
      <Link href="/boards/new" className={`${ui.btn} ${ui.btnPrimary} ${s.newBtn}`}>+ Nová akce</Link>
      {boards.length === 0 ? (
        <p className={s.empty}>Zatím žádná akce. Vytvoř první a nasdílej partě. 🍺</p>
      ) : (
        <ul className={s.list}>
          {boards.map((b) => (
            <li key={b.token}>
              <Link href={`/boards/${b.token}`} className={s.boardCard}>{b.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Přepiš `src/app/(host)/boards/SharePanel.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import s from '../host.module.css'

export default function SharePanel({ token }: { token: string }) {
  const [svg, setSvg] = useState('')
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${token}` : ''

  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 1 }).then(setSvg)
  }, [url])

  return (
    <div className={s.share}>
      <div className={s.shareTitle}>Hotovo! Nasdílej partě 🎉</div>
      <div className={s.shareRow}>
        {/* dangerouslySetInnerHTML je zde bezpečné — svg je výstup qrcode knihovny z naší vlastní URL, ne uživatelský vstup */}
        <div className={s.shareQr} role="img" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR kód na board" />
        <a className={s.shareUrl} href={url}>{url}</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Přepiš `src/app/(host)/boards/ContributionsList.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { formatAmount } from '@/domain/spayd'
import { setPaidAction } from '../actions'
import type { ContributionRow } from '@/db/contributions'
import s from '../host.module.css'

export default function ContributionsList({ rows }: { rows: ContributionRow[] }) {
  const [state, setState] = useState(rows)
  const toggle = async (id: string, paid: boolean) => {
    await setPaidAction(id, paid)
    setState((prev) => prev.map((r) => (r.id === id ? { ...r, paid } : r)))
  }
  if (state.length === 0) return <p className={s.empty}>Zatím se nikdo nepodepsal.</p>
  return (
    <ul className={s.contribList}>
      {state.map((r) => (
        <li key={r.id} className={s.contrib}>
          <input type="checkbox" checked={r.paid} onChange={(e) => toggle(r.id, e.target.checked)} aria-label="Zaplaceno" />
          <span>
            <span className={s.contribName}>{r.name ?? 'Anonym'}</span> — {formatAmount(r.amountHaler)} Kč
            {r.message && <span className={s.contribMsg}> „{r.message}"</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 7: Přepiš `src/app/(host)/profile/page.tsx` a `ProfileForm.tsx`**

`src/app/(host)/profile/page.tsx` zůstává strukturou stejný (jen nadpis/odstavec se zdědí z base stylů) — beze změny kódu. Přepiš `ProfileForm.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { saveAccountAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from '../host.module.css'

export function ProfileForm({
  defaultAccount,
  iban,
}: {
  defaultAccount: string
  iban: string | null
}) {
  const [state, formAction] = useActionState(saveAccountAction, {})
  return (
    <>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
        <input
          className={ui.field} name="account" placeholder="19-2000145399/0800"
          defaultValue={defaultAccount} required
        />
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>Uložit</button>
      </form>
      {state.error && <p style={{ color: '#c0392b', fontSize: 13 }}>{state.error}</p>}
      {iban && <p className={s.iban}>IBAN: {iban}</p>}
    </>
  )
}
```

- [ ] **Step 8: Přepiš `src/app/signin/page.tsx`**

```tsx
import { signIn } from '@/auth/config'
import ui from '@/design/ui.module.css'
import s from '../auth.module.css'

export default function SignIn() {
  return (
    <main className={s.page}>
      <h1 className={s.title}>Přihlášení</h1>
      {process.env.AUTH_GOOGLE_ID && (
        <form className={s.form} action={async () => { 'use server'; await signIn('google', { redirectTo: '/boards' }) }}>
          <button type="submit" className={`${ui.btn} ${ui.btnGhost}`}>Přihlásit se přes Google</button>
        </form>
      )}
      <div className={s.divider}>nebo e-mailem</div>
      <form
        className={s.form}
        action={async (fd) => { 'use server'; await signIn('nodemailer', { email: fd.get('email'), redirectTo: '/boards' }) }}
      >
        <input className={ui.field} type="email" name="email" placeholder="vas@email.cz" required />
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>Poslat přihlašovací odkaz</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 9: Přepiš `src/app/not-found.tsx`**

```tsx
export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
      <h1>Stránka nenalezena 🤔</h1>
      <p>Tady nic není. Zkus to z domovské stránky.</p>
    </main>
  )
}
```

- [ ] **Step 10: Ověř typy, build, kompletní testy**

Run: `npx tsc --noEmit`
Expected: žádné chyby.

Run: `npm run build`
Expected: build projde.

Run: `npx vitest run`
Expected: PASS.

Run: `npx playwright test`
Expected: PASS.

- [ ] **Step 11: Vizuální kontrola admin obrazovek**

Run (dev běží, přihlášený): postupně
`agent-browser open "http://localhost:3000/boards"` → screenshot,
`agent-browser open "http://localhost:3000/profile"` → screenshot,
`agent-browser open "http://localhost:3000/signin"` → screenshot.
Expected: jednotný Sunset styl, čitelné karty, gradientový share panel na detailu boardu.

- [ ] **Step 12: Commit**

```bash
git add src/app/\(host\)/ src/app/signin/page.tsx src/app/not-found.tsx src/app/auth.module.css
git commit -m "feat(admin): redesign host layout, boards list, share, contributions, profile and auth screens"
```

---

## Self-Review

**1. Spec coverage:**
- §2 značkový svět / §3 odlišení → barvy a typografie v Task 1, motivy Task 2–3, copy napříč Task 5–8. ✅
- §4 barevný systém + tokeny + motivy → Task 1 (tokeny), Task 2 (registry), Task 3 (per-board persistence + default-to-last). ✅
- §4 QR vždy černobílé → Task 5 ponechává `qrcode` SVG bez barvení, rám přes `--border`. ✅
- §5 typografie (Bricolage + Inter, latin-ext) → Task 1. ✅
- §6 komponenty (button, stepper, card, chip, sticky bar, QR karta) → Task 4 + Task 5. ✅
- §7 veřejný board (řádky + stepper, sticky lišta, dýško, QR, podpis) → Task 5. Responzivní bottom-sheet vědomě odložen (poznámka v Task 5 Step 3) — jednostránková varianta + sticky lišta pokrývá MVP. ✅ (vědomá redukce, zaznamenáno)
- §8 landing → Task 6. ✅
- §9 copy / bez „trapné" / headline → globální constraint + Task 6 (+ pozn. o opravě headline znaku). ✅
- §10 admin (editor + theme picker, seznam, profil, share) → Task 7–8. ✅
- §11 přístupnost (terče ≥44px, aria-label QR a ovládání, focus) → atomy `--tap`, aria-labely v Task 5/7/8. ✅
- §12 premium motivy → systém tokenů připraven (přidání = další `[data-theme]` blok + položka v `THEMES`), zaznamenáno ve specce, mimo scope plánu. ✅

**2. Placeholder scan:** Žádné „TBD/TODO". Veškerý CSS/TSX je kompletní; headline v Task 6 je přesně dle Global Constraints.

**3. Type consistency:** `ThemeKey`, `THEME_KEYS`, `DEFAULT_THEME`, `isThemeKey`, `THEMES` definovány v Task 2 a konzistentně použity v Task 3 (db, validace, akce), Task 5 (BoardClient prop), Task 7 (BoardEditor prop). `getLatestBoardTheme(userId): Promise<ThemeKey>` definováno v Task 3, voláno v Task 7. `createBoardAction`/`updateBoardAction` rozšířeny o `theme: ThemeKey` v Task 3, volány s `theme` v Task 7. Třídy `ui.module.css` z Task 4 použity přesně týmiž názvy v Task 5/7/8. ✅
