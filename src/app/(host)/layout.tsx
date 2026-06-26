import Link from 'next/link'
import { requireUser, signOut } from '@/auth/config'
import s from './host.module.css'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <Link href="/boards" className={s.brand}>Platebník<span className={s.dot}>.</span></Link>
        <Link href="/boards" className={s.navLink}>Moje akce</Link>
        <Link href="/profile" className={s.navLink}>Profil</Link>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }) }}>
          <button type="submit" className={s.signout}>Odhlásit</button>
        </form>
      </nav>
      {children}
    </div>
  )
}
