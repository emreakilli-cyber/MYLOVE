/**
 * Devir teslim eşikleri — `docs/CAPABILITIES.md` §C, plan M12.9.
 *
 * Buradaki tek iddia şudur: **eşik aşılmadıkça teklif çıkmaz.** Uyarı yok,
 * rozet yok, "masaüstünde daha iyi olur" ipucu yok, gri buton yok. Bu bir
 * yorum satırı değil, `threshold.test.ts` içinde sınır değerleriyle doğrulanan
 * davranıştır.
 *
 * `CAPABILITIES.md` bölünebilirlik testinden sonra B listesinde kullanıcı işi
 * kalmadığı için devir artık bir yetenek koşulu değil, yalnız hızlandırmadır.
 * Bu yüzden çıktı tipleri "yapamam" demez; en fazla "istersen hızlandırırım"
 * ya da "bu model bu cihazda çalışmaz, cihaz içi modelle sürüyorum" der.
 */

/** §C.0 — eşikler tahminle değil ölçümle karşılaştırılır. */
export interface DeviceCalibration {
  /** Ölçüm yapılmadıysa `false`; eşikler %50 gevşetilir. */
  readonly measured: boolean
  readonly decodeTokensPerSecond?: number
  readonly prefillTokensPerSecond?: number
}

export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical'

export interface JobEstimate {
  /**
   * Kullanıcının EKRAN BAŞINDA beklemesi gereken kesintisiz süre.
   * Kuyruğa alınabilen iş için bu değer 0'dır — ne kadar uzun sürerse sürsün.
   */
  readonly foregroundWaitSeconds: number
  /** İş kuyruğa alınıp kesintiye dayanıklı sürebiliyor mu (§A.0). */
  readonly queueable: boolean
  /** §C.3 — deterministik ön elemeden SONRA kalan parça sayısı. */
  readonly chunkCountAfterPrefilter?: number
  /** Kullanıcı sonucu aynı oturumda mı istiyor. */
  readonly wantsResultNow?: boolean
  /** §C.5 — ses/video süresi. */
  readonly audioMinutes?: number
  /** Kullanıcı "tek oturumda, şimdi" dedi mi. */
  readonly singleSession?: boolean
  /** §C.6 — tek atomik adımın tahminî yerleşik belleği. */
  readonly peakResidentMemoryMb?: number
}

export interface DeviceState {
  readonly batteryPercent?: number
  readonly thermalState?: ThermalState
  /** Eşleşmiş bir masaüstü yoksa teklif zaten anlamsızdır. */
  readonly desktopPaired?: boolean
}

export type HandoffOutcome =
  /** Hiçbir şey gösterilmez. Varsayılan ve ezici çoğunlukta doğru olan. */
  | { readonly kind: 'none' }
  /** Eşik aşıldı; teklif gösterilebilir. "Telefonda sürdür" her zaman vardır. */
  | { readonly kind: 'offer'; readonly trigger: HandoffTrigger; readonly detail: string }
  /** §C.7 — cihazın anlık hâli; devir değil erteleme önerilir. */
  | { readonly kind: 'postpone'; readonly detail: string }
  /** §C.6 — model bu cihazda çalışmaz. Teklif değil bilgilendirme; özellik kapanmaz. */
  | { readonly kind: 'info'; readonly detail: string }

export type HandoffTrigger = 'time' | 'batch' | 'audio'

/** §C özet tablosundaki temel değerler. Ölçüm yoksa 1,5 ile çarpılır (§C.0). */
export const THRESHOLDS = {
  foregroundWaitSeconds: 600,
  chunkCount: 2000,
  audioMinutes: 90,
  peakResidentMemoryMb: 1200,
  lowBatteryPercent: 20,
} as const

const UNMEASURED_RELAXATION = 1.5

export function shouldOfferHandoff(
  job: JobEstimate,
  calibration: DeviceCalibration,
  device: DeviceState = {},
): HandoffOutcome {
  const relax = calibration.measured ? 1 : UNMEASURED_RELAXATION

  // §C.6 — bellek tek gerçek zorunlu eşik. Teklif değil bilgilendirme; ölçüm
  // gevşetmesi UYGULANMAZ, çünkü jetsam sınırı cihaz gerçeğidir, tahmin değil.
  if ((job.peakResidentMemoryMb ?? 0) > THRESHOLDS.peakResidentMemoryMb) {
    return {
      kind: 'info',
      detail:
        `Bu adımın tahminî belleği ${job.peakResidentMemoryMb} MB, cihaz bütçesi ` +
        `${THRESHOLDS.peakResidentMemoryMb} MB. Cihaz içi model kullanılacak; özellik kapanmıyor.`,
    }
  }

  // §C.7 — anlık durum. Devir teklifinin ÖNÜNE geçer: cihaz ısındı diye
  // kullanıcıyı masaüstüne yönlendirmek, kalıcı bir sınır varmış gibi davranmaktır.
  const thermal = device.thermalState
  if (thermal === 'serious' || thermal === 'critical') {
    return { kind: 'postpone', detail: 'Cihaz ısındı; soğuyunca kaldığı yerden sürecek.' }
  }
  if ((device.batteryPercent ?? 100) < THRESHOLDS.lowBatteryPercent) {
    return { kind: 'postpone', detail: 'Batarya düşük; şarja takınca kaldığı yerden sürecek.' }
  }

  // Eşleşmiş masaüstü yoksa teklif gösterilmez — gösterilecek bir şey yok.
  if (device.desktopPaired === false) return { kind: 'none' }

  // §C.1 — birincil eşik. Kuyruğa alınabilen iş bunu ASLA tetiklemez.
  if (!job.queueable) {
    const limit = THRESHOLDS.foregroundWaitSeconds * relax
    if (job.foregroundWaitSeconds > limit) {
      return {
        kind: 'offer',
        trigger: 'time',
        detail:
          `Ekran başında ~${Math.round(job.foregroundWaitSeconds / 60)} dk beklemek gerekiyor ` +
          `(eşik ${Math.round(limit / 60)} dk).`,
      }
    }
  }

  // §C.3 — toplu iş. İki koşul da gerekli.
  const chunks = job.chunkCountAfterPrefilter ?? 0
  if (job.wantsResultNow === true && chunks > THRESHOLDS.chunkCount * relax) {
    return {
      kind: 'offer',
      trigger: 'batch',
      detail: `Ön elemeden sonra ${chunks} parça kaldı ve sonuç şimdi isteniyor.`,
    }
  }

  // §C.5 — ses. İki koşul da gerekli.
  const minutes = job.audioMinutes ?? 0
  if (job.singleSession === true && minutes > THRESHOLDS.audioMinutes * relax) {
    return {
      kind: 'offer',
      trigger: 'audio',
      detail: `${minutes} dakikalık kayıt tek oturumda isteniyor.`,
    }
  }

  return { kind: 'none' }
}
