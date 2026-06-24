import * as R from 'remeda'
import type { Haler, Selection, SelectionEntry } from './types'

export const itemsSubtotal = (entries: SelectionEntry[]): Haler =>
  R.sumBy(entries, (e) => e.priceHaler * e.quantity)

export const tipFromPercent = (subtotalHaler: Haler, percent: number): Haler =>
  Math.round((subtotalHaler * percent) / 100)

export const selectionTotal = (selection: Selection): Haler =>
  itemsSubtotal(selection.entries) + selection.tipHaler
