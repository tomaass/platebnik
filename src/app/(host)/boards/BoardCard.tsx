'use client'

import Link from 'next/link'
import { useState } from 'react'
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
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true)
    const res = await fn()
    if (res?.error) {
      window.alert(res.error)
      setBusy(false)
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
      <details className={s.cardMenu}>
        <summary className={s.cardMenuBtn} aria-label="Možnosti akce">⋯</summary>
        <div className={s.cardMenuList}>
          {archived ? (
            <>
              <button type="button" disabled={busy} onClick={() => act(() => unarchiveBoardAction(token))}>
                Odarchivovat
              </button>
              <button type="button" disabled={busy} onClick={remove}>Smazat</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => act(() => archiveBoardAction(token))}>
              Archivovat
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
