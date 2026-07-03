import nodemailer from 'nodemailer'

const RECIPIENT = () => process.env.REPORT_RECIPIENT ?? 'tomas@sorejs.cz'
const FROM = () => process.env.EMAIL_FROM ?? 'Platebnik <login@platebnik.cz>'

// Sends the digest over the same SMTP the magic-link emails use.
export async function sendReportEmail(subject: string, text: string): Promise<void> {
  const server = process.env.EMAIL_SERVER
  if (!server) throw new Error('EMAIL_SERVER not set')
  const transport = nodemailer.createTransport(server)
  await transport.sendMail({ from: FROM(), to: RECIPIENT(), subject, text })
}
