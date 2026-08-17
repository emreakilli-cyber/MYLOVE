import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import { bugunIso } from '../domain/tarih'
import type {
  Dosya,
  DosyaDurumu,
  DosyaTuru,
  KisiRolu,
  Muvekkil,
  MuvekkilTuru,
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

/**
 * Ada göre tüzel/gerçek kişi tahmini — satır içi müvekkil eklerken ön seçim
 * (kullanıcı sonra düzeltebilir). Şirket eklerini (A.Ş., Ltd., Şti., Holding,
 * İnşaat) arar.
 *
 * Neden `\b` değil `[\s.]`: JS'te `\b` yalnızca ASCII `\w` üzerinde çalışır;
 * Türkçe "ş/ı/İ" sözcük karakteri sayılmadığından `\b(a\.?ş)\b` gibi kalıplar
 * "A.Ş." / "Şti." / "İnşaat" için HİÇ eşleşmiyordu (yani en yaygın tüzel ekler
 * kaçıyor, şirketler "gerçek" işaretleniyordu). Önce `tr` küçük harfe indirip
 * (İ→i) sınırları elle `[\s.]` ile kuruyoruz; ada baş/son boşluk eklenir.
 */
export function muvekkilTuruTahmin(ad: string): MuvekkilTuru {
  const k = ` ${ad.toLocaleLowerCase('tr')} `
  return /[\s.](a\.?ş|ltd|şti|holding|inşaat)[\s.]/.test(k) ? 'tuzel' : 'gercek'
}

export async function dosyaEkle(girdi: DosyaGirdisi): Promise<string> {
  const zaman = simdi()

  // Gerekliyse yeni müvekkili hazırla (yazımı aşağıdaki transaction içinde).
  let muvekkilId = girdi.muvekkilId
  const yeniAd = bosaCevir(girdi.yeniMuvekkilAdi)
  const yeniMuvekkil: Muvekkil | null = yeniAd
    ? {
        id: yeniId(),
        ad: yeniAd,
        // Şirket eklerini basit bir sezgiyle tüzel say; kullanıcı sonra düzeltebilir.
        tur: muvekkilTuruTahmin(yeniAd),
        etiketler: [],
        arsivlendi: false,
        olusturmaTarihi: zaman,
        guncellemeTarihi: zaman,
      }
    : null
  if (yeniMuvekkil) muvekkilId = yeniMuvekkil.id

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

  // Satır içi müvekkil + dosya tek transaction'da: dosya yazımı başarısız
  // olursa yetim müvekkil kalmasın (ikisi de yazılır ya da hiçbiri).
  await db.transaction(
    'rw',
    [db.muvekkiller, db.dosyalar, db.hareketler],
    async () => {
      if (yeniMuvekkil) {
        await db.muvekkiller.add(yeniMuvekkil)
        await hareketYaz('muvekkil-eklendi', 'Müvekkil eklendi', yeniMuvekkil.ad)
      }
      await db.dosyalar.add(dosya)
      const muvekkil = yeniMuvekkil ?? (await db.muvekkiller.get(muvekkilId))
      await hareketYaz(
        'dosya-olusturuldu',
        'Yeni dosya oluşturuldu',
        muvekkil ? `${dosya.baslik} · ${muvekkil.ad}` : dosya.baslik,
        dosya.id,
      )
    },
  )
  return dosya.id
}

export async function dosyaGuncelle(
  id: string,
  girdi: DosyaGirdisi,
): Promise<void> {
  const zaman = simdi()
  const onceki = await db.dosyalar.get(id)

  // Satır içi yeni müvekkil düzenleme sırasında da seçilebilir. Önce hazırla,
  // yazımı aşağıdaki transaction içinde yap (dosyaEkle ile aynı akış). Hedef
  // müvekkil: yeni oluşturulan ya da seçilen. Boş gelirse (beklenmedik) eski
  // müvekkil korunur — dosya ASLA müvekkilsiz (`muvekkilId:''`) bırakılmaz;
  // aksi hâlde `yeniMuvekkilAdi` yok sayılıp dosya ve tüm bağlı finans/olay/
  // görev kayıtlarının `muvekkilId`'si silinirdi.
  const yeniAd = bosaCevir(girdi.yeniMuvekkilAdi)
  const yeniMuvekkil: Muvekkil | null = yeniAd
    ? {
        id: yeniId(),
        ad: yeniAd,
        tur: muvekkilTuruTahmin(yeniAd),
        etiketler: [],
        arsivlendi: false,
        olusturmaTarihi: zaman,
        guncellemeTarihi: zaman,
      }
    : null
  const hedefMuvekkilId =
    yeniMuvekkil?.id || girdi.muvekkilId || onceki?.muvekkilId || ''

  const guncelleme = {
    baslik: girdi.baslik.trim(),
    muvekkilId: hedefMuvekkilId,
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
    guncellemeTarihi: zaman,
  }

  // Müvekkil değiştiyse dosyaya bağlı kayıtlardaki denormalize `muvekkilId`'yi
  // eşitle. finans/olay/görev kayıtları oluşturulurken dosyanın müvekkilini
  // kopyalar; dosya başka müvekkile taşınınca bu kopyalar bayatlar. Özellikle
  // müvekkil bazlı finans (bekleyen ödeme) `finans.muvekkilId`'den okunduğu için
  // eski müvekkile yazılmaya devam ederdi. Kaynak doğruluğu dosyada; kopyalar
  // onu izlemeli. Yeni müvekkil yazımı + dosya güncellemesi + kopya eşitleme TEK
  // transaction'da: aralarında bir hata tutarsız durum bırakmasın.
  const muvekkilDegisti = !!onceki && onceki.muvekkilId !== hedefMuvekkilId
  if (yeniMuvekkil || muvekkilDegisti) {
    await db.transaction(
      'rw',
      [db.muvekkiller, db.dosyalar, db.finans, db.olaylar, db.gorevler, db.hareketler],
      async () => {
        if (yeniMuvekkil) {
          await db.muvekkiller.add(yeniMuvekkil)
          await hareketYaz('muvekkil-eklendi', 'Müvekkil eklendi', yeniMuvekkil.ad)
        }
        await db.dosyalar.update(id, guncelleme)
        if (muvekkilDegisti) {
          const yeni = { muvekkilId: hedefMuvekkilId }
          await db.finans.where('dosyaId').equals(id).modify(yeni)
          await db.olaylar.where('dosyaId').equals(id).modify(yeni)
          await db.gorevler.where('dosyaId').equals(id).modify(yeni)
        }
      },
    )
  } else {
    await db.dosyalar.update(id, guncelleme)
  }
}

export async function dosyaSil(id: string): Promise<void> {
  // Dosyaya bağlı her şeyi de temizle; yetim kayıt bırakma. Hareket günlüğü de
  // dahil: dosya silinince onun etkinlik satırları da gitmeli — hem tutarlılık
  // (yön açıklaması "yetim kayıt bırakma") hem gizlilik (silinen dosyanın adı
  // "Son hareketler" akışında kalmasın).
  await db.transaction(
    'rw',
    [db.dosyalar, db.olaylar, db.sureler, db.gorevler, db.finans, db.belgeler, db.kisiler, db.notlar, db.hareketler],
    async () => {
      await db.dosyalar.delete(id)
      await db.olaylar.where('dosyaId').equals(id).delete()
      await db.sureler.where('dosyaId').equals(id).delete()
      await db.gorevler.where('dosyaId').equals(id).delete()
      await db.finans.where('dosyaId').equals(id).delete()
      await db.belgeler.where('dosyaId').equals(id).delete()
      await db.kisiler.where('dosyaId').equals(id).delete()
      await db.notlar.where('dosyaId').equals(id).delete()
      await db.hareketler.where('dosyaId').equals(id).delete()
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
