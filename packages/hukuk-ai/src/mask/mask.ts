/**
 * Maskeleme ve geri alma — `docs/SPEC.md` §3, §5, §6.
 *
 * Akış (SPEC §6):
 *   1. kaçışlama  → kullanıcı metnindeki token benzeri dizgeler korunur
 *   2. kural katmanı (deterministik)
 *   3. NER katmanı — henüz bağlı değil (plan M3)
 *   4. çakışma çözümü
 *   5. sondan başa değiştirme
 *
 * Şu an yalnız kural katmanı bağlı; NER katmanı eklendiğinde 3. adım aynı
 * çakışma çözümüne beslenecek, kural sonuçları her zaman önce üretilecek (S5).
 */

import type { EntitySpan, SuspectSpan } from '../types/entities'
import { runNer, runNerAsync } from './ner'
import type { AsyncNerBackend, NerBackend } from './ner/types'
import { resolveOverlaps } from './overlap'
import { runRuleLayer } from './rules'
import { MaskTable } from './table'
import { TOKEN_PATTERN, escapeLiteralTokens, unescapeLiteralTokens } from './token'

export interface MaskOptions {
  /**
   * Var olan tabloya eklemek için — birden çok belge aynı dosyaya ait olduğunda
   * kişi kimliği belgeler arasında tutarlı kalsın diye (SPEC §4.2).
   */
  readonly table?: MaskTable
  /** SPEC §7/8 — tarih maskeleme kapatılabilen tek tiptir. */
  readonly maskDates?: boolean
  /**
   * NER katmanı. Verilmezse yalnız kural katmanı koşar — maskeleme yine çalışır,
   * ama yalnız desenli tipleri yakalar (SPEC §7/2).
   */
  readonly ner?: NerBackend
}

export interface MaskResult {
  readonly text: string
  readonly table: MaskTable
  /** Maskelenen aralıklar — konumlar KAÇIŞLANMIŞ metne göredir. */
  readonly spans: readonly EntitySpan[]
  /** Doğrulamadan geçemeyen adaylar (SPEC §7/3). Sessizce yutulmaz. */
  readonly suspects: readonly SuspectSpan[]
}

export interface UnmaskResult {
  readonly text: string
  /** Tabloda karşılığı olmayan token'lar (SPEC §5.1). Boş değilse kullanıcı uyarılır. */
  readonly unresolved: readonly string[]
}

export function mask(input: string, options: MaskOptions = {}): MaskResult {
  const table = options.table ?? new MaskTable()
  const escaped = escapeLiteralTokens(input)

  const ruleResult = runRuleLayer(
    escaped,
    options.maskDates === false ? { maskDates: false } : {},
  )
  // S5: kural katmanı önce, NER yalnız kalan boşluklarda.
  const nerSpans = options.ner ? runNer(escaped, ruleResult.spans, options.ner) : []
  return assemble(escaped, table, ruleResult.spans, nerSpans, ruleResult.suspects)
}

/**
 * Model tabanlı NER için eşzamansız sürüm. Cihaz içi çıkarım eşzamansızdır;
 * sözlük tabanlı varsayılan uygulama eşzamanlı olduğu için `mask()` senkron
 * kalabiliyor (`MODEL.md` §3.1).
 */
export interface MaskAsyncOptions extends Omit<MaskOptions, 'ner'> {
  readonly ner?: NerBackend | AsyncNerBackend
}

export async function maskAsync(
  input: string,
  options: MaskAsyncOptions = {},
): Promise<MaskResult> {
  const table = options.table ?? new MaskTable()
  const escaped = escapeLiteralTokens(input)

  const ruleResult = runRuleLayer(
    escaped,
    options.maskDates === false ? { maskDates: false } : {},
  )
  const nerSpans = options.ner
    ? await runNerAsync(escaped, ruleResult.spans, options.ner)
    : []
  return assemble(escaped, table, ruleResult.spans, nerSpans, ruleResult.suspects)
}

function assemble(
  escaped: string,
  table: MaskTable,
  ruleSpans: readonly EntitySpan[],
  nerSpans: readonly EntitySpan[],
  rawSuspects: readonly SuspectSpan[],
): MaskResult {
  const resolved = resolveOverlaps([...ruleSpans, ...nerSpans])

  let output = ''
  let cursor = 0
  for (const entity of resolved) {
    output += escaped.slice(cursor, entity.start)
    const token = table.tokenFor(entity.type, entity.key, entity.text, entity.start)
    // SPEC §7/7: belirsizlik tahmin edilmez, tabloya taşınır ve sorulur.
    if (entity.ambiguous) table.markAmbiguous(token, entity.candidates ?? [])
    output += token
    cursor = entity.end
  }
  output += escaped.slice(cursor)

  // Maskelenmiş bir aralığın içinde kalan şüpheli aday artık şüpheli değildir.
  const suspects = rawSuspects.filter(
    (item) => !resolved.some((entity) => item.start < entity.end && entity.start < item.end),
  )

  return { text: output, table, spans: resolved, suspects }
}

/**
 * Token'ları ham metne çevirir.
 *
 * Aynı token'ın n'inci geçişi, tabloda kayıtlı n'inci ham yazımla değiştirilir;
 * böylece aynı varlığın farklı yazımları (`12.03.2024` / `12 Mart 2024`) birebir
 * geri gelir ve SPEC S1 sağlanır. Kayıttan fazla geçiş varsa — model çıktısında
 * token tekrarlanmış olabilir — kanonik yazıma düşülür.
 *
 * Bilinmeyen token aynen bırakılır ve `unresolved` listesine yazılır; hata
 * fırlatılmaz, çökme olmaz (SPEC §5.1).
 */
export function unmask(text: string, table: MaskTable): UnmaskResult {
  const seen = new Map<string, number>()
  const unresolved = new Set<string>()

  const substituted = text.replace(TOKEN_PATTERN, (token: string) => {
    const nth = seen.get(token) ?? 0
    seen.set(token, nth + 1)

    const surface = table.surfaceAt(token, nth)
    if (surface === undefined) {
      unresolved.add(token)
      return token
    }
    return surface
  })

  return {
    text: unescapeLiteralTokens(substituted),
    unresolved: [...unresolved],
  }
}
