import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import { tekrarGunleri, type TekrarSikligi } from '../domain/tekrar'
import type { Gorev, GorevOnceligi, Kullanici } from '../domain/types'

/*
 * Görev yazma işlemleri ve genel görev sorguları.
 * "gorevDurumunuDegistir" zaten data/sorgular.ts içinde (panelden paylaşılıyor).
 */

export interface GorevGirdisi {
  baslik: string
  dosyaId?: string
  aciklama?: string
  vadeTarihi?: string
  oncelik: GorevOnceligi
  atananKullaniciId?: string
  /** Ayarlıysa seri olarak maddeleştirilir; vade tarihi gerektirir. */
  tekrar?: TekrarSikligi
  tekrarAdet?: number
}

function bosaCevir(v: string | undefined): string | undefined {
  const k = v?.trim()
  return k ? k : undefined
}

export async function gorevEkle(girdi: GorevGirdisi): Promise<string> {
  const zaman = simdi()
  const dosya = girdi.dosyaId ? await db.dosyalar.get(girdi.dosyaId) : undefined
  const vade = bosaCevir(girdi.vadeTarihi)

  // Tekrar yalnızca vade varsa anlamlı (yinelemeyi tarih taşır).
  const seri =
    girdi.tekrar !== undefined && (girdi.tekrarAdet ?? 1) > 1 && vade !== undefined
  const vadeler = seri
    ? tekrarGunleri(vade!, girdi.tekrar!, girdi.tekrarAdet ?? 1)
    : [vade]
  const seriesId = seri ? yeniId() : undefined

  const ortak = {
    baslik: girdi.baslik.trim(),
    ...(girdi.dosyaId ? { dosyaId: girdi.dosyaId } : {}),
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    ...(bosaCevir(girdi.aciklama) ? { aciklama: bosaCevir(girdi.aciklama) } : {}),
    oncelik: girdi.oncelik,
    durum: 'bekliyor' as const,
    ...(girdi.atananKullaniciId
      ? { atananKullaniciId: girdi.atananKullaniciId }
      : {}),
    ...(seriesId ? { seriesId } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  }

  const gorevler: Gorev[] = vadeler.map((v) => ({
    id: yeniId(),
    ...ortak,
    ...(v ? { vadeTarihi: v } : {}),
  }))

  await db.gorevler.bulkAdd(gorevler)
  return gorevler[0]!.id
}

export async function gorevGuncelle(
  id: string,
  girdi: GorevGirdisi,
): Promise<void> {
  const dosya = girdi.dosyaId ? await db.dosyalar.get(girdi.dosyaId) : undefined
  await db.gorevler.update(id, {
    baslik: girdi.baslik.trim(),
    dosyaId: girdi.dosyaId || undefined,
    muvekkilId: dosya?.muvekkilId,
    aciklama: bosaCevir(girdi.aciklama),
    vadeTarihi: bosaCevir(girdi.vadeTarihi),
    oncelik: girdi.oncelik,
    atananKullaniciId: girdi.atananKullaniciId || undefined,
    guncellemeTarihi: simdi(),
  })
}

export async function gorevSil(id: string): Promise<void> {
  await db.gorevler.delete(id)
}

/** Serideki tüm görevleri siler. */
export async function gorevSeriSil(seriesId: string): Promise<void> {
  const anahtarlar = await db.gorevler
    .where('seriesId')
    .equals(seriesId)
    .primaryKeys()
  await db.gorevler.bulkDelete(anahtarlar as string[])
}

/** Bu serideki toplam görev sayısı (silme onayında gösterilir). */
export function useGorevSeriSayisi(seriesId: string | undefined): number {
  return (
    useLiveQuery(
      async () =>
        seriesId ? db.gorevler.where('seriesId').equals(seriesId).count() : 0,
      [seriesId],
    ) ?? 0
  )
}

export function useGorev(id: string | undefined): Gorev | undefined | null {
  return useLiveQuery(
    async () => (id ? ((await db.gorevler.get(id)) ?? null) : null),
    [id],
  )
}

export function useKullanicilar(): Kullanici[] | undefined {
  return useLiveQuery(
    () => db.kullanicilar.filter((k) => k.aktif).sortBy('ad'),
    [],
  )
}

/** Sık kullanılan görev şablonları (şartname md. 9 örnekleri). */
export const gorevSablonlari: readonly string[] = [
  'Harç yatırılacak',
  'Dilekçe hazırlanacak',
  'Müvekkil aranacak',
  'Bilirkişi raporu beklenecek',
  'Evrak sisteme yüklenecek',
  'Gider avansı tamamlanacak',
  'Tanık listesi sunulacak',
  'Vekâletname alınacak',
]

export const oncelikEtiketleri: Record<GorevOnceligi, string> = {
  dusuk: 'Düşük',
  normal: 'Normal',
  yuksek: 'Yüksek',
}
