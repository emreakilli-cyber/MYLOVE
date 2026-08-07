/**
 * `MaskGuard` — plan M7.2 / M7.3.
 *
 * Araştırma katmanı, `CAPABILITIES.md` A6 gereği internete çıkan TEK modüldür.
 * Bu dosya o kapının kilididir.
 *
 * Kural: kapıdan geçen metinde kural katmanının tanıdığı bir kimlik verisi
 * varsa **hata fırlatılır**. Uyarı verilmez, temizlenmez, sessizce geçilmez —
 * çünkü "temizleyip gönder" davranışı, maskeleme akışını atlamayı ödüllendirir
 * ve maske tablosu olmadan geri dönüş de imkânsızdır.
 *
 * Kapı, kural katmanını **ters yönde** koşar: maskeleme neyi bulup gizliyorsa,
 * kapı da aynı şeyi bulup engeller. Böylece iki taraf birbirinden ayrı düşemez;
 * yeni bir tip eklendiğinde kapı da kendiliğinden öğrenir.
 */

import { runNer } from '../mask/ner'
import type { NerBackend } from '../mask/ner/types'
import { runRuleLayer } from '../mask/rules'
import type { EntityType } from '../types/entities'

export interface GuardFinding {
  readonly type: EntityType
  readonly start: number
  readonly end: number
  /** Ham değer BİLEREK taşınmaz — hata nesnesi de sızıntı yüzeyidir. */
  readonly preview: string
}

export class UnmaskedContentError extends Error {
  override readonly name = 'UnmaskedContentError'
  readonly findings: readonly GuardFinding[]

  constructor(findings: readonly GuardFinding[]) {
    const types = [...new Set(findings.map((finding) => finding.type))].join(', ')
    super(
      `Maskelenmemiş kimlik verisi taşıyan metin ağa çıkamaz. Bulunan tipler: ${types}. ` +
        'Önce mask() uygulayın (SPEC S3).',
    )
    this.findings = findings
  }
}

export interface GuardOptions {
  /**
   * Ad/kurum/adres de denetlensin diye. Verilmezse kapı yalnız desenli tipleri
   * görür — bu bir zayıflıktır ve `SPEC.md` §7/2'de yazılıdır.
   */
  readonly ner?: NerBackend
}

/** İlk ve son karakter dışında her şeyi gizler: `05••••••••33`. */
function preview(value: string): string {
  if (value.length <= 4) return '•'.repeat(value.length)
  return `${value.slice(0, 2)}${'•'.repeat(value.length - 4)}${value.slice(-2)}`
}

export function findUnmaskedContent(
  text: string,
  options: GuardOptions = {},
): readonly GuardFinding[] {
  const rules = runRuleLayer(text)
  const ner = options.ner ? runNer(text, rules.spans, options.ner) : []

  return [...rules.spans, ...ner]
    .sort((a, b) => a.start - b.start)
    .map((span) => ({
      type: span.type,
      start: span.start,
      end: span.end,
      preview: preview(span.text),
    }))
}

/**
 * Kapının kendisi. Ağa çıkan her yol bunu çağırmak zorundadır.
 * Geçerse sessizdir; geçmezse `UnmaskedContentError` fırlatır.
 */
export function assertMasked(text: string, options: GuardOptions = {}): void {
  const findings = findUnmaskedContent(text, options)
  if (findings.length > 0) throw new UnmaskedContentError(findings)
}
