import { db } from './db'
import type { Ayarlar, HatirlatmaKanali, OlayTuru } from '../domain/types'
import { VARSAYILAN_HATIRLATMA_OFSETLERI } from '../domain/types'

/*
 * Ayar yazma işlemleri. Ayarlar tek satırlık bir kayıttır (id: 'tekil'); yoksa
 * varsayılanla oluşturulur.
 */

const VARSAYILAN_AYARLAR: Ayarlar = {
  id: 'tekil',
  kullaniciAdi: 'Ayşe Kaya',
  unvan: 'Kıdemli avukat',
  hatirlatmaOfsetleri: {
    durusma: [...VARSAYILAN_HATIRLATMA_OFSETLERI],
    'son-tarih': [...VARSAYILAN_HATIRLATMA_OFSETLERI],
  },
  varsayilanKanallar: ['uygulama'],
  kilitEtkin: false,
  llmEtkin: false,
}

async function mevcutAyarlar(): Promise<Ayarlar> {
  return (await db.ayarlar.get('tekil')) ?? VARSAYILAN_AYARLAR
}

export async function ayarlariGuncelle(
  yama: Partial<Omit<Ayarlar, 'id'>>,
): Promise<void> {
  const mevcut = await mevcutAyarlar()
  await db.ayarlar.put({ ...mevcut, ...yama, id: 'tekil' })
}

/** Bir olay türünün hatırlatma ofsetlerini (dakika) günceller. */
export async function hatirlatmaProfiliGuncelle(
  tur: OlayTuru,
  ofsetler: number[],
): Promise<void> {
  const mevcut = await mevcutAyarlar()
  await db.ayarlar.put({
    ...mevcut,
    hatirlatmaOfsetleri: {
      ...mevcut.hatirlatmaOfsetleri,
      [tur]: [...ofsetler].sort((a, b) => b - a),
    },
    id: 'tekil',
  })
}

export async function kanallariGuncelle(
  kanallar: HatirlatmaKanali[],
): Promise<void> {
  await ayarlariGuncelle({ varsayilanKanallar: kanallar })
}

/** Standart hatırlatma ofsetleri ve okunur etiketleri (dakika cinsinden). */
export const HATIRLATMA_SECENEKLERI: ReadonlyArray<{
  ofset: number
  etiket: string
}> = [
  { ofset: 30 * 24 * 60, etiket: '30 gün önce' },
  { ofset: 15 * 24 * 60, etiket: '15 gün önce' },
  { ofset: 7 * 24 * 60, etiket: '7 gün önce' },
  { ofset: 3 * 24 * 60, etiket: '3 gün önce' },
  { ofset: 1 * 24 * 60, etiket: '1 gün önce' },
  { ofset: 0, etiket: 'Aynı gün' },
  { ofset: 60, etiket: '1 saat önce' },
]

export function ofsetEtiketi(ofset: number): string {
  const bulunan = HATIRLATMA_SECENEKLERI.find((s) => s.ofset === ofset)
  if (bulunan) return bulunan.etiket
  if (ofset === 0) return 'Aynı gün'
  if (ofset < 60) return `${ofset} dk önce`
  if (ofset < 24 * 60) return `${Math.round(ofset / 60)} saat önce`
  return `${Math.round(ofset / (24 * 60))} gün önce`
}
