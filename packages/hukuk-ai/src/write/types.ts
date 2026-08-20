/**
 * Yazma katmanı ortak tipleri — plan M8.
 *
 * `CAPABILITIES.md` A8/A9/A13: üslup öğrenme sırası **(a) iskelet → (b) üslup
 * profili → (c) few-shot**, üretim ise iskelet → bölüm bölüm → tutarlılık
 * geçişi. Bu dosya, o sıranın paylaştığı sayısal/istatistik tipleri taşır.
 */

/** Bir sayı kümesinin özeti — üslup profilindeki her ölçü bu şekle döner. */
export interface Distribution {
  readonly count: number
  readonly mean: number
  readonly min: number
  readonly max: number
}

const EMPTY_DISTRIBUTION: Distribution = { count: 0, mean: 0, min: 0, max: 0 }

export function distributionOf(values: readonly number[]): Distribution {
  if (values.length === 0) return EMPTY_DISTRIBUTION

  let sum = 0
  let min = values[0] as number
  let max = values[0] as number
  for (const value of values) {
    sum += value
    if (value < min) min = value
    if (value > max) max = value
  }
  return { count: values.length, mean: sum / values.length, min, max }
}

/**
 * İki dağılımı ağırlıklı ortalamayla birleştirir (M8.4 — artımlı üretim).
 * Belge belge işlenip biriktirilebilmesi için bu birleşme çağrısız, sırasız
 * ve tekrar uygulanabilir olmak zorunda: `merge(merge(a,b),c) === merge(a,merge(b,c))`.
 */
export function mergeDistribution(a: Distribution, b: Distribution): Distribution {
  const count = a.count + b.count
  if (count === 0) return EMPTY_DISTRIBUTION
  if (a.count === 0) return b
  if (b.count === 0) return a

  return {
    count,
    mean: (a.mean * a.count + b.mean * b.count) / count,
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
  }
}

/** Bir kalıp ifadenin/terimin gözlenen geçiş sayısı. */
export interface PhraseFrequency {
  readonly phrase: string
  readonly count: number
}

/** İki frekans listesini toplar; sıra ilk gözlem sırasına göre kararlıdır. */
export function mergeFrequencies(
  a: readonly PhraseFrequency[],
  b: readonly PhraseFrequency[],
): readonly PhraseFrequency[] {
  const order: string[] = []
  const counts = new Map<string, number>()

  for (const { phrase, count } of [...a, ...b]) {
    if (!counts.has(phrase)) order.push(phrase)
    counts.set(phrase, (counts.get(phrase) ?? 0) + count)
  }

  return order.map((phrase) => ({ phrase, count: counts.get(phrase) as number }))
}
