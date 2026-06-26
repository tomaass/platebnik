import { Bricolage_Grotesque, Inter } from 'next/font/google'

// Variabilní fonty — neuvádíme weight, použije se celá osa.
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})
