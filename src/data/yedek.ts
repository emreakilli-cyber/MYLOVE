import { db } from './db'
import { sifrele, sifreCoz, type SifreliZarf } from '../services/kripto'
import type {
  Ayarlar,
  Belge,
  Dosya,
  FinansKaydi,
  Gorev,
  Hareket,
  Hatirlatma,
  Kisi,
  Kullanici,
  Muvekkil,
  Not,
  Olay,
  Sure,
} from '../domain/types'

/*
 * Yedekleme ve geri yükleme.
 *
 * Veri cihazda durduğu için tarayıcı verisini temizlemek ya da telefonu
 * değiştirmek her şeyi silmek demek. Kullanıcının elinde taşınabilir tek bir
 * dosya olmalı: tüm tablolar + belge içerikleri tek JSON'da.
 *
 * Belgeler Blob olduğundan JSON'a doğrudan girmez; base64'e çevrilir. Bu
 * yedeği ~%33 büyütür, buna karşılık dosya tek parça ve her yerde açılabilir
 * kalır — e-posta ile kendine gönderebilmek zip'ten daha kıymetli.
 */

export const YEDEK_SURUMU = 1

interface YedekBelgesi extends Omit<Belge, 'icerik'> {
  /** Blob içeriğinin base64 karşılığı. */
  icerikBase64: string
}

export interface Yedek {
  bicim: 'juriscalendar-yedek'
  surum: number
  olusturmaZamani: string
  tablolar: {
    kullanicilar: Kullanici[]
    muvekkiller: Muvekkil[]
    dosyalar: Dosya[]
    olaylar: Olay[]
    sureler: Sure[]
    gorevler: Gorev[]
    finans: FinansKaydi[]
    belgeler: YedekBelgesi[]
    kisiler: Kisi[]
    notlar: Not[]
    hatirlatmalar: Hatirlatma[]
    hareketler: Hareket[]
    ayarlar: Ayarlar[]
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const tampon = new Uint8Array(await blob.arrayBuffer())
  // btoa karakter karakter çalışır; büyük dosyada yığın taşmasın diye parçalı.
  let ikili = ''
  const parca = 0x8000
  for (let i = 0; i < tampon.length; i += parca) {
    ikili += String.fromCharCode(...tampon.subarray(i, i + parca))
  }
  return btoa(ikili)
}

function base64ToBlob(base64: string, mimeTur: string): Blob {
  const ikili = atob(base64)
  const tampon = new Uint8Array(ikili.length)
  for (let i = 0; i < ikili.length; i++) tampon[i] = ikili.charCodeAt(i)
  return new Blob([tampon], { type: mimeTur })
}

/** Tüm veritabanını tek bir yedek nesnesine çıkarır. */
export async function yedekOlustur(): Promise<Yedek> {
  const [
    kullanicilar,
    muvekkiller,
    dosyalar,
    olaylar,
    sureler,
    gorevler,
    finans,
    belgeler,
    kisiler,
    notlar,
    hatirlatmalar,
    hareketler,
    ayarlar,
  ] = await Promise.all([
    db.kullanicilar.toArray(),
    db.muvekkiller.toArray(),
    db.dosyalar.toArray(),
    db.olaylar.toArray(),
    db.sureler.toArray(),
    db.gorevler.toArray(),
    db.finans.toArray(),
    db.belgeler.toArray(),
    db.kisiler.toArray(),
    db.notlar.toArray(),
    db.hatirlatmalar.toArray(),
    db.hareketler.toArray(),
    db.ayarlar.toArray(),
  ])

  const belgelerBase64: YedekBelgesi[] = await Promise.all(
    belgeler.map(async ({ icerik, ...geri }) => ({
      ...geri,
      icerikBase64: await blobToBase64(icerik),
    })),
  )

  return {
    bicim: 'juriscalendar-yedek',
    surum: YEDEK_SURUMU,
    olusturmaZamani: new Date().toISOString(),
    tablolar: {
      kullanicilar,
      muvekkiller,
      dosyalar,
      olaylar,
      sureler,
      gorevler,
      finans,
      belgeler: belgelerBase64,
      kisiler,
      notlar,
      hatirlatmalar,
      hareketler,
      ayarlar,
    },
  }
}

function indir(icerik: string, mime: string, ad: string): void {
  const blob = new Blob([icerik], { type: mime })
  const adres = URL.createObjectURL(blob)
  const baglanti = document.createElement('a')
  baglanti.href = adres
  baglanti.download = ad
  baglanti.click()
  URL.revokeObjectURL(adres)
}

/**
 * Yedeği indirir. Parola verilirse dosya AES-GCM ile şifrelenir — müvekkil
 * verisi cihaz dışına yalnızca şifreli çıkar.
 */
export async function yedegiIndir(parola?: string): Promise<void> {
  const yedek = await yedekOlustur()
  const damga = new Date().toISOString().slice(0, 10)
  const govde = JSON.stringify(yedek)

  if (parola?.trim()) {
    const zarf = await sifrele(govde, parola)
    indir(
      JSON.stringify(zarf),
      'application/json',
      `juriscalendar-yedek-${damga}.jcenc`,
    )
  } else {
    indir(govde, 'application/json', `juriscalendar-yedek-${damga}.json`)
  }

  await db.ayarlar.update('tekil', {
    sonYedeklemeZamani: yedek.olusturmaZamani,
  })
}

export class YedekHatasi extends Error {}

function dogrula(veri: unknown): asserts veri is Yedek {
  if (typeof veri !== 'object' || veri === null) {
    throw new YedekHatasi('Dosya okunamadı.')
  }
  const aday = veri as Partial<Yedek>
  if (aday.bicim !== 'juriscalendar-yedek') {
    throw new YedekHatasi('Bu dosya bir JurisCalendar yedeği değil.')
  }
  if (typeof aday.surum !== 'number' || aday.surum > YEDEK_SURUMU) {
    throw new YedekHatasi(
      'Yedek, uygulamanın bu sürümünden daha yeni. Önce uygulamayı güncelleyin.',
    )
  }
  if (typeof aday.tablolar !== 'object' || aday.tablolar === null) {
    throw new YedekHatasi('Yedek içeriği eksik.')
  }
}

/** Metin şifreli bir yedek zarfı mı? */
export function sifreliMi(metin: string): boolean {
  try {
    const j = JSON.parse(metin) as Partial<SifreliZarf>
    return j.bicim === 'juriscalendar-sifreli-yedek'
  } catch {
    return false
  }
}

/**
 * Yedeği geri yükler. **Mevcut tüm veriyi siler** — çağıran taraf kullanıcıdan
 * açık onay almadan bunu çağırmamalı. Dosya şifreliyse `parola` gerekir.
 */
export async function yedektenGeriYukle(
  metin: string,
  parola?: string,
): Promise<void> {
  let hamMetin = metin
  if (sifreliMi(metin)) {
    if (!parola?.trim()) {
      throw new YedekHatasi('Bu yedek şifreli; parola gerekli.')
    }
    const zarf = JSON.parse(metin) as SifreliZarf
    hamMetin = await sifreCoz(zarf, parola) // yanlış parolada SifreCozmeHatasi
  }

  let cozulmus: unknown
  try {
    cozulmus = JSON.parse(hamMetin)
  } catch {
    throw new YedekHatasi('Dosya geçerli bir JSON değil.')
  }
  dogrula(cozulmus)
  const { tablolar } = cozulmus

  const belgeler: Belge[] = (tablolar.belgeler ?? []).map(
    ({ icerikBase64, ...geri }) => ({
      ...geri,
      icerik: base64ToBlob(icerikBase64, geri.mimeTur),
    }),
  )

  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((tablo) => tablo.clear()))

    await db.kullanicilar.bulkAdd(tablolar.kullanicilar ?? [])
    await db.muvekkiller.bulkAdd(tablolar.muvekkiller ?? [])
    await db.dosyalar.bulkAdd(tablolar.dosyalar ?? [])
    await db.olaylar.bulkAdd(tablolar.olaylar ?? [])
    await db.sureler.bulkAdd(tablolar.sureler ?? [])
    await db.gorevler.bulkAdd(tablolar.gorevler ?? [])
    await db.finans.bulkAdd(tablolar.finans ?? [])
    await db.belgeler.bulkAdd(belgeler)
    await db.kisiler.bulkAdd(tablolar.kisiler ?? [])
    await db.notlar.bulkAdd(tablolar.notlar ?? [])
    await db.hatirlatmalar.bulkAdd(tablolar.hatirlatmalar ?? [])
    await db.hareketler.bulkAdd(tablolar.hareketler ?? [])
    await db.ayarlar.bulkPut(tablolar.ayarlar ?? [])
  })
}

/** Yedekteki kayıt sayıları — geri yüklemeden önce kullanıcıya gösterilir. */
export function yedekOzeti(yedek: Yedek): Array<[string, number]> {
  const t = yedek.tablolar
  return [
    ['Dosya', t.dosyalar?.length ?? 0],
    ['Müvekkil', t.muvekkiller?.length ?? 0],
    ['Takvim olayı', t.olaylar?.length ?? 0],
    ['Süre', t.sureler?.length ?? 0],
    ['Görev', t.gorevler?.length ?? 0],
    ['Finans kaydı', t.finans?.length ?? 0],
    ['Belge', t.belgeler?.length ?? 0],
  ]
}
