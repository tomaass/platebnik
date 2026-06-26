import { requireUser } from '@/auth/config'
import { getLatestBoardTheme } from '@/db/boards'
import BoardEditor from '../BoardEditor'

export default async function NewBoard() {
  const user = await requireUser()
  const initialTheme = await getLatestBoardTheme(user.id)
  return (
    <main>
      <h1>Nová akce</h1>
      <BoardEditor initialTheme={initialTheme} />
    </main>
  )
}
