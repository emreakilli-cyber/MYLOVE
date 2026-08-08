/**
 * E-posta tespiti — plan M2.7.
 *
 * RFC 5322'nin tamamı değil, pratikte karşılaşılan biçim. Eşleme anahtarı
 * küçültülür (SPEC §4.1), böylece `Av.Ahmet@Ornek.COM` ile `av.ahmet@ornek.com`
 * aynı maskeye düşer.
 */

import type { EntitySpan } from '../../types/entities'
import { span, type RuleResult } from './shared'

const CANDIDATE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/g

export function detectEmail(text: string): RuleResult {
  const spans: EntitySpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const raw = match[0]
    const start = match.index
    const end = start + raw.length
    spans.push(span(text, start, end, 'EPOSTA', raw.toLocaleLowerCase('tr'), 1))
  }

  return { spans, suspects: [] }
}
