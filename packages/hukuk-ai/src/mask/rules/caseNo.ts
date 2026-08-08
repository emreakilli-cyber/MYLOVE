/**
 * Dosya / esas / karar numarası tespiti — plan M2.6.
 *
 * `2024/1234` tek başına belirsizdir (tarih, oran, madde numarası olabilir).
 * Bu yüzden yalnız bağlam varsa maskelenir:
 *   - ardından gelen ek: `E.`, `K.`, `D.İş`, `Esas`, `Karar`
 *   - ya da öncesinde geçen: `Esas No`, `Karar No`, `Dosya No`
 */

import type { EntitySpan } from '../../types/entities'
import { collapseSpaces, span, type RuleResult } from './shared'

const CANDIDATE = /((?:19|20)[0-9]{2})\s*\/\s*([0-9]{1,6})/g

/** Numaradan sonra gelebilecek ek — eşleşirse aralığa dâhil edilir. */
const TRAILING = /^\s*(E\.|K\.|D\.\s?İş|Esas|Karar)/

/** Numaradan önce gelen anahtar sözcük. */
const LEADING = /(esas|karar|dosya)\s*(no)?\s*[:.]?\s*$/

export function detectCaseNumber(text: string): RuleResult {
  const spans: EntitySpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const [raw, year, sequence] = match
    if (year === undefined || sequence === undefined) continue

    const start = match.index
    let end = start + raw.length

    const trailing = TRAILING.exec(text.slice(end, end + 8))
    const leadingWindow = text.slice(Math.max(0, start - 24), start).toLocaleLowerCase('tr')
    const hasLeading = LEADING.test(leadingWindow)

    if (trailing) {
      end += trailing[0].length
    } else if (!hasLeading) {
      continue
    }

    const key = collapseSpaces(`${year}/${sequence}`)
    spans.push(span(text, start, end, 'ESAS', key, trailing ? 1 : 0.9))
  }

  return { spans, suspects: [] }
}
