'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function SharePanel({ token }: { token: string }) {
  const [svg, setSvg] = useState('')
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${token}` : ''

  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 1 }).then(setSvg)
  }, [url])

  return (
    <div>
      <h3>Sdílej s partou</h3>
      <p><a href={url}>{url}</a></p>
      {/* dangerouslySetInnerHTML je zde bezpečné — svg je výstup qrcode knihovny z naší vlastní URL, ne uživatelský vstup */}
      <div role="img" dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR kód na board" />
    </div>
  )
}
