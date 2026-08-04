import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
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
}

function bosaCevir(v: string | undefined): string | undefined {
  const k = v?.trim()
  return k ? k : undefined
}

export async function gorevEkle(girdi: GorevGirdisi): Promise<string> {
  const zaman = simdi()
  const id = yeniId()
  const dosya = girdi.dosyaId ? await db.dosyalar.get(girdi.dosyaId) : undefined
  await db.gorevler.add({
    id,
    baslik: girdi.baslik.trim(),
    ...(girdi.dosyaId ? { dosyaId: girdi.dosyaId } : {}),
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    ...(bosaCevir(girdi.aciklama) ? { aciklama: bosaCevir(girdi.aciklama) } : {}),
    ...(bosaCevir(girdi.vadeTarihi)
      ? { vadeTarihi: bosaCevir(girdi.vadeTarihi) }
      : {}),
    oncelik: girdi.oncelik,
    durum: 'bekliyor',
    ...(girdi.atananKullaniciId
      ? { atananKullaniciId: girdi.atananKullaniciId }
      : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })
  return id
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
