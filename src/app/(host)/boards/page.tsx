import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { listBoardsByUser } from '@/db/boards'

export default async function Boards() {
  const user = await requireUser()
  const boards = await listBoardsByUser(user.id)
  return (
    <main>
      <h1>Moje akce</h1>
      <Link href="/boards/new">+ Nová akce</Link>
      <ul>
        {boards.map((b) => (
          <li key={b.token}>
            <Link href={`/boards/${b.token}`}>{b.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
