import { z } from 'zod'
import { isValidCzAccount } from './iban'
import { DEFAULT_THEME, THEME_KEYS } from '@/design/themes'
import {
  MAX_CONTRIBUTION_HALER, MAX_ITEM_NAME, MAX_ITEMS, MAX_MESSAGE, MAX_NAME,
  MAX_PRICE_HALER, MAX_TITLE,
} from './limits'

// Re-export so existing importers keep a single entry point.
export * from './limits'

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
  theme: z.enum(THEME_KEYS).default(DEFAULT_THEME),
})

export const signatureSchema = z.object({
  name: z.string().trim().max(MAX_NAME).optional(),
  message: z.string().trim().max(MAX_MESSAGE).optional(),
})

export const contributionSchema = z.object({
  name: z.string().trim().max(MAX_NAME).optional(),
  message: z.string().trim().max(MAX_MESSAGE).optional(),
  amountHaler: z.number().int().min(0).max(MAX_CONTRIBUTION_HALER),
  tipHaler: z.number().int().min(0).max(MAX_CONTRIBUTION_HALER),
  selectionSnapshot: z
    .array(
      z.object({
        name: z.string().max(MAX_ITEM_NAME),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(MAX_ITEMS),
})
