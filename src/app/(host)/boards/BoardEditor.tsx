'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME } from '@/design/themes'
import { createBoardAction, updateBoardAction } from '../actions'

interface Props {
  token?: string
  initialTitle?: string
  initialItems?: ItemInput[]
}

export default function BoardEditor({ token, initialTitle = '', initialItems = [] }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<ItemInput[]>(initialItems)
  const [error, setError] = useState('')

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { name: '', priceHaler: 0 }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setError('')
    const clean = R.pipe(items, R.filter((it) => it.name.trim().length > 0))
    if (token) {
      const res = await updateBoardAction(token, { title, items: clean, theme: DEFAULT_THEME })
      if (res.error) return setError(res.error)
      router.refresh()
      return
    }
    const res = await createBoardAction({ title, items: clean, theme: DEFAULT_THEME })
    if ('error' in res) return setError(res.error)
    router.push(`/boards/${res.token}`)
  }

  return (
    <div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Název akce" />
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={it.name} placeholder="Položka"
            onChange={(e) => setItem(i, { name: e.target.value })}
          />
          <input
            type="number" inputMode="decimal" placeholder="Kč"
            value={it.priceHaler === 0 ? '' : it.priceHaler / 100}
            onChange={(e) => setItem(i, { priceHaler: Math.round(Number(e.target.value) * 100) })}
          />
          <button type="button" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={addItem}>+ Položka</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="button" onClick={save}>Uložit</button>
    </div>
  )
}
