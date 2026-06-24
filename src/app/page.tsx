import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Platebník</h1>
      <p>Zadej ceník občerstvení, sdílej QR a nech partu snadno zaplatit — bez počítání a trapnosti.</p>
      <Link href="/boards">Vytvořit akci</Link>
    </main>
  )
}
