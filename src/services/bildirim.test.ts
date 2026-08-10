import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cihazBildirimiGoster,
  kanalDurumEtiketleri,
  kanalDurumlari,
  pushIzniIste,
} from './bildirim'

/*
 * Bildirim kanalı adaptörü. İki değişmez korunur:
 *  1) DÜRÜSTLÜK: SMS/e-posta bir sunucu ister; asla "hazır" gösterilmez —
 *     kullanıcı olmayan bir teslimat sözüne kanmamalı.
 *  2) ZARİF DÜŞÜŞ: Notification API yoksa çökme değil, "desteklenmiyor"/false.
 */

// Notification'ı test içinde taklit etmek için yardımcı.
function notificationKur(permission: NotificationPermission) {
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn(async () => permission),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('kanalDurumlari — dürüst kanal bildirimi', () => {
  it('SMS ve e-postayı her zaman "yapılandırılmadı" gösterir', () => {
    const kanallar = kanalDurumlari()
    const bul = (k: string) => kanallar.find((x) => x.kanal === k)
    expect(bul('sms')?.durum).toBe('yapilandirilmadi')
    expect(bul('eposta')?.durum).toBe('yapilandirilmadi')
    // Uygulama içi kutu sunucusuz çalışır → her zaman hazır.
    expect(bul('uygulama')?.durum).toBe('hazir')
    expect(kanallar).toHaveLength(4)
  })

  it('push durumu Notification iznini yansıtır', () => {
    notificationKur('granted')
    expect(kanalDurumlari().find((x) => x.kanal === 'push')?.durum).toBe('hazir')
    vi.unstubAllGlobals()
    notificationKur('denied')
    expect(kanalDurumlari().find((x) => x.kanal === 'push')?.durum).toBe(
      'reddedildi',
    )
  })
})

describe('zarif düşüş — Notification API yokken', () => {
  it('push izni istenince "desteklenmiyor" döner ve çökmez', async () => {
    // Node ortamında Notification tanımsız.
    expect(typeof (globalThis as { Notification?: unknown }).Notification).toBe(
      'undefined',
    )
    await expect(pushIzniIste()).resolves.toBe('desteklenmiyor')
  })

  it('cihaz bildirimi gösterimi sessizce false döner', () => {
    expect(cihazBildirimiGoster('Başlık', 'Gövde')).toBe(false)
  })
})

describe('pushIzniIste — izin durumları', () => {
  it('izin zaten verilmişse istemeden "hazır" döner', async () => {
    notificationKur('granted')
    await expect(pushIzniIste()).resolves.toBe('hazir')
  })

  it('izin reddedilmişse "reddedildi" döner', async () => {
    notificationKur('denied')
    await expect(pushIzniIste()).resolves.toBe('reddedildi')
  })

  it('izin sorulmamışsa API’den ister ve sonucu eşler', async () => {
    notificationKur('default')
    await expect(pushIzniIste()).resolves.toBe('izin-gerekli')
  })
})

describe('cihazBildirimiGoster — izin verilmemişse göstermez', () => {
  it('izin "granted" değilken false döner', () => {
    notificationKur('denied')
    expect(cihazBildirimiGoster('B', 'G')).toBe(false)
  })
})

describe('kanalDurumEtiketleri', () => {
  it('her durum için bir etiket vardır', () => {
    for (const d of [
      'hazir',
      'izin-gerekli',
      'reddedildi',
      'yapilandirilmadi',
      'desteklenmiyor',
    ] as const) {
      expect(kanalDurumEtiketleri[d]?.length ?? 0).toBeGreaterThan(0)
    }
  })
})
