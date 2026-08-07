/**
 * Varlık tipleri ve aralık (span) modeli — `docs/SPEC.md` §2.
 *
 * Tip kodları Türkçedir çünkü maske token'ları cihaz içi Türkçe dil modeline
 * giden metnin içinde yer alır (SPEC §2). Bunlar veri değeridir, tanımlayıcı
 * değil; kod tarafındaki isimler İngilizce kalır.
 */

export const ENTITY_TYPES = [
  'TCKN',
  'IBAN',
  'TEL',
  'EPOSTA',
  'PLAKA',
  'ESAS',
  'TARIH',
  'KISI',
  'KURUM',
  'ISYERI',
  'ADRES',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/** Varlığı hangi katman buldu. SPEC §6. */
export type DetectionLayer = 'rule' | 'ner' | 'manual'

/**
 * Çakışma çözümünde uzunluk eşitse karar veren öncelik sırası. SPEC §6.1.
 * Küçük sayı önce gelir.
 */
export const TYPE_PRIORITY: Readonly<Record<EntityType, number>> = {
  TCKN: 10,
  IBAN: 20,
  ESAS: 30,
  EPOSTA: 40,
  PLAKA: 50,
  TEL: 60,
  TARIH: 70,
  KISI: 80,
  KURUM: 90,
  ISYERI: 95,
  ADRES: 100,
}

/** Metinde tespit edilmiş tek bir varlık aralığı. `end` dışlayıcıdır. */
export interface EntitySpan {
  readonly start: number
  readonly end: number
  /** Aralığın ham metni — unmask bunu geri yazar. */
  readonly text: string
  readonly type: EntityType
  readonly layer: DetectionLayer
  /**
   * Eşleme anahtarının kök kısmı (SPEC §4.1). Normalleştirme tipe bağlıdır;
   * aynı varlığın farklı yazımları aynı köke düşer.
   */
  readonly key: string
  /** 0..1. Kural katmanı doğrulama algoritmalı tiplerde 1 verir. */
  readonly confidence: number
}

/** Doğrulaması olan ama geçemeyen aday — SPEC §7/3 gereği yutulmaz. */
export interface SuspectSpan {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly type: EntityType
  readonly reason: string
}
