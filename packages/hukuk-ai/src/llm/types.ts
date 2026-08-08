/**
 * Cihaz içi model arayüzü — plan M7.6 ve M8'in ortak zemini.
 *
 * `docs/MODEL.md` §3.2: telefonda 2 B sınıfı bir model, 4–8 K çalışma penceresi.
 * Bu dosya o modelin nasıl çağrılacağını tanımlar; hangi model olduğunu değil.
 *
 * SÖZLEŞME: uygulamalar ağa çıkamaz. `runsLocally` sabiti bunu tip düzeyinde
 * yazar, testler dosya taramasıyla doğrular.
 *
 * ## Bağlam bütçesi neden ZORLANIYOR
 *
 * `CAPABILITIES.md` A6 ve A10–A13'ün tamamı tek bir varsayıma dayanıyor: hiçbir
 * çağrı uzun bağlam istemez, iş K bağımsız kısa geçişe bölünür. Bu varsayım
 * çağıranın iyi niyetine bırakılırsa er geç biri "hepsini tek seferde verelim"
 * der ve mimari sessizce çöker — telefonda çalışmayan bir kod yolu ortaya çıkar,
 * ama bunu ancak cihazda fark ederiz.
 *
 * Bu yüzden bütçe aşımı bir uyarı değil, `ContextBudgetError` fırlatır.
 */

export class ContextBudgetError extends Error {
  override readonly name = 'ContextBudgetError'
  readonly estimatedTokens: number
  readonly budgetTokens: number

  constructor(estimatedTokens: number, budgetTokens: number) {
    super(
      `Tek geçişte ${estimatedTokens} token isteniyor ama bütçe ${budgetTokens}. ` +
        'İş parçalara bölünmeli (CAPABILITIES.md §A.0).',
    )
    this.estimatedTokens = estimatedTokens
    this.budgetTokens = budgetTokens
  }
}

export interface GenerateRequest {
  readonly prompt: string
  readonly maxOutputTokens?: number
}

export interface LocalModel {
  readonly id: string
  /** Ağ yasağının tip düzeyindeki karşılığı. */
  readonly runsLocally: true
  /** Bu modelin tek geçişte kaldırabileceği token sayısı (girdi + çıktı). */
  readonly contextTokens: number
  generate(request: GenerateRequest): Promise<string>
}

/**
 * Kaba token tahmini. Gerçek tokenizer modele bağlı ve cihazda; burada amaç
 * bütçe denetimi, birebir sayım değil.
 *
 * Türkçe sondan eklemeli olduğu için sözcükler birden çok token'a bölünür;
 * karakter başına ~1/3 token, İngilizce için kullanılan ~1/4'ten bilerek
 * daha kötümser. Bütçe denetiminde kötümser tahmin doğru taraftır.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3)
}

/** Bütçeyi aşan çağrıyı fırlatarak durdurur. */
export function assertWithinBudget(
  prompt: string,
  model: LocalModel,
  reservedForOutput: number,
): void {
  const estimated = estimateTokens(prompt) + reservedForOutput
  if (estimated > model.contextTokens) {
    throw new ContextBudgetError(estimated, model.contextTokens)
  }
}
