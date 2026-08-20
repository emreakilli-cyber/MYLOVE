import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { IconName } from '../components/Icon'
import type { IsoDate } from '../domain/types'
import { aciliyetAksani, olayGorunumleri, type Accent } from '../domain/olay'
import { aciliyet, dateToIsoDate, saat } from '../domain/tarih'

/*
 * Takvim, iki ayrı kaynağı tek zaman çizelgesinde gösterir: kullanıcının
 * girdiği olaylar ve süre motorunun ürettiği son tarihler. Ekranın ikisini
 * ayrı ayrı bilmesi gerekmesin diye burada ortak bir öğeye indirgeniyor.
 */

export interface TakvimOgesi {
  readonly id: string
  readonly kaynak: 'olay' | 'sure'
  readonly gun: IsoDate
  /** Saatli olaylarda "09:30"; son tarihlerde yok (gün boyu). */
  readonly saat?: string
  readonly baslik: string
  readonly altBaslik?: string
  readonly yer?: string
  readonly accent: Accent
  readonly icon: IconName
  readonly dosyaId?: string
  readonly tamamlandi: boolean
  /** Gün içi sıralama: saatli olaylar saatine göre, süreler en üstte. */
  readonly siraAnahtari: string
}

export interface GunGrubu {
  readonly gun: IsoDate
  readonly ogeler: TakvimOgesi[]
}

/**
 * Yerel gün aralığını, olay sorgusunda kullanılacak UTC zaman-damgası sınırlarına
 * çevirir. Olaylar UTC damgası tutar ama takvim YEREL güne kovalar; aralık
 * sınırlarını da yerel gün başlangıç/bitişinden türetmeliyiz. Naif
 * `${gun}T00:00:00.000Z` yerel gece yarısını UTC sayardı; UTC+3'te ilk günün
 * tüm-gün olayları (yerel gece yarısı = önceki gün 21:00Z) `basGunT00:00Z`'nin
 * ÖNCESİNE düşüp aralık dışında kalır, takvimden kaybolurdu. `new Date(...T00:00:00)`
 * (Z'siz) yerel yorumlanır → toISOString doğru UTC anını verir.
 */
export function gunAraligiUtcSinirlari(
  basGun: IsoDate,
  sonGun: IsoDate,
): { basDamga: string; sonDamga: string } {
  return {
    basDamga: new Date(`${basGun}T00:00:00`).toISOString(),
    sonDamga: new Date(`${sonGun}T23:59:59.999`).toISOString(),
  }
}

/** Verilen ISO gün aralığındaki her şeyi güne göre gruplanmış döndürür. */
async function araliktakiOgeler(
  basGun: IsoDate,
  sonGun: IsoDate,
): Promise<TakvimOgesi[]> {
  const { basDamga, sonDamga } = gunAraligiUtcSinirlari(basGun, sonGun)

  const [olaylar, sureler] = await Promise.all([
    db.olaylar.where('baslangic').between(basDamga, sonDamga, true, true).toArray(),
    db.sureler.where('sonTarih').between(basGun, sonGun, true, true).toArray(),
  ])

  const dosyaIdleri = new Set<string>()
  for (const o of olaylar) if (o.dosyaId) dosyaIdleri.add(o.dosyaId)
  for (const s of sureler) dosyaIdleri.add(s.dosyaId)

  const dosyalar = new Map(
    (await db.dosyalar.bulkGet([...dosyaIdleri]))
      .filter((d) => d !== undefined)
      .map((d) => [d.id, d]),
  )

  const ogeler: TakvimOgesi[] = []

  for (const olay of olaylar) {
    if (olay.durum === 'iptal') continue
    // Süre motorunun ürettiği son-tarih olayları burada gösterilmez: aynı son
    // gün zaten aşağıda `sureler`'den çiziliyor. (Eski sürümlerde bu olaylar
    // yazılmış olabilir; okuma anında eleyerek çift satırı önlüyoruz.)
    if (olay.kaynak === 'sure-hesabi') continue
    const gorunum = olayGorunumleri[olay.tur]
    const baslangicTarihi = new Date(olay.baslangic)
    const gun = dateToIsoDate(baslangicTarihi)
    const saatMetni = olay.tumGun ? undefined : saat(baslangicTarihi)

    ogeler.push({
      id: olay.id,
      kaynak: 'olay',
      gun,
      ...(saatMetni ? { saat: saatMetni } : {}),
      baslik: olay.baslik,
      ...(olay.dosyaId
        ? { altBaslik: dosyalar.get(olay.dosyaId)?.baslik, dosyaId: olay.dosyaId }
        : {}),
      ...(olay.yer ? { yer: olay.yer } : {}),
      accent: gorunum.accent,
      icon: gorunum.icon,
      tamamlandi: olay.durum === 'tamamlandi',
      siraAnahtari: saatMetni ?? '00:00',
    })
  }

  for (const sure of sureler) {
    if (sure.durum === 'iptal') continue
    const dosya = dosyalar.get(sure.dosyaId)
    ogeler.push({
      id: sure.id,
      kaynak: 'sure',
      gun: sure.sonTarih,
      baslik: sure.kuralAdi,
      ...(dosya ? { altBaslik: dosya.baslik, dosyaId: sure.dosyaId } : {}),
      accent:
        sure.durum === 'tamamlandi'
          ? 'green'
          : aciliyetAksani[aciliyet(sure.sonTarih)],
      icon: 'calendar-clock',
      tamamlandi: sure.durum === 'tamamlandi',
      // Son tarihler günün en başında dursun: saatten bağımsız, gün boyu geçerli.
      siraAnahtari: '',
    })
  }

  return ogeler.sort(
    (a, b) =>
      a.gun.localeCompare(b.gun) || a.siraAnahtari.localeCompare(b.siraAnahtari),
  )
}

function grupla(ogeler: TakvimOgesi[]): GunGrubu[] {
  const harita = new Map<IsoDate, TakvimOgesi[]>()
  for (const oge of ogeler) {
    const mevcut = harita.get(oge.gun)
    if (mevcut) mevcut.push(oge)
    else harita.set(oge.gun, [oge])
  }
  return [...harita.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gun, gunOgeleri]) => ({ gun, ogeler: gunOgeleri }))
}

/** Ay görünümü: ızgarada görünen tüm günleri kapsayacak şekilde geniş aralık. */
export function useAyOgeleri(
  yil: number,
  ay: number,
): Map<IsoDate, TakvimOgesi[]> | undefined {
  return useLiveQuery(async () => {
    // Izgara önceki ayın son günlerini ve sonraki ayın ilk günlerini de gösterir.
    const bas = new Date(yil, ay, 1)
    bas.setDate(bas.getDate() - 7)
    const son = new Date(yil, ay + 1, 0)
    son.setDate(son.getDate() + 14)

    const ogeler = await araliktakiOgeler(dateToIsoDate(bas), dateToIsoDate(son))
    const harita = new Map<IsoDate, TakvimOgesi[]>()
    for (const oge of ogeler) {
      const mevcut = harita.get(oge.gun)
      if (mevcut) mevcut.push(oge)
      else harita.set(oge.gun, [oge])
    }
    return harita
  }, [yil, ay])
}

/** Ajanda: bugünden itibaren N gün, güne göre gruplanmış. */
export function useAjanda(gunSayisi = 30): GunGrubu[] | undefined {
  return useLiveQuery(async () => {
    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const son = new Date(bugun.getTime() + gunSayisi * 86_400_000)
    return grupla(
      await araliktakiOgeler(dateToIsoDate(bugun), dateToIsoDate(son)),
    )
  }, [gunSayisi])
}

/** Hafta şeridi: verilen günü içeren pazartesi–pazar aralığı. */
export function useHaftaOgeleri(
  ankraj: IsoDate,
): Map<IsoDate, TakvimOgesi[]> | undefined {
  return useLiveQuery(async () => {
    const { bas, son } = haftaSinirlari(ankraj)
    const ogeler = await araliktakiOgeler(dateToIsoDate(bas), dateToIsoDate(son))
    const harita = new Map<IsoDate, TakvimOgesi[]>()
    for (const oge of ogeler) {
      const mevcut = harita.get(oge.gun)
      if (mevcut) mevcut.push(oge)
      else harita.set(oge.gun, [oge])
    }
    return harita
  }, [ankraj])
}

/** Türkiye'de hafta pazartesi başlar. */
export function haftaSinirlari(gun: IsoDate): { bas: Date; son: Date } {
  const d = new Date(`${gun}T00:00:00`)
  const haftaGunu = (d.getDay() + 6) % 7 // Pazartesi = 0
  const bas = new Date(d)
  bas.setDate(d.getDate() - haftaGunu)
  const son = new Date(bas)
  son.setDate(bas.getDate() + 6)
  return { bas, son }
}
