/**
 * Kaçak kimlik bilgisi yakalama — plan M11.
 *
 * Senaryo: kullanıcı onay ekranını atlar ve doğrudan AI kutusuna "Ahmet
 * Yılmaz'ın TC'si 10000000146" yazar. Gönderim düğmesine basmadan ÖNCE bu
 * fonksiyon çalışır ve "maskeleyeyim mi?" sorusunun verisini üretir.
 *
 * Bu, `MaskGuard`'ın (M7) yerine geçmez; ondan önce gelir. Guard son savunma
 * hattıdır ve hata fırlatır; preflight ise kullanıcıya seçenek sunan kibar
 * kapıdır. İkisi de olmalı: preflight atlanabilir, guard atlanamaz.
 */

import { mask, type MaskOptions, type MaskResult } from './mask'
import type { EntityType, SuspectSpan } from '../types/entities'

/** Gönderimin nereye gittiği — "maskesiz gönder" seçeneğini bu belirler. */
export type Destination = 'local' | 'network'

export interface PreflightEntity {
  readonly type: EntityType
  readonly start: number
  readonly end: number
  readonly text: string
  readonly suggestedToken: string
  readonly confidence: number
}

export interface PreflightResult {
  /** Kimlik verisi bulunmadıysa `true` — akış kesintisiz sürer. */
  readonly clean: boolean
  readonly entities: readonly PreflightEntity[]
  /** Doğrulamadan geçemeyen ama insan gözüyle okunabilen adaylar (SPEC §7/3). */
  readonly suspects: readonly SuspectSpan[]
  /** Kullanıcı "maskele ve gönder" derse gidecek olan metin. */
  readonly maskedPreview: MaskResult
  /**
   * M11.5 — internete çıkan hedefte bu HER ZAMAN `false`. Arayüz bu bayrağa
   * bakarak "maskesiz gönder" düğmesini hiç çizmez.
   */
  readonly canSendUnmasked: boolean
}

export interface PreflightOptions extends MaskOptions {
  readonly destination: Destination
}

export function preflightCheck(text: string, options: PreflightOptions): PreflightResult {
  const { destination, ...maskOptions } = options
  const preview = mask(text, maskOptions)

  const entities: PreflightEntity[] = preview.spans.map((span) => ({
    type: span.type,
    start: span.start,
    end: span.end,
    text: span.text,
    suggestedToken: preview.table.tokenOf(span.type, span.key) ?? '',
    confidence: span.confidence,
  }))

  return {
    clean: entities.length === 0 && preview.suspects.length === 0,
    entities,
    suspects: preview.suspects,
    maskedPreview: preview,
    // Ağa giden yolda maskesiz gönderme seçeneği YOKTUR. Guard zaten fırlatırdı;
    // burada seçeneği hiç göstermeyerek kullanıcıyı çıkmaza sokmuyoruz.
    canSendUnmasked: destination === 'local',
  }
}
