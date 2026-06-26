'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, THEMES, type ThemeKey } from '@/design/themes'
import { createBoardAction, updateBoardAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from './BoardEditor.module.css'

interface Props {
  token?: string
  initialTitle?: string
  initialItems?: ItemInput[]
  initialTheme?: ThemeKey
}

export default function BoardEditor({
  token, initialTitle = '', initialItems = [], initialTheme = DEFAULT_THEME,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<ItemInput[]>(initialItems)
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)
  const [error, setError] = useState('')

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { name: '', priceHaler: 0 }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setError('')
    const clean = R.pipe(items, R.filter((it) => it.name.trim().length > 0))
    if (token) {
      const res = await updateBoardAction(token, { title, items: clean, theme })
      if (res.error) return setError(res.error)
      router.refresh()
      return
    }
    const res = await createBoardAction({ title, items: clean, theme })
    if ('error' in res) return setError(res.error)
    router.push(`/boards/${res.token}`)
  }

  return (
    <div data-theme={theme} className={s.wrap}>
      <span className={ui.label}>Název akce</span>
      <input className={ui.field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grilovačka u Tomáše" />

      <span className={ui.label}>Ceník</span>
      {items.map((it, i) => (
        <div key={i} className={s.itemRow}>
          <input
            className={`${ui.field} ${s.itemName}`} value={it.name} placeholder="Pivo 🍺"
            onChange={(e) => setItem(i, { name: e.target.value })}
          />
          <input
            className={`${ui.field} ${s.itemPrice}`} type="number" inputMode="decimal" placeholder="Kč"
            value={it.priceHaler === 0 ? '' : it.priceHaler / 100}
            onChange={(e) => setItem(i, { priceHaler: Math.round(Number(e.target.value) * 100) })}
          />
          <button type="button" className={s.del} aria-label="Smazat položku" onClick={() => removeItem(i)}>×</button>
        </div>
      ))}
      <button type="button" className={s.add} onClick={addItem}>+ Přidat položku</button>
      <p className={s.hint}>Bez položek? V pohodě — board pojede v režimu čistého dýška.</p>

      <span className={ui.label}>Styl akce</span>
      <div className={s.themes}>
        {THEMES.map((t) => (
          <div
            key={t.key} data-theme={t.key}
            className={`${s.theme} ${theme === t.key ? s.themeOn : ''}`}
            onClick={() => setTheme(t.key)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.key) } }}
          >
            <div className={s.themePrev} />
            <div className={s.themeName}>{t.label}{theme === t.key ? ' ✓' : ''}</div>
          </div>
        ))}
      </div>
      <p className={s.hint}>Nový board převezme tvůj poslední styl. 🔓 Další motivy přibydou v Premiu.</p>

      {error && <p className={s.error}>{error}</p>}
      <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${s.save}`} onClick={save}>Uložit</button>
    </div>
  )
}
