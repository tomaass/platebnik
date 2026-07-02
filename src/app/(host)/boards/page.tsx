import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { listBoardsByUser } from '@/db/boards'
import ui from '@/design/ui.module.css'
import BoardList from './BoardList'
import s from '../host.module.css'

export default async function Boards() {
  const user = await requireUser()
  const boards = await listBoardsByUser(user.id)
  return (
    <main>
      <h1>Moje akce</h1>
      <Link href="/boards/new" className={`${ui.btn} ${ui.btnPrimary} ${s.newBtn}`}>+ Nová akce</Link>
      {boards.length === 0 ? (
        <p className={s.empty}>Zatím žádná akce. Vytvoř první a nasdílej partě. 🍺</p>
      ) : (
        <BoardList boards={boards} />
      )}
    </main>
  )
}
