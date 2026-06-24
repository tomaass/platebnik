import { DrizzleAdapter } from '@auth/drizzle-adapter'
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'
import { redirect } from 'next/navigation'
import { db } from '@/db/client'
import { accounts, sessions, users, verificationTokens } from '@/db/schema'

const devSendVerificationRequest = async ({
  identifier,
  url,
}: {
  identifier: string
  url: string
  // eslint-disable-next-line @typescript-eslint/require-await
}) => {
  console.log('\n[dev] Magic link pro ' + identifier + ':\n' + url + '\n')
}

const nodemailerProvider = Nodemailer({
  server: process.env.EMAIL_SERVER || 'smtp://localhost:1025',
  from: process.env.EMAIL_FROM ?? 'Platebnik <login@platebnik.cz>',
  ...(process.env.EMAIL_SERVER ? {} : { sendVerificationRequest: devSendVerificationRequest }),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    nodemailerProvider,
  ],
  pages: { signIn: '/signin' },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
  },
})

export const requireUser = async (): Promise<{ id: string; email: string }> => {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) redirect('/signin')
  return { id: session.user.id, email: session.user.email }
}
