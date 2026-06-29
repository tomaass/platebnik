# Board editor: smart save button + per-field validation

**Date:** 2026-06-29
**Status:** Approved (design)
**Area:** `src/app/(host)/boards/BoardEditor.tsx`, `src/app/(host)/actions.ts`, `src/domain/validation.ts`

## Problem

The board editor (`BoardEditor.tsx`) has a single "Uložit" button and one global
validation message (`'Neplatná data boardu'`). For the target audience —
non-technical users, sometimes mildly intoxicated — this is too opaque:

- The button gives no signal about whether there is anything to save, whether a
  save is in flight, or whether the data is valid.
- A single global error doesn't tell the user *which* field to fix.
- After every update the component calls `router.refresh()`, which causes a
  full route refetch and visible flicker.

Autosave-on-blur was considered and **rejected** — too much implementation
complexity (debounce, race handling, the `delete-all + reinsert` item write
amplified per blur) for the value. Instead we keep an explicit save button but
make it communicate its state clearly, and add inline per-field validation.

## Goals

- One obvious, always-present control whose appearance tells the user the
  current state (saved / unsaved / saving / can't-save-yet).
- The user always knows *what* to fix when data is invalid (per-field errors).
- No full-page refresh after saving an existing board.
- Dead-simple UX; no new concepts for the user to learn.

## Non-goals

- Autosave / debounced saving.
- Granular per-field server writes (the existing whole-board `updateBoard`
  stays; it is safe because contributions store a `selectionSnapshot` JSON, not
  an FK to item ids).
- Tabs or restructuring the editor layout.

## Save button state machine

The button derives its label/appearance from three inputs: **mode**
(create vs edit), **dirty** (does current state differ from the last-saved
snapshot), and **valid** (does the client-side mirror of `boardSchema` pass),
plus a transient **submitting** flag.

### Create mode (`!token`)

| Condition | Button |
| --- | --- |
| valid | active — **"Vytvořit board"** |
| invalid | muted, still clickable — clicking reveals errors & scrolls to the first (variant B) |
| submitting | loading — **"Vytvářím…"**, disabled |

On success: `router.push('/boards/{token}')` (unchanged).

### Edit mode (`token` present)

| Condition | Button |
| --- | --- |
| not dirty | disabled, calm — **"Uloženo ✓"** |
| dirty + valid | active — **"Uložit změny"** |
| dirty + invalid | muted, still clickable — clicking reveals errors & scrolls to the first |
| submitting | loading — **"Ukládám…"**, disabled |

The calm **"Uloženo ✓"** resting state doubles as the "your data is saved"
reassurance — without autosave.

On success: **no `router.refresh()`**. Instead reset the saved snapshot to the
current state so the form becomes "not dirty" again and the button returns to
**"Uloženo ✓"**. Nothing flickers.

## Variant B — invalid handling

When the data is invalid, the button is visually muted but **remains
clickable**. Clicking it does *not* save; instead it:

1. Reveals all field errors.
2. Scrolls to / focuses the first invalid field.

Rationale: a fully disabled button that does nothing on tap confuses the target
audience. Actively guiding them to the problem is kinder.

## Dirty detection

Compare the current `{ title, items, theme }` against an initial snapshot taken
on mount (and reset after each successful save). A theme click also marks the
form dirty. A structural/value compare of the items array (name + priceHaler,
in order) is sufficient; theme and title are scalar compares.

## Per-field validation

Client-side mirror of the existing `boardSchema` rules
(`src/domain/validation.ts`), surfaced per field:

- **title** — required, max `MAX_TITLE` (80). Error sits under the title input.
- **item name** — max `MAX_ITEM_NAME` (60). Error sits under that item's name input.
- **item price** — integer haléře, 0 … `MAX_PRICE_HALER` (100 000,00). Error
  sits under that item's price input.

**Trigger:** a field's error shows on its `onBlur`; clicking the save button
while invalid reveals *all* errors at once and applies variant B (scroll to
first).

### Empty / half-filled item rows

- **Fully empty row** (no name, no price) → silently dropped before save, no
  error (preserves today's behavior).
- **Price filled but name empty** → field error **"Doplň název položky"**
  (otherwise a drunk user's entered price would silently vanish).

### Server side

The server actions keep `boardSchema.safeParse` as the last-resort guard.
Because the client now blocks invalid submits (variant B), a server validation
failure is an edge case. The server's generic error string, plus any
network/transport failure, surfaces as **one general message near the button**
("Nepodařilo se uložit, zkus to znovu") — distinct from the inline per-field
errors, which are purely client-side.

## Components / data flow

All changes are local to `BoardEditor.tsx` plus a small validation helper:

- A pure `validateBoard(state)` helper (in or beside `validation.ts`) returning
  a structured `{ title?: string; items: (string | undefined)[] }`-shaped error
  map derived from the zod schema, reusable by the component.
- `BoardEditor` gains: `savedSnapshot` (for dirty), derived `dirty`/`valid`,
  `submitting` state, `showErrors` flag (flips true on a failed save click),
  and per-field error rendering.
- Server actions: behavior unchanged; only the client's handling of the
  returned `error` changes (general message, no `router.refresh()` on update).

## Error handling

- Client validation failure → inline per-field messages, no network call.
- Server/transport failure → general message near the button; button returns to
  its actionable state so the user can retry.

## Testing

- Dirty detection: editing then reverting a field returns the button to
  "Uloženo ✓"; theme click marks dirty.
- Validation: empty title blocks save and shows the title error; over-long
  name/price show their field errors; price-without-name shows "Doplň název
  položky"; fully empty row is dropped silently.
- Variant B: clicking the muted button focuses/scrolls to the first invalid
  field and reveals all errors.
- Save flow: create redirects; update shows "Ukládám…" then "Uloženo ✓" with no
  route refresh; server error shows the general message and keeps the button
  actionable.
