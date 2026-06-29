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
