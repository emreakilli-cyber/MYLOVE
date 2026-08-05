import type {
  Belge,
  Dosya,
  DosyaTuru,
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
 * Kontrol listesi **dosya türüne göre** değişir: icra takibinde duruşma
 * beklenmez, ceza davasında harç yoktur, arabuluculukta mahkeme/esas no yoktur.
 * Uygulanmayan madde yüzdeye hiç katılmaz — aksi hâlde yüzde haksız düşerdi.
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

/**
 * Hangi kontrol maddesi hangi dosya türünde anlamlı? Sıra aynı zamanda
 * gösterim sırasıdır. Uygulanmayan maddeler yüzdeye katılmaz.
 */
const TUR_MADDELERI: Record<DosyaTuru, readonly string[]> = {
  // Klasik dava türleri: tam liste.
  hukuk: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  is: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  ticaret: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  aile: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  // Tüketici davaları harçtan muaftır (6502 s.K. m. 73/2): harç maddesi yok.
  tuketici: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  // İdari yargı çoğunlukla dosya üzerinden karar verir: duruşma beklenmez.
  idari: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  // Ceza (kamu davası) harçsızdır ve gider avansı öngörmez.
  ceza: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  // İcra takibinde duruşma ve gider avansı yoktur; "mahkeme" = icra dairesi.
  icra: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname',
    'harc', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  // Arabuluculukta mahkeme, esas no, harç, duruşma, gider avansı yoktur.
  arabuluculuk: [
    'muvekkil-iletisim', 'vekaletname',
    'odemeler', 'sureler', 'gorevler', 'belge',
  ],
  diger: [
    'muvekkil-iletisim', 'esas-no', 'mahkeme', 'vekaletname', 'durusma',
    'harc', 'gider-avansi', 'odemeler', 'sureler', 'gorevler', 'belge',
  ],
}

/** Türe özgü etiket/eylem düzeltmeleri (icra dairesi, takip no, icra harcı…). */
const TUR_ETIKET: Partial<
  Record<DosyaTuru, Record<string, { etiket?: string; eylem?: string }>>
> = {
  icra: {
    'esas-no': {
      etiket: 'Takip numarası girildi',
      eylem: 'Takip numarasını girin',
    },
    mahkeme: {
      etiket: 'İcra dairesi girildi',
      eylem: 'İcra dairesini girin',
    },
    harc: {
      etiket: 'İcra ve başvurma harcı yatırıldı',
    },
  },
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

  // Tüm aday maddeler, anahtara göre. Türe göre bunlardan bir altküme seçilir.
  const adaylar: Record<string, AgirlikliMadde> = {
    'muvekkil-iletisim': {
      anahtar: 'muvekkil-iletisim',
      etiket: 'Müvekkil iletişim bilgisi var',
      tamam: iletisimVar,
      agirlik: 1,
      eylem: 'Müvekkil telefon veya e-postasını ekleyin',
    },
    'esas-no': {
      anahtar: 'esas-no',
      etiket: 'Esas numarası girildi',
      tamam: Boolean(dosya.esasNo),
      agirlik: 1,
      eylem: 'Dosyanın esas numarasını girin',
    },
    mahkeme: {
      anahtar: 'mahkeme',
      etiket: 'Mahkeme bilgisi girildi',
      tamam: Boolean(dosya.mahkeme),
      agirlik: 1,
      eylem: 'Görevli mahkemeyi girin',
    },
    vekaletname: {
      anahtar: 'vekaletname',
      etiket: 'Vekâletname yüklendi',
      tamam: vekaletnameVar,
      agirlik: 3,
      eylem: 'Vekâletnameyi dosyaya yükleyin',
    },
    durusma: {
      anahtar: 'durusma',
      etiket: 'Duruşma tarihi girildi',
      tamam: durusmaVar,
      agirlik: 2,
      eylem: 'Duruşma tarihini takvime ekleyin',
    },
    harc: {
      anahtar: 'harc',
      etiket: 'Harç yatırıldı',
      // Harç kaydı hiç yoksa da eksik sayılır: yatırılmamış olabilir.
      tamam:
        harclar.length > 0 && harclar.every((f) => f.odemeDurumu === 'odendi'),
      agirlik: 3,
      eylem:
        harclar.length === 0
          ? 'Harç ödemesini kaydedin'
          : 'Bekleyen harcı ödeyip kaydedin',
    },
    'gider-avansi': {
      anahtar: 'gider-avansi',
      etiket: 'Gider avansı tamamlandı',
      tamam: giderAvanslari.every((f) => f.odemeDurumu === 'odendi'),
      agirlik: 2,
      eylem: 'Gider avansını tamamlayın',
    },
    odemeler: {
      anahtar: 'odemeler',
      etiket: 'Bekleyen ödeme yok',
      tamam: bekleyenGiderler.length === 0,
      agirlik: 2,
      eylem: bekleyenGiderler[0]
        ? `${bekleyenGiderler[0].baslik} ödenecek`
        : 'Bekleyen ödemeleri kapatın',
    },
    sureler: {
      anahtar: 'sureler',
      etiket: 'Kaçırılmış süre yok',
      tamam: !kacmisSure,
      agirlik: 4,
      eylem: 'Kaçırılan süreyi inceleyin',
    },
    gorevler: {
      anahtar: 'gorevler',
      etiket: 'Geciken görev yok',
      tamam: gecikmisGorev.length === 0,
      agirlik: 2,
      eylem: gecikmisGorev[0]
        ? gecikmisGorev[0].baslik
        : 'Geciken görevleri tamamlayın',
    },
    belge: {
      anahtar: 'belge',
      etiket: 'Dosyada belge var',
      tamam: belgeler.length > 0,
      agirlik: 1,
      eylem: 'İlgili belgeleri yükleyin',
    },
  }

  const anahtarlar = TUR_MADDELERI[dosya.tur] ?? TUR_MADDELERI.diger
  const etiketDuzelt = TUR_ETIKET[dosya.tur]
  const maddeler: AgirlikliMadde[] = anahtarlar
    .map((anahtar) => adaylar[anahtar])
    .filter((m): m is AgirlikliMadde => m !== undefined)
    .map((m) => {
      const duzelt = etiketDuzelt?.[m.anahtar]
      if (!duzelt) return m
      return {
        ...m,
        ...(duzelt.etiket ? { etiket: duzelt.etiket } : {}),
        ...(duzelt.eylem ? { eylem: duzelt.eylem } : {}),
      }
    })

  const toplamAgirlik = maddeler.reduce((t, m) => t + m.agirlik, 0)
  const tamamlanan = maddeler
    .filter((m) => m.tamam)
    .reduce((t, m) => t + m.agirlik, 0)
  const yuzde =
    toplamAgirlik === 0 ? 100 : Math.round((tamamlanan / toplamAgirlik) * 100)

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
