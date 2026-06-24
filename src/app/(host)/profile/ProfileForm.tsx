'use client'

import { useActionState } from 'react'
import { saveAccountAction } from '../actions'

export function ProfileForm({
  defaultAccount,
  iban,
}: {
  defaultAccount: string
  iban: string | null
}) {
  const [state, formAction] = useActionState(saveAccountAction, {})
  return (
    <>
      <form action={formAction}>
        <input
          name="account" placeholder="19-2000145399/0800"
          defaultValue={defaultAccount} required
        />
        <button type="submit">Uložit</button>
      </form>
      {state.error && <p style={{ color: 'red' }}>{state.error}</p>}
      {iban && <p>IBAN: {iban}</p>}
    </>
  )
}
