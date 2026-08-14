import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { hazirlikHesapla } from '../domain/hazirlik'
import { yerelGun } from '../domain/tarih'
import type {
  Belge,
  Dosya,
  DosyaDurumu,
  FinansKaydi,
  Gorev,
  HazirlikOzeti,
  Kisi,
  Muvekkil,
  Not,
  Olay,
  Sure,
} from '../domain/types'

/*
 * Dosya listesi ve dosya detayı sorguları.
 *
 * Liste tarafında arama ve süzme bellekte yapılıyor: bir hukuk bürosunun açık
 * dosya sayısı birkaç yüzü geçmez, IndexedDB'de tam metin indeksi kurmanın
 * karmaşıklığı bu ölçekte kendini ödemez.
 */

export interface DosyaSatiri {
  dosya: Dosya
  muvekkil?: Muvekkil
  ozet: HazirlikOzeti
  /** Bir sonraki duruşma veya süre — listede "sırada ne var" sütunu. */
  sonrakiIs?: { etiket: string; gun: string }
}

export type DosyaSuzgeci = 'tumu' | 'acik' | 'durusmasi-yaklasan' | 'kapali'

export const suzgecEtiketleri: Record<DosyaSuzgeci, string> = {
  tumu: 'Tümü',
  acik: 'Açık',
  'durusmasi-yaklasan': 'Duruşması yakın',
  kapali: 'Kapalı',
}

function eslesiyorMu(
  dosya: Dosya,
  muvekkil: Muvekkil | undefined,
  arama: string,
): boolean {
  if (!arama) return true
  // Türkçe'de "İ".toLowerCase() beklenen sonucu vermeyebiliyor; tr yerel
  // ayarıyla küçültmek "İSTANBUL" aramasının "İstanbul" ile eşleşmesini sağlar.
  const kucuk = (metin: string) => metin.toLocaleLowerCase('tr')
  const hedef = kucuk(arama.trim())
  return [
    dosya.baslik,
    dosya.konu,
    dosya.mahkeme,
    dosya.esasNo,
    dosya.karsiTaraf,
    muvekkil?.ad,
  ]
    .filter((x): x is string => Boolean(x))
    .some((alan) => kucuk(alan).includes(hedef))
}

export function useDosyaListesi(
  arama: string,
  suzgec: DosyaSuzgeci,
): DosyaSatiri[] | undefined {
  return useLiveQuery(async () => {
    const dosyalar = await db.dosyalar.toArray()
    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const ufuk = new Date(bugun.getTime() + 14 * 86_400_000).toISOString()

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

        // Sırada ne var: en yakın duruşma ile en yakın açık süreden erken olanı.
        const sonrakiOlay = olaylar
          .filter(
            (o) =>
              o.durum === 'planlandi' &&
              o.baslangic >= bugun.toISOString(),
          )
          .sort((a, b) => a.baslangic.localeCompare(b.baslangic))[0]
        const sonrakiSure = sureler
          .filter((s) => s.durum === 'acik')
          .sort((a, b) => a.sonTarih.localeCompare(b.sonTarih))[0]

        let sonrakiIs: DosyaSatiri['sonrakiIs']
        // Gösterilen "sıradaki iş" günü, takvimle aynı olsun diye yerel gün.
        const olayGunu = sonrakiOlay ? yerelGun(sonrakiOlay.baslangic) : undefined
        if (sonrakiOlay && olayGunu && (!sonrakiSure || olayGunu <= sonrakiSure.sonTarih)) {
          sonrakiIs = { etiket: sonrakiOlay.baslik, gun: olayGunu }
        } else if (sonrakiSure) {
          sonrakiIs = {
            etiket: sonrakiSure.kuralAdi,
            gun: sonrakiSure.sonTarih,
          }
        }

        const durusmasiYakin = olaylar.some(
          (o) =>
            o.tur === 'durusma' &&
            o.durum === 'planlandi' &&
            o.baslangic >= bugun.toISOString() &&
            o.baslangic <= ufuk,
        )

        return { dosya, muvekkil, ozet, sonrakiIs, durusmasiYakin }
      }),
    )

    return satirlar
      .filter(({ dosya, muvekkil, durusmasiYakin }) => {
        if (!eslesiyorMu(dosya, muvekkil, arama)) return false
        switch (suzgec) {
          case 'acik':
            return dosya.durum !== 'kapali' && !dosya.arsivlendi
          case 'kapali':
            return dosya.durum === 'kapali' || dosya.arsivlendi
          case 'durusmasi-yaklasan':
            return durusmasiYakin
          case 'tumu':
            return true
        }
      })
      .sort((a, b) => {
        // Yakın işi olan üstte; sonra alfabetik.
        const aGun = a.sonrakiIs?.gun ?? '9999'
        const bGun = b.sonrakiIs?.gun ?? '9999'
        return aGun.localeCompare(bGun) || a.dosya.baslik.localeCompare(b.dosya.baslik, 'tr')
      })
      .map(({ durusmasiYakin: _yakin, ...satir }) => satir)
  }, [arama, suzgec])
}

/* ------------------------------------------------------------------ *
 * Dosya detayı
 * ------------------------------------------------------------------ */

export interface DosyaDetayi {
  dosya: Dosya
  muvekkil?: Muvekkil
  ozet: HazirlikOzeti
  olaylar: Olay[]
  sureler: Sure[]
  gorevler: Gorev[]
  finans: FinansKaydi[]
  belgeler: Belge[]
  kisiler: Kisi[]
  notlar: Not[]
}

export function useDosyaDetayi(
  dosyaId: string | undefined,
): DosyaDetayi | undefined | null {
  return useLiveQuery(async () => {
    if (!dosyaId) return null
    const dosya = await db.dosyalar.get(dosyaId)
    if (!dosya) return null

    const [muvekkil, olaylar, sureler, gorevler, finans, belgeler, kisiler, notlar] =
      await Promise.all([
        db.muvekkiller.get(dosya.muvekkilId),
        db.olaylar.where('dosyaId').equals(dosya.id).toArray(),
        db.sureler.where('dosyaId').equals(dosya.id).toArray(),
        db.gorevler.where('dosyaId').equals(dosya.id).toArray(),
        db.finans.where('dosyaId').equals(dosya.id).toArray(),
        db.belgeler.where('dosyaId').equals(dosya.id).toArray(),
        db.kisiler.where('dosyaId').equals(dosya.id).toArray(),
        db.notlar.where('dosyaId').equals(dosya.id).toArray(),
      ])

    return {
      dosya,
      muvekkil,
      ozet: hazirlikHesapla({
        dosya,
        muvekkil,
        olaylar,
        sureler,
        gorevler,
        finans,
        belgeler,
      }),
      // Süre motorunun son-tarih olayları "Duruşmalar" sekmesinde gösterilmez:
      // son gün "Süreler" sekmesinde zaten var. (Eski kayıtlar için eleniyor.)
      olaylar: olaylar
        .filter((o) => o.kaynak !== 'sure-hesabi')
        .sort((a, b) => b.baslangic.localeCompare(a.baslangic)),
      sureler: sureler.sort((a, b) => a.sonTarih.localeCompare(b.sonTarih)),
      gorevler: gorevler.sort((a, b) => {
        if (a.durum !== b.durum) return a.durum === 'bekliyor' ? -1 : 1
        return (a.vadeTarihi ?? '9999').localeCompare(b.vadeTarihi ?? '9999')
      }),
      finans: finans.sort((a, b) => b.tarih.localeCompare(a.tarih)),
      belgeler: belgeler.sort((a, b) =>
        b.olusturmaTarihi.localeCompare(a.olusturmaTarihi),
      ),
      kisiler,
      notlar: notlar.sort((a, b) =>
        b.olusturmaTarihi.localeCompare(a.olusturmaTarihi),
      ),
    }
  }, [dosyaId])
}

export const dosyaDurumEtiketleri: Record<DosyaDurumu, string> = {
  hazirlik: 'Hazırlık',
  derdest: 'Derdest',
  istinaf: 'İstinaf',
  temyiz: 'Temyiz',
  infaz: 'İnfaz',
  kapali: 'Kapalı',
}

export const dosyaTuruEtiketleri: Record<Dosya['tur'], string> = {
  hukuk: 'Hukuk',
  is: 'İş',
  ticaret: 'Ticaret',
  ceza: 'Ceza',
  icra: 'İcra',
  idari: 'İdari',
  aile: 'Aile',
  tuketici: 'Tüketici',
  arabuluculuk: 'Arabuluculuk',
  diger: 'Diğer',
}

/** Dosyanın gelir–gider özeti. */
export function finansOzeti(kayitlar: FinansKaydi[]) {
  const gelir = kayitlar
    .filter((f) => f.yon === 'gelir')
    .reduce((t, f) => t + f.odenenTutar, 0)
  const gider = kayitlar
    .filter((f) => f.yon === 'gider')
    .reduce((t, f) => t + f.odenenTutar, 0)
  const bekleyen = kayitlar
    .filter((f) => f.odemeDurumu !== 'odendi')
    .reduce((t, f) => t + (f.tutar - f.odenenTutar), 0)
  return { gelir, gider, bakiye: gelir - gider, bekleyen }
}
