/**
 * Maske token dilbilgisi ve kaçış kuralı — `docs/SPEC.md` §3.
 *
 * Gerçek token'lar hiçbir zaman '!' içermez. Kullanıcı metninde doğal olarak
 * geçen token benzeri dizgeler maskeleme öncesi bir '!' eklenerek kaçışlanır,
 * unmask sonunda bir '!' silinerek geri alınır. Bu çift bir eşlemedir
 * (bijection), dolayısıyla SPEC S1 (birebirlik) korunur.
 */

import type { EntityType } from '../types/entities'

/** Gerçek maske token'ı: `[TIP_N]`, N baştan sıfırsız ve 1'den başlar. */
export const TOKEN_PATTERN = /\[([A-Z]{2,12})_([1-9][0-9]*)\]/g

/** Kaçışlanacak aday: token benzeri, önünde sıfır veya daha çok '!' olabilir. */
const ESCAPE_PATTERN = /\[(!*)([A-Z]{2,12}_[1-9][0-9]*)\]/g

/** Kaçışı çözülecek dizge: en az bir '!' taşır. */
const UNESCAPE_PATTERN = /\[!(!*)([A-Z]{2,12}_[1-9][0-9]*)\]/g

export function buildToken(type: EntityType, ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new RangeError(`Maske sıra numarası 1 veya daha büyük olmalı: ${ordinal}`)
  }
  return `[${type}_${ordinal}]`
}

/**
 * Maskeleme öncesi kaçışlama (SPEC §3.2). Her token benzeri dizgeye bir '!'
 * eklenir; zaten kaçışlanmış olanlar bir kat daha kaçışlanır.
 */
export function escapeLiteralTokens(text: string): string {
  return text.replace(ESCAPE_PATTERN, (_match, bangs: string, body: string) => {
    return `[!${bangs}${body}]`
  })
}

/** Unmask sonrası kaçış çözme (SPEC §3.2). Tam olarak bir '!' silinir. */
export function unescapeLiteralTokens(text: string): string {
  return text.replace(UNESCAPE_PATTERN, (_match, bangs: string, body: string) => {
    return `[${bangs}${body}]`
  })
}

/** Bir dizgenin gerçek maske token'ı olup olmadığı. */
export function isMaskToken(candidate: string): boolean {
  const pattern = new RegExp(`^${TOKEN_PATTERN.source}$`)
  return pattern.test(candidate)
}
