import { signIn } from '@/auth/config'
import ui from '@/design/ui.module.css'
import s from '../auth.module.css'

export default function SignIn() {
  return (
    <main className={s.page}>
      <h1 className={s.title}>Přihlášení</h1>
      {process.env.AUTH_GOOGLE_ID && (
        <form className={s.form} action={async () => { 'use server'; await signIn('google', { redirectTo: '/boards' }) }}>
          <button type="submit" className={`${ui.btn} ${ui.btnGhost}`}>Přihlásit se přes Google</button>
        </form>
      )}
      <div className={s.divider}>nebo e-mailem</div>
      <form
        className={s.form}
        action={async (fd) => { 'use server'; await signIn('nodemailer', { email: fd.get('email'), redirectTo: '/boards' }) }}
      >
        <input className={ui.field} type="email" name="email" placeholder="vas@email.cz" required />
        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>Poslat přihlašovací odkaz</button>
      </form>
    </main>
  )
}
