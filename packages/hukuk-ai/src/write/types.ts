/**
 * Yazma katmanı ortak arayüzü — plan M8, `docs/CAPABILITIES.md` A7/A8/A9/A13.
 *
 * `docs/MODEL.md` §3.2 gereği üretim yerel bir modeldir; ağ hiç yok (M8.1).
 * `WriteBackend`, NER katmanındaki `NerBackend` ile aynı desendir: paket
 * modeli kendisi taşımaz, `runsLocally: true` sabiti ağ yasağını tip
 * düzeyinde taşır ve backend uygulaması dışarıdan (uygulama katmanından)
 * verilir.
 */

export interface GenerateOptions {
  /** Aşılırsa backend'e bırakılır; paket kendi tarafında yalnız tahmin eder. */
  readonly maxTokens?: number
}

export interface WriteBackend {
  readonly id: string
  readonly runsLocally: true
  generate(prompt: string, options?: GenerateOptions): string | Promise<string>
}

/**
 * Kaba token tahmini — gerçek bir tokenizer değil. Bağlam bütçesi kararları
 * (A9 ≤ 2.000 token, A13 bölüm penceresi ≤ 2.000 token) için üst sınır
 * denetimidir; kesin sayım seçilen modele göre değişir ve backend'in işidir.
 * Türkçe için ortalama ~4 karakter/token kabul edilir (SPEC dışı, belgelenmiş
 * bir sadeleştirme).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
