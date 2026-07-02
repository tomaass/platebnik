'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/auth/config'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import {
  archiveBoard, createBoard, deleteBoard, getBoardByToken, unarchiveBoard, updateBoard,
} from '@/db/boards'
import { setPaid } from '@/db/contributions'
import { czAccountToIban } from '@/domain/iban'
import { track } from '@/lib/analytics'
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
  await track('board_created', user.id, {
    board_token: token,
    item_count: parsed.data.items.length,
    theme: parsed.data.theme,
  })
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

export const archiveBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  await archiveBoard(token, user.id)
  await track('board_archived', user.id, { board_token: token })
  revalidatePath('/boards')
  revalidatePath(`/boards/${token}`)
  return {}
}

export const unarchiveBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  await unarchiveBoard(token, user.id)
  revalidatePath('/boards')
  revalidatePath(`/boards/${token}`)
  return {}
}

export const deleteBoardAction = async (token: string): Promise<{ error?: string }> => {
  const user = await requireUser()
  // Deletion is only allowed after archiving (flow: archive -> delete).
  const board = await getBoardByToken(token)
  if (!board || board.userId !== user.id) return { error: 'Akce nenalezena' }
  if (!board.archivedAt) return { error: 'Akci lze smazat až po archivaci.' }
  await deleteBoard(token, user.id)
  await track('board_deleted', user.id, { board_token: token })
  revalidatePath('/boards')
  return {}
}

export const setPaidAction = async (id: string, paid: boolean): Promise<void> => {
  const user = await requireUser()
  await setPaid(id, user.id, paid)
  if (paid) {
    await track('board_paid', user.id, { contribution_id: id })
  }
}
