import { notFound } from 'next/navigation'
import { requireUser } from '@/auth/config'
import { getBoardByToken } from '@/db/boards'
import { listContributionsByBoard } from '@/db/contributions'
import BoardEditor from '../BoardEditor'
import BoardDangerZone from '../BoardDangerZone'
import SharePanel from '../SharePanel'
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
      <BoardEditor
        token={token}
        initialTitle={board.title}
        initialItems={board.items.map((it) => ({ name: it.name, priceHaler: it.priceHaler }))}
        initialTheme={board.theme}
      />
      <SharePanel token={token} />
      <h2>Kdo se podepsal</h2>
      <ContributionsList rows={contributions} />
      <BoardDangerZone token={token} title={board.title} archived={!!board.archivedAt} />
    </main>
  )
}
