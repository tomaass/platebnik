'use client'

import { useEffect, useMemo, useState } from 'react'
import * as R from 'remeda'
import type { ThemeKey } from '@/design/themes'
import { itemsSubtotal, selectionTotal, tipFromPercent } from '@/domain/pricing'
import { buildSpayd, formatAmount } from '@/domain/spayd'
import { signAction } from './sign-action'
import { renderQrDataUrl, renderQrSvg, renderQrCard, shareOrDownload, qrFileName, canUseCanvas } from './save-qr'
import ui from '@/design/ui.module.css'
import s from './BoardClient.module.css'
import QrSvg from '@/components/QrSvg'

// Debounce the (heavier) branded-card render so it doesn't run on every keystroke.
const CARD_DEBOUNCE_MS = 300

// Live QR: a canvas-backed PNG (long-pressable on iOS) with a canvas-free SVG fallback
// for WebViews where canvas is unavailable.
type LiveQr = { kind: 'png'; url: string } | { kind: 'svg'; markup: string }

interface ClientItem { id: string; name: string; priceHaler: number }
interface Props {
  token: string
  title: string
  iban: string
  variableSymbol: string
  items: ClientItem[]
  tipPercents: number[]
  theme: ThemeKey
}

export default function BoardClient(props: Props) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [tipKc, setTipKc] = useState('')
  const [qr, setQr] = useState<LiveQr | null>(null)
  const [card, setCard] = useState<Blob | null>(null)
  // Probe canvas once (lazy init runs in the browser on first render; false during SSR).
  // The QR block is gated on `qr`, which is null until the client effects run, so this never
  // affects SSR output — no hydration mismatch.
  const [canvasOk] = useState(canUseCanvas)
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
  // closely. Canvas PNG when available (long-pressable on iOS), else a canvas-free SVG so the QR
  // stays scannable. AbortController discards a stale result.
  useEffect(() => {
    if (total <= 0) {
      setQr(null)
      return
    }
    const ac = new AbortController()
    setQrError(undefined)
    const toSvg = (): Promise<LiveQr> => renderQrSvg(spayd).then((markup) => ({ kind: 'svg', markup }))
    const pending: Promise<LiveQr> = canvasOk
      ? renderQrDataUrl(spayd).then((url): LiveQr => ({ kind: 'png', url })).catch(toSvg)
      : toSvg()
    pending
      .then((next) => { if (!ac.signal.aborted) setQr(next) })
      .catch(() => { if (!ac.signal.aborted) setQrError('QR se nepodařilo vygenerovat.') })
    return () => ac.abort()
  }, [spayd, total, canvasOk])

  // Branded card for the "Uložit QR" button — pre-rendered (debounced) so share() can run within
  // the click gesture on iOS. Only when a PNG live QR rendered (qr.kind === 'png'): that's the
  // single signal that canvas works here, so the save UI and the card stay in lockstep and a
  // failure here can't contradict an SVG-fallback QR. Cleared on any change so a stale card
  // (wrong amount) can never be saved; the button is disabled until the fresh card is ready.
  useEffect(() => {
    setCard(null)
    if (qr?.kind !== 'png' || total <= 0) return
    const ac = new AbortController()
    const timer = setTimeout(() => {
      renderQrCard({ spayd, title: props.title, amountFormatted: formatAmount(total) })
        .then((blob) => { if (!ac.signal.aborted) setCard(blob) })
        .catch(() => { if (!ac.signal.aborted) setQrError('Uložení QR se nepodařilo připravit.') })
    }, CARD_DEBOUNCE_MS)
    return () => { ac.abort(); clearTimeout(timer) }
  }, [spayd, total, props.title, qr?.kind])

  const setItemQty = (id: string, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))

  const activeTipKc = (p: number) => String(tipFromPercent(subtotal, p) / 100)

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
    if (res.ok) setSigned(true)
    else setSignError(res.error ?? 'Nastala chyba, zkuste to znovu.')
  }

  const scrollToPay = () => {
    if (total <= 0 || typeof document === 'undefined') return
    document.querySelector(`.${s.payCard}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main data-theme={props.theme} className={s.page}>
      <div className={s.inner}>
        <div className={s.head}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <span className={s.title}>{props.title}</span>
        </div>
        <p className={s.sub}>Co sis dal? Naťukej a zaplať. 🍺</p>

        {props.items.map((it) => (
          <div key={it.id} className={s.row}>
            <span className={s.rowInfo}>
              <span className={s.name}>{it.name}</span>
              <span className={s.price}>{formatAmount(it.priceHaler)} Kč</span>
            </span>
            <span className={ui.stepper}>
              <button className={`${ui.stepBtn} ${ui.stepMinus}`} aria-label={`Ubrat ${it.name}`} onClick={() => setItemQty(it.id, -1)}>−</button>
              <span className={ui.q}>{qty[it.id] ?? 0}</span>
              <button className={`${ui.stepBtn} ${ui.stepPlus}`} aria-label={`Přidat ${it.name}`} onClick={() => setItemQty(it.id, +1)}>+</button>
            </span>
          </div>
        ))}

        <span className={ui.label}>Dýško (dobrovolné)</span>
        <div className={s.tips}>
          {props.tipPercents.map((p) => (
            <button key={p} className={ui.chip} onClick={() => setTipKc(activeTipKc(p))}>{p} %</button>
          ))}
          <input
            className={s.tipInput} type="number" inputMode="decimal" placeholder="vlastní Kč"
            value={tipKc} onChange={(e) => setTipKc(e.target.value)}
          />
        </div>

        {total > 0 ? (
          <div className={`${ui.card} ${s.payCard}`}>
            <span className={s.amtLabel}>K zaplacení vč. dýška</span>
            <span className={s.amt}>{formatAmount(total)} Kč</span>

            {qr?.kind === 'png' && <img className={s.qrImg} src={qr.url} alt="QR Platba" />}
            {qr?.kind === 'svg' && (
              <div className={s.qrSvgBox}>
                <div className={s.qrSvgPad} />
                <QrSvg className={s.qrSvgInner} markup={qr.markup} label="QR Platba" />
              </div>
            )}

            <div className={s.qrBadge}>▢ QR Platba</div>

            {qr?.kind === 'png' ? (
              <>
                <button
                  className={`${ui.btn} ${ui.btnPrimary} ${s.saveBtn}`}
                  onClick={saveQr}
                  disabled={saving || !card}
                >
                  {saving ? 'Ukládám…' : 'Uložit QR do mobilu'}
                </button>
                <p className={s.qrHint}>Podrž QR a ulož do Fotek, nebo klikni „Uložit QR". Pak ho načti v bankovní appce z galerie.</p>
              </>
            ) : (
              <p className={s.qrHint}>Podrž QR a ulož do Fotek, pak ho načti v bankovní appce z galerie.</p>
            )}
            {qrError && <p className={s.signError}>{qrError}</p>}

            {!signed ? (
              <div className={s.sign}>
                <p className={s.signPrompt}>Podepiš se, ať hostitel ví, kdo platil 🙂</p>
                <input className={ui.field} placeholder="Jméno (třeba Pepa)" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={ui.field} placeholder="Vzkaz (nepovinné)" value={message} onChange={(e) => setMessage(e.target.value)} />
                <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={sign}>Podepsat se</button>
                {signError && <p className={s.signError}>{signError}</p>}
              </div>
            ) : (
              <p className={s.signDone}>Díky, podpis odeslán!</p>
            )}
          </div>
        ) : (
          <p className={s.emptyHint}>Vyber položky nebo zadej dýško. 👆</p>
        )}
      </div>

      <div className={s.bar}>
        <div className={s.barTotal}>
          <span className={s.barLabel}>Tvůj účet</span>
          <span className={s.barValue}>{formatAmount(total)} Kč</span>
        </div>
        <button className={s.barPay} onClick={scrollToPay} disabled={total <= 0}>
          Zaplatit přes QR →
        </button>
      </div>
    </main>
  )
}
