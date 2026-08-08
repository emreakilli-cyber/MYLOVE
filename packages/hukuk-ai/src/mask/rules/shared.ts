/**
 * Kural katmanı ortak yardımcıları — plan M2.
 *
 * Kural katmanı deterministiktir: desen + (varsa) doğrulama algoritması.
 * Doğrulaması olan bir tip doğrulamadan geçmiyorsa MASKELENMEZ, ama sessizce
 * de yutulmaz — `suspects` listesine düşer ve M11 kapısı kullanıcıya gösterir
 * (SPEC §7/3).
 */

import type { EntitySpan, EntityType, SuspectSpan } from '../../types/entities'

export interface RuleResult {
  readonly spans: readonly EntitySpan[]
  readonly suspects: readonly SuspectSpan[]
}

export type RuleDetector = (text: string) => RuleResult

export const EMPTY_RESULT: RuleResult = { spans: [], suspects: [] }

/**
 * Eşleşmenin iki yanında rakam var mı. Lookbehind kullanmadan sınır denetimi —
 * eski Safari sürümlerinde de çalışsın diye bilerek elle yapılıyor.
 */
export function hasDigitNeighbour(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined
  const after = end < text.length ? text[end] : undefined
  return isDigit(before) || isDigit(after)
}

export function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

/** Yalnız rakamları bırakır — TCKN/IBAN/telefon normalleştirmesi. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Türkçe kurala göre büyütür (`i` → `İ`, `ı` → `I`). SPEC §4.1. */
export function upperTr(value: string): string {
  return value.toLocaleUpperCase('tr')
}

/** Ardışık boşlukları teke indirir ve uçları kırpar. */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function span(
  text: string,
  start: number,
  end: number,
  type: EntityType,
  key: string,
  confidence: number,
): EntitySpan {
  return {
    start,
    end,
    text: text.slice(start, end),
    type,
    layer: 'rule',
    key,
    confidence,
  }
}

export function suspect(
  text: string,
  start: number,
  end: number,
  type: EntityType,
  reason: string,
): SuspectSpan {
  return { start, end, text: text.slice(start, end), type, reason }
}
