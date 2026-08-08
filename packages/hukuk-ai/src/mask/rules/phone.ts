/**
 * Telefon tespiti — plan M2.3.
 *
 * Desteklenen yazımlar: `+90 532 111 22 33`, `0090…`, `0532 111 22 33`,
 * `0(212) 444 55 66`, `(0212) 444 55 66`, `532 111 22 33`, ayırıcı olarak
 * boşluk/nokta/tire.
 *
 * Bilinen sınır: alan kodu başında sıfır olmayan sabit hat (`212 444 55 66`)
 * bilerek yakalanmıyor — on haneli herhangi bir sayıyla ayırt edilemez ve
 * yanlış pozitif üretir. Mobil (`5xx…`) sıfırsız da yakalanır.
 */

import type { EntitySpan } from '../../types/entities'
import { digitsOnly, hasDigitNeighbour, span, type RuleResult } from './shared'

const BODY = String.raw`\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}`

const CANDIDATE = new RegExp(
  [
    String.raw`(?:\+90|0090)[ ]?0?${BODY}`,
    String.raw`\(0\d{3}\)[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}`,
    String.raw`0[ ]?${BODY}`,
    String.raw`5\d{2}[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}`,
  ].join('|'),
  'g',
)

/** Ülke kodu / baştaki sıfır soyulduktan sonra 10 hane ve geçerli alan kodu. */
export function normalizePhone(raw: string): string | undefined {
  let digits = digitsOnly(raw)
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2)
  if (digits.length === 13 && digits.startsWith('0090')) digits = digits.slice(4)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length !== 10) return undefined

  const first = digits[0]
  if (first !== '2' && first !== '3' && first !== '4' && first !== '5') return undefined
  return digits
}

export function detectPhone(text: string): RuleResult {
  const spans: EntitySpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const raw = match[0]
    const start = match.index
    const end = start + raw.length
    if (hasDigitNeighbour(text, start, end)) continue

    const normalized = normalizePhone(raw)
    if (normalized === undefined) continue

    spans.push(span(text, start, end, 'TEL', normalized, 0.95))
  }

  return { spans, suspects: [] }
}
