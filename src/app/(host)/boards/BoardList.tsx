'use client'

import { useEffect, useState } from 'react'
import type { BoardSummary } from '@/db/boards'
import BoardCard from './BoardCard'
import s from '../host.module.css'

// Owns the "which card's menu is open" state so only one menu is open at a
// time. A transparent backdrop closes it on any outside click; Escape too.
export default function BoardList({ boards }: { boards: BoardSummary[] }) {
  const [openToken, setOpenToken] = useState<string | null>(null)
  const active = boards.filter((b) => !b.archivedAt)
  const archived = boards.filter((b) => b.archivedAt)

  const close = () => setOpenToken(null)

  useEffect(() => {
    if (!openToken) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openToken])

  const card = (b: BoardSummary, isArchived: boolean) => (
    <li key={b.token}>
      <BoardCard
        token={b.token} title={b.title} archived={isArchived}
        open={openToken === b.token}
        onToggle={() => setOpenToken((cur) => (cur === b.token ? null : b.token))}
        onClose={close}
      />
    </li>
  )

  return (
    <>
      {openToken && <div className={s.menuBackdrop} onClick={close} />}
      {active.length === 0 ? (
        <p className={s.empty}>Žádná aktivní akce.</p>
      ) : (
        <ul className={s.list}>{active.map((b) => card(b, false))}</ul>
      )}
      {archived.length > 0 && (
        <>
          <h2 className={s.archivedHeading}>Archivované</h2>
          <ul className={s.list}>{archived.map((b) => card(b, true))}</ul>
        </>
      )}
    </>
  )
}
