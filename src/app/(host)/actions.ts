'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/auth/config'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import {
  createBoard, deleteBoard, updateBoard,
} from '@/db/boards'
import { setPaid } from '@/db/contributions'
import { czAccountToIban } from '@/domain/iban'
import { accountSchema, boardSchema } from '@/domain/validation'
import type { ItemInput } from '@/domain/types'
import type { ThemeKey } from '@/design/themes'

export const saveAccountAction = async (
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> => {
  const user = await requireUser()
  const parsed = accountSchema.safeParse({ account: formData.get('account') })
  if (!parsed.success) return { error: 'Neplatné číslo účtu' }
  const iban = czAccountToIban(parsed.data.account)
  if (!iban) return { error: 'Neplatné číslo účtu' }
  await db.update(users)
    .set({ bankAccountRaw: parsed.data.account, bankAccountIban: iban })
    .where(eq(users.id, user.id))
  revalidatePath('/profile')
  return {}
}

export const createBoardAction = async (
  input: { title: string; items: ItemInput[]; theme: ThemeKey },
): Promise<{ token: string } | { error: string }> => {
  const user = await requireUser()
  const parsed = boardSchema.safeParse(input)
  if (!parsed.success) return { error: 'Neplatná data boardu' }
  const token = await createBoard({ userId: user.id, ...parsed.data })
  revalidatePath('/boards')
  return { token }
}

export const updateBoardAction = async (
  token: string,
  input: { title: string; items: ItemInput[]; theme: ThemeKey },
): Promise<{ error?: string }> => {
  const user = await requireUser()
  const parsed = boardSchema.safeParse(input)
  if (!parsed.success) return { error: 'Neplatná data boardu' }
  await updateBoard(token, user.id, parsed.data)
  revalidatePath(`/boards/${token}`)
  return {}
}

export const deleteBoardAction = async (token: string): Promise<void> => {
  const user = await requireUser()
  await deleteBoard(token, user.id)
  revalidatePath('/boards')
}

export const setPaidAction = async (id: string, paid: boolean): Promise<void> => {
  const user = await requireUser()
  await setPaid(id, user.id, paid)
}
