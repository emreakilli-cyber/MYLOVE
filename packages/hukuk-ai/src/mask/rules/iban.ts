/**
 * IBAN tespiti — plan M2.2.
 *
 * TR IBAN'ı 26 karakterdir: "TR" + 2 kontrol + 5 banka + 1 rezerv + 16 hesap.
 * Boşluklu ve boşluksuz yazım desteklenir.
 *
 * Aday deseni bilerek geniş tutuluyor: hane eksik/fazla yazılmış bir IBAN
 * maskelenmez ama `suspects` listesine düşer, çünkü insan gözüyle hâlâ
 * okunabilir bir hesap numarasıdır (SPEC §7/3).
 */

import type { EntitySpan, SuspectSpan } from '../../types/entities'
import { span, suspect, upperTr, type RuleResult } from './shared'

/** TR + en az 18, en çok 28 hane/boşluk. Satır atlamaz. */
const CANDIDATE = /TR ?\d{2}[\d ]{18,28}/gi

const TR_IBAN_LENGTH = 26

/** Harf → sayı (A=10 … Z=35), sonra 97'ye bölümden kalan 1 olmalı. */
export function isValidIban(raw: string): boolean {
  const normalized = upperTr(raw).replace(/\s/g, '')
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) return false
  if (normalized.length < 15 || normalized.length > 34) return false

  const rearranged = normalized.slice(4) + normalized.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const chunk = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of chunk) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder === 1
}

export function detectIban(text: string): RuleResult {
  const spans: EntitySpan[] = []
  const suspects: SuspectSpan[] = []

  CANDIDATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CANDIDATE.exec(text)) !== null) {
    const raw = match[0]
    const trimmed = raw.replace(/ +$/, '')
    const start = match.index
    const end = start + trimmed.length
    const compact = upperTr(trimmed).replace(/ /g, '')

    if (compact.length !== TR_IBAN_LENGTH) {
      suspects.push(
        suspect(
          text,
          start,
          end,
          'IBAN',
          `TR IBAN ${TR_IBAN_LENGTH} karakter olmalı, ${compact.length} bulundu`,
        ),
      )
      continue
    }

    if (isValidIban(compact)) {
      spans.push(span(text, start, end, 'IBAN', compact, 1))
    } else {
      suspects.push(suspect(text, start, end, 'IBAN', 'mod-97 kontrol hanesi tutmuyor'))
    }
  }

  return { spans, suspects }
}
