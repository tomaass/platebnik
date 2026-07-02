import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { listBoardsByUser } from '@/db/boards'
import ui from '@/design/ui.module.css'
import BoardCard from './BoardCard'
import s from '../host.module.css'

export default async function Boards() {
  const user = await requireUser()
  const boards = await listBoardsByUser(user.id)
  const active = boards.filter((b) => !b.archivedAt)
  const archived = boards.filter((b) => b.archivedAt)
  return (
    <main>
      <h1>Moje akce</h1>
      <Link href="/boards/new" className={`${ui.btn} ${ui.btnPrimary} ${s.newBtn}`}>+ Nová akce</Link>
      {boards.length === 0 ? (
        <p className={s.empty}>Zatím žádná akce. Vytvoř první a nasdílej partě. 🍺</p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className={s.empty}>Žádná aktivní akce.</p>
          ) : (
            <ul className={s.list}>
              {active.map((b) => (
                <li key={b.token}><BoardCard token={b.token} title={b.title} archived={false} /></li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <>
              <h2 className={s.archivedHeading}>Archivované</h2>
              <ul className={s.list}>
                {archived.map((b) => (
                  <li key={b.token}><BoardCard token={b.token} title={b.title} archived /></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  )
}
