import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import { bugunIso } from '../domain/tarih'
import type {
  Dosya,
  DosyaDurumu,
  DosyaTuru,
  KisiRolu,
  Muvekkil,
  NotTuru,
} from '../domain/types'

/*
 * Dosya, müvekkil, not ve ilgili kişi için yazma işlemleri.
 *
 * Yeni bir dosya girilirken müvekkil de yoksa aynı akışta oluşturulabilsin
 * diye müvekkil ekleme buraya konuldu — kullanıcı iki ayrı ekran arasında
 * gidip gelmesin.
 */

export interface DosyaGirdisi {
  baslik: string
  muvekkilId: string
  /** Dolu ise yeni müvekkil oluşturulur ve muvekkilId yok sayılır. */
  yeniMuvekkilAdi?: string
  tur: DosyaTuru
  durum: DosyaDurumu
  konu?: string
  mahkeme?: string
  esasNo?: string
  karsiTaraf?: string
  not?: string
}

async function hareketYaz(
  tur: 'dosya-olusturuldu' | 'muvekkil-eklendi' | 'not-eklendi',
  baslik: string,
  ayrinti: string,
  dosyaId?: string,
): Promise<void> {
  await db.hareketler.add({
    id: yeniId(),
    tur,
    baslik,
    ayrinti,
    ...(dosyaId ? { dosyaId } : {}),
    zaman: simdi(),
  })
}

function bosaCevir(deger: string | undefined): string | undefined {
  const kirpik = deger?.trim()
  return kirpik ? kirpik : undefined
}

export async function dosyaEkle(girdi: DosyaGirdisi): Promise<string> {
  const zaman = simdi()

  // Gerekliyse önce müvekkili oluştur.
  let muvekkilId = girdi.muvekkilId
  const yeniAd = bosaCevir(girdi.yeniMuvekkilAdi)
  if (yeniAd) {
    muvekkilId = yeniId()
    const muvekkil: Muvekkil = {
      id: muvekkilId,
      ad: yeniAd,
      // Şirket eklerini basit bir sezgiyle tüzel say; kullanıcı sonra düzeltebilir.
      tur: /\b(a\.?ş\.?|ltd\.?|şti\.?|holding|inş)\b/i.test(yeniAd)
        ? 'tuzel'
        : 'gercek',
      etiketler: [],
      arsivlendi: false,
      olusturmaTarihi: zaman,
      guncellemeTarihi: zaman,
    }
    await db.muvekkiller.add(muvekkil)
    await hareketYaz('muvekkil-eklendi', 'Müvekkil eklendi', yeniAd)
  }

  const dosya: Dosya = {
    id: yeniId(),
    baslik: girdi.baslik.trim(),
    muvekkilId,
    tur: girdi.tur,
    durum: girdi.durum,
    ...(bosaCevir(girdi.konu) ? { konu: bosaCevir(girdi.konu) } : {}),
    ...(bosaCevir(girdi.mahkeme) ? { mahkeme: bosaCevir(girdi.mahkeme) } : {}),
    ...(bosaCevir(girdi.esasNo) ? { esasNo: bosaCevir(girdi.esasNo) } : {}),
    ...(bosaCevir(girdi.karsiTaraf)
      ? { karsiTaraf: bosaCevir(girdi.karsiTaraf) }
      : {}),
    acilisTarihi: bugunIso(),
    ...(bosaCevir(girdi.not) ? { not: bosaCevir(girdi.not) } : {}),
    arsivlendi: false,
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  }

  await db.dosyalar.add(dosya)
  const muvekkil = await db.muvekkiller.get(muvekkilId)
  await hareketYaz(
    'dosya-olusturuldu',
    'Yeni dosya oluşturuldu',
    muvekkil ? `${dosya.baslik} · ${muvekkil.ad}` : dosya.baslik,
    dosya.id,
  )
  return dosya.id
}

export async function dosyaGuncelle(
  id: string,
  girdi: DosyaGirdisi,
): Promise<void> {
  await db.dosyalar.update(id, {
    baslik: girdi.baslik.trim(),
    muvekkilId: girdi.muvekkilId,
    tur: girdi.tur,
    durum: girdi.durum,
    konu: bosaCevir(girdi.konu),
    mahkeme: bosaCevir(girdi.mahkeme),
    esasNo: bosaCevir(girdi.esasNo),
    karsiTaraf: bosaCevir(girdi.karsiTaraf),
    not: bosaCevir(girdi.not),
    // Dosya kapatılıyorsa kapanış tarihini damgala.
    ...(girdi.durum === 'kapali'
      ? { kapanisTarihi: bugunIso() }
      : { kapanisTarihi: undefined }),
    guncellemeTarihi: simdi(),
  })
}

export async function dosyaSil(id: string): Promise<void> {
  // Dosyaya bağlı her şeyi de temizle; yetim kayıt bırakma.
  await db.transaction(
    'rw',
    [db.dosyalar, db.olaylar, db.sureler, db.gorevler, db.finans, db.belgeler, db.kisiler, db.notlar],
    async () => {
      await db.dosyalar.delete(id)
      await db.olaylar.where('dosyaId').equals(id).delete()
      await db.sureler.where('dosyaId').equals(id).delete()
      await db.gorevler.where('dosyaId').equals(id).delete()
      await db.finans.where('dosyaId').equals(id).delete()
      await db.belgeler.where('dosyaId').equals(id).delete()
      await db.kisiler.where('dosyaId').equals(id).delete()
      await db.notlar.where('dosyaId').equals(id).delete()
    },
  )
}

/* ------------------------------------------------------------------ *
 * Not ve ilgili kişi
 * ------------------------------------------------------------------ */

export async function notEkle(
  dosyaId: string,
  icerik: string,
  tur: NotTuru = 'genel',
  baslik?: string,
): Promise<void> {
  const kirpik = icerik.trim()
  if (!kirpik) return
  const zaman = simdi()
  await db.notlar.add({
    id: yeniId(),
    icerik: kirpik,
    tur,
    dosyaId,
    ...(baslik?.trim() ? { baslik: baslik.trim() } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })
  const dosya = await db.dosyalar.get(dosyaId)
  await hareketYaz(
    'not-eklendi',
    'Dosya notu eklendi',
    dosya ? `${baslik?.trim() || 'Not'} · ${dosya.baslik}` : 'Not',
    dosyaId,
  )
}

export async function notSil(id: string): Promise<void> {
  await db.notlar.delete(id)
}

export async function kisiEkle(
  dosyaId: string,
  ad: string,
  rol: KisiRolu,
  telefon?: string,
): Promise<void> {
  const kirpik = ad.trim()
  if (!kirpik) return
  const zaman = simdi()
  await db.kisiler.add({
    id: yeniId(),
    dosyaId,
    ad: kirpik,
    rol,
    ...(telefon?.trim() ? { telefon: telefon.trim() } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })
}

export async function kisiSil(id: string): Promise<void> {
  await db.kisiler.delete(id)
}

/* ------------------------------------------------------------------ *
 * Form yardımcıları
 * ------------------------------------------------------------------ */

export function useDosya(id: string | undefined): Dosya | undefined | null {
  return useLiveQuery(
    async () => (id ? ((await db.dosyalar.get(id)) ?? null) : null),
    [id],
  )
}

export function useMuvekkiller(): Muvekkil[] | undefined {
  return useLiveQuery(
    () => db.muvekkiller.filter((m) => !m.arsivlendi).sortBy('ad'),
    [],
  )
}

export const kisiRolEtiketleri: Record<KisiRolu, string> = {
  'karsi-taraf': 'Karşı taraf',
  'karsi-vekil': 'Karşı vekil',
  hakim: 'Hâkim',
  bilirkisi: 'Bilirkişi',
  tanik: 'Tanık',
  arabulucu: 'Arabulucu',
  'icra-muduru': 'İcra müdürü',
  diger: 'Diğer',
}
