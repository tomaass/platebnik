'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { archiveBoardAction, deleteBoardAction, unarchiveBoardAction } from '../actions'
import ui from '@/design/ui.module.css'
import s from '../host.module.css'

interface Props {
  token: string
  title: string
  archived: boolean
}

export default function BoardDangerZone({ token, title, archived }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (
    fn: () => Promise<{ error?: string }>,
    after: () => void,
  ) => {
    setError('')
    setBusy(true)
    const res = await fn()
    if (res?.error) {
      setError(res.error)
      setBusy(false)
      return
    }
    after()
  }

  const archive = () => run(() => archiveBoardAction(token), () => router.refresh())
  const unarchive = () => run(() => unarchiveBoardAction(token), () => router.refresh())
  const remove = () => {
    if (!window.confirm(`Opravdu smazat akci „${title}"? Nevratně zmizí i všechny příspěvky.`)) return
    run(() => deleteBoardAction(token), () => router.push('/boards'))
  }

  return (
    <section className={s.danger}>
      {archived ? (
        <div className={s.dangerRow}>
          <button
            type="button" disabled={busy} onClick={unarchive}
            className={`${ui.btn} ${s.archiveBtn}`}
          >
            Odarchivovat
          </button>
          <button
            type="button" disabled={busy} onClick={remove}
            className={`${ui.btn} ${s.deleteBtn}`}
          >
            Smazat akci
          </button>
        </div>
      ) : (
        <button
          type="button" disabled={busy} onClick={archive}
          className={`${ui.btn} ${s.archiveBtn}`}
        >
          Archivovat akci
        </button>
      )}
      {error && <p className={s.dangerError}>{error}</p>}
    </section>
  )
}
