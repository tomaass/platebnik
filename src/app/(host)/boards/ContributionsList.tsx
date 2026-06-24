'use client'

import { useState } from 'react'
import { formatAmount } from '@/domain/spayd'
import { setPaidAction } from '../actions'
import type { ContributionRow } from '@/db/contributions'

export default function ContributionsList({ rows }: { rows: ContributionRow[] }) {
  const [state, setState] = useState(rows)
  const toggle = async (id: string, paid: boolean) => {
    await setPaidAction(id, paid)
    setState((prev) => prev.map((r) => (r.id === id ? { ...r, paid } : r)))
  }
  if (state.length === 0) return <p>Zatím se nikdo nepodepsal.</p>
  return (
    <ul>
      {state.map((r) => (
        <li key={r.id}>
          <label>
            <input type="checkbox" checked={r.paid} onChange={(e) => toggle(r.id, e.target.checked)} />
            <strong>{r.name ?? 'Anonym'}</strong> — {formatAmount(r.amountHaler)} Kč
            {r.message && <em> „{r.message}"</em>}
          </label>
        </li>
      ))}
    </ul>
  )
}
