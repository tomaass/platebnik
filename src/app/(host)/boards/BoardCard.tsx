'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archiveBoardAction, deleteBoardAction, unarchiveBoardAction } from '../actions'
import s from '../host.module.css'

interface Props {
  token: string
  title: string
  archived: boolean
}

export default function BoardCard({ token, title, archived }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const act = (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const res = await fn()
      if (res?.error) {
        window.alert(res.error)
        return
      }
      router.refresh()
    })
  }
  const remove = () => {
    if (!window.confirm(`Opravdu smazat akci „${title}"? Nevratně zmizí i všechny příspěvky.`)) return
    act(() => deleteBoardAction(token))
  }

  return (
    <div className={`${s.boardCard} ${archived ? s.boardCardArchived : ''}`}>
      <Link href={`/boards/${token}`} className={s.boardCardLink}>{title}</Link>
      <details className={s.cardMenu}>
        <summary className={s.cardMenuBtn} aria-label="Možnosti akce">⋯</summary>
        <div className={s.cardMenuList}>
          {archived ? (
            <>
              <button type="button" disabled={isPending} onClick={() => act(() => unarchiveBoardAction(token))}>
                Odarchivovat
              </button>
              <button type="button" disabled={isPending} onClick={remove}>Smazat</button>
            </>
          ) : (
            <button type="button" disabled={isPending} onClick={() => act(() => archiveBoardAction(token))}>
              Archivovat
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
