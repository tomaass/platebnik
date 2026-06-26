'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import s from '../host.module.css'

export default function SharePanel({ token }: { token: string }) {
  const [svg, setSvg] = useState('')
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${token}` : ''

  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 1 }).then(setSvg)
  }, [url])

  return (
    <div className={s.share}>
      <div className={s.shareTitle}>Hotovo! Nasdílej partě 🎉</div>
      <div className={s.shareRow}>
        {/* dangerouslySetInnerHTML je zde bezpečné — svg je výstup qrcode knihovny z naší vlastní URL, ne uživatelský vstup */}
        <div className={s.shareQr} role="img" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR kód na board" />
        <a className={s.shareUrl} href={url}>{url}</a>
      </div>
    </div>
  )
}
