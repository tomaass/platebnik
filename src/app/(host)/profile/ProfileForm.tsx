'use client'

import { useActionState } from 'react'
import { saveAccountAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from '../host.module.css'

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
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
        <input
          className={ui.field} name="account" placeholder="19-2000145399/0800"
          defaultValue={defaultAccount} required
        />
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>Uložit</button>
      </form>
      {state.error && <p style={{ color: '#c0392b', fontSize: 13 }}>{state.error}</p>}
      {iban && <p className={s.iban}>IBAN: {iban}</p>}
    </>
  )
}
