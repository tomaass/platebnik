'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import s from '../host.module.css'
import QrSvg from '@/components/QrSvg'
import { QR_COLOR } from '@/lib/qr'

export default function SharePanel({ token }: { token: string }) {
  const [svg, setSvg] = useState('')
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${token}` : ''

  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 1, color: QR_COLOR }).then(setSvg)
  }, [url])

  return (
    <div className={s.share}>
      <div className={s.shareTitle}>Hotovo! Nasdílej partě 🎉</div>
      <div className={s.shareRow}>
        <QrSvg className={s.shareQr} markup={svg} label="QR kód na board" />
        <a className={s.shareUrl} href={url}>{url}</a>
      </div>
      <a className={s.sharePrint} href={`/b/${token}/print.pdf`} target="_blank" rel="noopener noreferrer">
        Vytisknout QR na stůl (PDF)
      </a>
    </div>
  )
}
