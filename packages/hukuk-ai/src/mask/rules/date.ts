/**
 * Tarih tespiti — plan M2.5.
 *
 * `TARIH`, SPEC §7/8 gereği kapatılabilen tek tiptir: bütün tarihler
 * maskelendiğinde kronoloji okunmaz hâle gelebilir. Karar kullanıcınındır.
 *
 * Eşleme anahtarı ISO biçime (`YYYY-MM-DD`) normalleştirilir; böylece
 * `12.03.2024` ile `12 Mart 2024` aynı maskeye düşer.
 */

import type { EntitySpan } from '../../types/entities'
import { span, type RuleResult } from './shared'

const MONTH_NAMES = [
  'ocak',
  'şubat',
  'mart',
  'nisan',
  'mayıs',
  'haziran',
  'temmuz',
  'ağustos',
  'eylül',
  'ekim',
  'kasım',
  'aralık',
] as const

const NUMERIC = /(\b[0-3]?[0-9])[./-]([01]?[0-9])[./-]((?:19|20)[0-9]{2})\b/g
const ISO = /\b((?:19|20)[0-9]{2})-([01][0-9])-([0-3][0-9])\b/g
const TEXTUAL = new RegExp(
  String.raw`\b([0-3]?[0-9])\s+(${MONTH_NAMES.join('|')})\s+((?:19|20)[0-9]{2})\b`,
  'gi',
)

function isRealDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= daysInMonth
}

function isoKey(day: number, month: number, year: number): string {
  const paddedMonth = String(month).padStart(2, '0')
  const paddedDay = String(day).padStart(2, '0')
  return `${year}-${paddedMonth}-${paddedDay}`
}

function collect(
  text: string,
  pattern: RegExp,
  read: (match: RegExpExecArray) => { day: number; month: number; year: number } | undefined,
  spans: EntitySpan[],
): void {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const parts = read(match)
    if (!parts) continue
    if (!isRealDate(parts.day, parts.month, parts.year)) continue

    const start = match.index
    const end = start + match[0].length
    spans.push(span(text, start, end, 'TARIH', isoKey(parts.day, parts.month, parts.year), 1))
  }
}

export function detectDate(text: string): RuleResult {
  const spans: EntitySpan[] = []

  collect(text, NUMERIC, (match) => {
    const [, day, month, year] = match
    if (day === undefined || month === undefined || year === undefined) return undefined
    return { day: Number(day), month: Number(month), year: Number(year) }
  }, spans)

  collect(text, ISO, (match) => {
    const [, year, month, day] = match
    if (day === undefined || month === undefined || year === undefined) return undefined
    return { day: Number(day), month: Number(month), year: Number(year) }
  }, spans)

  collect(text, TEXTUAL, (match) => {
    const [, day, monthName, year] = match
    if (day === undefined || monthName === undefined || year === undefined) return undefined
    const monthIndex = MONTH_NAMES.indexOf(
      monthName.toLocaleLowerCase('tr') as (typeof MONTH_NAMES)[number],
    )
    if (monthIndex < 0) return undefined
    return { day: Number(day), month: monthIndex + 1, year: Number(year) }
  }, spans)

  return { spans, suspects: [] }
}
