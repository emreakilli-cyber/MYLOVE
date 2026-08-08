/**
 * TCKN tespiti — plan M2.1.
 *
 * 11 hane yeterli değil; resmî doğrulama algoritması uygulanır. Geçmeyen aday
 * maskelenmez (yanlış pozitif, esas numarası ya da müşteri numarası olabilir)
 * ama `suspects` listesine düşer — SPEC §7/3.
 */

import type { EntitySpan, SuspectSpan } from '../../types/entities'
import { hasDigitNeighbour, span, suspect, type RuleResult } from './shared'

const CANDIDATE = /\d{11}/g

/**
 * Resmî TCKN doğrulaması:
 *   - ilk hane 0 olamaz
 *   - 10. hane = ((tek konumların toplamı × 7) − çift konumların toplamı) mod 10
 *   - 11. hane = ilk 10 hanenin toplamı mod 10
 */
export function isValidTckn(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  const digits: number[] = []
  for (const char of value) digits.push(Number(char))
  if (digits[0] === 0) return false

  let odd = 0
  let even = 0
  for (let index = 0; index < 9; index += 1) {
    const digit = digits[index] ?? 0
    if (index % 2 === 0) odd += digit
    else even += digit
  }

  const tenth = (odd * 7 - even) % 10
  if (((tenth + 10) % 10) !== digits[9]) return false

  let sum = 0
  for (let index = 0; index < 10; index += 1) sum += digits[index] ?? 0
  return sum % 10 === digits[10]
}

export function detectTckn(text: string): RuleResult {
  const spans: EntitySpan[] = []
  const suspects: SuspectSpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    // 11 haneden uzun bir rakam dizisinin içinden kesit almayalım.
    if (hasDigitNeighbour(text, start, end)) continue

    if (isValidTckn(match[0])) {
      spans.push(span(text, start, end, 'TCKN', match[0], 1))
    } else {
      suspects.push(
        suspect(text, start, end, 'TCKN', 'On bir hane ama doğrulama algoritmasından geçmiyor'),
      )
    }
  }

  return { spans, suspects }
}
