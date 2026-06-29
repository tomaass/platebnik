import * as R from 'remeda'
import type { ItemInput } from './types'
import type { ThemeKey } from '@/design/themes'
import {
  MAX_ITEM_NAME, MAX_ITEMS, MAX_PRICE_HALER, MAX_TITLE,
} from './validation'

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
  // Board-level error not tied to a single field (e.g. too many items).
  form?: string
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
  // Mirror the server boardSchema's .max(MAX_ITEMS); only persisted rows count.
  const form = cleanItems(state.items).length > MAX_ITEMS
    ? `Maximálně ${MAX_ITEMS} položek`
    : undefined
  const valid = !title && !form && items.every((e) => e === undefined)
  return { errors: { title, form, items }, valid }
}

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

// --- Price text <-> haléře -------------------------------------------------
// The editor works with the raw string the user typed so in-progress decimals
// aren't clobbered, and so a Czech comma separator is accepted on mobile.

/**
 * Parse a price the user typed into integer haléře.
 * Empty string → 0. Unparseable non-empty text → null (a format error).
 * Accepts both "," and "." as the decimal separator and ignores whitespace.
 */
export const parsePrice = (text: string): number | null => {
  const normalized = text.replace(/\s/g, '').replace(/,/g, '.')
  if (normalized === '') return 0
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/** Render haléře for a price input. 0 → "" (placeholder shows instead). */
export const formatPrice = (priceHaler: number): string =>
  priceHaler === 0 ? '' : String(priceHaler / 100).replace('.', ',')

export type SaveMode = 'create' | 'edit'

export interface SaveButton {
  label: string
  disabled: boolean
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
      muted: false,
    }
  }
  if (input.mode === 'create') {
    return { label: 'Vytvořit board', disabled: false, muted: !input.valid }
  }
  if (!input.dirty) {
    return { label: 'Uloženo ✓', disabled: true, muted: false }
  }
  return { label: 'Uložit změny', disabled: false, muted: !input.valid }
}
