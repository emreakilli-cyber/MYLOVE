import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type {
  Ayarlar,
  Dosya,
  Gorev,
  Hareket,
  Muvekkil,
  Olay,
  Sure,
} from '../domain/types'
import { hazirlikHesapla } from '../domain/hazirlik'
import type { HazirlikOzeti } from '../domain/types'
import { aralik, bugunIso, dateToIsoDate, gunBaslangici } from '../domain/tarih'

/*
 * Gösterge panelinin okuma katmanı.
 *
 * Hepsi Dexie'nin canlı sorgusu üzerinden: veri değiştiğinde bileşen
 * kendiliğinden yeniden çizilir, elle yenileme yok. Sayıların hiçbiri sabit
 * yazılmaz — panelde görünen her rakam buradan hesaplanır.
 */

const GUN_MS = 86_400_000

/** Bir dosyayı müvekkiliyle birlikte taşıyan görünüm tipi. */
export interface DosyaBaglami {
  dosya: Dosya
  muvekkil?: Muvekkil
}

function ayOneki(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ *
 * Üst istatistikler
 * ------------------------------------------------------------------ */

export interface PanelIstatistikleri {
  aktifDosya: number
  buAyAcilanDosya: number
  buHaftakiDurusma: number
  bugunkuDurusma: number
  bekleyenGorev: number
  oncelikliGorev: number
  buAyTahsilat: number
  gecenAyTahsilat: number
}

export function useIstatistikler(): PanelIstatistikleri | undefined {
  return useLiveQuery(async () => {
    const bugun = gunBaslangici()
    const { basIso, sonIso } = aralik(7)
    const yarinIso = new Date(bugun.getTime() + GUN_MS).toISOString()

    const [dosyalar, olaylar, gorevler, finans] = await Promise.all([
      db.dosyalar.toArray(),
      db.olaylar
        .where('baslangic')
        .between(basIso, sonIso, true, false)
        .toArray(),
      db.gorevler.where('durum').equals('bekliyor').toArray(),
      db.finans.where('yon').equals('gelir').toArray(),
    ])

    const aktif = dosyalar.filter((d) => d.durum !== 'kapali' && !d.arsivlendi)
    const ayBasi = dateToIsoDate(new Date(bugun.getFullYear(), bugun.getMonth(), 1))

    const durusmalar = olaylar.filter(
      (o) => o.tur === 'durusma' && o.durum !== 'iptal',
    )

    const buAy = ayOneki(bugun)
    const gecenAy = ayOneki(
      new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1),
    )
    const tahsilatTopla = (onek: string) =>
      finans
        .filter((f) => f.odemeDurumu !== 'bekliyor' && f.tarih.startsWith(onek))
        .reduce((toplam, f) => toplam + f.odenenTutar, 0)

    return {
      aktifDosya: aktif.length,
      buAyAcilanDosya: aktif.filter((d) => d.acilisTarihi >= ayBasi).length,
      buHaftakiDurusma: durusmalar.length,
      bugunkuDurusma: durusmalar.filter((o) => o.baslangic < yarinIso).length,
      bekleyenGorev: gorevler.length,
      oncelikliGorev: gorevler.filter((g) => g.oncelik === 'yuksek').length,
      buAyTahsilat: tahsilatTopla(buAy),
      gecenAyTahsilat: tahsilatTopla(gecenAy),
    }
  }, [])
}

/* ------------------------------------------------------------------ *
 * Yaklaşan son tarihler
 * ------------------------------------------------------------------ */

export interface SureSatiri extends DosyaBaglami {
  sure: Sure
}

export function useYaklasanSureler(limit = 5): SureSatiri[] | undefined {
  return useLiveQuery(async () => {
    const sureler = await db.sureler
      .where('durum')
      .equals('acik')
      .sortBy('sonTarih')

    const secilenler = sureler.slice(0, limit)
    return Promise.all(
      secilenler.map(async (sure) => {
        const dosya = await db.dosyalar.get(sure.dosyaId)
        const muvekkil = dosya
          ? await db.muvekkiller.get(dosya.muvekkilId)
          : undefined
        return { sure, dosya: dosya!, muvekkil }
      }),
    )
  }, [limit])
}

/* ------------------------------------------------------------------ *
 * Bugünün programı
 * ------------------------------------------------------------------ */

export interface OlaySatiri extends DosyaBaglami {
  olay: Olay
}

/** Bugünden başlayarak `gunSayisi` günlük program. */
export function useYaklasanOlaylar(
  gunSayisi = 3,
  limit = 5,
): OlaySatiri[] | undefined {
  return useLiveQuery(async () => {
    const { basIso, sonIso } = aralik(gunSayisi)
    const olaylar = await db.olaylar
      .where('baslangic')
      .between(basIso, sonIso, true, false)
      .toArray()

    const siralanmis = olaylar
      .filter((o) => o.durum !== 'iptal')
      .sort((a, b) => a.baslangic.localeCompare(b.baslangic))
      .slice(0, limit)

    return Promise.all(
      siralanmis.map(async (olay) => {
        const dosya = olay.dosyaId
          ? await db.dosyalar.get(olay.dosyaId)
          : undefined
        const muvekkil = dosya
          ? await db.muvekkiller.get(dosya.muvekkilId)
          : undefined
        return { olay, dosya: dosya!, muvekkil }
      }),
    )
  }, [gunSayisi, limit])
}

/* ------------------------------------------------------------------ *
 * Bugün yapılacaklar
 * ------------------------------------------------------------------ */

export interface GorevSatiri extends DosyaBaglami {
  gorev: Gorev
}

/**
 * Vadesi bugün ya da daha önce olanlar başta; ardından yakın vadeliler.
 * Bugün tamamlananlar listede kalır — kullanıcı ne yaptığını görebilsin,
 * üstü çizili olarak.
 */
export function useGunlukGorevler(limit = 6): GorevSatiri[] | undefined {
  return useLiveQuery(async () => {
    const bugun = bugunIso()
    const gorevler = await db.gorevler.toArray()

    const uygun = gorevler.filter((g) => {
      if (g.durum === 'tamamlandi') {
        // Yalnızca bugün tamamlananlar görünsün.
        return (
          g.tamamlanmaTarihi !== undefined &&
          g.tamamlanmaTarihi.slice(0, 10) === bugun
        )
      }
      return true
    })

    const siraDegeri = (g: Gorev) => g.vadeTarihi ?? '9999-12-31'
    const siralanmis = uygun
      .sort((a, b) => {
        if (a.durum !== b.durum) return a.durum === 'bekliyor' ? -1 : 1
        return siraDegeri(a).localeCompare(siraDegeri(b))
      })
      .slice(0, limit)

    return Promise.all(
      siralanmis.map(async (gorev) => {
        const dosya = gorev.dosyaId
          ? await db.dosyalar.get(gorev.dosyaId)
          : undefined
        const muvekkil = dosya
          ? await db.muvekkiller.get(dosya.muvekkilId)
          : undefined
        return { gorev, dosya: dosya!, muvekkil }
      }),
    )
  }, [limit])
}

/** Görevi tamamla / geri al. */
export async function gorevDurumunuDegistir(gorev: Gorev): Promise<void> {
  const tamamlandi = gorev.durum === 'tamamlandi'
  await db.gorevler.update(gorev.id, {
    durum: tamamlandi ? 'bekliyor' : 'tamamlandi',
    tamamlanmaTarihi: tamamlandi ? undefined : new Date().toISOString(),
    guncellemeTarihi: new Date().toISOString(),
  })

  if (!tamamlandi) {
    const dosya = gorev.dosyaId
      ? await db.dosyalar.get(gorev.dosyaId)
      : undefined
    await db.hareketler.add({
      id: crypto.randomUUID(),
      tur: 'gorev-tamamlandi',
      baslik: 'Görev tamamlandı',
      ayrinti: dosya ? `${gorev.baslik} · ${dosya.baslik}` : gorev.baslik,
      ...(gorev.dosyaId ? { dosyaId: gorev.dosyaId } : {}),
      zaman: new Date().toISOString(),
    })
  }
}

/* ------------------------------------------------------------------ *
 * Dosya sağlığı
 * ------------------------------------------------------------------ */

export interface HazirlikSatiri extends DosyaBaglami {
  ozet: HazirlikOzeti
  /** Kartın alt satırındaki durum notu: "Duruşma bugün", "Bilirkişi bekleniyor". */
  durumNotu: string
}

export function useHazirlikDurumlari(
  limit = 3,
): HazirlikSatiri[] | undefined {
  return useLiveQuery(async () => {
    const dosyalar = await db.dosyalar
      .filter((d) => d.durum !== 'kapali' && !d.arsivlendi)
      .toArray()

    const satirlar = await Promise.all(
      dosyalar.map(async (dosya) => {
        const [muvekkil, olaylar, sureler, gorevler, finans, belgeler] =
          await Promise.all([
            db.muvekkiller.get(dosya.muvekkilId),
            db.olaylar.where('dosyaId').equals(dosya.id).toArray(),
            db.sureler.where('dosyaId').equals(dosya.id).toArray(),
            db.gorevler.where('dosyaId').equals(dosya.id).toArray(),
            db.finans.where('dosyaId').equals(dosya.id).toArray(),
            db.belgeler.where('dosyaId').equals(dosya.id).toArray(),
          ])

        const ozet = hazirlikHesapla({
          dosya,
          muvekkil,
          olaylar,
          sureler,
          gorevler,
          finans,
          belgeler,
        })

        // Yakında bir işi olan dosya, eksiği olan dosyadan daha aciledir:
        // hiç duruşması ve süresi olmayan bir dosyanın %40'ta durması sorun
        // değil, iki gün sonra duruşması olanın %60'ta durması sorundur.
        const ufuk = new Date(Date.now() + 14 * GUN_MS).toISOString()
        const acilIs =
          sureler.some((s) => s.durum === 'acik') ||
          olaylar.some((o) => o.durum === 'planlandi' && o.baslangic <= ufuk)

        return {
          dosya,
          muvekkil,
          ozet,
          acilIs,
          durumNotu: durumNotuUret(olaylar, sureler, finans),
        }
      }),
    )

    return satirlar
      .sort((a, b) => {
        if (a.acilIs !== b.acilIs) return a.acilIs ? -1 : 1
        return a.ozet.yuzde - b.ozet.yuzde
      })
      .slice(0, limit)
      .map(({ acilIs: _acilIs, ...satir }) => satir)
  }, [limit])
}

/** Dosyanın "şu an neyi bekliyor" cümlesi. */
function durumNotuUret(
  olaylar: Olay[],
  sureler: Sure[],
  finans: Array<{ kategori: string; odemeDurumu: string; baslik: string }>,
): string {
  const bugun = bugunIso()

  const bugunkuDurusma = olaylar.find(
    (o) => o.tur === 'durusma' && o.baslangic.slice(0, 10) === bugun,
  )
  if (bugunkuDurusma) return 'Duruşma bugün'

  const bekleyenBilirkisi = finans.find(
    (f) => f.kategori === 'bilirkisi' && f.odemeDurumu !== 'odendi',
  )
  if (bekleyenBilirkisi) return 'Bilirkişi bekleniyor'

  const acikSure = sureler
    .filter((s) => s.durum === 'acik')
    .sort((a, b) => a.sonTarih.localeCompare(b.sonTarih))[0]
  if (acikSure) return `${acikSure.kuralAdi} yaklaşıyor`

  const bekleyenOdeme = finans.find((f) => f.odemeDurumu === 'bekliyor')
  if (bekleyenOdeme) return `${bekleyenOdeme.baslik} bekliyor`

  const sonrakiDurusma = olaylar
    .filter((o) => o.tur === 'durusma' && o.baslangic.slice(0, 10) > bugun)
    .sort((a, b) => a.baslangic.localeCompare(b.baslangic))[0]
  if (sonrakiDurusma) return 'Duruşma bekleniyor'

  return 'Belge bekleniyor'
}

/* ------------------------------------------------------------------ *
 * Son hareketler ve ayarlar
 * ------------------------------------------------------------------ */

export function useSonHareketler(limit = 4): Hareket[] | undefined {
  return useLiveQuery(
    () => db.hareketler.orderBy('zaman').reverse().limit(limit).toArray(),
    [limit],
  )
}

export function useAyarlar(): Ayarlar | undefined {
  return useLiveQuery(() => db.ayarlar.get('tekil'), [])
}
