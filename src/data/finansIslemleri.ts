import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import type {
  FinansKategorisi,
  FinansKaydi,
  FinansYonu,
  Kurus,
} from '../domain/types'

/*
 * Finans kaydı yazma işlemleri. Ödenen tutar ayrı tutulur: kısmi ödemede
 * "tahsil edilen" ile "bekleyen" ayrı hesaplanabilsin.
 */

export interface FinansGirdisi {
  dosyaId: string
  yon: FinansYonu
  kategori: FinansKategorisi
  baslik: string
  tutar: Kurus
  odenenTutar: Kurus
  tarih: string
  vadeTarihi?: string
  odemeDurumu: 'bekliyor' | 'odendi' | 'kismi'
  aciklama?: string
}

function bosaCevir(v: string | undefined): string | undefined {
  const k = v?.trim()
  return k ? k : undefined
}

/** Ödeme durumunu ödenen/toplam oranından tutarlı biçimde türetir. */
function durumNormalize(
  tutar: Kurus,
  odenen: Kurus,
): FinansKaydi['odemeDurumu'] {
  if (odenen <= 0) return 'bekliyor'
  if (odenen >= tutar) return 'odendi'
  return 'kismi'
}

/**
 * Ödenen tutarı [0, toplam] aralığına kırpar. Toplamı aşan (yanlışlıkla fazla
 * girilen) ya da negatif ödeme, negatif "bekleyen" bakiyesi veya şişmiş tahsilat
 * toplamı üretmesin — bekleyen = tutar − odenenTutar her zaman ≥ 0 kalır.
 */
function odenenKirp(tutar: Kurus, odenen: Kurus): Kurus {
  return Math.max(0, Math.min(odenen, tutar))
}

export async function finansEkle(girdi: FinansGirdisi): Promise<string> {
  const zaman = simdi()
  const id = yeniId()
  const dosya = await db.dosyalar.get(girdi.dosyaId)
  const odenen = odenenKirp(girdi.tutar, girdi.odenenTutar)
  const durum = durumNormalize(girdi.tutar, odenen)

  await db.finans.add({
    id,
    dosyaId: girdi.dosyaId,
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    yon: girdi.yon,
    kategori: girdi.kategori,
    baslik: girdi.baslik.trim(),
    tutar: girdi.tutar,
    odenenTutar: odenen,
    tarih: girdi.tarih,
    ...(bosaCevir(girdi.vadeTarihi)
      ? { vadeTarihi: bosaCevir(girdi.vadeTarihi) }
      : {}),
    odemeDurumu: durum,
    ...(durum === 'odendi' ? { odemeTarihi: girdi.tarih } : {}),
    ...(bosaCevir(girdi.aciklama) ? { aciklama: bosaCevir(girdi.aciklama) } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })

  await db.hareketler.add({
    id: yeniId(),
    tur: 'odeme-kaydedildi',
    baslik: girdi.yon === 'gelir' ? 'Tahsilat kaydedildi' : 'Gider kaydedildi',
    ayrinti: dosya ? `${girdi.baslik} · ${dosya.baslik}` : girdi.baslik,
    dosyaId: girdi.dosyaId,
    zaman,
  })
  return id
}

export async function finansGuncelle(
  id: string,
  girdi: FinansGirdisi,
): Promise<void> {
  const odenen = odenenKirp(girdi.tutar, girdi.odenenTutar)
  const durum = durumNormalize(girdi.tutar, odenen)
  await db.finans.update(id, {
    yon: girdi.yon,
    kategori: girdi.kategori,
    baslik: girdi.baslik.trim(),
    tutar: girdi.tutar,
    odenenTutar: odenen,
    tarih: girdi.tarih,
    vadeTarihi: bosaCevir(girdi.vadeTarihi),
    odemeDurumu: durum,
    odemeTarihi: durum === 'odendi' ? girdi.tarih : undefined,
    aciklama: bosaCevir(girdi.aciklama),
    guncellemeTarihi: simdi(),
  })
}

/** Finans kaydını ve ona bağlı dekont/makbuzları birlikte siler. */
export async function finansSil(id: string): Promise<void> {
  await db.transaction('rw', [db.finans, db.belgeler], async () => {
    await db.finans.delete(id)
    await db.belgeler.where('finansKaydiId').equals(id).delete()
  })
}

/** Bekleyen kaydı tamamen ödendi olarak işaretler. */
export async function odemeTamamla(id: string): Promise<void> {
  const kayit = await db.finans.get(id)
  if (!kayit) return
  await db.finans.update(id, {
    odenenTutar: kayit.tutar,
    odemeDurumu: 'odendi',
    odemeTarihi: simdi().slice(0, 10),
    guncellemeTarihi: simdi(),
  })
}

export function useFinansKaydi(
  id: string | undefined,
): FinansKaydi | undefined | null {
  return useLiveQuery(
    async () => (id ? ((await db.finans.get(id)) ?? null) : null),
    [id],
  )
}

export const kategoriEtiketleri: Record<FinansKategorisi, string> = {
  harc: 'Harç',
  'gider-avansi': 'Gider avansı',
  bilirkisi: 'Bilirkişi ücreti',
  kesif: 'Keşif gideri',
  teblig: 'Tebligat masrafı',
  arabuluculuk: 'Arabuluculuk ücreti',
  noter: 'Noter masrafı',
  'icra-masrafi': 'İcra masrafı',
  'muvekkil-avansi': 'Müvekkil avansı',
  'vekalet-ucreti': 'Vekâlet ücreti',
  diger: 'Diğer',
}

/** Kategorinin varsayılan yönü (gelir mi gider mi) — formda ön seçim. */
export const kategoriYonu: Record<FinansKategorisi, FinansYonu> = {
  harc: 'gider',
  'gider-avansi': 'gider',
  bilirkisi: 'gider',
  kesif: 'gider',
  teblig: 'gider',
  arabuluculuk: 'gider',
  noter: 'gider',
  'icra-masrafi': 'gider',
  'muvekkil-avansi': 'gelir',
  'vekalet-ucreti': 'gelir',
  diger: 'gider',
}
