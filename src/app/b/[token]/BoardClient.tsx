'use client'

import { useEffect, useMemo, useState } from 'react'
import * as R from 'remeda'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'
import { renderQrCard, shareOrDownload, qrFileName, CARD_GEOMETRY } from './save-qr'
import type { QrCardOutput } from './save-qr'

// On the page we show only the QR crop (without branding). The <img> is the full
// card, though, so an iOS long-press saves the branded source. Crop = a QR-sized window.
const QR_DISPLAY = 280
const SCALE = QR_DISPLAY / CARD_GEOMETRY.qr.size

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
  const [card, setCard] = useState<QrCardOutput | null>(null)
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

  // On every change, generate the branded card client-side (dataUrl for the <img> +
  // blob for sharing). Prepared ahead of time so share() can be called within the
  // gesture on iOS. No server request.
  useEffect(() => {
    if (total <= 0) {
      setCard(null)
      return
    }
    let cancelled = false // standard async-effect cleanup — discard a stale result
    setQrError(undefined)
    renderQrCard({ spayd, title: props.title, amountFormatted: formatAmount(total) })
      .then((result) => {
        if (!cancelled) setCard(result)
      })
      .catch(() => {
        if (!cancelled) setQrError('QR se nepodařilo vygenerovat.')
      })
    return () => { cancelled = true }
  }, [spayd, total, props.title])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  const saveQr = async () => {
    if (!card) return
    setSaving(true)
    setQrError(undefined)
    try {
      // card.blob is ready → share() runs within the gesture (iOS user activation).
      await shareOrDownload(card.blob, qrFileName(props.title))
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
      {card
        ? (
          <>
            <div
              style={{ width: QR_DISPLAY, height: QR_DISPLAY, maxWidth: '100%', overflow: 'hidden', position: 'relative' }}
            >
              <img
                src={card.dataUrl}
                alt="QR platba"
                style={{
                  position: 'absolute',
                  left: -CARD_GEOMETRY.qr.x * SCALE,
                  top: -CARD_GEOMETRY.qr.y * SCALE,
                  width: CARD_GEOMETRY.width * SCALE,
                  maxWidth: 'none',
                }}
              />
            </div>
            <button onClick={saveQr} disabled={saving}>
              {saving ? 'Ukládám…' : 'Uložit QR'}
            </button>
            <p style={{ fontSize: '0.85rem', color: '#555' }}>
              Podrž QR pro uložení do Fotek, nebo klikni na „Uložit QR" a sdílej do bankovní aplikace. Pak QR načti v bance z galerie.
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
