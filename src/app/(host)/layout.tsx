import Link from 'next/link'
import { requireUser } from '@/auth/config'
import { signOut } from '@/auth/config'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/boards">Moje akce</Link>
        <Link href="/profile">Profil</Link>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
          <button type="submit">Odhlásit</button>
        </form>
      </nav>
      {children}
    </div>
  )
}
