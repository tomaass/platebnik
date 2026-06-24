import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getBoardByToken } from '@/db/boards'
import BoardClient from './BoardClient'

export default async function PublicBoard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const board = await getBoardByToken(token)
  if (!board) notFound()
  const host = await db.query.users.findFirst({ where: eq(users.id, board.userId) })
  if (!host?.bankAccountIban) {
    return <main style={{ padding: '1rem' }}><p>Hostitel ještě nenastavil platební údaje.</p></main>
  }
  return (
    <BoardClient
      token={board.token}
      title={board.title}
      iban={host.bankAccountIban}
      variableSymbol={board.variableSymbol}
      items={board.items.map((it) => ({ id: it.id, name: it.name, priceHaler: it.priceHaler }))}
      tipPercents={board.tipPercents}
    />
  )
}
