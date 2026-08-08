/**
 * Kural katmanı — plan M2.
 *
 * Tüm deterministik dedektörler koşar, sonuçlar birleşir. Çakışma çözümü
 * burada YAPILMAZ; NER katmanı da eklendikten sonra tek elden yapılır
 * (SPEC §6), yoksa kural içi çakışma ile kural–NER çakışması farklı kurallara
 * tabi olurdu.
 */

import type { EntitySpan, SuspectSpan } from '../../types/entities'
import { detectCaseNumber } from './caseNo'
import { detectDate } from './date'
import { detectEmail } from './email'
import { detectIban } from './iban'
import { detectPhone } from './phone'
import { detectPlate } from './plate'
import { detectTckn } from './tckn'
import type { RuleDetector, RuleResult } from './shared'

export interface RuleLayerOptions {
  /**
   * Tarih maskeleme kapatılabilir — SPEC §7/8. Bütün tarihler maskelendiğinde
   * kronoloji okunmaz hâle gelebilir; karar kullanıcınındır.
   */
  readonly maskDates?: boolean
}

const ALWAYS_ON: readonly RuleDetector[] = [
  detectTckn,
  detectIban,
  detectCaseNumber,
  detectEmail,
  detectPlate,
  detectPhone,
]

export function runRuleLayer(text: string, options: RuleLayerOptions = {}): RuleResult {
  const detectors = options.maskDates === false ? ALWAYS_ON : [...ALWAYS_ON, detectDate]

  const spans: EntitySpan[] = []
  const suspects: SuspectSpan[] = []
  for (const detect of detectors) {
    const result = detect(text)
    spans.push(...result.spans)
    suspects.push(...result.suspects)
  }

  return { spans, suspects }
}

export { detectCaseNumber, detectDate, detectEmail, detectIban, detectPhone, detectPlate, detectTckn }
export { isValidTckn } from './tckn'
export { isValidIban } from './iban'
export { normalizePhone } from './phone'
export type { RuleDetector, RuleResult } from './shared'
