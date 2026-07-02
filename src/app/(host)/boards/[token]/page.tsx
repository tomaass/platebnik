import { notFound } from 'next/navigation'
import { requireUser } from '@/auth/config'
import { getBoardByToken } from '@/db/boards'
import { listContributionsByBoard } from '@/db/contributions'
import BoardWorkspace from '../BoardWorkspace'
import BoardDangerZone from '../BoardDangerZone'
import ContributionsList from '../ContributionsList'
import s from '../../host.module.css'

export default async function BoardDetail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await requireUser()
  const board = await getBoardByToken(token)
  if (!board || board.userId !== user.id) notFound()
  const contributions = await listContributionsByBoard(token, user.id)
  return (
    <main>
      <h1>{board.title}</h1>
      {board.archivedAt && <p className={s.archivedNote}>Tato akce je archivovaná.</p>}
      <BoardWorkspace
        // Remount per board so the live theme state can't carry over from a
        // previous board on a client-side board→board navigation.
        key={token}
        token={token}
        initialTitle={board.title}
        initialItems={board.items.map((it) => ({ name: it.name, priceHaler: it.priceHaler }))}
        initialTheme={board.theme}
      />
      <h2>Kdo se podepsal</h2>
      <ContributionsList rows={contributions} />
      <BoardDangerZone token={token} title={board.title} archived={!!board.archivedAt} />
    </main>
  )
}
