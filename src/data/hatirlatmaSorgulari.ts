import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { IconName } from '../components/Icon'
import { olayGorunumleri, type Accent } from '../domain/olay'
import { VARSAYILAN_HATIRLATMA_OFSETLERI } from '../domain/types'

/*
 * Yaklaşan hatırlatmalar (uygulama içi bildirim kutusu için).
 *
 * Hatırlatmalar önceden tabloya yazılmaz; olaylardan ve sürelerden + ayarlardaki
 * ofset profillerinden **anlık türetilir**. Böylece kullanıcı bir olayı ya da
 * ofsetini değiştirince liste kendiliğinden güncel kalır; senkron tutulacak
 * ikinci bir kayıt yok.
 */

export interface YaklasanHatirlatma {
  id: string
  /** Hatırlatmanın tetikleneceği an. */
  zaman: string
  /** Hedef olayın/sürenin gerçekleşeceği an. */
  hedefZaman: string
  baslik: string
  altBaslik: string
  ofsetEtiketi: string
  accent: Accent
  icon: IconName
  yol: string
  /** Tetikleme zamanı geçmişte mi (yani "artık zamanı geldi"). */
  gecti: boolean
}

const GUN_MS = 86_400_000

function ofsetMetni(dk: number): string {
  if (dk === 0) return 'aynı gün'
  if (dk < 60) return `${dk} dk önce`
  if (dk < 24 * 60) return `${Math.round(dk / 60)} saat önce`
  return `${Math.round(dk / (24 * 60))} gün önce`
}

export function useYaklasanHatirlatmalar(
  ufukGun = 30,
): YaklasanHatirlatma[] | undefined {
  return useLiveQuery(async () => {
    const simdi = Date.now()
    const ufuk = simdi + ufukGun * GUN_MS
    // Tetiklenmesi geçen 3 günü de göster ("kaçırılmışları" görebilsin).
    const alt = simdi - 3 * GUN_MS

    const [ayarlar, olaylar, sureler, dosyalar] = await Promise.all([
      db.ayarlar.get('tekil'),
      db.olaylar.toArray(),
      db.sureler.where('durum').equals('acik').toArray(),
      db.dosyalar.toArray(),
    ])
    const dosyaAd = new Map(dosyalar.map((d) => [d.id, d.baslik]))
    const profiller = ayarlar?.hatirlatmaOfsetleri ?? {}
    const varsayilan = [...VARSAYILAN_HATIRLATMA_OFSETLERI]

    const sonuc: YaklasanHatirlatma[] = []

    // Takvim olaylarından.
    for (const olay of olaylar) {
      if (olay.durum !== 'planlandi') continue
      const hedef = new Date(olay.baslangic).getTime()
      if (hedef < simdi) continue
      const ofsetler = profiller[olay.tur] ?? varsayilan
      const gorunum = olayGorunumleri[olay.tur]
      for (const ofset of ofsetler) {
        const tetik = hedef - ofset * 60_000
        if (tetik < alt || tetik > ufuk) continue
        sonuc.push({
          id: `${olay.id}-${ofset}`,
          zaman: new Date(tetik).toISOString(),
          hedefZaman: olay.baslangic,
          baslik: olay.baslik,
          altBaslik: olay.dosyaId
            ? (dosyaAd.get(olay.dosyaId) ?? gorunum.etiket)
            : gorunum.etiket,
          ofsetEtiketi: ofsetMetni(ofset),
          accent: gorunum.accent,
          icon: gorunum.icon,
          yol: olay.dosyaId ? `/dosyalar/${olay.dosyaId}` : '/takvim',
          gecti: tetik <= simdi,
        })
      }
    }

    // Hukuki sürelerden (son-tarih profili).
    const sureOfsetleri = profiller['son-tarih'] ?? varsayilan
    for (const sure of sureler) {
      // Süre günün başında (00:00) dolmuş sayılır.
      const hedef = new Date(`${sure.sonTarih}T09:00:00`).getTime()
      if (hedef < simdi) continue
      for (const ofset of sureOfsetleri) {
        const tetik = hedef - ofset * 60_000
        if (tetik < alt || tetik > ufuk) continue
        sonuc.push({
          id: `${sure.id}-${ofset}`,
          zaman: new Date(tetik).toISOString(),
          hedefZaman: new Date(hedef).toISOString(),
          baslik: sure.kuralAdi,
          altBaslik: dosyaAd.get(sure.dosyaId) ?? sure.kanunReferansi,
          ofsetEtiketi: ofsetMetni(ofset),
          accent: 'red',
          icon: 'calendar-clock',
          yol: `/dosyalar/${sure.dosyaId}`,
          gecti: tetik <= simdi,
        })
      }
    }

    return sonuc.sort((a, b) => a.zaman.localeCompare(b.zaman))
  }, [ufukGun])
}

/** Uygulama açılışında gösterilecek "şu an zamanı gelmiş" hatırlatma sayısı. */
export function useAktifHatirlatmaSayisi(): number | undefined {
  return useLiveQuery(async () => {
    const simdi = Date.now()
    const alt = simdi - 3 * GUN_MS
    const [ayarlar, olaylar, sureler] = await Promise.all([
      db.ayarlar.get('tekil'),
      db.olaylar.where('durum').equals('planlandi').toArray(),
      db.sureler.where('durum').equals('acik').toArray(),
    ])
    const profiller = ayarlar?.hatirlatmaOfsetleri ?? {}
    const varsayilan = [...VARSAYILAN_HATIRLATMA_OFSETLERI]
    let sayi = 0

    for (const olay of olaylar) {
      const hedef = new Date(olay.baslangic).getTime()
      if (hedef < simdi) continue
      for (const ofset of profiller[olay.tur] ?? varsayilan) {
        const tetik = hedef - ofset * 60_000
        if (tetik > alt && tetik <= simdi) sayi++
      }
    }
    const sureOfsetleri = profiller['son-tarih'] ?? varsayilan
    for (const sure of sureler) {
      const hedef = new Date(`${sure.sonTarih}T09:00:00`).getTime()
      if (hedef < simdi) continue
      for (const ofset of sureOfsetleri) {
        const tetik = hedef - ofset * 60_000
        if (tetik > alt && tetik <= simdi) sayi++
      }
    }
    return sayi
  }, [])
}
