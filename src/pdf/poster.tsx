import path from 'node:path'
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { THEME_GRADIENTS, type ThemeKey } from '@/design/themes'

// Register Czech-capable Inter (the built-in Helvetica cannot render č/ř/š/ž/…).
// Read from the bundled TTFs. next.config.ts must include src/pdf/fonts in
// this route's serverless trace (outputFileTracingIncludes) so the files
// exist in the deployed bundle on Vercel.
const fontDir = path.join(process.cwd(), 'src/pdf/fonts')
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontDir, 'Inter-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontDir, 'Inter-Bold.ttf'), fontWeight: 700 },
  ],
})
// Keep long words intact (URLs, board titles) instead of hyphenating.
Font.registerHyphenationCallback((word) => [word])

const BLACK = '#111111'
const MUTED = '#555555'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', fontFamily: 'Inter' },
  accentBar: { height: 10, width: '100%' },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingVertical: 48,
  },
  wordmark: { fontSize: 26, fontWeight: 700, marginBottom: 8 },
  // Clip long titles to 2 lines with an ellipsis so V1 stays a single A4 page.
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: BLACK,
    marginBottom: 28,
    textAlign: 'center',
    maxLines: 2,
    textOverflow: 'ellipsis',
  },
  qr: { width: 300, height: 300, marginBottom: 28 },
  heading: { fontSize: 28, fontWeight: 700, marginBottom: 12, textAlign: 'center' },
  instruction: {
    fontSize: 15,
    color: BLACK,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 1.4,
    marginBottom: 24,
  },
  fallback: { fontSize: 13, color: BLACK, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },
})

export interface PosterProps {
  title: string
  theme: ThemeKey
  qrDataUrl: string
  shortUrl: string
}

// Single A4 portrait poster. Accent is the theme's flat primary (`from`) stop.
function PosterDocument({ title, theme, qrDataUrl, shortUrl }: PosterProps) {
  const accent = THEME_GRADIENTS[theme][0]
  return (
    <Document>
      <Page size="A4" wrap={false} style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.body}>
          <Text style={[styles.wordmark, { color: accent }]}>Platebník</Text>
          <Text style={styles.title}>{title}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image style={styles.qr} src={qrDataUrl} />
          <Text style={[styles.heading, { color: accent }]}>Zaplať svoji útratu</Text>
          <Text style={styles.instruction}>
            Naskenuj telefonem → naklikej, co sis dal → zaplať QR platbou.
          </Text>
          <Text style={styles.fallback}>{shortUrl}</Text>
        </View>
        <Text style={styles.footer}>platebnik.cz</Text>
      </Page>
    </Document>
  )
}

export const renderPosterPdf = (props: PosterProps): Promise<Buffer> =>
  renderToBuffer(<PosterDocument {...props} />)
