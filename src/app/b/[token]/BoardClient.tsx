'use client'

import { useEffect, useMemo, useState } from 'react'
import * as R from 'remeda'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'
import { renderQrDataUrl, renderQrCard, shareOrDownload, qrFileName } from './save-qr'

// Debounce the (heavier) branded-card render so it doesn't run on every keystroke.
const CARD_DEBOUNCE_MS = 300

interface ClientItem { id: string; name: string; priceHaler: number }
interface Props {
  token: string
  title: string
  iban: string
  variableSymbol: string
  items: ClientItem[]
  tipPercents: number[]
}

export default function BoardClient(props: Props) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [tipKc, setTipKc] = useState('')
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [card, setCard] = useState<Blob | null>(null)
  const [signed, setSigned] = useState(false)
  const [signError, setSignError] = useState<string | undefined>(undefined)
  const [qrError, setQrError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const entries = useMemo(
    () => R.pipe(
      props.items,
      R.map((it) => ({ ...it, itemId: it.id, quantity: qty[it.id] ?? 0 })),
      R.filter((e) => e.quantity > 0),
    ),
    [props.items, qty],
  )

  const subtotal = itemsSubtotal(entries)
  // Tip: the % buttons only pre-fill the "custom Kč" input, which is the single source of truth.
  const tipKcNum = Number(tipKc)
  const tipHaler = Number.isFinite(tipKcNum) && tipKcNum > 0 ? Math.round(tipKcNum * 100) : 0
  const total = selectionTotal({ entries, tipHaler })

  const spayd = buildSpayd({
    iban: props.iban, amountHaler: total, variableSymbol: props.variableSymbol,
    message: `${name} ${props.title}`.trim(),
  })

  // Live QR for display — plain (no branding), generated immediately so it tracks the total
  // closely. data: URL is long-pressable on iOS. AbortController discards a stale result.
  useEffect(() => {
    if (total <= 0) {
      setQrUrl(null)
      return
    }
    const ac = new AbortController()
    setQrError(undefined)
    renderQrDataUrl(spayd)
      .then((url) => { if (!ac.signal.aborted) setQrUrl(url) })
      .catch(() => { if (!ac.signal.aborted) setQrError('QR se nepodařilo vygenerovat.') })
    return () => ac.abort()
  }, [spayd, total])

  // Branded card for the "Uložit QR" button — pre-rendered (debounced) so share() can run
  // within the click gesture on iOS. Cleared immediately on any change so a stale card (wrong
  // amount) can never be saved; the button is disabled until the fresh card is ready.
  useEffect(() => {
    setCard(null)
    if (total <= 0) return
    const ac = new AbortController()
    const timer = setTimeout(() => {
      renderQrCard({ spayd, title: props.title, amountFormatted: formatAmount(total) })
        .then((blob) => { if (!ac.signal.aborted) setCard(blob) })
        .catch(() => { if (!ac.signal.aborted) setQrError('QR se nepodařilo vygenerovat.') })
    }, CARD_DEBOUNCE_MS)
    return () => { ac.abort(); clearTimeout(timer) }
  }, [spayd, total, props.title])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  const saveQr = async () => {
    if (!card) return
    setSaving(true)
    setQrError(undefined)
    try {
      // card is ready → share() runs within the gesture (iOS user activation).
      await shareOrDownload(card, qrFileName(props.title))
    } catch {
      setQrError('QR se nepodařilo uložit, zkus to znovu.')
    } finally {
      setSaving(false)
    }
  }

  const sign = async () => {
    setSignError(undefined)
    const res = await signAction({
      token: props.token, name: name || undefined, message: message || undefined,
      selectionSnapshot: entries.map((e) => ({ name: e.name, quantity: e.quantity })),
      amountHaler: total, tipHaler,
    })
    if (res.ok) {
      setSigned(true)
    } else {
      setSignError(res.error ?? 'Nastala chyba, zkuste to znovu.')
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '1rem' }}>
      <h1>{props.title}</h1>
      {props.items.map((it) => (
        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{it.name} — {formatAmount(it.priceHaler)} Kč</span>
          <span>
            <button onClick={() => setItemQty(it.id, -1)}>−</button>
            {qty[it.id] ?? 0}
            <button onClick={() => setItemQty(it.id, +1)}>+</button>
          </span>
        </div>
      ))}

      <section>
        <h3>Dýško (dobrovolné)</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {props.tipPercents.map((p) => (
            <button key={p} onClick={() => setTipKc(String(tipFromPercent(subtotal, p) / 100))}>{p} %</button>
          ))}
          <input
            type="number" inputMode="decimal" placeholder="vlastní Kč"
            value={tipKc}
            onChange={(e) => setTipKc(e.target.value)}
          />
        </div>
      </section>

      <p><strong>Celkem: {formatAmount(total)} Kč</strong></p>
      {qrUrl
        ? (
          <>
            <img
              src={qrUrl}
              alt="QR platba"
              style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block' }}
            />
            <button onClick={saveQr} disabled={saving || !card}>
              {saving ? 'Ukládám…' : 'Uložit QR'}
            </button>
            <p style={{ fontSize: '0.85rem', color: '#555' }}>
              Podrž QR pro uložení do Fotek, nebo klikni na „Uložit QR" pro QR s logem. Pak QR načti v bance z galerie.
            </p>
            {qrError && <p style={{ color: 'red' }}>{qrError}</p>}
          </>
        )
        : <p>Vyber položky nebo zadej dýško.</p>}

      {!signed
        ? (
          <section>
            <p>Chceš se podepsat nebo nechat vzkaz, ať hostitel ví, kdo a co platil?</p>
            <input placeholder="Jméno" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Vzkaz" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button onClick={sign} disabled={total <= 0}>Podepsat se</button>
            {signError && <p style={{ color: 'red' }}>{signError}</p>}
          </section>
        )
        : <p>Díky, podpis odeslán!</p>}
    </main>
  )
}
