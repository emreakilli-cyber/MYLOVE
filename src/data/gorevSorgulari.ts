import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { bugunIso, gunFarki } from '../domain/tarih'
import type { Dosya, Gorev, Kullanici } from '../domain/types'

/*
 * Görev listesi. Görevler zaman durumuna göre gruplanır (gecikmiş, bugün,
 * yaklaşan, vadesiz, tamamlanan) çünkü bir avukatın ilk sorusu "neyi kaçırdım,
 * bugün ne var" — öncelik ikincil.
 */

export type GorevSuzgeci = 'aktif' | 'bana' | 'oncelikli' | 'tamamlanan'

export const gorevSuzgecEtiketleri: Record<GorevSuzgeci, string> = {
  aktif: 'Açık',
  bana: 'Bana atanan',
  oncelikli: 'Öncelikli',
  tamamlanan: 'Tamamlanan',
}

export interface GorevSatiri {
  gorev: Gorev
  dosya?: Dosya
  atanan?: Kullanici
}

export type GorevGrupAnahtari =
  | 'gecikmis'
  | 'bugun'
  | 'yarin'
  | 'yaklasan'
  | 'vadesiz'
  | 'tamamlanan'

export const grupBasliklari: Record<GorevGrupAnahtari, string> = {
  gecikmis: 'Gecikmiş',
  bugun: 'Bugün',
  yarin: 'Yarın',
  yaklasan: 'Yaklaşan',
  vadesiz: 'Vadesiz',
  tamamlanan: 'Tamamlanan',
}

const GRUP_SIRASI: GorevGrupAnahtari[] = [
  'gecikmis',
  'bugun',
  'yarin',
  'yaklasan',
  'vadesiz',
  'tamamlanan',
]

function grupAnahtari(gorev: Gorev): GorevGrupAnahtari {
  if (gorev.durum === 'tamamlandi') return 'tamamlanan'
  if (!gorev.vadeTarihi) return 'vadesiz'
  const fark = gunFarki(gorev.vadeTarihi, bugunIso())
  if (fark < 0) return 'gecikmis'
  if (fark === 0) return 'bugun'
  if (fark === 1) return 'yarin'
  return 'yaklasan'
}

export interface GorevGrubu {
  anahtar: GorevGrupAnahtari
  baslik: string
  satirlar: GorevSatiri[]
}

/**
 * `benKullaniciId`: "Bana atanan" süzgeci için mevcut kullanıcının kimliği
 * (varsayılan büroda Ayşe Kaya).
 */
export function useGorevListesi(
  suzgec: GorevSuzgeci,
  benKullaniciId: string,
): GorevGrubu[] | undefined {
  return useLiveQuery(async () => {
    const [gorevler, dosyalar, kullanicilar] = await Promise.all([
      db.gorevler.toArray(),
      db.dosyalar.toArray(),
      db.kullanicilar.toArray(),
    ])
    const dosyaHarita = new Map(dosyalar.map((d) => [d.id, d]))
    const kullaniciHarita = new Map(kullanicilar.map((k) => [k.id, k]))

    const suzulmus = gorevler.filter((g) => {
      switch (suzgec) {
        case 'aktif':
          return g.durum === 'bekliyor'
        case 'bana':
          return g.durum === 'bekliyor' && g.atananKullaniciId === benKullaniciId
        case 'oncelikli':
          return g.durum === 'bekliyor' && g.oncelik === 'yuksek'
        case 'tamamlanan':
          return g.durum === 'tamamlandi'
      }
    })

    // Grupla.
    const gruplar = new Map<GorevGrupAnahtari, GorevSatiri[]>()
    for (const gorev of suzulmus) {
      const anahtar = grupAnahtari(gorev)
      const satir: GorevSatiri = {
        gorev,
        ...(gorev.dosyaId ? { dosya: dosyaHarita.get(gorev.dosyaId) } : {}),
        ...(gorev.atananKullaniciId
          ? { atanan: kullaniciHarita.get(gorev.atananKullaniciId) }
          : {}),
      }
      const liste = gruplar.get(anahtar) ?? []
      liste.push(satir)
      gruplar.set(anahtar, liste)
    }

    // Her grup içinde vade/öncelik sırala.
    const oncelikDeger = { yuksek: 0, normal: 1, dusuk: 2 }
    for (const liste of gruplar.values()) {
      liste.sort((a, b) => {
        const va = a.gorev.vadeTarihi ?? '9999-12-31'
        const vb = b.gorev.vadeTarihi ?? '9999-12-31'
        return (
          va.localeCompare(vb) ||
          oncelikDeger[a.gorev.oncelik] - oncelikDeger[b.gorev.oncelik]
        )
      })
    }

    return GRUP_SIRASI.filter((a) => gruplar.has(a)).map((anahtar) => ({
      anahtar,
      baslik: grupBasliklari[anahtar],
      satirlar: gruplar.get(anahtar) ?? [],
    }))
  }, [suzgec, benKullaniciId])
}
