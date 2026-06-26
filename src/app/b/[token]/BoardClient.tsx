'use client'

import { useEffect, useMemo, useState } from 'react'
import * as R from 'remeda'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'
import { renderQrDataUrl, renderQrCard, shareOrDownload, qrFileName } from './save-qr'

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
  const [cardBlob, setCardBlob] = useState<Blob | null>(null)
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
  // Dýško: tlačítka % jen předvyplní input "vlastní Kč", který je jediný zdroj pravdy.
  const tipKcNum = Number(tipKc)
  const tipHaler = Number.isFinite(tipKcNum) && tipKcNum > 0 ? Math.round(tipKcNum * 100) : 0
  const total = selectionTotal({ entries, tipHaler })

  const spayd = buildSpayd({
    iban: props.iban, amountHaler: total, variableSymbol: props.variableSymbol,
    message: `${name} ${props.title}`.trim(),
  })

  // Při každé změně klientsky generujeme dvě věci: holý QR (data URL) pro zobrazení
  // a brandovanou kartu (blob) pro uložení. Karta se chystá dopředu, aby na iOS šlo
  // share() zavolat hned v gestu. Žádný server request.
  useEffect(() => {
    if (total <= 0) {
      setQrUrl(null)
      setCardBlob(null)
      return
    }
    let cancelled = false // standardní cleanup pro async efekt — zahodí zastaralý výsledek
    setQrError(undefined)
    Promise.all([
      renderQrDataUrl(spayd),
      renderQrCard({ spayd, title: props.title, amountFormatted: formatAmount(total) }),
    ])
      .then(([url, blob]) => {
        if (cancelled) return
        setQrUrl(url)
        setCardBlob(blob)
      })
      .catch(() => {
        if (!cancelled) setQrError('QR se nepodařilo vygenerovat.')
      })
    return () => { cancelled = true }
  }, [spayd, total, props.title])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  const saveQr = async () => {
    if (!cardBlob) return
    setSaving(true)
    setQrError(undefined)
    try {
      // cardBlob je hotový → share() se zavolá hned v gestu (iOS user-activation).
      await shareOrDownload(cardBlob, qrFileName(props.title))
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
              style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block' }}
            />
            <button onClick={saveQr} disabled={saving || !cardBlob}>
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
