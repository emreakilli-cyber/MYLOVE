import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import { tekrarGunleri, type TekrarSikligi } from '../domain/tekrar'
import type { Dosya, Olay, OlayTuru } from '../domain/types'

/*
 * Takvim olaylarının yazma işlemleri. Her değişiklik hareket günlüğüne de
 * düşer — "Son hareketler" listesinin gerçek bir iz olması için.
 */

export interface OlayGirdisi {
  baslik: string
  tur: OlayTuru
  dosyaId?: string
  /** "2026-08-12" */
  gun: string
  /** "09:30" — tüm gün ise yok sayılır. */
  baslangicSaati?: string
  bitisSaati?: string
  tumGun: boolean
  yer?: string
  aciklama?: string
  /** Ayarlıysa seri olarak maddeleştirilir. */
  tekrar?: TekrarSikligi
  tekrarAdet?: number
}

/** Yerel gün + saat metnini tam ISO damgasına çevirir. */
function damgaKur(gun: string, saatMetni?: string): string {
  const [saatStr = '0', dakikaStr = '0'] = (saatMetni ?? '00:00').split(':')
  const d = new Date(`${gun}T00:00:00`)
  d.setHours(Number(saatStr), Number(dakikaStr), 0, 0)
  return d.toISOString()
}

async function hareketYaz(
  olay: Olay,
  baslik: string,
  tur: 'olay-eklendi',
): Promise<void> {
  const dosya = olay.dosyaId ? await db.dosyalar.get(olay.dosyaId) : undefined
  await db.hareketler.add({
    id: yeniId(),
    tur,
    baslik,
    ayrinti: dosya ? `${olay.baslik} · ${dosya.baslik}` : olay.baslik,
    ...(olay.dosyaId ? { dosyaId: olay.dosyaId } : {}),
    zaman: simdi(),
  })
}

export async function olayEkle(girdi: OlayGirdisi): Promise<string> {
  const dosya = girdi.dosyaId ? await db.dosyalar.get(girdi.dosyaId) : undefined
  const zaman = simdi()

  const seri = girdi.tekrar !== undefined && (girdi.tekrarAdet ?? 1) > 1
  const gunler = seri
    ? tekrarGunleri(girdi.gun, girdi.tekrar!, girdi.tekrarAdet ?? 1)
    : [girdi.gun]
  const seriesId = seri ? yeniId() : undefined

  const olaylar: Olay[] = gunler.map((gun) => ({
    id: yeniId(),
    baslik: girdi.baslik.trim(),
    tur: girdi.tur,
    ...(girdi.dosyaId ? { dosyaId: girdi.dosyaId } : {}),
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    baslangic: damgaKur(gun, girdi.tumGun ? '00:00' : girdi.baslangicSaati),
    ...(!girdi.tumGun && girdi.bitisSaati
      ? { bitis: damgaKur(gun, girdi.bitisSaati) }
      : {}),
    tumGun: girdi.tumGun,
    ...(girdi.yer?.trim() ? { yer: girdi.yer.trim() } : {}),
    ...(girdi.aciklama?.trim() ? { aciklama: girdi.aciklama.trim() } : {}),
    durum: 'planlandi',
    kaynak: 'manuel',
    ...(seriesId ? { seriesId } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  }))

  await db.olaylar.bulkAdd(olaylar)
  const ilk = olaylar[0]!
  await hareketYaz(
    ilk,
    seri
      ? `Takvime ${olaylar.length} tekrarlı kayıt eklendi`
      : 'Takvime kayıt eklendi',
    'olay-eklendi',
  )
  return ilk.id
}

export async function olayGuncelle(
  id: string,
  girdi: OlayGirdisi,
): Promise<void> {
  const dosya = girdi.dosyaId ? await db.dosyalar.get(girdi.dosyaId) : undefined

  await db.olaylar.update(id, {
    baslik: girdi.baslik.trim(),
    tur: girdi.tur,
    dosyaId: girdi.dosyaId || undefined,
    muvekkilId: dosya?.muvekkilId,
    baslangic: damgaKur(girdi.gun, girdi.tumGun ? '00:00' : girdi.baslangicSaati),
    bitis:
      !girdi.tumGun && girdi.bitisSaati
        ? damgaKur(girdi.gun, girdi.bitisSaati)
        : undefined,
    tumGun: girdi.tumGun,
    yer: girdi.yer?.trim() || undefined,
    aciklama: girdi.aciklama?.trim() || undefined,
    guncellemeTarihi: simdi(),
  })
}

export async function olaySil(id: string): Promise<void> {
  await db.olaylar.delete(id)
}

/** Serideki tüm olayları siler. */
export async function olaySeriSil(seriesId: string): Promise<void> {
  const anahtarlar = await db.olaylar
    .where('seriesId')
    .equals(seriesId)
    .primaryKeys()
  await db.olaylar.bulkDelete(anahtarlar as string[])
}

/** Bu serideki toplam olay sayısı (silme onayında gösterilir). */
export function useOlaySeriSayisi(seriesId: string | undefined): number {
  return (
    useLiveQuery(
      async () =>
        seriesId
          ? db.olaylar.where('seriesId').equals(seriesId).count()
          : 0,
      [seriesId],
    ) ?? 0
  )
}

export async function olayDurumunuDegistir(
  id: string,
  durum: Olay['durum'],
): Promise<void> {
  await db.olaylar.update(id, { durum, guncellemeTarihi: simdi() })
}

export function useOlay(id: string | undefined): Olay | undefined | null {
  return useLiveQuery(
    async () => (id ? ((await db.olaylar.get(id)) ?? null) : null),
    [id],
  )
}

/** Form içindeki dosya seçicisi — kapalı dosyalar listelenmez. */
export function useAcikDosyalar(): Dosya[] | undefined {
  return useLiveQuery(
    () =>
      db.dosyalar
        .filter((d) => d.durum !== 'kapali' && !d.arsivlendi)
        .sortBy('baslik'),
    [],
  )
}
