/** Peníze v celých haléřích. Nikdy float. */
export type Haler = number

export interface ItemInput {
  name: string
  priceHaler: Haler
}

export interface SelectionEntry {
  itemId: string
  name: string
  priceHaler: Haler
  quantity: number
}

export interface Selection {
  entries: SelectionEntry[]
  tipHaler: Haler
}
