'use client'

import { useState, useTransition } from 'react'
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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const run = (
    fn: () => Promise<{ error?: string }>,
    after: () => void,
  ) => {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res?.error) {
        setError(res.error)
        return
      }
      after()
    })
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
            type="button" disabled={isPending} onClick={unarchive}
            className={`${ui.btn} ${s.archiveBtn}`}
          >
            Odarchivovat
          </button>
          <button
            type="button" disabled={isPending} onClick={remove}
            className={`${ui.btn} ${s.deleteBtn}`}
          >
            Smazat akci
          </button>
        </div>
      ) : (
        <button
          type="button" disabled={isPending} onClick={archive}
          className={`${ui.btn} ${s.archiveBtn}`}
        >
          Archivovat akci
        </button>
      )}
      {error && <p className={s.dangerError}>{error}</p>}
    </section>
  )
}
