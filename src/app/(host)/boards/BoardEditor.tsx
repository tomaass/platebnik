'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, THEMES, type ThemeKey } from '@/design/themes'
import {
  cleanItems, isBoardDirty, saveButton, validateBoardForm, type BoardFormState,
} from '@/domain/boardForm'
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
  const [snapshot, setSnapshot] = useState<BoardFormState>({
    title: initialTitle, items: initialItems, theme: initialTheme,
  })
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [serverError, setServerError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const current: BoardFormState = { title, items, theme }
  const { errors, valid } = validateBoardForm(current)
  const dirty = isBoardDirty(current, snapshot)
  const mode = token ? 'edit' : 'create'
  const btn = saveButton({ mode, dirty, valid, submitting })

  // A field's error is shown once it's been touched (onBlur) or after a failed save click.
  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key))
  const shows = (key: string) => showErrors || touched.has(key)

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { name: '', priceHaler: 0 }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    setServerError('')
    if (!valid) {
      setShowErrors(true)
      requestAnimationFrame(() => {
        const el = wrapRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus()
      })
      return
    }
    setSubmitting(true)
    const clean = cleanItems(items)
    if (token) {
      const res = await updateBoardAction(token, { title, items: clean, theme })
      setSubmitting(false)
      if (res.error) return setServerError('Nepodařilo se uložit, zkus to znovu')
      // No router.refresh(): reset the snapshot so the form is "clean" again.
      setSnapshot({ title, items, theme })
      setShowErrors(false)
      setTouched(new Set())
      return
    }
    const res = await createBoardAction({ title, items: clean, theme })
    if ('error' in res) {
      setSubmitting(false)
      return setServerError('Nepodařilo se uložit, zkus to znovu')
    }
    router.push(`/boards/${res.token}`)
  }

  const titleErr = shows('title') ? errors.title : undefined

  return (
    <div ref={wrapRef} data-theme={theme} className={s.wrap}>
      <span className={ui.label}>Název akce</span>
      <input
        className={`${ui.field} ${titleErr ? s.inputError : ''}`}
        value={title} placeholder="Grilovačka u Tomáše"
        aria-invalid={!!titleErr}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => touch('title')}
      />
      {titleErr && <p className={s.fieldError}>{titleErr}</p>}

      <span className={ui.label}>Ceník</span>
      {items.map((it, i) => {
        const nameErr = shows(`item:${i}:name`) ? errors.items[i]?.name : undefined
        const priceErr = shows(`item:${i}:price`) ? errors.items[i]?.price : undefined
        return (
          <div key={i} className={s.itemRow}>
            <div className={s.itemName}>
              <input
                className={`${ui.field} ${nameErr ? s.inputError : ''}`} value={it.name} placeholder="Pivo 🍺"
                aria-invalid={!!nameErr}
                onChange={(e) => setItem(i, { name: e.target.value })}
                onBlur={() => touch(`item:${i}:name`)}
              />
              {nameErr && <p className={s.fieldError}>{nameErr}</p>}
            </div>
            <div className={s.itemPrice}>
              <input
                className={`${ui.field} ${priceErr ? s.inputError : ''}`} type="number" inputMode="decimal" placeholder="Kč"
                value={it.priceHaler === 0 ? '' : it.priceHaler / 100}
                aria-invalid={!!priceErr}
                onChange={(e) => setItem(i, { priceHaler: Math.round(Number(e.target.value) * 100) })}
                onBlur={() => touch(`item:${i}:price`)}
              />
              {priceErr && <p className={s.fieldError}>{priceErr}</p>}
            </div>
            <button type="button" className={s.del} aria-label="Smazat položku" onClick={() => removeItem(i)}>×</button>
          </div>
        )
      })}
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

      {serverError && <p className={s.error}>{serverError}</p>}
      <button
        type="button"
        className={`${ui.btn} ${ui.btnPrimary} ${s.save} ${btn.muted ? s.saveMuted : ''}`}
        disabled={btn.disabled}
        onClick={save}
      >
        {btn.label}
      </button>
    </div>
  )
}
