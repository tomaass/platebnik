'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { archiveBoardAction, deleteBoardAction, unarchiveBoardAction } from '../actions'
import s from '../host.module.css'

interface Props {
  token: string
  title: string
  archived: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
}

export default function BoardCard({ token, title, archived, open, onToggle, onClose }: Props) {
  const router = useRouter()

  // Close the menu as the action starts; the list re-renders on success.
  const act = async (fn: () => Promise<{ error?: string }>) => {
    onClose()
    const res = await fn()
    if (res?.error) {
      window.alert(res.error)
      return
    }
    router.refresh()
  }
  const remove = () => {
    if (!window.confirm(`Opravdu smazat akci „${title}"? Nevratně zmizí i všechny příspěvky.`)) return
    act(() => deleteBoardAction(token))
  }

  return (
    <div className={`${s.boardCard} ${archived ? s.boardCardArchived : ''}`}>
      <Link href={`/boards/${token}`} className={s.boardCardLink}>{title}</Link>
      <div className={s.cardMenu}>
        <button
          type="button" className={s.cardMenuBtn}
          aria-label="Možnosti akce" aria-haspopup="menu" aria-expanded={open}
          onClick={onToggle}
        >
          ⋯
        </button>
        {open && (
          <div className={s.cardMenuList} role="menu">
            {archived ? (
              <>
                <button type="button" role="menuitem" onClick={() => act(() => unarchiveBoardAction(token))}>
                  Odarchivovat
                </button>
                <button type="button" role="menuitem" onClick={remove}>Smazat</button>
              </>
            ) : (
              <button type="button" role="menuitem" onClick={() => act(() => archiveBoardAction(token))}>
                Archivovat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
