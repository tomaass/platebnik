// Input size limits shared by server-side validation (validation.ts) and
// client-side form constraints. Kept zod-free so client components can import
// them without pulling zod into the bundle.
export const MAX_TITLE = 80
export const MAX_ITEM_NAME = 60
export const MAX_ITEMS = 100
export const MAX_PRICE_HALER = 100_000_00 // 100 000 Kč
export const MAX_NAME = 40
export const MAX_MESSAGE = 280
export const MAX_CONTRIBUTION_HALER = 100_000_00 // 100 000 Kč
