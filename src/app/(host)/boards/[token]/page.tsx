import { notFound } from 'next/navigation'
import { requireUser } from '@/auth/config'
import { getBoardByToken } from '@/db/boards'
import { listContributionsByBoard } from '@/db/contributions'
import BoardWorkspace from '../BoardWorkspace'
import ContributionsList from '../ContributionsList'

export default async function BoardDetail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await requireUser()
  const board = await getBoardByToken(token)
  if (!board || board.userId !== user.id) notFound()
  const contributions = await listContributionsByBoard(token, user.id)
  return (
    <main>
      <h1>{board.title}</h1>
      <BoardWorkspace
        token={token}
        initialTitle={board.title}
        initialItems={board.items.map((it) => ({ name: it.name, priceHaler: it.priceHaler }))}
        initialTheme={board.theme}
      />
      <h2>Kdo se podepsal</h2>
      <ContributionsList rows={contributions} />
    </main>
  )
}
