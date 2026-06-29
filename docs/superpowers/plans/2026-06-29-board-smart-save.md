# Board smart-save button + per-field validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the board editor's single "Uložit" button + one global error with a state-aware save button and inline per-field validation.

**Architecture:** Extract all form logic into a pure, unit-tested module `src/domain/boardForm.ts` (validation, dirty detection, button-state derivation). `BoardEditor.tsx` becomes a thin React shell that renders derived state. No autosave; no `router.refresh()` after update.

**Tech Stack:** Next.js 15 (App Router, React 19, client component), TypeScript, Zod (existing `boardSchema` as server guard), Remeda, Vitest (node env, co-located `*.test.ts`).

## Global Constraints

- **UI copy is Czech**; code identifiers, comments, commit messages are English.
- **Immutable / pipeline style** — no `let`, no `for`/`for...of` in app code; use Remeda (`R.map`, `R.filter`, …) or native array methods. (Existing project convention.)
- **Money is integer haléře** (`priceHaler`), never float.
- **Validation limits (verbatim from `src/domain/validation.ts`):** `MAX_TITLE = 80`, `MAX_ITEM_NAME = 60`, `MAX_PRICE_HALER = 100_000_00`.
- **No autosave.** Saving happens only on button click.
- **No `router.refresh()` after a successful update** — reset the in-memory snapshot instead.
- Tests are co-located `*.test.ts`, run with `npm test` (`vitest run`), env `node`, Czech `describe`/`test` names (match `src/domain/iban.test.ts`).
- Commit messages end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

- **Create** `src/domain/boardForm.ts` — pure board-form logic: types, `cleanItems`, `validateBoardForm`, `isBoardDirty`, `saveButton`. One responsibility: turn raw form state into validation + UI-derived state.
- **Create** `src/domain/boardForm.test.ts` — unit tests for the above.
- **Modify** `src/app/(host)/boards/BoardEditor.tsx` — consume the helpers; render per-field errors and the state-aware button.
- **Modify** `src/app/(host)/boards/BoardEditor.module.css` — `.fieldError`, `.inputError`, `.saveMuted`.

Server actions (`src/app/(host)/actions.ts`) and the DB layer are **unchanged** — the client blocks invalid submits, and `boardSchema.safeParse` stays as the last-resort server guard.

---

### Task 1: Validation helpers (`cleanItems`, `validateBoardForm`)

**Files:**
- Create: `src/domain/boardForm.ts`
- Test: `src/domain/boardForm.test.ts`

**Interfaces:**
- Consumes: `MAX_TITLE`, `MAX_ITEM_NAME`, `MAX_PRICE_HALER` from `src/domain/validation.ts`; `ItemInput` from `src/domain/types.ts`; `ThemeKey` from `@/design/themes`.
- Produces:
  - `interface BoardFormState { title: string; items: ItemInput[]; theme: ThemeKey }`
  - `interface ItemFieldError { name?: string; price?: string }`
  - `interface BoardFormErrors { title?: string; items: (ItemFieldError | undefined)[] }`
  - `interface BoardValidation { errors: BoardFormErrors; valid: boolean }`
  - `cleanItems(items: ItemInput[]): ItemInput[]`
  - `validateBoardForm(state: BoardFormState): BoardValidation`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/boardForm.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { cleanItems, validateBoardForm } from './boardForm'
import { DEFAULT_THEME } from '@/design/themes'

const base = { title: 'Grilovačka', items: [], theme: DEFAULT_THEME }

describe('cleanItems', () => {
  test('zahodí úplně prázdné řádky', () => {
    expect(
      cleanItems([
        { name: '', priceHaler: 0 },
        { name: 'Pivo', priceHaler: 5000 },
        { name: '   ', priceHaler: 0 },
      ]),
    ).toEqual([{ name: 'Pivo', priceHaler: 5000 }])
  })
  test('řádek s cenou bez názvu nechá projít (chytí ho validace)', () => {
    expect(cleanItems([{ name: '', priceHaler: 5000 }])).toEqual([{ name: '', priceHaler: 5000 }])
  })
})

describe('validateBoardForm', () => {
  test('prázdný název je chyba', () => {
    const { errors, valid } = validateBoardForm({ ...base, title: '  ' })
    expect(errors.title).toBe('Zadej název akce')
    expect(valid).toBe(false)
  })
  test('příliš dlouhý název je chyba', () => {
    const { errors } = validateBoardForm({ ...base, title: 'x'.repeat(81) })
    expect(errors.title).toBe('Název je moc dlouhý (max 80 znaků)')
  })
  test('validní board bez položek je valid', () => {
    const { errors, valid } = validateBoardForm(base)
    expect(errors.title).toBeUndefined()
    expect(errors.items).toEqual([])
    expect(valid).toBe(true)
  })
  test('úplně prázdný řádek nehlásí chybu (bude zahozen)', () => {
    const { errors, valid } = validateBoardForm({ ...base, items: [{ name: '', priceHaler: 0 }] })
    expect(errors.items).toEqual([undefined])
    expect(valid).toBe(true)
  })
  test('cena bez názvu hlásí chybu u názvu', () => {
    const { errors, valid } = validateBoardForm({ ...base, items: [{ name: '', priceHaler: 5000 }] })
    expect(errors.items[0]).toEqual({ name: 'Doplň název položky' })
    expect(valid).toBe(false)
  })
  test('příliš dlouhý název položky', () => {
    const { errors } = validateBoardForm({ ...base, items: [{ name: 'x'.repeat(61), priceHaler: 0 }] })
    expect(errors.items[0]).toEqual({ name: 'Název položky je moc dlouhý (max 60 znaků)' })
  })
  test('příliš vysoká cena', () => {
    const { errors } = validateBoardForm({ ...base, items: [{ name: 'Pivo', priceHaler: 100_000_01 }] })
    expect(errors.items[0]).toEqual({ price: 'Cena je moc vysoká' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/domain/boardForm.test.ts`
Expected: FAIL — cannot resolve `./boardForm` (module not found).

- [ ] **Step 3: Implement the validation helpers**

Create `src/domain/boardForm.ts`:

```ts
import * as R from 'remeda'
import type { ItemInput } from './types'
import type { ThemeKey } from '@/design/themes'
import { MAX_ITEM_NAME, MAX_PRICE_HALER, MAX_TITLE } from './validation'

export interface BoardFormState {
  title: string
  items: ItemInput[]
  theme: ThemeKey
}

export interface ItemFieldError {
  name?: string
  price?: string
}

export interface BoardFormErrors {
  title?: string
  items: (ItemFieldError | undefined)[]
}

export interface BoardValidation {
  errors: BoardFormErrors
  valid: boolean
}

// A row with no name and no price is dropped on save, so it is never an error.
const isEmptyRow = (it: ItemInput): boolean => it.name.trim() === '' && it.priceHaler === 0

/** Rows actually persisted: fully empty rows are dropped. */
export const cleanItems = (items: ItemInput[]): ItemInput[] =>
  R.filter(items, (it) => !isEmptyRow(it))

const validateItem = (it: ItemInput): ItemFieldError | undefined => {
  if (isEmptyRow(it)) return undefined
  const name =
    it.name.trim() === ''
      ? 'Doplň název položky'
      : it.name.trim().length > MAX_ITEM_NAME
        ? `Název položky je moc dlouhý (max ${MAX_ITEM_NAME} znaků)`
        : undefined
  const price =
    it.priceHaler < 0
      ? 'Cena nemůže být záporná'
      : it.priceHaler > MAX_PRICE_HALER
        ? 'Cena je moc vysoká'
        : undefined
  if (!name && !price) return undefined
  return { name, price }
}

export const validateBoardForm = (state: BoardFormState): BoardValidation => {
  const title =
    state.title.trim() === ''
      ? 'Zadej název akce'
      : state.title.trim().length > MAX_TITLE
        ? `Název je moc dlouhý (max ${MAX_TITLE} znaků)`
        : undefined
  const items = R.map(state.items, validateItem)
  const valid = !title && items.every((e) => e === undefined)
  return { errors: { title, items }, valid }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/domain/boardForm.test.ts`
Expected: PASS — all `cleanItems` and `validateBoardForm` tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/boardForm.ts src/domain/boardForm.test.ts
git commit -m "feat(boards): pure board-form validation helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: State helpers (`isBoardDirty`, `saveButton`)

**Files:**
- Modify: `src/domain/boardForm.ts`
- Test: `src/domain/boardForm.test.ts`

**Interfaces:**
- Consumes: `BoardFormState`, `cleanItems` (from Task 1); `ItemInput` from `src/domain/types.ts`.
- Produces:
  - `isBoardDirty(current: BoardFormState, snapshot: BoardFormState): boolean`
  - `type SaveMode = 'create' | 'edit'`
  - `interface SaveButton { label: string; disabled: boolean; loading: boolean; muted: boolean }`
  - `saveButton(input: { mode: SaveMode; dirty: boolean; valid: boolean; submitting: boolean }): SaveButton`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/boardForm.test.ts`. Add `isBoardDirty, saveButton` to the existing import from `./boardForm`, and add `THEME_KEYS` to the existing import from `@/design/themes` (so the first import line becomes `import { DEFAULT_THEME, THEME_KEYS } from '@/design/themes'`):

```ts
describe('isBoardDirty', () => {
  const snap = { title: 'A', items: [{ name: 'Pivo', priceHaler: 5000 }], theme: DEFAULT_THEME }
  test('beze změn není dirty', () => {
    expect(isBoardDirty(snap, snap)).toBe(false)
  })
  test('změna názvu je dirty', () => {
    expect(isBoardDirty({ ...snap, title: 'B' }, snap)).toBe(true)
  })
  test('přidaný prázdný řádek se nepočítá jako změna', () => {
    expect(
      isBoardDirty({ ...snap, items: [...snap.items, { name: '', priceHaler: 0 }] }, snap),
    ).toBe(false)
  })
  test('změna ceny položky je dirty', () => {
    expect(isBoardDirty({ ...snap, items: [{ name: 'Pivo', priceHaler: 6000 }] }, snap)).toBe(true)
  })
  test('změna tématu je dirty', () => {
    const other = THEME_KEYS.find((k) => k !== DEFAULT_THEME)!
    expect(isBoardDirty({ ...snap, theme: other }, snap)).toBe(true)
  })
})

describe('saveButton', () => {
  test('create validní', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: true, submitting: false })).toEqual({
      label: 'Vytvořit board', disabled: false, loading: false, muted: false,
    })
  })
  test('create nevalidní je muted ale klikatelné', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: false, submitting: false })).toEqual({
      label: 'Vytvořit board', disabled: false, loading: false, muted: true,
    })
  })
  test('create při odesílání', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: true, submitting: true })).toEqual({
      label: 'Vytvářím…', disabled: true, loading: true, muted: false,
    })
  })
  test('edit beze změn je disabled Uloženo', () => {
    expect(saveButton({ mode: 'edit', dirty: false, valid: true, submitting: false })).toEqual({
      label: 'Uloženo ✓', disabled: true, loading: false, muted: false,
    })
  })
  test('edit se změnami', () => {
    expect(saveButton({ mode: 'edit', dirty: true, valid: true, submitting: false })).toEqual({
      label: 'Uložit změny', disabled: false, loading: false, muted: false,
    })
  })
  test('edit při ukládání', () => {
    expect(saveButton({ mode: 'edit', dirty: true, valid: true, submitting: true })).toEqual({
      label: 'Ukládám…', disabled: true, loading: true, muted: false,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/domain/boardForm.test.ts`
Expected: FAIL — `isBoardDirty`/`saveButton` are not exported.

- [ ] **Step 3: Implement the state helpers**

Append to `src/domain/boardForm.ts`:

```ts
const itemsEqual = (a: ItemInput[], b: ItemInput[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((it, i) => {
    const other = b[i]
    return other !== undefined && it.name === other.name && it.priceHaler === other.priceHaler
  })
}

/** Dirty = persisted content differs; empty rows are ignored. */
export const isBoardDirty = (current: BoardFormState, snapshot: BoardFormState): boolean =>
  current.title !== snapshot.title ||
  current.theme !== snapshot.theme ||
  !itemsEqual(cleanItems(current.items), cleanItems(snapshot.items))

export type SaveMode = 'create' | 'edit'

export interface SaveButton {
  label: string
  disabled: boolean
  loading: boolean
  muted: boolean
}

export const saveButton = (input: {
  mode: SaveMode
  dirty: boolean
  valid: boolean
  submitting: boolean
}): SaveButton => {
  if (input.submitting) {
    return {
      label: input.mode === 'create' ? 'Vytvářím…' : 'Ukládám…',
      disabled: true,
      loading: true,
      muted: false,
    }
  }
  if (input.mode === 'create') {
    return { label: 'Vytvořit board', disabled: false, loading: false, muted: !input.valid }
  }
  if (!input.dirty) {
    return { label: 'Uloženo ✓', disabled: true, loading: false, muted: false }
  }
  return { label: 'Uložit změny', disabled: false, loading: false, muted: !input.valid }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/domain/boardForm.test.ts`
Expected: PASS — all suites (`cleanItems`, `validateBoardForm`, `isBoardDirty`, `saveButton`) green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/boardForm.ts src/domain/boardForm.test.ts
git commit -m "feat(boards): dirty detection + save-button state derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `BoardEditor` to the helpers + CSS

**Files:**
- Modify: `src/app/(host)/boards/BoardEditor.tsx`
- Modify: `src/app/(host)/boards/BoardEditor.module.css`

**Interfaces:**
- Consumes: `BoardFormState`, `cleanItems`, `validateBoardForm`, `isBoardDirty`, `saveButton` (Tasks 1–2); `createBoardAction`, `updateBoardAction` from `../actions` (unchanged signatures: `createBoardAction(input) => { token } | { error }`, `updateBoardAction(token, input) => { error? }`).
- Produces: no new exports — UI behavior only.

> No unit test: the project's Vitest env is `node` and there is no DOM testing library, so this React shell is verified by typecheck + manual browser checks (Step 4). All testable logic already lives in the unit-tested helpers.

- [ ] **Step 1: Add the CSS classes**

Append to `src/app/(host)/boards/BoardEditor.module.css`:

```css
.fieldError {
  color: #c0392b;
  font-size: 12px;
  margin: 4px 2px 0;
}

.inputError {
  border-color: #c0392b;
}

/* Invalid save button: visually muted but still clickable (guides to errors). */
.saveMuted {
  opacity: 0.5;
}
```

- [ ] **Step 2: Replace `BoardEditor.tsx` with the state-aware version**

Overwrite `src/app/(host)/boards/BoardEditor.tsx` with:

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, THEMES, type ThemeKey } from '@/design/themes'
import {
  cleanItems, isBoardDirty, saveButton, validateBoardForm, type BoardFormState,
} from '@/domain/boardForm'
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
  const [snapshot, setSnapshot] = useState<BoardFormState>({
    title: initialTitle, items: initialItems, theme: initialTheme,
  })
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [serverError, setServerError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const current: BoardFormState = { title, items, theme }
  const { errors, valid } = validateBoardForm(current)
  const dirty = isBoardDirty(current, snapshot)
  const mode = token ? 'edit' : 'create'
  const btn = saveButton({ mode, dirty, valid, submitting })

  // A field's error is shown once it's been touched (onBlur) or after a failed save click.
  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key))
  const shows = (key: string) => showErrors || touched.has(key)

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { name: '', priceHaler: 0 }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setServerError('')
    if (!valid) {
      setShowErrors(true)
      requestAnimationFrame(() => {
        const el = wrapRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus()
      })
      return
    }
    setSubmitting(true)
    const clean = cleanItems(items)
    if (token) {
      const res = await updateBoardAction(token, { title, items: clean, theme })
      setSubmitting(false)
      if (res.error) return setServerError('Nepodařilo se uložit, zkus to znovu')
      // No router.refresh(): reset the snapshot so the form is "clean" again.
      setSnapshot({ title, items, theme })
      setShowErrors(false)
      setTouched(new Set())
      return
    }
    const res = await createBoardAction({ title, items: clean, theme })
    if ('error' in res) {
      setSubmitting(false)
      return setServerError('Nepodařilo se uložit, zkus to znovu')
    }
    router.push(`/boards/${res.token}`)
  }

  const titleErr = shows('title') ? errors.title : undefined

  return (
    <div ref={wrapRef} data-theme={theme} className={s.wrap}>
      <span className={ui.label}>Název akce</span>
      <input
        className={`${ui.field} ${titleErr ? s.inputError : ''}`}
        value={title} placeholder="Grilovačka u Tomáše"
        aria-invalid={!!titleErr}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => touch('title')}
      />
      {titleErr && <p className={s.fieldError}>{titleErr}</p>}

      <span className={ui.label}>Ceník</span>
      {items.map((it, i) => {
        const nameErr = shows(`item:${i}:name`) ? errors.items[i]?.name : undefined
        const priceErr = shows(`item:${i}:price`) ? errors.items[i]?.price : undefined
        return (
          <div key={i} className={s.itemRow}>
            <div className={s.itemName}>
              <input
                className={`${ui.field} ${nameErr ? s.inputError : ''}`} value={it.name} placeholder="Pivo 🍺"
                aria-invalid={!!nameErr}
                onChange={(e) => setItem(i, { name: e.target.value })}
                onBlur={() => touch(`item:${i}:name`)}
              />
              {nameErr && <p className={s.fieldError}>{nameErr}</p>}
            </div>
            <div className={s.itemPrice}>
              <input
                className={`${ui.field} ${priceErr ? s.inputError : ''}`} type="number" inputMode="decimal" placeholder="Kč"
                value={it.priceHaler === 0 ? '' : it.priceHaler / 100}
                aria-invalid={!!priceErr}
                onChange={(e) => setItem(i, { priceHaler: Math.round(Number(e.target.value) * 100) })}
                onBlur={() => touch(`item:${i}:price`)}
              />
              {priceErr && <p className={s.fieldError}>{priceErr}</p>}
            </div>
            <button type="button" className={s.del} aria-label="Smazat položku" onClick={() => removeItem(i)}>×</button>
          </div>
        )
      })}
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
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.key) } }}
          >
            <div className={s.themePrev} />
            <div className={s.themeName}>{t.label}{theme === t.key ? ' ✓' : ''}</div>
          </div>
        ))}
      </div>
      <p className={s.hint}>Nový board převezme tvůj poslední styl. 🔓 Další motivy přibydou v Premiu.</p>

      {serverError && <p className={s.error}>{serverError}</p>}
      <button
        type="button"
        className={`${ui.btn} ${ui.btnPrimary} ${s.save} ${btn.muted ? s.saveMuted : ''}`}
        disabled={btn.disabled}
        onClick={save}
      >
        {btn.label}
      </button>
    </div>
  )
}
```

Note: the item name/price `<input>`s are now wrapped in `<div className={s.itemName}>` / `<div className={s.itemPrice}>` so each error `<p>` sits directly under its field. The width classes move from the inputs to these wrappers; `ui.field` keeps the inputs at `width: 100%`.

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: PASS — `boardForm.test.ts` suites green; no other tests broken.

- [ ] **Step 4: Manual verification in the browser**

Start the dev server (`npm run dev`) and verify with agent-browser (or manually):

1. **New board** (`/boards/new`): button reads **"Vytvořit board"**. With an empty title, clicking it does not navigate — the title shows **"Zadej název akce"** and the field gets focus/scroll. Fill a title → board is created and you're redirected to `/boards/{token}`.
2. **Existing board** (`/boards/{token}`): on load the button reads **"Uloženo ✓"** and is disabled. Edit the title → button becomes active **"Uložit změny"**. Click → briefly **"Ukládám…"**, then back to **"Uloženo ✓"** with no page flash/reload.
3. **Per-field error**: add an item, type a price but leave the name empty, click save → name field shows **"Doplň název položky"** and gets focus; nothing is saved.
4. **Empty row ignored**: add an empty item row (no name, no price) → button stays **"Uloženo ✓"** (not dirty); saving with it present does not error and the row is not persisted.
5. **Theme**: clicking a theme tile marks the board dirty (button → "Uložit změny").

- [ ] **Step 5: Commit**

```bash
git add "src/app/(host)/boards/BoardEditor.tsx" "src/app/(host)/boards/BoardEditor.module.css"
git commit -m "feat(boards): state-aware save button + inline per-field validation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Save button state machine (create/edit, dirty, valid, submitting) → Task 2 `saveButton` + Task 3 wiring. ✓
- Variant B (invalid button clickable, scrolls/focuses first invalid) → Task 3 `save()` + `aria-invalid` querySelector. ✓
- Dirty detection (title/theme/items, theme click counts, empty rows ignored) → Task 2 `isBoardDirty`. ✓
- Per-field validation mirroring `boardSchema` → Task 1 `validateBoardForm`. ✓
- Empty / price-without-name row rules → Task 1 (`isEmptyRow`, `validateItem`) + tests. ✓
- No `router.refresh()`; snapshot reset on update success → Task 3 `save()`. ✓
- General server/network error message near the button → Task 3 `serverError`. ✓
- Server `boardSchema.safeParse` left as guard → actions unchanged. ✓

**Placeholder scan:** No TBD/TODO; every code/test step shows complete code. ✓

**Type consistency:** `BoardFormState`, `ItemFieldError`, `BoardFormErrors`, `BoardValidation`, `SaveButton`, `SaveMode` defined in Tasks 1–2 and consumed with matching names/shapes in Task 3. `saveButton` input `{ mode, dirty, valid, submitting }` matches the call site. Action signatures match `actions.ts`. ✓
