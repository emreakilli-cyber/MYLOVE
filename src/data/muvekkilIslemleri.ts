import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import type { Muvekkil, MuvekkilTuru } from '../domain/types'

/*
 * Müvekkil için yazma işlemleri. Müvekkil silmek, ona bağlı dosyalar varken
 * tehlikelidir; bu yüzden silme yalnızca bağlı dosya yoksa yapılır, aksi halde
 * arşive alınır (listeden düşer ama veri durur).
 */

export interface MuvekkilGirdisi {
  ad: string
  tur: MuvekkilTuru
  kimlikNo?: string
  telefon?: string
  eposta?: string
  adres?: string
  etiketler: string[]
  not?: string
}

function bosaCevir(deger: string | undefined): string | undefined {
  const k = deger?.trim()
  return k ? k : undefined
}

export async function muvekkilEkle(girdi: MuvekkilGirdisi): Promise<string> {
  const zaman = simdi()
  const id = yeniId()
  await db.muvekkiller.add({
    id,
    ad: girdi.ad.trim(),
    tur: girdi.tur,
    ...(bosaCevir(girdi.kimlikNo) ? { kimlikNo: bosaCevir(girdi.kimlikNo) } : {}),
    ...(bosaCevir(girdi.telefon) ? { telefon: bosaCevir(girdi.telefon) } : {}),
    ...(bosaCevir(girdi.eposta) ? { eposta: bosaCevir(girdi.eposta) } : {}),
    ...(bosaCevir(girdi.adres) ? { adres: bosaCevir(girdi.adres) } : {}),
    etiketler: girdi.etiketler.filter((e) => e.trim()),
    ...(bosaCevir(girdi.not) ? { not: bosaCevir(girdi.not) } : {}),
    arsivlendi: false,
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })
  await db.hareketler.add({
    id: yeniId(),
    tur: 'muvekkil-eklendi',
    baslik: 'Müvekkil eklendi',
    ayrinti: girdi.ad.trim(),
    zaman,
  })
  return id
}

export async function muvekkilGuncelle(
  id: string,
  girdi: MuvekkilGirdisi,
): Promise<void> {
  await db.muvekkiller.update(id, {
    ad: girdi.ad.trim(),
    tur: girdi.tur,
    kimlikNo: bosaCevir(girdi.kimlikNo),
    telefon: bosaCevir(girdi.telefon),
    eposta: bosaCevir(girdi.eposta),
    adres: bosaCevir(girdi.adres),
    etiketler: girdi.etiketler.filter((e) => e.trim()),
    not: bosaCevir(girdi.not),
    guncellemeTarihi: simdi(),
  })
}

export type MuvekkilSilmeSonucu = 'silindi' | 'arsivlendi'

/**
 * Bağlı dosya yoksa müvekkili tamamen siler; varsa arşive alır (veri kaybı
 * olmasın, ama liste temiz kalsın).
 */
export async function muvekkilSilVeyaArsivle(
  id: string,
): Promise<MuvekkilSilmeSonucu> {
  const dosyaSayisi = await db.dosyalar.where('muvekkilId').equals(id).count()
  if (dosyaSayisi > 0) {
    await db.muvekkiller.update(id, {
      arsivlendi: true,
      guncellemeTarihi: simdi(),
    })
    return 'arsivlendi'
  }
  // Dosyası olmayan müvekkil siliniyor: ona bağlı müvekkil-düzeyi kayıtları da
  // (görüşme notu, etkinlik günlüğü, dosyasız olay/görev/finans) temizle —
  // yetim kayıt ve silinen müvekkilin izi kalmasın (dosyaSil ile tutarlı).
  await db.transaction(
    'rw',
    [db.muvekkiller, db.notlar, db.hareketler, db.olaylar, db.gorevler, db.finans],
    async () => {
      await db.muvekkiller.delete(id)
      await db.notlar.where('muvekkilId').equals(id).delete()
      await db.hareketler.where('muvekkilId').equals(id).delete()
      await db.olaylar.where('muvekkilId').equals(id).delete()
      await db.gorevler.where('muvekkilId').equals(id).delete()
      await db.finans.where('muvekkilId').equals(id).delete()
    },
  )
  return 'silindi'
}

/** Müvekkile bağlı not ekler (görüşme geçmişi / genel not). */
export async function muvekkilNotEkle(
  muvekkilId: string,
  icerik: string,
  tur: 'gorusme' | 'genel' = 'gorusme',
): Promise<void> {
  const kirpik = icerik.trim()
  if (!kirpik) return
  const zaman = simdi()
  await db.notlar.add({
    id: yeniId(),
    icerik: kirpik,
    tur,
    muvekkilId,
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })
  const muvekkil = await db.muvekkiller.get(muvekkilId)
  await db.hareketler.add({
    id: yeniId(),
    tur: 'not-eklendi',
    baslik: tur === 'gorusme' ? 'Görüşme kaydedildi' : 'Müvekkil notu eklendi',
    ...(muvekkil ? { ayrinti: muvekkil.ad } : {}),
    ...(muvekkilId ? { muvekkilId } : {}),
    zaman,
  })
}

export function useMuvekkil(id: string | undefined): Muvekkil | undefined | null {
  return useLiveQuery(
    async () => (id ? ((await db.muvekkiller.get(id)) ?? null) : null),
    [id],
  )
}
