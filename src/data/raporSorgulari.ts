import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import {
  aciliyet,
  bugunIso,
  dateToIsoDate,
  isoDateToDate,
  yerelGun,
} from '../domain/tarih'
import { kategoriEtiketleri } from './finansIslemleri'
import type { FinansKategorisi, IsoDate } from '../domain/types'

/*
 * Raporlar için toplulaştırmalar. Hepsi bellekte hesaplanıyor: veri bir cihaza
 * sığacak ölçekte ve grafikler elle çizilen SVG olduğu için ara katman gereksiz.
 */

const AY_ADLARI = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
]

export interface AylikKovan {
  etiket: string
  onEk: string // "2026-08"
  deger: number
}

export interface RaporVerisi {
  /** Seçili dönemdeki aylara göre tahsilat (kuruş). */
  aylikTahsilat: AylikKovan[]
  /** Seçili dönemdeki aylara göre gider (kuruş). */
  aylikGider: AylikKovan[]
  /** Seçili dönem: duruşma, görüşme, tamamlanan görev sayısı. */
  donemDurusma: number
  donemGorusme: number
  donemTamamlananGorev: number
  /** Kategori bazlı gider dağılımı (kuruş), büyükten küçüğe. */
  giderDagilimi: Array<{ kategori: FinansKategorisi; etiket: string; tutar: number }>
  /** Açık sürelerin aciliyet dağılımı. */
  sureAciliyet: { kritik: number; yakin: number; normal: number }
  /** En yüksek bakiyeli dosyalar. */
  dosyaBakiye: Array<{ dosyaId: string; baslik: string; gelir: number; gider: number }>
  /** Toplamlar. */
  toplamTahsilat: number
  toplamGider: number
}

/** Aralığın dokunduğu her ay için bir kova (en çok 24 — grafik okunur kalsın). */
function aylikKovanlar(
  baslangic: IsoDate,
  bitis: IsoDate,
): Array<{ etiket: string; onEk: string }> {
  const b = isoDateToDate(baslangic)
  const e = isoDateToDate(bitis)
  const liste: Array<{ etiket: string; onEk: string }> = []
  let y = b.getFullYear()
  let m = b.getMonth()
  while (
    (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) &&
    liste.length < 24
  ) {
    liste.push({
      etiket: AY_ADLARI[m] ?? '',
      onEk: `${y}-${String(m + 1).padStart(2, '0')}`,
    })
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return liste
}

/** Varsayılan rapor aralığı: son altı ay (ayın 1'inden bugüne). */
export function varsayilanRaporAraligi(): { baslangic: IsoDate; bitis: IsoDate } {
  const bugun = new Date()
  const bas = new Date(bugun.getFullYear(), bugun.getMonth() - 5, 1)
  return { baslangic: dateToIsoDate(bas), bitis: dateToIsoDate(bugun) }
}

export function useRaporVerisi(
  baslangic: IsoDate,
  bitis: IsoDate,
): RaporVerisi | undefined {
  return useLiveQuery(async () => {
    const [tumFinans, olaylar, gorevler, sureler, dosyalar] = await Promise.all([
      db.finans.toArray(),
      db.olaylar.toArray(),
      db.gorevler.toArray(),
      db.sureler.toArray(),
      db.dosyalar.toArray(),
    ])

    // Aralık içindeki günler (dahil). Zaman damgaları (olay/görev) yerel güne
    // indirgenir ki takvimle aynı gün kovasına düşsün (bkz. yerelGun).
    const aralikta = (isoTarih: string): boolean => {
      const g = yerelGun(isoTarih)
      return g >= baslangic && g <= bitis
    }
    const finans = tumFinans.filter((f) => aralikta(f.tarih))

    const aylar = aylikKovanlar(baslangic, bitis)

    const aylikTahsilat = aylar.map((a) => ({
      etiket: a.etiket,
      onEk: a.onEk,
      deger: finans
        .filter((f) => f.yon === 'gelir' && f.tarih.startsWith(a.onEk))
        .reduce((t, f) => t + f.odenenTutar, 0),
    }))
    const aylikGider = aylar.map((a) => ({
      etiket: a.etiket,
      onEk: a.onEk,
      deger: finans
        .filter((f) => f.yon === 'gider' && f.tarih.startsWith(a.onEk))
        .reduce((t, f) => t + f.odenenTutar, 0),
    }))

    const donemDurusma = olaylar.filter(
      (o) => o.tur === 'durusma' && aralikta(o.baslangic),
    ).length
    const donemGorusme = olaylar.filter(
      (o) => o.tur === 'muvekkil-gorusmesi' && aralikta(o.baslangic),
    ).length
    const donemTamamlananGorev = gorevler.filter(
      (g) =>
        g.durum === 'tamamlandi' &&
        g.tamamlanmaTarihi !== undefined &&
        aralikta(g.tamamlanmaTarihi),
    ).length

    // Gider dağılımı (ödenen, aralık içi).
    const giderMap = new Map<FinansKategorisi, number>()
    for (const f of finans) {
      if (f.yon !== 'gider') continue
      giderMap.set(f.kategori, (giderMap.get(f.kategori) ?? 0) + f.odenenTutar)
    }
    const giderDagilimi = [...giderMap.entries()]
      .filter(([, tutar]) => tutar > 0)
      .map(([kategori, tutar]) => ({
        kategori,
        etiket: kategoriEtiketleri[kategori],
        tutar,
      }))
      .sort((a, b) => b.tutar - a.tutar)

    // Süre aciliyet dağılımı.
    const sureAciliyet = { kritik: 0, yakin: 0, normal: 0 }
    for (const s of sureler) {
      if (s.durum !== 'acik') continue
      const a = aciliyet(s.sonTarih)
      if (a === 'gecti' || a === 'kritik') sureAciliyet.kritik += 1
      else if (a === 'yakin') sureAciliyet.yakin += 1
      else sureAciliyet.normal += 1
    }

    // Dosya bazlı bakiye (en yüksek hareketli 6 dosya).
    const dosyaMap = new Map<string, { gelir: number; gider: number }>()
    for (const f of finans) {
      if (!f.dosyaId) continue
      const kayit = dosyaMap.get(f.dosyaId) ?? { gelir: 0, gider: 0 }
      if (f.yon === 'gelir') kayit.gelir += f.odenenTutar
      else kayit.gider += f.odenenTutar
      dosyaMap.set(f.dosyaId, kayit)
    }
    const dosyaAd = new Map(dosyalar.map((d) => [d.id, d.baslik]))
    const dosyaBakiye = [...dosyaMap.entries()]
      .map(([dosyaId, v]) => ({
        dosyaId,
        baslik: dosyaAd.get(dosyaId) ?? 'Dosya',
        gelir: v.gelir,
        gider: v.gider,
      }))
      .sort((a, b) => b.gelir + b.gider - (a.gelir + a.gider))
      .slice(0, 6)

    return {
      aylikTahsilat,
      aylikGider,
      donemDurusma,
      donemGorusme,
      donemTamamlananGorev,
      giderDagilimi,
      sureAciliyet,
      dosyaBakiye,
      toplamTahsilat: finans
        .filter((f) => f.yon === 'gelir')
        .reduce((t, f) => t + f.odenenTutar, 0),
      toplamGider: finans
        .filter((f) => f.yon === 'gider')
        .reduce((t, f) => t + f.odenenTutar, 0),
    }
  }, [baslangic, bitis])
}

/** Rapor verisini CSV'ye çevirir (aylık gelir-gider). */
export function raporCsv(veri: RaporVerisi): string {
  const satirlar: string[] = ['Ay;Tahsilat (TL);Gider (TL)']
  for (let i = 0; i < veri.aylikTahsilat.length; i++) {
    const t = veri.aylikTahsilat[i]
    const g = veri.aylikGider[i]
    if (!t || !g) continue
    satirlar.push(
      `${t.onEk};${(t.deger / 100).toFixed(2)};${(g.deger / 100).toFixed(2)}`,
    )
  }
  satirlar.push('')
  satirlar.push('Kategori;Gider (TL)')
  for (const g of veri.giderDagilimi) {
    satirlar.push(`${g.etiket};${(g.tutar / 100).toFixed(2)}`)
  }
  // Excel Türkçe yerel ayarında ; ayracı ve UTF-8 BOM ile açılsın.
  return '﻿' + satirlar.join('\n')
}

export { bugunIso }
