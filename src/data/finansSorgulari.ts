import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { dateToIsoDate, gunFarki } from '../domain/tarih'
import type { Dosya, FinansKaydi } from '../domain/types'

/*
 * Genel finans ekranının sorguları. Dosya bazlı özet zaten dosyaSorgulari.ts
 * içinde (finansOzeti); burada büro genelindeki tablo hesaplanır.
 */

export type FinansSuzgeci = 'tumu' | 'gelir' | 'gider' | 'bekleyen'

export const finansSuzgecEtiketleri: Record<FinansSuzgeci, string> = {
  tumu: 'Tümü',
  gelir: 'Tahsilat',
  gider: 'Gider',
  bekleyen: 'Bekleyen',
}

export interface FinansGenelOzet {
  buAyTahsilat: number
  buAyGider: number
  toplamBekleyen: number
  /** Vadesi 7 gün içinde olan bekleyen ödeme sayısı. */
  yaklasanOdeme: number
}

/**
 * Büro geneli finans özeti — saf çekirdek (DB/DOM'suz test edilebilir).
 *
 * "Bekleyen ÖDEME" ve "yaklaşan ödeme" yalnızca GİDER kalemlerini sayar:
 * büronun ödemesi gereken tutardır. Tahsil edilmemiş gelir (müvekkilin borcu)
 * bekleyen TAHSİLATtır, ödeme değil; buraya katılırsa "ödemem gereken" tutar
 * yanlışça şişerdi. Asistanın aynı adlı hesabıyla (dosyaOzeti — yalnızca
 * gider) da tutarlı.
 */
export function finansGenelOzetHesapla(
  kayitlar: FinansKaydi[],
  bugun: Date = new Date(),
): FinansGenelOzet {
  const onEk = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}`
  const bugunStr = dateToIsoDate(bugun)

  let buAyTahsilat = 0
  let buAyGider = 0
  let toplamBekleyen = 0
  let yaklasanOdeme = 0

  for (const f of kayitlar) {
    if (f.tarih.startsWith(onEk)) {
      if (f.yon === 'gelir') buAyTahsilat += f.odenenTutar
      else buAyGider += f.odenenTutar
    }
    if (f.yon === 'gider' && f.odemeDurumu !== 'odendi') {
      const kalan = f.tutar - f.odenenTutar
      toplamBekleyen += kalan
      if (f.vadeTarihi) {
        const fark = gunFarki(f.vadeTarihi, bugunStr)
        if (fark >= 0 && fark <= 7) yaklasanOdeme += 1
      }
    }
  }

  return { buAyTahsilat, buAyGider, toplamBekleyen, yaklasanOdeme }
}

export function useFinansGenelOzet(): FinansGenelOzet | undefined {
  return useLiveQuery(
    async () => finansGenelOzetHesapla(await db.finans.toArray()),
    [],
  )
}

export interface FinansSatiri {
  kayit: FinansKaydi
  dosya?: Dosya
}

export function useFinansListesi(
  suzgec: FinansSuzgeci,
): FinansSatiri[] | undefined {
  return useLiveQuery(async () => {
    const [kayitlar, dosyalar] = await Promise.all([
      db.finans.toArray(),
      db.dosyalar.toArray(),
    ])
    const dosyaHarita = new Map(dosyalar.map((d) => [d.id, d]))

    return kayitlar
      .filter((f) => {
        switch (suzgec) {
          case 'gelir':
            return f.yon === 'gelir'
          case 'gider':
            return f.yon === 'gider'
          case 'bekleyen':
            return f.odemeDurumu !== 'odendi'
          case 'tumu':
            return true
        }
      })
      .sort((a, b) => {
        // Bekleyenler vadeye göre; diğerleri tarihe göre yeni→eski.
        if (suzgec === 'bekleyen') {
          return (a.vadeTarihi ?? '9999').localeCompare(b.vadeTarihi ?? '9999')
        }
        return b.tarih.localeCompare(a.tarih)
      })
      .map((kayit) => ({
        kayit,
        ...(kayit.dosyaId ? { dosya: dosyaHarita.get(kayit.dosyaId) } : {}),
      }))
  }, [suzgec])
}
