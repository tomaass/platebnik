import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth/config'
import { UserNav } from '../UserNav'
import s from './host.module.css'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) redirect('/signin')
  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link href="/boards" className={s.brand}>Platebník<span className={s.dot}>.</span></Link>
        {/* Seeded with the server session so the nav is correct on first paint (no flash). */}
        <SessionProvider session={session}>
          <UserNav />
        </SessionProvider>
      </nav>
      {children}
    </div>
  )
}
