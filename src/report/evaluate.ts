import { generateText } from 'ai'
import type { Metrics } from './types'

// AI Gateway model slug — cheap/fast, enough for a daily digest.
const MODEL = 'anthropic/claude-haiku-4-5-20251001'

const buildPrompt = (m: Metrics): string =>
  [
    'Jsi asistent, který každé ráno píše stručný český přehled o webu platebník.cz',
    '(appka na rozúčtování útraty v partě — hosté dělají „boardy“ s ceníkem a lidé',
    'platí QR platbou). Dostaneš JSON s metrikami za včerejšek a 7denní denní průměr.',
    '',
    'Napiš krátký ranní přehled česky:',
    '- první řádek: celkový stav jedním z 🟢 vše OK / 🟡 hlídat / 🔴 problém,',
    '- pak klíčová čísla (noví lidé, boardy vytvořené/podepsané/zaplacené, tisky)',
    '  s porovnáním na 7denní průměr,',
    '- pak sekci „Co si zaslouží pozornost“: vypíchni odchylky (nula registrací,',
    '  propad konverze created→signed→paid, render_ms p95 nad ~3000 ms, otevřené bugy).',
    'Buď stručný a konkrétní — je to glanceable ranní e-mail, ne esej.',
    'Pokud je některá sekce {"error": …}, zmiň, že se data nepodařilo načíst.',
    '',
    'Data (JSON):',
    JSON.stringify(m, null, 2),
  ].join('\n')

// Plain-text dump so the morning email still arrives if the model call fails.
export function rawFallback(m: Metrics): string {
  return `Ranní přehled platebník.cz (${m.date}) — surová data (AI vyhodnocení selhalo):\n${JSON.stringify(m, null, 2)}`
}

export async function evaluateMetrics(m: Metrics): Promise<string> {
  try {
    const { text } = await generateText({ model: MODEL, prompt: buildPrompt(m) })
    return text
  } catch (e) {
    console.error('[daily-report] evaluation failed, using raw fallback:', e)
    return rawFallback(m)
  }
}
