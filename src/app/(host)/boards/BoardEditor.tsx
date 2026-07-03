'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, THEMES, type ThemeKey } from '@/design/themes'
import {
  cleanItems, formatPrice, isBoardDirty, parsePrice, saveButton, validateBoardForm,
  type BoardFormState,
} from '@/domain/boardForm'
import { createBoardAction, updateBoardAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from './BoardEditor.module.css'

interface Props {
  token?: string
  initialTitle?: string
  initialItems?: ItemInput[]
  initialTheme?: ThemeKey
  // Notifies a parent when the live (unsaved) theme changes, so sibling UI
  // (e.g. the share panel) can re-theme along with the editor preview.
  onThemeChange?: (theme: ThemeKey) => void
}

// The editor keeps each row's price as the raw string the user typed (so
// in-progress decimals and a Czech comma separator survive) and a stable id
// (so inline errors stay bound to the row, not its index).
interface EditorItem {
  id: string
  name: string
  price: string
}

function Field({
  value, placeholder, error, inputMode, onChange, onBlur,
}: {
  value: string
  placeholder: string
  error?: string
  inputMode?: 'decimal'
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <>
      <input
        className={`${ui.field} ${error ? s.inputError : ''}`}
        value={value} placeholder={placeholder} inputMode={inputMode}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {error && <p className={s.fieldError}>{error}</p>}
    </>
  )
}

export default function BoardEditor({
  token, initialTitle = '', initialItems = [], initialTheme = DEFAULT_THEME, onThemeChange,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<EditorItem[]>(
    () => initialItems.map((it) => ({ id: nanoid(), name: it.name, price: formatPrice(it.priceHaler) })),
  )
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)
  const selectTheme = (key: ThemeKey) => {
    setTheme(key)
    onThemeChange?.(key)
  }
  const [savedSnapshot, setSavedSnapshot] = useState<BoardFormState>({
    title: initialTitle, items: initialItems, theme: initialTheme,
  })
  const [submitting, setSubmitting] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [serverError, setServerError] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Numeric view of the rows, recomputed only when rows change.
  const parsedItems = useMemo<ItemInput[]>(
    () => items.map((it) => ({ name: it.name, priceHaler: parsePrice(it.price) ?? 0 })),
    [items],
  )
  const current = useMemo<BoardFormState>(
    () => ({ title, items: parsedItems, theme }),
    [title, parsedItems, theme],
  )
  const base = useMemo(() => validateBoardForm(current), [current])
  // Merge price-text format errors (unparseable, non-empty) that the numeric validator can't see.
  const itemErrors = useMemo(
    () => items.map((it, i) => {
      const badFormat = it.price.trim() !== '' && parsePrice(it.price) === null
      return badFormat ? { ...base.errors.items[i], price: 'Neplatná cena' } : base.errors.items[i]
    }),
    [items, base],
  )
  const valid = base.valid && items.every((it) => it.price.trim() === '' || parsePrice(it.price) !== null)
  const dirty = useMemo(() => isBoardDirty(current, savedSnapshot), [current, savedSnapshot])
  const mode = token ? 'edit' : 'create'
  const btn = saveButton({ mode, dirty, valid, submitting })

  // A field's error is shown once it's been touched (onBlur) or after a failed save click.
  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key))
  const shows = (key: string) => showErrors || touched.has(key)

  const setItem = (id: string, patch: Partial<Omit<EditorItem, 'id'>>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, { id: nanoid(), name: '', price: '' }])
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

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
    const fail = (message?: string) => {
      setSubmitting(false)
      setServerError(message || 'Nepodařilo se uložit, zkus to znovu')
    }
    setSubmitting(true)
    const clean = cleanItems(parsedItems)
    try {
      if (token) {
        const res = await updateBoardAction(token, { title, items: clean, theme })
        if (res.error) return fail(res.error)
        // No router.refresh(): reset the snapshot so the form is "clean" again.
        setSavedSnapshot({ title, items: parsedItems, theme })
        setShowErrors(false)
        setTouched(new Set())
        setSubmitting(false)
        return
      }
      const res = await createBoardAction({ title, items: clean, theme })
      if ('error' in res) return fail(res.error)
      // Navigating away — leave submitting true to avoid a button flicker.
      router.push(`/boards/${res.token}`)
    } catch {
      fail()
    }
  }

  const titleErr = shows('title') ? base.errors.title : undefined

  return (
    <div ref={wrapRef} data-theme={theme} className={s.wrap}>
      <span className={ui.label}>Název akce</span>
      <Field
        value={title} placeholder="Grilovačka u Tomáše" error={titleErr}
        onChange={setTitle} onBlur={() => touch('title')}
      />

      <span className={ui.label}>Ceník</span>
      {items.map((it, i) => (
        <div key={it.id} className={s.itemRow}>
          <div className={s.itemName}>
            <Field
              value={it.name} placeholder="Pivo 🍺"
              error={shows(`item:${it.id}:name`) ? itemErrors[i]?.name : undefined}
              onChange={(v) => setItem(it.id, { name: v })}
              onBlur={() => touch(`item:${it.id}:name`)}
            />
          </div>
          <div className={s.itemPrice}>
            <Field
              value={it.price} placeholder="Kč" inputMode="decimal"
              error={shows(`item:${it.id}:price`) ? itemErrors[i]?.price : undefined}
              onChange={(v) => setItem(it.id, { price: v })}
              onBlur={() => touch(`item:${it.id}:price`)}
            />
          </div>
          <button type="button" className={s.del} aria-label="Smazat položku" onClick={() => removeItem(it.id)}>×</button>
        </div>
      ))}
      <button type="button" className={s.add} onClick={addItem}>+ Přidat položku</button>
      {showErrors && base.errors.form && <p className={s.fieldError}>{base.errors.form}</p>}
      <p className={s.hint}>Bez položek? V pohodě — board pojede v režimu čistého dýška.</p>

      <span className={ui.label}>Styl akce</span>
      <div className={s.themes}>
        {THEMES.map((t) => (
          <div
            key={t.key} data-theme={t.key}
            className={`${s.theme} ${theme === t.key ? s.themeOn : ''}`}
            onClick={() => selectTheme(t.key)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(t.key) } }}
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
