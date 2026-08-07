/**
 * NER katmanı arayüzü — plan M3.1 / M3.2.
 *
 * Katman model bağımsızdır: cihazdaki sözlük tabanlı varsayılan uygulama da,
 * ileride gelecek BERTurk token sınıflandırıcı da aynı arayüzü uygular
 * (`docs/MODEL.md` §3.1).
 *
 * SÖZLEŞME (M3.6): bu arayüzü uygulayan hiçbir şey ağa çıkamaz. `runsLocally`
 * alanı `true` sabitidir; bunu yazamayan bir uygulama derlenmez. Ağ yasağı
 * ayrıca testle doğrulanır.
 */

import type { EntityType } from '../../types/entities'

/** NER katmanının üretebileceği tipler — kural katmanı tipleri buraya girmez. */
export type NerEntityType = Extract<EntityType, 'KISI' | 'KURUM' | 'ADRES' | 'ISYERI'>

export interface NerCandidate {
  /** Konum, kaçışlanmış TAM metne göredir; boşluk aralığına göre değil. */
  readonly start: number
  readonly end: number
  readonly type: NerEntityType
  readonly confidence: number
  /**
   * Ek soyulduktan sonraki eşleme anahtarı (SPEC §4.1). Verilmezse maskeleme
   * katmanı ham metinden üretir.
   */
  readonly key?: string
  /** SPEC §7/7 — hangi varlık olduğu belirsiz. Tahmin edilmez, işaretlenir. */
  readonly ambiguous?: boolean
  /** Belirsizse aday varlıkların anahtarları. */
  readonly candidates?: readonly string[]
}

/** Kural katmanının dokunmadığı, NER'e açık aralık. */
export interface FreeRegion {
  readonly start: number
  readonly end: number
}

export interface NerBackend {
  readonly id: string
  /** Ağ erişimi yasağının tip düzeyindeki karşılığı (M3.6). */
  readonly runsLocally: true
  detect(text: string, regions: readonly FreeRegion[]): readonly NerCandidate[]
}

/** Model tabanlı uygulamalar için — çıkarım eşzamansızdır. */
export interface AsyncNerBackend {
  readonly id: string
  readonly runsLocally: true
  detect(text: string, regions: readonly FreeRegion[]): Promise<readonly NerCandidate[]>
}
