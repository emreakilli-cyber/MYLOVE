import type {
  Belge,
  Dosya,
  FinansKaydi,
  Gorev,
  HazirlikMaddesi,
  HazirlikOzeti,
  Muvekkil,
  Olay,
  Sure,
} from './types'
import { bugunIso, gunFarki } from './tarih'

/*
 * Dosya hazırlık durumu (şartname md. 11).
 *
 * Kontrol listesi elle işaretlenmez — her madde mevcut veriden okunur. Böylece
 * yüzde her zaman gerçeği söyler; kullanıcının ayrıca bir şey güncellemesi
 * gerekmez.
 *
 * Ağırlıklar eşit değil: eksikliği dosyayı gerçekten riske atan maddeler
 * (kaçmış süre, ödenmemiş harç) daha çok düşürür.
 */

export interface HazirlikGirdisi {
  dosya: Dosya
  muvekkil?: Muvekkil | undefined
  olaylar: Olay[]
  sureler: Sure[]
  gorevler: Gorev[]
  finans: FinansKaydi[]
  belgeler: Belge[]
}

interface AgirlikliMadde extends HazirlikMaddesi {
  agirlik: number
}

export function hazirlikHesapla(girdi: HazirlikGirdisi): HazirlikOzeti {
  const { dosya, muvekkil, olaylar, sureler, gorevler, finans, belgeler } =
    girdi
  const bugun = bugunIso()

  const vekaletnameVar = belgeler.some((b) => b.tur === 'vekaletname')
  const durusmaVar = olaylar.some((o) => o.tur === 'durusma')
  const harclar = finans.filter((f) => f.kategori === 'harc')
  const giderAvanslari = finans.filter((f) => f.kategori === 'gider-avansi')
  const bekleyenGiderler = finans.filter(
    (f) => f.yon === 'gider' && f.odemeDurumu !== 'odendi',
  )
  const kacmisSure = sureler.some((s) => s.durum === 'kacirildi')
  const gecikmisGorev = gorevler.filter(
    (g) =>
      g.durum === 'bekliyor' &&
      g.vadeTarihi !== undefined &&
      gunFarki(g.vadeTarihi, bugun) < 0,
  )
  const iletisimVar = Boolean(muvekkil?.telefon ?? muvekkil?.eposta)

  const maddeler: AgirlikliMadde[] = [
    {
      anahtar: 'muvekkil-iletisim',
      etiket: 'Müvekkil iletişim bilgisi var',
      tamam: iletisimVar,
      agirlik: 1,
      eylem: 'Müvekkil telefon veya e-postasını ekleyin',
    },
    {
      anahtar: 'esas-no',
      etiket: 'Esas numarası girildi',
      tamam: Boolean(dosya.esasNo),
      agirlik: 1,
      eylem: 'Dosyanın esas numarasını girin',
    },
    {
      anahtar: 'mahkeme',
      etiket: 'Mahkeme bilgisi girildi',
      tamam: Boolean(dosya.mahkeme),
      agirlik: 1,
      eylem: 'Görevli mahkemeyi girin',
    },
    {
      anahtar: 'vekaletname',
      etiket: 'Vekâletname yüklendi',
      tamam: vekaletnameVar,
      agirlik: 3,
      eylem: 'Vekâletnameyi dosyaya yükleyin',
    },
    {
      anahtar: 'durusma',
      etiket: 'Duruşma tarihi girildi',
      tamam: durusmaVar,
      agirlik: 2,
      eylem: 'Duruşma tarihini takvime ekleyin',
    },
    {
      anahtar: 'harc',
      etiket: 'Harç yatırıldı',
      // Harç kaydı hiç yoksa da eksik sayılır: yatırılmamış olabilir.
      tamam: harclar.length > 0 && harclar.every((f) => f.odemeDurumu === 'odendi'),
      agirlik: 3,
      eylem:
        harclar.length === 0
          ? 'Harç ödemesini kaydedin'
          : 'Bekleyen harcı ödeyip kaydedin',
    },
    {
      anahtar: 'gider-avansi',
      etiket: 'Gider avansı tamamlandı',
      tamam: giderAvanslari.every((f) => f.odemeDurumu === 'odendi'),
      agirlik: 2,
      eylem: 'Gider avansını tamamlayın',
    },
    {
      anahtar: 'odemeler',
      etiket: 'Bekleyen ödeme yok',
      tamam: bekleyenGiderler.length === 0,
      agirlik: 2,
      eylem: bekleyenGiderler[0]
        ? `${bekleyenGiderler[0].baslik} ödenecek`
        : 'Bekleyen ödemeleri kapatın',
    },
    {
      anahtar: 'sureler',
      etiket: 'Kaçırılmış süre yok',
      tamam: !kacmisSure,
      agirlik: 4,
      eylem: 'Kaçırılan süreyi inceleyin',
    },
    {
      anahtar: 'gorevler',
      etiket: 'Geciken görev yok',
      tamam: gecikmisGorev.length === 0,
      agirlik: 2,
      eylem: gecikmisGorev[0]
        ? gecikmisGorev[0].baslik
        : 'Geciken görevleri tamamlayın',
    },
    {
      anahtar: 'belge',
      etiket: 'Dosyada belge var',
      tamam: belgeler.length > 0,
      agirlik: 1,
      eylem: 'İlgili belgeleri yükleyin',
    },
  ]

  const toplamAgirlik = maddeler.reduce((t, m) => t + m.agirlik, 0)
  const tamamlanan = maddeler
    .filter((m) => m.tamam)
    .reduce((t, m) => t + m.agirlik, 0)
  const yuzde = Math.round((tamamlanan / toplamAgirlik) * 100)

  // Sıradaki adım: en ağır eksik madde. Ağırlık eşitse listedeki ilk sıra.
  const eksikler = maddeler.filter((m) => !m.tamam)
  const enOnemliEksik = eksikler.reduce<AgirlikliMadde | undefined>(
    (enIyi, m) => (enIyi === undefined || m.agirlik > enIyi.agirlik ? m : enIyi),
    undefined,
  )

  return {
    dosyaId: dosya.id,
    yuzde,
    seviye: yuzde >= 70 ? 'iyi' : yuzde >= 50 ? 'orta' : 'dikkat',
    maddeler: maddeler.map(({ agirlik: _agirlik, ...m }) => m),
    ...(enOnemliEksik?.eylem ? { sonrakiAdim: enOnemliEksik.eylem } : {}),
  }
}

/** Kart altındaki durum metni: "İyi ilerliyor" / "Dikkat gerekiyor". */
export function seviyeMetni(seviye: HazirlikOzeti['seviye']): string {
  switch (seviye) {
    case 'iyi':
      return 'İyi ilerliyor'
    case 'orta':
      return 'Takip gerekiyor'
    case 'dikkat':
      return 'Dikkat gerekiyor'
  }
}
