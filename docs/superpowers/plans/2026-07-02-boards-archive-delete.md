# Archivace a mazání akcí — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umožnit hostovi archivovat akci (ukončit + schovat, vratné) a smazat ji — ale jen z archivu (flow archiv → smazat, model koše).

**Architecture:** Soft-stav přes nový nullable sloupec `boards.archived_at`. Repository funkce (`archiveBoard`/`unarchiveBoard`) přes stávající `assertOwner`; tenké Server Actions nad nimi. Veřejná stránka `/b/[token]` u archivované akce ukáže „akce skončila" a `sign-action` ji odmítne. UI: nebezpečná zóna na detailu + `…` menu na kartě v seznamu, se sekcí „Archivované".

**Tech Stack:** Next.js 15 (App Router, Server Actions), Drizzle ORM + Neon Postgres, React 19, PostHog (server-side), Vitest.

## Global Constraints

- **Jazyk:** anglicky commit messages / kód komentáře; **česky** veškeré user-facing UI copy.
- **Autorizace mutací:** vždy přes `assertOwner(token, userId)` v repo vrstvě (vyhodí `'Forbidden'`).
- **Styl kódu:** immutable, pipeline (native `.map/.filter/.reduce` nebo Remeda tam, kde už je importovaná); žádné `let`/`for` v aplikačním kódu; early return místo `if/else`.
- **Analytics `track()` nikdy nevyhazuje** — je fire-and-forget, `AnalyticsEvent` je uzavřená TS unie.
- **DB testy běží proti dev Neon DB** (vitest načítá `.env.local`); migrace musí být aplikovaná na dev DB, než testy projdou.
- **Package manager:** `pnpm`.
- **Návrh:** `docs/superpowers/specs/2026-07-02-boards-archive-delete-design.md`.

---

## File Structure

**Modify:**
- `src/db/schema.ts` — přidat sloupec `archivedAt`.
- `src/db/boards.ts` — `archivedAt` na typech + čteních, nové `archiveBoard`/`unarchiveBoard`, filtr v `getLatestBoardTheme`, řazení v `listBoardsByUser`.
- `src/app/b/[token]/page.tsx` — closed stav pro archivovanou akci.
- `src/app/b/[token]/sign-action.ts` — odmítnout podpis archivované akce.
- `src/lib/analytics.ts` — rozšířit `AnalyticsEvent` unii.
- `src/app/(host)/actions.ts` — `archiveBoardAction`, `unarchiveBoardAction`, přepsat `deleteBoardAction` (guard + analytics).
- `src/app/(host)/boards/[token]/page.tsx` — vložit nebezpečnou zónu.
- `src/app/(host)/boards/page.tsx` — sekce aktivní / archivované, karty jako komponenta.
- `src/app/(host)/host.module.css` — styly karty (menu, ztlumení), nebezpečné zóny, nadpisu sekce.
- `src/db/boards.test.ts` — testy archive/unarchive/theme-filtr.

**Create:**
- `drizzle/0002_*.sql` — migrace (generovaná).
- `src/app/(host)/boards/BoardDangerZone.tsx` — client komponenta (archiv/odarchiv/smazat na detailu).
- `src/app/(host)/boards/BoardCard.tsx` — client komponenta karty v seznamu (`…` menu).

---

## Task 1: Sloupec `archived_at` + migrace

**Files:**
- Modify: `src/db/schema.ts:18-28`
- Create: `drizzle/0002_*.sql` (generovaná)

**Interfaces:**
- Produces: `boards.archivedAt` sloupec (`timestamp`, nullable, `NULL` = aktivní).

- [ ] **Step 1: Přidat sloupec do schématu**

V `src/db/schema.ts` do tabulky `boards` (za `updatedAt`, řádek 27):

```ts
export const boards = pgTable('boards', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  currency: text('currency').notNull().default('CZK'),
  variableSymbol: text('variable_symbol').notNull(),
  tipPercents: jsonb('tip_percents').$type<number[]>().notNull().default([0, 5, 10]),
  theme: text('theme').notNull().default(DEFAULT_THEME),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // NULL = aktivní akce; vyplněné = archivovaná (ukončená, schovaná).
  archivedAt: timestamp('archived_at'),
})
```

- [ ] **Step 2: Vygenerovat migraci**

Run: `pnpm db:generate`
Expected: vznikne nový soubor `drizzle/0002_*.sql` obsahující `ALTER TABLE "boards" ADD COLUMN "archived_at" timestamp;` a přibude záznam v `drizzle/meta/_journal.json`.

- [ ] **Step 3: Ověřit obsah migrace**

Run: `cat drizzle/0002_*.sql`
Expected: obsahuje `ADD COLUMN "archived_at" timestamp` (bez `NOT NULL`).

- [ ] **Step 4: Aplikovat migraci na dev DB**

Run: `node --env-file=.env.local scripts/migrate.mjs`
Expected: `Migrations up to date.` (bez chyby). Tím je sloupec v dev DB, aby prošly DB testy v dalších úlohách.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(boards): add archived_at column + migration"
```

---

## Task 2: Repository — archive/unarchive + čtení

**Files:**
- Modify: `src/db/boards.ts`
- Test: `src/db/boards.test.ts`

**Interfaces:**
- Consumes: `boards.archivedAt` (Task 1), `assertOwner(token, userId)` (existující, `boards.ts:84`).
- Produces:
  - `archiveBoard(token: string, userId: string): Promise<void>`
  - `unarchiveBoard(token: string, userId: string): Promise<void>`
  - `BoardWithItems.archivedAt: Date | null` (na výstupu `getBoardByToken`)
  - `BoardSummary.archivedAt: Date | null` (na výstupu `listBoardsByUser`)

- [ ] **Step 1: Napsat padající testy**

Do `src/db/boards.test.ts` — nejdřív doplnit import (řádek 6-8):

```ts
import {
  archiveBoard, createBoard, deleteBoard, getBoardByToken,
  getLatestBoardTheme, listBoardsByUser, unarchiveBoard, updateBoard,
} from './boards'
```

Pak přidat do `describe('boards repository', …)` (před uzavírací `})` na řádku 81):

```ts
test('archiveBoard nastaví archivedAt, unarchiveBoard ho vynuluje', async () => {
  const token = await createBoard({ userId, title: 'Gril', items: [] })
  expect((await getBoardByToken(token))?.archivedAt).toBeNull()

  await archiveBoard(token, userId)
  expect((await getBoardByToken(token))?.archivedAt).toBeInstanceOf(Date)

  await unarchiveBoard(token, userId)
  expect((await getBoardByToken(token))?.archivedAt).toBeNull()

  await deleteBoard(token, userId)
})

test('archiveBoard cizího uživatele vyhodí chybu', async () => {
  const token = await createBoard({ userId, title: 'A', items: [] })
  await expect(archiveBoard(token, 'someone-else')).rejects.toThrow()
  await deleteBoard(token, userId)
})

test('listBoardsByUser nese archivedAt', async () => {
  const active = await createBoard({ userId, title: 'Aktivní', items: [] })
  const gone = await createBoard({ userId, title: 'Pryč', items: [] })
  await archiveBoard(gone, userId)

  const rows = await listBoardsByUser(userId)
  expect(rows.find((b) => b.token === active)?.archivedAt).toBeNull()
  expect(rows.find((b) => b.token === gone)?.archivedAt).toBeInstanceOf(Date)

  await deleteBoard(active, userId)
  await deleteBoard(gone, userId)
})

test('getLatestBoardTheme ignoruje archivované akce', async () => {
  const u = `t-${nanoid(6)}`
  await db.insert(users).values({ id: u, email: `${u}@test.local` })
  const token = await createBoard({ userId: u, title: 'Stará', items: [], theme: 'green' })
  await archiveBoard(token, u)
  // Jediná akce je archivovaná → žádná aktivní → výchozí motiv.
  expect(await getLatestBoardTheme(u)).toBe('sunset')
  await db.delete(users).where(eq(users.id, u)) // cascade smaže i board
})
```

- [ ] **Step 2: Spustit testy — ověřit, že padají**

Run: `pnpm test src/db/boards.test.ts`
Expected: FAIL — `archiveBoard`/`unarchiveBoard` neexistují (import error) a `archivedAt` chybí na typech.

- [ ] **Step 3: Rozšířit typy a čtení**

V `src/db/boards.ts` upravit import drizzle helperů (řádek 2):

```ts
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
```

Přidat `archivedAt` do `BoardWithItems` (za `theme`, řádek 31):

```ts
export interface BoardWithItems {
  token: string
  userId: string
  title: string
  variableSymbol: string
  tipPercents: number[]
  theme: ThemeKey
  archivedAt: Date | null
  items: { id: string; name: string; priceHaler: number; position: number }[]
}
```

Přidat `archivedAt` do `BoardSummary` (řádek 35-39):

```ts
export interface BoardSummary {
  token: string
  title: string
  createdAt: Date
  archivedAt: Date | null
}
```

V `getBoardByToken` doplnit `archivedAt` do vraceného objektu (za `theme`, řádek 70):

```ts
  return {
    token: board.token, userId: board.userId, title: board.title,
    variableSymbol: board.variableSymbol, tipPercents: board.tipPercents,
    theme: isThemeKey(board.theme) ? board.theme : DEFAULT_THEME,
    archivedAt: board.archivedAt,
    items: R.map(rows, (r) => ({
      id: r.id, name: r.name, priceHaler: r.priceHaler, position: r.position,
    })),
  }
```

Přepsat `listBoardsByUser` — přidat sloupec a řazení (nejnovější první):

```ts
export const listBoardsByUser = async (userId: string): Promise<BoardSummary[]> => {
  const rows = await db.select({
    token: boards.token, title: boards.title,
    createdAt: boards.createdAt, archivedAt: boards.archivedAt,
  }).from(boards).where(eq(boards.userId, userId)).orderBy(desc(boards.createdAt))
  return rows
}
```

- [ ] **Step 4: Přidat archive/unarchive a filtr do theme**

V `src/db/boards.ts` přidat za `deleteBoard` (řádek 106):

```ts
export const archiveBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards).set({ archivedAt: new Date() }).where(eq(boards.token, token))
}

export const unarchiveBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards).set({ archivedAt: null }).where(eq(boards.token, token))
}
```

Upravit `getLatestBoardTheme` — brát jen aktivní akce (řádek 108-115):

```ts
export const getLatestBoardTheme = async (userId: string): Promise<ThemeKey> => {
  const rows = await db.select({ theme: boards.theme }).from(boards)
    .where(and(eq(boards.userId, userId), isNull(boards.archivedAt)))
    .orderBy(desc(boards.createdAt))
    .limit(1)
  const theme = rows[0]?.theme
  return isThemeKey(theme) ? theme : DEFAULT_THEME
}
```

- [ ] **Step 5: Spustit testy — ověřit, že prochází**

Run: `pnpm test src/db/boards.test.ts`
Expected: PASS (všechny, včetně 4 nových).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb.

```bash
git add src/db/boards.ts src/db/boards.test.ts
git commit -m "feat(boards): archiveBoard/unarchiveBoard + archivedAt on reads"
```

---

## Task 3: Veřejná stránka — „akce skončila"

**Files:**
- Modify: `src/app/b/[token]/page.tsx:45-56`
- Modify: `src/app/b/[token]/sign-action.ts:36-37`

**Interfaces:**
- Consumes: `BoardWithItems.archivedAt` (Task 2), `boards.archivedAt` řádek z `db.query.boards.findFirst`.

- [ ] **Step 1: Closed stav na veřejné stránce**

V `src/app/b/[token]/page.tsx` v `PublicBoard`, hned za `if (!board) notFound()` (řádek 48) přidat:

```ts
  const { token } = await params
  const board = await getBoardByToken(token)
  if (!board) notFound()
  if (board.archivedAt) {
    return (
      <main
        data-theme={board.theme}
        style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}
      >
        <h1>{board.title}</h1>
        <p>Tato akce už skončila. Díky všem! 🎉</p>
      </main>
    )
  }
  const host = await db.query.users.findFirst({ where: eq(users.id, board.userId) })
```

- [ ] **Step 2: Serverová obrana v sign-action**

V `src/app/b/[token]/sign-action.ts` za `if (!board) return { ok: false, error: 'Board neexistuje' }` (řádek 37) přidat:

```ts
  const board = await db.query.boards.findFirst({ where: eq(boards.token, input.token) })
  if (!board) return { ok: false, error: 'Board neexistuje' }
  if (board.archivedAt) return { ok: false, error: 'Tato akce už skončila.' }
```

(`board.archivedAt` je automaticky součástí řádku z `findFirst`, žádný další import netřeba.)

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb.

- [ ] **Step 4: Regresní testy**

Run: `pnpm test`
Expected: PASS (žádná regrese).

- [ ] **Step 5: Ruční ověření**

Ve dvou terminálech: `pnpm dev`, pak jako přihlášený host vytvoř akci, archivuj ji (po Task 5) — nebo teď dočasně nastav `archived_at` v DB — a otevři `/b/<token>`. Očekávané: stránka ukáže „Tato akce už skončila.", nejde se podepsat. (Automatický test vynechán: `sign-action` závisí na `next/headers` + rate-limitu, které projekt v unit testech nemockuje.)

- [ ] **Step 6: Commit**

```bash
git add src/app/b/[token]/page.tsx src/app/b/[token]/sign-action.ts
git commit -m "feat(boards): closed public page + reject signing for archived boards"
```

---

## Task 4: Server actions + analytics

**Files:**
- Modify: `src/lib/analytics.ts:8`
- Modify: `src/app/(host)/actions.ts`

**Interfaces:**
- Consumes: `archiveBoard`, `unarchiveBoard`, `deleteBoard`, `getBoardByToken` (Task 2), `track` (analytics), `requireUser`.
- Produces:
  - `archiveBoardAction(token: string): Promise<{ error?: string }>`
  - `unarchiveBoardAction(token: string): Promise<{ error?: string }>`
  - `deleteBoardAction(token: string): Promise<{ error?: string }>` (změněný návratový typ z `void`)

- [ ] **Step 1: Rozšířit analytics unii**

V `src/lib/analytics.ts` řádek 8:

```ts
type AnalyticsEvent =
  | 'user_registered' | 'board_created' | 'board_signed' | 'board_paid'
  | 'board_archived' | 'board_deleted'
```

- [ ] **Step 2: Upravit importy v actions.ts**

V `src/app/(host)/actions.ts` řádek 8-10:

```ts
import {
  archiveBoard, createBoard, deleteBoard, getBoardByToken, unarchiveBoard, updateBoard,
} from '@/db/boards'
```

- [ ] **Step 3: Přepsat deleteBoardAction (guard + analytics) a přidat archive/unarchive**

V `src/app/(host)/actions.ts` nahradit stávající `deleteBoardAction` (řádek 62-66):

```ts
export const archiveBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  await archiveBoard(token, user.id)
  await track('board_archived', user.id, { board_token: token })
  revalidatePath('/boards')
  revalidatePath(`/boards/${token}`)
  return {}
}

export const unarchiveBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  await unarchiveBoard(token, user.id)
  revalidatePath('/boards')
  revalidatePath(`/boards/${token}`)
  return {}
}

export const deleteBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  // Mazat lze až po archivaci (flow archiv → smazat).
  const board = await getBoardByToken(token)
  if (!board || board.userId !== user.id) return { error: 'Akce nenalezena' }
  if (!board.archivedAt) return { error: 'Akci lze smazat až po archivaci.' }
  await deleteBoard(token, user.id)
  await track('board_deleted', user.id, { board_token: token })
  revalidatePath('/boards')
  return {}
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb. (Pozn.: `deleteBoardAction` teď vrací objekt místo `void` — volající v Task 5/6 s tím počítají; jinde se zatím nevolá.)

- [ ] **Step 5: Regresní testy**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics.ts src/app/(host)/actions.ts
git commit -m "feat(boards): archive/unarchive/delete server actions + analytics"
```

---

## Task 5: Nebezpečná zóna na detailu akce

**Files:**
- Create: `src/app/(host)/boards/BoardDangerZone.tsx`
- Modify: `src/app/(host)/boards/[token]/page.tsx`
- Modify: `src/app/(host)/host.module.css` (přidat styly)

**Interfaces:**
- Consumes: `archiveBoardAction`, `unarchiveBoardAction`, `deleteBoardAction` (Task 4), `BoardWithItems.archivedAt` (Task 2).
- Produces: `<BoardDangerZone token title archived />` React komponenta.

- [ ] **Step 1: Vytvořit komponentu**

Vytvořit `src/app/(host)/boards/BoardDangerZone.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { archiveBoardAction, deleteBoardAction, unarchiveBoardAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from '../host.module.css'

interface Props {
  token: string
  title: string
  archived: boolean
}

export default function BoardDangerZone({ token, title, archived }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (
    fn: () => Promise<{ error?: string }>,
    after: () => void,
  ) => {
    setError('')
    setBusy(true)
    const res = await fn()
    if (res?.error) {
      setError(res.error)
      setBusy(false)
      return
    }
    after()
  }

  const archive = () => run(() => archiveBoardAction(token), () => router.refresh())
  const unarchive = () => run(() => unarchiveBoardAction(token), () => router.refresh())
  const remove = () => {
    if (!window.confirm(`Opravdu smazat akci „${title}"? Nevratně zmizí i všechny příspěvky.`)) return
    run(() => deleteBoardAction(token), () => router.push('/boards'))
  }

  return (
    <section className={s.danger}>
      {archived ? (
        <div className={s.dangerRow}>
          <button
            type="button" disabled={busy} onClick={unarchive}
            className={`${ui.btn} ${s.archiveBtn}`}
          >
            Odarchivovat
          </button>
          <button
            type="button" disabled={busy} onClick={remove}
            className={`${ui.btn} ${s.deleteBtn}`}
          >
            Smazat akci
          </button>
        </div>
      ) : (
        <button
          type="button" disabled={busy} onClick={archive}
          className={`${ui.btn} ${s.archiveBtn}`}
        >
          Archivovat akci
        </button>
      )}
      {error && <p className={s.dangerError}>{error}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Vložit do detailu akce**

V `src/app/(host)/boards/[token]/page.tsx` doplnit import a vykreslení. Nový obsah souboru:

```tsx
import { notFound } from 'next/navigation'
import { requireUser } from '@/auth/config'
import { getBoardByToken } from '@/db/boards'
import { listContributionsByBoard } from '@/db/contributions'
import BoardEditor from '../BoardEditor'
import BoardDangerZone from '../BoardDangerZone'
import SharePanel from '../SharePanel'
import ContributionsList from '../ContributionsList'

export default async function BoardDetail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await requireUser()
  const board = await getBoardByToken(token)
  if (!board || board.userId !== user.id) notFound()
  const contributions = await listContributionsByBoard(token, user.id)
  return (
    <main>
      <h1>{board.title}</h1>
      {board.archivedAt && <p className={'archivedNote'}>Tato akce je archivovaná.</p>}
      <BoardEditor
        token={token}
        initialTitle={board.title}
        initialItems={board.items.map((it) => ({ name: it.name, priceHaler: it.priceHaler }))}
        initialTheme={board.theme}
      />
      <SharePanel token={token} />
      <h2>Kdo se podepsal</h2>
      <ContributionsList rows={contributions} />
      <BoardDangerZone token={token} title={board.title} archived={!!board.archivedAt} />
    </main>
  )
}
```

Pozn.: nahradit `className={'archivedNote'}` za `className={s.archivedNote}` s importem `import s from '../host.module.css'` na začátku souboru:

```tsx
import s from '../host.module.css'
```

a řádek s poznámkou:

```tsx
      {board.archivedAt && <p className={s.archivedNote}>Tato akce je archivovaná.</p>}
```

- [ ] **Step 3: Přidat styly**

Do `src/app/(host)/host.module.css` na konec souboru přidat:

```css
.archivedNote {
  color: var(--text-muted);
  font-weight: 600;
  margin: 4px 0 12px;
}

.danger {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.dangerRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.archiveBtn {
  background: var(--surface-alt);
  border: 1px solid var(--border);
  color: var(--text);
}

.deleteBtn {
  background: var(--surface-alt);
  border: 1px solid #d1495b;
  color: #d1495b;
}

.dangerError {
  color: #d1495b;
  font-size: 13px;
  margin-top: 8px;
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb.

- [ ] **Step 5: Ruční ověření**

Run: `pnpm dev` → jako host otevři `/boards/<token>`. Očekávané: dole tlačítko „Archivovat akci". Po kliknutí se stránka obnoví, ukáže „Tato akce je archivovaná." a tlačítka „Odarchivovat" + „Smazat akci". „Smazat" vyžádá potvrzení a přesměruje na `/boards`.

- [ ] **Step 6: Commit**

```bash
git add src/app/(host)/boards/BoardDangerZone.tsx "src/app/(host)/boards/[token]/page.tsx" src/app/(host)/host.module.css
git commit -m "feat(boards): danger zone (archive/unarchive/delete) on board detail"
```

---

## Task 6: Seznam — sekce Archivované + `…` menu na kartě

**Files:**
- Create: `src/app/(host)/boards/BoardCard.tsx`
- Modify: `src/app/(host)/boards/page.tsx`
- Modify: `src/app/(host)/host.module.css` (přepsat `.boardCard`, přidat menu/ztlumení)

**Interfaces:**
- Consumes: `archiveBoardAction`, `unarchiveBoardAction`, `deleteBoardAction` (Task 4), `BoardSummary.archivedAt` (Task 2).
- Produces: `<BoardCard token title archived />` React komponenta.

- [ ] **Step 1: Vytvořit kartu**

Vytvořit `src/app/(host)/boards/BoardCard.tsx`. `…` menu je nativní `<details>` (dostupné, bez extra JS stavu); karta je kontejner s odkazem + menu jako sourozenci (odkaz nesmí obalovat interaktivní menu):

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { archiveBoardAction, deleteBoardAction, unarchiveBoardAction } from '../actions'
import s from '../host.module.css'

interface Props {
  token: string
  title: string
  archived: boolean
}

export default function BoardCard({ token, title, archived }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true)
    const res = await fn()
    if (res?.error) {
      window.alert(res.error)
      setBusy(false)
      return
    }
    router.refresh()
  }
  const remove = () => {
    if (!window.confirm(`Opravdu smazat akci „${title}"? Nevratně zmizí i všechny příspěvky.`)) return
    act(() => deleteBoardAction(token))
  }

  return (
    <div className={`${s.boardCard} ${archived ? s.boardCardArchived : ''}`}>
      <Link href={`/boards/${token}`} className={s.boardCardLink}>{title}</Link>
      <details className={s.cardMenu}>
        <summary className={s.cardMenuBtn} aria-label="Možnosti akce">⋯</summary>
        <div className={s.cardMenuList}>
          {archived ? (
            <>
              <button type="button" disabled={busy} onClick={() => act(() => unarchiveBoardAction(token))}>
                Odarchivovat
              </button>
              <button type="button" disabled={busy} onClick={remove}>Smazat</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => act(() => archiveBoardAction(token))}>
              Archivovat
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Přepsat seznam**

Nahradit obsah `src/app/(host)/boards/page.tsx`:

```tsx
import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { listBoardsByUser } from '@/db/boards'
import ui from '@/design/ui.module.css'
import BoardCard from './BoardCard'
import s from '../host.module.css'

export default async function Boards() {
  const user = await requireUser()
  const boards = await listBoardsByUser(user.id)
  const active = boards.filter((b) => !b.archivedAt)
  const archived = boards.filter((b) => b.archivedAt)
  return (
    <main>
      <h1>Moje akce</h1>
      <Link href="/boards/new" className={`${ui.btn} ${ui.btnPrimary} ${s.newBtn}`}>+ Nová akce</Link>
      {boards.length === 0 ? (
        <p className={s.empty}>Zatím žádná akce. Vytvoř první a nasdílej partě. 🍺</p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className={s.empty}>Žádná aktivní akce.</p>
          ) : (
            <ul className={s.list}>
              {active.map((b) => (
                <li key={b.token}><BoardCard token={b.token} title={b.title} archived={false} /></li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <>
              <h2 className={s.archivedHeading}>Archivované</h2>
              <ul className={s.list}>
                {archived.map((b) => (
                  <li key={b.token}><BoardCard token={b.token} title={b.title} archived /></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Upravit styly karty**

V `src/app/(host)/host.module.css` nahradit blok `.boardCard` (řádky 54-64) a přidat nové třídy:

```css
.boardCard {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 16px;
}

.boardCardLink {
  flex: 1;
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
  min-width: 0;
}

.boardCardArchived {
  opacity: 0.6;
}

.cardMenu {
  position: relative;
  flex: none;
}

.cardMenuBtn {
  list-style: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  user-select: none;
}

.cardMenu[open] .cardMenuBtn {
  background: var(--surface-alt);
}

.cardMenuBtn::-webkit-details-marker { display: none; }

.cardMenuList {
  position: absolute;
  right: 0;
  top: 36px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.cardMenuList button {
  text-align: left;
  padding: 10px 14px;
  background: none;
  border: none;
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.cardMenuList button:hover {
  background: var(--surface-alt);
}

.archivedHeading {
  margin-top: 28px;
  font-size: 15px;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: bez chyb.

- [ ] **Step 5: Regresní testy**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Ruční ověření**

Run: `pnpm dev` → `/boards`. Očekávané: aktivní akce nahoře; `⋯` menu → „Archivovat" akci schová do sekce „Archivované" (ztlumená karta) s volbami „Odarchivovat" / „Smazat". „Smazat" po potvrzení kartu odstraní.

- [ ] **Step 7: Commit**

```bash
git add src/app/(host)/boards/BoardCard.tsx "src/app/(host)/boards/page.tsx" src/app/(host)/host.module.css
git commit -m "feat(boards): archived section + per-card archive/delete menu on list"
```

---

## Self-Review

**Spec coverage:**
- Datový model `archivedAt` → Task 1. ✅
- `archiveBoard`/`unarchiveBoard` + `assertOwner` → Task 2. ✅
- Čtení: `listBoardsByUser` (archivedAt), `getBoardByToken`/`getBoardMeta`, `getLatestBoardTheme` filtr → Task 2. (`getBoardMeta` vrací jen `title`/`theme` — pro OG/metadata archivace nevadí, záměrně neměněno.) ✅
- Veřejná stránka „akce skončila" + serverová obrana `sign-action` → Task 3. ✅
- Server actions `archive`/`unarchive`/`delete` guard + analytics → Task 4. ✅
- Detail: nebezpečná zóna (aktivní = Archivovat; archiv = Odarchivovat + Smazat, confirm) → Task 5. ✅
- Seznam: aktivní + sekce Archivované, `…` menu, ztlumení → Task 6. ✅
- Analytics `board_archived`/`board_deleted`, bez `board_unarchived` → Task 4. ✅
- Testy archive/unarchive/theme-filtr → Task 2. Delete kaskáda: pokryto stávajícím `deleteBoard` v testech. ✅

**Placeholder scan:** žádné TBD/TODO; každý krok nese konkrétní kód a příkaz. ✅

**Type consistency:** `archivedAt: Date | null` konzistentně na `BoardWithItems` i `BoardSummary`; `archiveBoardAction`/`unarchiveBoardAction`/`deleteBoardAction` vrací `{ error?: string }` a přesně tak je volají Task 5/6; komponenty `BoardDangerZone`/`BoardCard` mají shodné propsy `{ token, title, archived }`. ✅

**Poznámka k testům UI/serverových akcí:** projekt nemá component-test infrastrukturu (Vitest `node` env, žádné jsdom/testing-library) ani mocky pro `next/headers`/rate-limit. Tasky 3/5/6 proto ověřují typecheckem, během regresních testů a ručně — v souladu se stávajícím stavem repozitáře.
