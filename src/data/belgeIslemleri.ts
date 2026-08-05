import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, simdi, yeniId } from './db'
import type { Belge, BelgeTuru } from '../domain/types'

/*
 * Belge yükleme ve yönetimi. İçerik Blob olarak IndexedDB'de tutulur; cihazdan
 * çıkmaz. F8 (dekont/makbuz) ve F9 (genel belge) bunu paylaşır.
 */

/** Belge türlerinin Türkçe etiketleri (paylaşılan). */
export const belgeTuruEtiketleri: Record<BelgeTuru, string> = {
  vekaletname: 'Vekâletname',
  dilekce: 'Dilekçe',
  karar: 'Karar',
  'bilirkisi-raporu': 'Bilirkişi raporu',
  dekont: 'Dekont',
  makbuz: 'Makbuz',
  sozlesme: 'Sözleşme',
  kimlik: 'Kimlik',
  foto: 'Fotoğraf',
  ses: 'Ses kaydı',
  diger: 'Diğer',
}

/** Dosya uzantısı/MIME'inden makul bir belge türü tahmini. */
export function belgeTuruTahmini(dosya: File): BelgeTuru {
  const ad = dosya.name.toLocaleLowerCase('tr')
  const mime = dosya.type
  if (mime.startsWith('image/')) return 'foto'
  if (mime.startsWith('audio/')) return 'ses'
  if (/vekalet|vekâlet/.test(ad)) return 'vekaletname'
  if (/dilekce|dilekçe/.test(ad)) return 'dilekce'
  if (/karar/.test(ad)) return 'karar'
  if (/bilirki[sş]i/.test(ad)) return 'bilirkisi-raporu'
  if (/dekont/.test(ad)) return 'dekont'
  if (/makbuz|fatura/.test(ad)) return 'makbuz'
  if (/s[oö]zle[sş]me/.test(ad)) return 'sozlesme'
  return 'diger'
}

export interface BelgeYuklemeGirdisi {
  dosya: File
  tur?: BelgeTuru
  dosyaId?: string
  muvekkilId?: string
  finansKaydiId?: string
  etiketler?: string[]
  not?: string
}

/** 25 MB üstü ekleri reddet — IndexedDB kotasını tek dosyayla doldurmasın. */
export const MAKS_BELGE_BAYT = 25 * 1024 * 1024

export class BelgeHatasi extends Error {}

export async function belgeYukle(girdi: BelgeYuklemeGirdisi): Promise<string> {
  const { dosya } = girdi
  if (dosya.size > MAKS_BELGE_BAYT) {
    throw new BelgeHatasi('Dosya 25 MB sınırını aşıyor.')
  }
  const zaman = simdi()
  const id = yeniId()
  // File zaten bir Blob; kopyalayıp saf Blob olarak saklıyoruz.
  const icerik = dosya.slice(0, dosya.size, dosya.type || 'application/octet-stream')

  await db.belgeler.add({
    id,
    ad: dosya.name,
    tur: girdi.tur ?? belgeTuruTahmini(dosya),
    ...(girdi.dosyaId ? { dosyaId: girdi.dosyaId } : {}),
    ...(girdi.muvekkilId ? { muvekkilId: girdi.muvekkilId } : {}),
    ...(girdi.finansKaydiId ? { finansKaydiId: girdi.finansKaydiId } : {}),
    mimeTur: dosya.type || 'application/octet-stream',
    boyut: dosya.size,
    icerik,
    etiketler: girdi.etiketler ?? [],
    ...(girdi.not?.trim() ? { not: girdi.not.trim() } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })

  if (girdi.dosyaId) {
    const dosyaKaydi = await db.dosyalar.get(girdi.dosyaId)
    await db.hareketler.add({
      id: yeniId(),
      tur: 'belge-yuklendi',
      baslik: 'Yeni belge yüklendi',
      ayrinti: dosyaKaydi ? `${dosya.name} · ${dosyaKaydi.baslik}` : dosya.name,
      dosyaId: girdi.dosyaId,
      zaman,
    })
  }
  return id
}

export async function belgeSil(id: string): Promise<void> {
  await db.belgeler.delete(id)
}

/** Belgenin etiketlerini günceller (tekilleştirir, boşları atar). */
export async function belgeEtiketleriGuncelle(
  id: string,
  etiketler: string[],
): Promise<void> {
  const temiz = [...new Set(etiketler.map((e) => e.trim()).filter(Boolean))]
  await db.belgeler.update(id, {
    etiketler: temiz,
    guncellemeTarihi: simdi(),
  })
}

/** Belgeyi cihaza indirir (veri yerelde; ağ trafiği yok). */
export function belgeyiIndir(belge: Belge): void {
  const adres = URL.createObjectURL(belge.icerik)
  const baglanti = document.createElement('a')
  baglanti.href = adres
  baglanti.download = belge.ad
  baglanti.click()
  URL.revokeObjectURL(adres)
}

/** Bir finans kaydına bağlı dekont/makbuzlar. */
export function useFinansBelgeleri(
  finansKaydiId: string | undefined,
): Belge[] | undefined {
  return useLiveQuery(async () => {
    if (!finansKaydiId) return []
    return db.belgeler.where('finansKaydiId').equals(finansKaydiId).toArray()
  }, [finansKaydiId])
}

export function boyutMetni(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`
}

/** Belgelerin toplam kapladığı yer (Blob boyutlarından). */
export function useBelgelerToplamBoyut(): number | undefined {
  return useLiveQuery(async () => {
    const belgeler = await db.belgeler.toArray()
    return belgeler.reduce((t, b) => t + (b.boyut ?? 0), 0)
  }, [])
}

export interface DepolamaDurumu {
  /** Tarayıcının bildirdiği toplam kullanım (tüm site verisi). */
  kullanilan: number
  /** Ayrılan kota. 0 = tarayıcı bildirmedi. */
  kota: number
  /** kullanilan/kota, 0–1. Kota yoksa 0. */
  oran: number
  /** Kota bilgisi bu tarayıcıda var mı? */
  destekleniyor: boolean
}

/**
 * Cihazın bu site için ayırdığı depolamanın ne kadarının dolu olduğunu okur
 * (`navigator.storage.estimate`). `yenileme` değeri değişince yeniden ölçülür —
 * belge eklendikçe göstergenin güncellenmesi için toplam boyutu geçin.
 */
export function useDepolamaDurumu(yenileme?: number): DepolamaDurumu | null {
  const [durum, setDurum] = useState<DepolamaDurumu | null>(null)
  useEffect(() => {
    let iptal = false
    const est = navigator.storage?.estimate
    if (!est) {
      if (!iptal) {
        setDurum({ kullanilan: 0, kota: 0, oran: 0, destekleniyor: false })
      }
      return
    }
    void navigator.storage.estimate().then((e) => {
      if (iptal) return
      const kullanilan = e.usage ?? 0
      const kota = e.quota ?? 0
      setDurum({
        kullanilan,
        kota,
        oran: kota > 0 ? Math.min(1, kullanilan / kota) : 0,
        destekleniyor: true,
      })
    })
    return () => {
      iptal = true
    }
  }, [yenileme])
  return durum
}
