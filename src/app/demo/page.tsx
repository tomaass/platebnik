import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site'
import BoardClient from '../b/[token]/BoardClient'
import { DEMO_BOARD, resolveDemoIban } from './demo-board'

const description =
  'Vyzkoušej Platebníka bez registrace — naťukej, co by sis dal, a koukni, jak se generuje QR Platba.'

export const metadata: Metadata = {
  title: 'Demo',
  description,
  alternates: { canonical: '/demo' },
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    siteName: SITE_NAME,
    url: '/demo',
    title: `Demo · ${SITE_NAME}`,
    description,
  },
}

export default function DemoBoard() {
  // Statically prerendered: the env var is baked in at build time, which is
  // exactly what we want — no per-request work for a marketing page.
  const iban = resolveDemoIban(process.env.DEMO_ACCOUNT)
  return (
    <BoardClient
      token={DEMO_BOARD.token}
      title={DEMO_BOARD.title}
      iban={iban}
      variableSymbol={DEMO_BOARD.variableSymbol}
      items={[...DEMO_BOARD.items]}
      tipPercents={[...DEMO_BOARD.tipPercents]}
      theme={DEMO_BOARD.theme}
      demo
    />
  )
}
