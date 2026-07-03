'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import s from './UserNav.module.css'

export function UserNav() {
  const { data: session } = useSession()

  if (!session?.user) {
    return (
      <Link className={s.login} href="/signin">Přihlásit</Link>
    )
  }

  return (
    <div className={s.links}>
      <Link className={s.link} href="/boards">Moje akce</Link>
      <Link className={s.link} href="/profile">Profil</Link>
      <button type="button" className={s.signout} onClick={() => signOut({ redirectTo: '/' })}>
        Odhlásit
      </button>
    </div>
  )
}
