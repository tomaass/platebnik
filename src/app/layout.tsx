import './globals.css'
import { bricolage, inter } from '@/design/fonts'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-theme="sunset" className={`${bricolage.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
