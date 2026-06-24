import { signIn } from '@/auth/config'

export default function SignIn() {
  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Přihlášení</h1>
      {process.env.AUTH_GOOGLE_ID && (
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/boards' }) }}>
          <button type="submit">Přihlásit se přes Google</button>
        </form>
      )}
      <form
        action={async (fd) => { 'use server'; await signIn('nodemailer', { email: fd.get('email'), redirectTo: '/boards' }) }}
        style={{ marginTop: '1rem' }}
      >
        <input type="email" name="email" placeholder="vas@email.cz" required />
        <button type="submit">Poslat přihlašovací odkaz</button>
      </form>
    </main>
  )
}
