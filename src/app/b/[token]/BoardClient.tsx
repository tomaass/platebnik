'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import * as R from 'remeda'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'

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
  const [qr, setQr] = useState('')
  const [signed, setSigned] = useState(false)
  const [signError, setSignError] = useState<string | undefined>(undefined)
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

  // Regenerace QR při každé změně — čistě klientsky, žádný server request.
  useEffect(() => {
    if (total <= 0) {
      setQr('')
      return
    }
    QRCode.toString(spayd, { type: 'svg', margin: 1 }).then(setQr)
  }, [spayd, total])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

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
      {qr
        ? <div role="img" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR Platba" />
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
