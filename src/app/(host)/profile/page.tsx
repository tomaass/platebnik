import { eq } from 'drizzle-orm'
import { requireUser } from '@/auth/config'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { saveAccountAction } from '../actions'

const saveAccountFormAction = async (fd: FormData): Promise<void> => {
  'use server'
  await saveAccountAction(fd)
}

export default async function Profile() {
  const user = await requireUser()
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  return (
    <main>
      <h1>Profil</h1>
      <p>Číslo účtu se použije pro QR Platbu na tvých boardech.</p>
      <form action={saveAccountFormAction}>
        <input
          name="account" placeholder="19-2000145399/0800"
          defaultValue={row?.bankAccountRaw ?? ''} required
        />
        <button type="submit">Uložit</button>
      </form>
      {row?.bankAccountIban && <p>IBAN: {row.bankAccountIban}</p>}
    </main>
  )
}
