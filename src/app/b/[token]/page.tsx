import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { getBoardByToken, getBoardMeta } from '@/db/boards'
import { SITE_NAME } from '@/lib/site'
import BoardClient from './BoardClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const board = await getBoardMeta(token)
  if (!board) return { title: 'Akce nenalezena' }

  const title = board.title
  const description = `Zaplať za sebe na „${board.title}" — naťukej, co sis dal, a zaplať přímo hostiteli přes QR Platbu. Žádná registrace.`

  return {
    title,
    description,
    // Private per-event links don't belong in search engines, but we still
    // want a nice preview when shared (iMessage, social networks).
    robots: { index: false, follow: false },
    alternates: { canonical: `/b/${token}` },
    openGraph: {
      type: 'website',
      locale: 'cs_CZ',
      siteName: SITE_NAME,
      url: `/b/${token}`,
      title: `${title} · ${SITE_NAME}`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  }
}

export default async function PublicBoard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const board = await getBoardByToken(token)
  if (!board) notFound()
  if (board.archivedAt) {
    return (
      <main
        data-theme={board.theme}
        style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}
      >
        <h1>{board.title}</h1>
        <p>Tato akce už skončila. Díky všem! 🎉</p>
      </main>
    )
  }
  const host = await db.query.users.findFirst({ where: eq(users.id, board.userId) })
  if (!host?.bankAccountIban) {
    return (
      <main data-theme={board.theme} style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
        <p>Hostitel ještě nenastavil platební údaje. Zkus to za chvíli. 🙂</p>
      </main>
    )
  }
  return (
    <BoardClient
      token={board.token}
      title={board.title}
      iban={host.bankAccountIban}
      variableSymbol={board.variableSymbol}
      items={board.items.map((it) => ({ id: it.id, name: it.name, priceHaler: it.priceHaler }))}
      tipPercents={board.tipPercents}
      theme={board.theme}
    />
  )
}
