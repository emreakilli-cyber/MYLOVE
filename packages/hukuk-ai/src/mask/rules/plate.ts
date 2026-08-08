/**
 * Araç plakası tespiti — plan M2.4.
 *
 * Biçim: il kodu (01–81) + 1–3 harf + 2–5 rakam, harf/rakam sayısı birbirine
 * bağlı. Harfler yalnız BÜYÜK kabul edilir; küçük harfe izin vermek
 * "34 ada 123" gibi ifadelerde yanlış pozitif üretiyor.
 */

import type { EntitySpan } from '../../types/entities'
import { span, type RuleResult } from './shared'

const CANDIDATE = /(0[1-9]|[1-7][0-9]|8[01])[ ]?([A-Z]{1,3})[ ]?([0-9]{2,5})/g

/** Harf sayısına göre izin verilen rakam sayısı. */
const DIGIT_COUNT_BY_LETTERS: Readonly<Record<number, readonly number[]>> = {
  1: [4, 5],
  2: [3, 4],
  3: [2, 3],
}

function isWordChar(char: string | undefined): boolean {
  if (char === undefined) return false
  return /[0-9A-Za-zÇĞİÖŞÜçğıöşü]/.test(char)
}

export function detectPlate(text: string): RuleResult {
  const spans: EntitySpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const [raw, province, letters, digits] = match
    if (province === undefined || letters === undefined || digits === undefined) continue

    const allowed = DIGIT_COUNT_BY_LETTERS[letters.length]
    if (!allowed?.includes(digits.length)) continue

    const start = match.index
    const end = start + raw.length
    if (isWordChar(text[start - 1]) || isWordChar(text[end])) continue

    spans.push(span(text, start, end, 'PLAKA', `${province}${letters}${digits}`, 0.9))
  }

  return { spans, suspects: [] }
}
