import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}))
import nodemailer from 'nodemailer'
import { sendReportEmail } from './deliver'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  vi.clearAllMocks()
  process.env.EMAIL_SERVER = 'smtp://user:pass@smtp.example.com:587'
  process.env.EMAIL_FROM = 'Platebnik <login@platebnik.cz>'
  delete process.env.REPORT_RECIPIENT
})
afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('sendReportEmail', () => {
  test('sends to the default recipient with the given subject/body', async () => {
    await sendReportEmail('Ranní přehled', 'tělo')
    expect(nodemailer.createTransport).toHaveBeenCalledWith('smtp://user:pass@smtp.example.com:587')
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Platebnik <login@platebnik.cz>',
      to: 'tomas@sorejs.cz',
      subject: 'Ranní přehled',
      text: 'tělo',
    })
  })

  test('honours REPORT_RECIPIENT override', async () => {
    process.env.REPORT_RECIPIENT = 'someone@else.cz'
    await sendReportEmail('S', 'B')
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'someone@else.cz' }))
  })

  test('throws when EMAIL_SERVER is missing', async () => {
    delete process.env.EMAIL_SERVER
    await expect(sendReportEmail('S', 'B')).rejects.toThrow('EMAIL_SERVER')
  })
})
