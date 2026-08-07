/*
 * Öğretici mod (onboarding) — sahne METİNLERİ ve ZAMANLAMALARI burada veri olarak
 * durur; sahne bileşenleri bu veriyi okuyup oynatır (metin/süre bileşene gömülü
 * değil). Böylece akış, kod değişmeden düzenlenebilir.
 *
 * ÖNEMLİ: Buradaki hiçbir şey gerçek veritabanına yazılmaz. Demo verisi yalnızca
 * animasyon içindir; maskeleme animasyonu tamamen hardcoded'dır ve hiçbir gerçek
 * modülü (LLM, kripto, Dexie) çağırmaz.
 *
 * DİL KURALI: "hiçbir veri paylaşılmıyor" / "hacklenemez" / "%100 güvenli" gibi
 * ifadeler YASAK. Doğru dil: "kimlik bilgileri gitmiyor", "maskelenmiş metin
 * gidiyor". (Bir test bu yasağı script metinlerinde denetler.)
 */

export type SahneId =
  | 's0'
  | 's1'
  | 's2'
  | 's3'
  | 's4'
  | 's5'
  | 's6'
  | 'neyi-nerede'
  | 's7'

/** Sahnenin otomatik ilerleme süresi (ms). Etkileşimli sahnelerde 0 = kullanıcı bekler. */
export interface SahneZaman {
  /** Sahnenin kendi animasyonunu tamamlaması için tipik süre (ms). */
  sure: number
  /** true ise sahne kullanıcı dokunuşuyla ilerler, süre yok sayılır. */
  etkilesimli?: boolean
}

export interface SahneTanim {
  id: SahneId
  /** Üstte mono etiket (BÜYÜK HARF). */
  etiket: string
  /** Serif başlık ya da ana cümle. */
  baslik: string
  /** Alt açıklama satır(lar)ı. */
  metin?: string
  zaman: SahneZaman
}

/* Demo dava — yalnızca animasyon için; DB'ye yazılmaz. */
export const demoDava = {
  muvekkil: 'Kemal Arslan',
  karsiTaraf: 'Nuray Öztürk',
  esasNo: '2026/1184 E.',
  konu: 'Kira Alacağı',
  mahkeme: 'İzmir 3. Sulh Hukuk Mahkemesi',
  durusma: '14 Eylül 2026',
  tutar: '45.000 TL',
} as const

/* Maskeleme sahnesi (S6) verisi. "Gidecek" alanlar maskelenir; "kalacak" alanlar
 * (yetkili mahkeme + süre) yeşil çerçeveyle korunur. Toplam 7 maskeli bilgi. */
export interface MaskeParcasi {
  ham: string
  maske: string
  etiket: string
}

export const maskeParcalari: readonly MaskeParcasi[] = [
  { ham: 'Kemal Arslan', maske: '███████', etiket: 'MÜVEKKİL' },
  { ham: '12345678901', maske: '███████', etiket: 'TCKN' },
  { ham: 'Atatürk Cad. No:5, Konak', maske: '███████', etiket: 'ADRES' },
  { ham: 'Nuray Öztürk', maske: '███████', etiket: 'KARŞI TARAF' },
  { ham: 'Arslan Tekstil Ltd. Şti.', maske: '███████', etiket: 'İŞYERİ' },
  { ham: 'TR12 0006 7010 0000 0012 3456 78', maske: '███████', etiket: 'IBAN' },
  { ham: '2026/1184 E.', maske: '███████', etiket: 'DOSYA NO' },
]

export const korunanParcalar: ReadonlyArray<{ metin: string; neden: string }> = [
  { metin: 'İzmir', neden: 'yetkili mahkeme için' },
  { metin: '14 Eylül 2026', neden: 'süre hesabı için' },
]

/** "Neyi nerede yaparsınız?" sahnesi: iş kalemleri ve hangi cihaza düştüğü. */
export interface IsKalemi {
  is: string
  yer: 'telefon' | 'bilgisayar'
}

export const isBolumu: readonly IsKalemi[] = [
  { is: 'Duruşma ve süre takibi', yer: 'telefon' },
  { is: 'Hızlı not ve arama', yer: 'telefon' },
  { is: 'Müvekkil kaydı', yer: 'telefon' },
  { is: 'Bildirimleri görme', yer: 'telefon' },
  { is: 'Ücret takibi', yer: 'telefon' },
  { is: 'Fotoğrafla belge ekleme', yer: 'telefon' },
  { is: 'Uzun dilekçe yazımı', yer: 'bilgisayar' },
  { is: 'Toplu belge düzenleme', yer: 'bilgisayar' },
]

/** S7 özet maddeleri. */
export const ozetMaddeleri: readonly { ikon: string; metin: string }[] = [
  { ikon: '📵', metin: 'Bulut yok' },
  { ikon: '🎭', metin: "AI'a giden metinde kimlik yok" },
  { ikon: '⏱', metin: 'Süreler kendiliğinden' },
  { ikon: '📶', metin: 'İnternetsiz çalışır' },
  { ikon: '💻', metin: 'AI kendi cihazınızda' },
]

/* Sahne sırası ve metin/zaman verisi. */
export const sahneler: readonly SahneTanim[] = [
  {
    id: 's0',
    etiket: 'JURISCALENDAR',
    baslik: 'Verileriniz bu cihazdan çıkmaz.',
    zaman: { sure: 3800 },
  },
  {
    id: 's1',
    etiket: 'MÜVEKKİL KAYDI',
    baslik: 'Dosyayı bir kez girin, gerisini takip etsin.',
    metin: 'Form kendi kendine dolarken izleyin.',
    zaman: { sure: 5200 },
  },
  {
    id: 's2',
    etiket: 'HATIRLATMA',
    baslik: 'Süreler kendiliğinden hesaplanır.',
    metin: 'Duruşmaya 38 gün · Cevap dilekçesi süresi 9 gün',
    zaman: { sure: 4600 },
  },
  {
    id: 's3',
    etiket: 'ÜCRET TAKİBİ',
    baslik: 'Tahsil edilmeyen ücret gözden kaçmaz.',
    metin: 'Aramak için telefon simgesine dokunun.',
    zaman: { sure: 0, etkilesimli: true },
  },
  {
    id: 's4',
    etiket: 'ACİL İŞ',
    baslik: 'Karşı taraf cevap dilekçesi sundu.',
    metin: 'Beyan için 6 gün. “AI Asistan’a Yaz”a dokunun.',
    zaman: { sure: 0, etkilesimli: true },
  },
  {
    id: 's5',
    etiket: 'AI ASİSTAN',
    baslik: 'Taslağı asistan hazırlar, siz denetlersiniz.',
    metin: 'Mesaj yazılıyor, dosya ekleniyor. Gönder’e dokunun.',
    zaman: { sure: 0, etkilesimli: true },
  },
  {
    id: 's6',
    etiket: 'MASKELEME',
    baslik: 'AI’a giden metinde kimlik kalmaz.',
    metin: 'Kim olduğu cihazda kalır; giden metin maskelenir.',
    zaman: { sure: 0, etkilesimli: true },
  },
  {
    id: 'neyi-nerede',
    etiket: 'İŞ BÖLÜMÜ',
    baslik: 'Neyi nerede yaparsınız?',
    metin: 'Bilgisayarınız kapalıyken de çalışır.',
    zaman: { sure: 7600 },
  },
  {
    id: 's7',
    etiket: 'ÖZET',
    baslik: 'Kısacası.',
    zaman: { sure: 0, etkilesimli: true },
  },
]
