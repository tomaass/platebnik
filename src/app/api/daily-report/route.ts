import { gatherMetrics } from '@/report/gather'
import { evaluateMetrics } from '@/report/evaluate'
import { sendReportEmail } from '@/report/deliver'

// nodemailer + fetch need Node; the Claude call can take a while.
export const runtime = 'nodejs'
export const maxDuration = 60

// ISO date (YYYY-MM-DD) and a human "3. 7." label, both in Prague time.
const pragueIsoDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
const pragueHumanDate = (): string =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Prague' }).format(new Date())

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const metrics = await gatherMetrics(pragueIsoDate())
    const body = await evaluateMetrics(metrics)
    await sendReportEmail(`Platebník — ranní přehled (${pragueHumanDate()})`, body)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[daily-report] failed to build/send report:', e)
    return new Response('Report failed', { status: 500 })
  }
}
