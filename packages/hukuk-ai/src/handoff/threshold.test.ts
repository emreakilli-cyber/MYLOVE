import { describe, expect, it } from 'vitest'
import { THRESHOLDS, shouldOfferHandoff, type JobEstimate } from './threshold'

/*
 * M12.9 — bu dosyanın tek işi şunu kanıtlamak: EŞİK ALTINDA TEKLİF ÇIKMAZ.
 * Her eşik için sınır değeri ayrı ayrı deneniyor (tam eşikte çıkmaz, bir
 * fazlasında çıkar), ayrıca eşiğin altında kalan geniş bir iş kümesi taranıyor.
 */

const measured = { measured: true } as const
const unmeasured = { measured: false } as const

const idle: JobEstimate = { foregroundWaitSeconds: 0, queueable: true }

describe('varsayılan: teklif yok', () => {
  it('boşta iş için hiçbir şey göstermez', () => {
    expect(shouldOfferHandoff(idle, measured)).toEqual({ kind: 'none' })
  })

  it('kuyruğa alınabilen iş ne kadar uzun olursa olsun teklif çıkarmaz', () => {
    const longJob: JobEstimate = { foregroundWaitSeconds: 90 * 60, queueable: true }
    expect(shouldOfferHandoff(longJob, measured).kind).toBe('none')
  })

  it('eşleşmiş masaüstü yoksa teklif çıkmaz', () => {
    const heavy: JobEstimate = { foregroundWaitSeconds: 3600, queueable: false }
    expect(shouldOfferHandoff(heavy, measured, { desktopPaired: false }).kind).toBe('none')
  })
})

describe('§C.1 süre eşiği — sınır değeri', () => {
  it('tam eşikte teklif çıkmaz', () => {
    const job: JobEstimate = {
      foregroundWaitSeconds: THRESHOLDS.foregroundWaitSeconds,
      queueable: false,
    }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('eşiğin bir saniye üstünde teklif çıkar', () => {
    const job: JobEstimate = {
      foregroundWaitSeconds: THRESHOLDS.foregroundWaitSeconds + 1,
      queueable: false,
    }
    const outcome = shouldOfferHandoff(job, measured)
    expect(outcome.kind).toBe('offer')
    expect(outcome.kind === 'offer' && outcome.trigger).toBe('time')
  })

  it('ölçüm yoksa eşik %50 gevşer', () => {
    const job: JobEstimate = {
      foregroundWaitSeconds: THRESHOLDS.foregroundWaitSeconds + 1,
      queueable: false,
    }
    expect(shouldOfferHandoff(job, unmeasured).kind).toBe('none')

    const longer: JobEstimate = {
      foregroundWaitSeconds: THRESHOLDS.foregroundWaitSeconds * 1.5 + 1,
      queueable: false,
    }
    expect(shouldOfferHandoff(longer, unmeasured).kind).toBe('offer')
  })
})

describe('§C.3 toplu iş — iki koşul da gerekli', () => {
  it('tam eşikte teklif çıkmaz', () => {
    const job: JobEstimate = {
      ...idle,
      chunkCountAfterPrefilter: THRESHOLDS.chunkCount,
      wantsResultNow: true,
    }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('eşik aşılsa da "şimdi" istenmiyorsa teklif çıkmaz', () => {
    const job: JobEstimate = {
      ...idle,
      chunkCountAfterPrefilter: THRESHOLDS.chunkCount * 10,
      wantsResultNow: false,
    }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('her iki koşul sağlanınca teklif çıkar', () => {
    const job: JobEstimate = {
      ...idle,
      chunkCountAfterPrefilter: THRESHOLDS.chunkCount + 1,
      wantsResultNow: true,
    }
    const outcome = shouldOfferHandoff(job, measured)
    expect(outcome.kind === 'offer' && outcome.trigger).toBe('batch')
  })
})

describe('§C.5 ses — iki koşul da gerekli', () => {
  it('tam eşikte teklif çıkmaz', () => {
    const job: JobEstimate = {
      ...idle,
      audioMinutes: THRESHOLDS.audioMinutes,
      singleSession: true,
    }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('3 saatlik kayıt bile tek oturum istenmiyorsa teklif çıkarmaz', () => {
    const job: JobEstimate = { ...idle, audioMinutes: 180, singleSession: false }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('tek oturum + eşik üstü süre teklif çıkarır', () => {
    const job: JobEstimate = { ...idle, audioMinutes: 180, singleSession: true }
    const outcome = shouldOfferHandoff(job, measured)
    expect(outcome.kind === 'offer' && outcome.trigger).toBe('audio')
  })
})

describe('§C.6 bellek — teklif değil bilgilendirme', () => {
  it('eşik üstünde bilgilendirme döner, özellik kapanmaz', () => {
    const job: JobEstimate = { ...idle, peakResidentMemoryMb: 16_000 }
    const outcome = shouldOfferHandoff(job, measured)

    expect(outcome.kind).toBe('info')
    expect(outcome.kind === 'info' && outcome.detail).toContain('özellik kapanmıyor')
  })

  it('tam eşikte bilgilendirme çıkmaz', () => {
    const job: JobEstimate = { ...idle, peakResidentMemoryMb: THRESHOLDS.peakResidentMemoryMb }
    expect(shouldOfferHandoff(job, measured).kind).toBe('none')
  })

  it('ölçüm yokluğu bellek eşiğini gevşetmez', () => {
    const job: JobEstimate = {
      ...idle,
      peakResidentMemoryMb: THRESHOLDS.peakResidentMemoryMb + 1,
    }
    expect(shouldOfferHandoff(job, unmeasured).kind).toBe('info')
  })
})

describe('§C.7 yumuşak koşullar — devir değil erteleme', () => {
  const heavy: JobEstimate = { foregroundWaitSeconds: 3600, queueable: false }

  it('ısınmada teklif yerine erteleme çıkar', () => {
    expect(shouldOfferHandoff(heavy, measured, { thermalState: 'serious' }).kind).toBe(
      'postpone',
    )
    expect(shouldOfferHandoff(heavy, measured, { thermalState: 'critical' }).kind).toBe(
      'postpone',
    )
  })

  it('düşük bataryada teklif yerine erteleme çıkar', () => {
    expect(shouldOfferHandoff(heavy, measured, { batteryPercent: 19 }).kind).toBe('postpone')
  })

  it('eşik değerlerinde normal akış sürer', () => {
    expect(
      shouldOfferHandoff(heavy, measured, {
        batteryPercent: THRESHOLDS.lowBatteryPercent,
        thermalState: 'fair',
      }).kind,
    ).toBe('offer')
  })
})

describe('eşik altında ASLA teklif yok — kapsamlı tarama', () => {
  it('eşiğin altındaki hiçbir bileşimde offer üretmez', () => {
    for (let seconds = 0; seconds <= THRESHOLDS.foregroundWaitSeconds; seconds += 60) {
      for (const chunks of [0, 100, 1000, THRESHOLDS.chunkCount]) {
        for (const minutes of [0, 10, 45, THRESHOLDS.audioMinutes]) {
          for (const queueable of [true, false]) {
            const outcome = shouldOfferHandoff(
              {
                foregroundWaitSeconds: seconds,
                queueable,
                chunkCountAfterPrefilter: chunks,
                wantsResultNow: true,
                audioMinutes: minutes,
                singleSession: true,
              },
              measured,
            )
            expect(outcome.kind).toBe('none')
          }
        }
      }
    }
  })
})
