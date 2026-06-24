import { eq } from 'drizzle-orm'
import { requireUser } from '@/auth/config'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { ProfileForm } from './ProfileForm'

export default async function Profile() {
  const user = await requireUser()
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  return (
    <main>
      <h1>Profil</h1>
      <p>Číslo účtu se použije pro QR Platbu na tvých boardech.</p>
      <ProfileForm
        defaultAccount={row?.bankAccountRaw ?? ''}
        iban={row?.bankAccountIban ?? null}
      />
    </main>
  )
}
