import { z } from 'zod'
import { isValidCzAccount } from './iban'

export const MAX_TITLE = 80
export const MAX_ITEM_NAME = 60
export const MAX_ITEMS = 100
export const MAX_PRICE_HALER = 100_000_00 // 100 000 Kč
export const MAX_NAME = 40
export const MAX_MESSAGE = 280

export const accountSchema = z.object({
  account: z.string().trim().refine(isValidCzAccount, 'Neplatné číslo účtu'),
})

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
})

export const signatureSchema = z.object({
  name: z.string().trim().max(MAX_NAME).optional(),
  message: z.string().trim().max(MAX_MESSAGE).optional(),
})
