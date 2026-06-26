'use client'

import { useState } from 'react'
import { formatAmount } from '@/domain/spayd'
import { setPaidAction } from '../actions'
import type { ContributionRow } from '@/db/contributions'
import s from '../host.module.css'

export default function ContributionsList({ rows }: { rows: ContributionRow[] }) {
  const [state, setState] = useState(rows)
  const toggle = async (id: string, paid: boolean) => {
    await setPaidAction(id, paid)
    setState((prev) => prev.map((r) => (r.id === id ? { ...r, paid } : r)))
  }
  if (state.length === 0) return <p className={s.empty}>Zatím se nikdo nepodepsal.</p>
  return (
    <ul className={s.contribList}>
      {state.map((r) => (
        <li key={r.id} className={s.contrib}>
          <input type="checkbox" checked={r.paid} onChange={(e) => toggle(r.id, e.target.checked)} aria-label="Zaplaceno" />
          <span>
            <span className={s.contribName}>{r.name ?? 'Anonym'}</span> — {formatAmount(r.amountHaler)} Kč
            {r.message && <span className={s.contribMsg}> „{r.message}"</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
