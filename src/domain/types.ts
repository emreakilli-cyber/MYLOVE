/*
 * JurisCalendar alan modeli.
 *
 * Tarih gösterimi hakkında iki kural:
 *   - "gün" anlamı taşıyan alanlar (son tarih, tebligat tarihi, vade) `IsoDate`
 *     yani "2026-08-12" biçimindedir. Hukuki süre bir takvim günüdür, bir an
 *     değildir; saat/dilim taşımak sadece kayma riski üretir.
 *   - "an" anlamı taşıyan alanlar (duruşma saati, kayıt zamanı) `IsoDateTime`
 *     yani tam ISO damgasıdır.
 *
 * Para birimi: tüm tutarlar **kuruş** cinsinden tam sayıdır. Kayan noktalı
 * sayıyla para toplamak yuvarlama hatası üretir; gösterim katmanı böler.
 */

/** "2026-08-12" — takvim günü. */
export type IsoDate = string
/** "2026-08-12T09:30:00.000Z" — zaman damgası. */
export type IsoDateTime = string
/** Tam sayı kuruş. 184.500,00 ₺ → 18450000 */
export type Kurus = number

export type Id = string

interface Kayit {
  readonly id: Id
  readonly olusturmaTarihi: IsoDateTime
  readonly guncellemeTarihi: IsoDateTime
}

/* ------------------------------------------------------------------ *
 * Müvekkil
 * ------------------------------------------------------------------ */

export type MuvekkilTuru = 'gercek' | 'tuzel'

export interface Muvekkil extends Kayit {
  /** Listelerde görünen ad: "Seda Yılmaz" ya da "Demir İnşaat A.Ş." */
  ad: string
  tur: MuvekkilTuru
  /** Gerçek kişide TC kimlik, tüzel kişide vergi numarası. */
  kimlikNo?: string
  telefon?: string
  eposta?: string
  adres?: string
  etiketler: string[]
  not?: string
  arsivlendi: boolean
}

/* ------------------------------------------------------------------ *
 * Dosya
 * ------------------------------------------------------------------ */

export type DosyaTuru =
  | 'hukuk'
  | 'is'
  | 'ticaret'
  | 'ceza'
  | 'icra'
  | 'idari'
  | 'aile'
  | 'tuketici'
  | 'arabuluculuk'
  | 'diger'

export type DosyaDurumu =
  | 'hazirlik'
  | 'derdest'
  | 'istinaf'
  | 'temyiz'
  | 'infaz'
  | 'kapali'

export interface Dosya extends Kayit {
  /** Kısa ad: "Yılmaz / Arslan" — referanstaki gösterim. */
  baslik: string
  muvekkilId: Id
  tur: DosyaTuru
  durum: DosyaDurumu
  /** "İşçilik alacağı", "Tazminat davası"… */
  konu?: string
  mahkeme?: string
  esasNo?: string
  kararNo?: string
  karsiTaraf?: string
  acilisTarihi: IsoDate
  kapanisTarihi?: IsoDate
  /** Sözleşmede kararlaştırılan vekâlet ücreti. */
  sozlesmeUcreti?: Kurus
  not?: string
  arsivlendi: boolean
}

/* ------------------------------------------------------------------ *
 * Takvim olayı
 * ------------------------------------------------------------------ */

export type OlayTuru =
  | 'durusma'
  | 'icra'
  | 'muvekkil-gorusmesi'
  | 'dilekce-teslimi'
  | 'arabuluculuk'
  | 'kesif'
  | 'son-tarih'
  | 'diger'

export type OlayDurumu = 'planlandi' | 'tamamlandi' | 'ertelendi' | 'iptal'

export interface Olay extends Kayit {
  baslik: string
  tur: OlayTuru
  dosyaId?: Id
  muvekkilId?: Id
  /** Tüm gün olaylarında saat kısmı yok sayılır. */
  baslangic: IsoDateTime
  bitis?: IsoDateTime
  tumGun: boolean
  yer?: string
  aciklama?: string
  durum: OlayDurumu
  /** Süre motorunun ürettiği olaylar elle silinince süreyle bağı kopmasın. */
  kaynak: 'manuel' | 'sure-hesabi'
  sureId?: Id
  /** Tekrar eden serinin ortak kimliği; tek yineleme ise yok. */
  seriesId?: Id
}

/* ------------------------------------------------------------------ *
 * Hukuki süre
 * ------------------------------------------------------------------ */

export type SureDurumu = 'acik' | 'tamamlandi' | 'kacirildi' | 'iptal'

export interface Sure extends Kayit {
  dosyaId: Id
  /** Süre kataloğundaki kural anahtarı, ör. "istinaf-hmk-345". */
  kuralId: string
  /** Kural adı kayıt anındaki haliyle saklanır ki katalog değişse de bozulmasın. */
  kuralAdi: string
  kanunReferansi: string
  /** Süreyi başlatan olay — çoğunlukla tebligat tarihi. */
  baslangicTarihi: IsoDate
  /** Tatil/hafta sonu kaydırması uygulanmadan önceki gün. */
  hamSonTarih: IsoDate
  /** Kullanıcıya gösterilen son gün. */
  sonTarih: IsoDate
  /** Kaydırmanın gerekçesi: "31 Ağustos adli tatil sonu", "hafta sonu"… */
  kaydirmaGerekcesi?: string
  durum: SureDurumu
  olayId?: Id
  not?: string
}

/* ------------------------------------------------------------------ *
 * Görev
 * ------------------------------------------------------------------ */

export type GorevOnceligi = 'dusuk' | 'normal' | 'yuksek'
export type GorevDurumu = 'bekliyor' | 'tamamlandi'

export interface Gorev extends Kayit {
  baslik: string
  dosyaId?: Id
  muvekkilId?: Id
  aciklama?: string
  vadeTarihi?: IsoDate
  oncelik: GorevOnceligi
  durum: GorevDurumu
  tamamlanmaTarihi?: IsoDateTime
  atananKullaniciId?: Id
  /** Tekrar eden serinin ortak kimliği; tek yineleme ise yok. */
  seriesId?: Id
}

/* ------------------------------------------------------------------ *
 * Finans
 * ------------------------------------------------------------------ */

export type FinansYonu = 'gider' | 'gelir'

export type FinansKategorisi =
  | 'harc'
  | 'gider-avansi'
  | 'bilirkisi'
  | 'kesif'
  | 'teblig'
  | 'arabuluculuk'
  | 'noter'
  | 'icra-masrafi'
  | 'muvekkil-avansi'
  | 'vekalet-ucreti'
  | 'diger'

export type OdemeDurumu = 'bekliyor' | 'odendi' | 'kismi'

export interface FinansKaydi extends Kayit {
  dosyaId: Id
  muvekkilId?: Id
  yon: FinansYonu
  kategori: FinansKategorisi
  baslik: string
  tutar: Kurus
  /** Kısmi ödemede tahsil/ödenen kısım. */
  odenenTutar: Kurus
  tarih: IsoDate
  vadeTarihi?: IsoDate
  odemeDurumu: OdemeDurumu
  odemeTarihi?: IsoDate
  aciklama?: string
}

/* ------------------------------------------------------------------ *
 * Belge
 * ------------------------------------------------------------------ */

export type BelgeTuru =
  | 'vekaletname'
  | 'dilekce'
  | 'karar'
  | 'bilirkisi-raporu'
  | 'dekont'
  | 'makbuz'
  | 'sozlesme'
  | 'kimlik'
  | 'foto'
  | 'ses'
  | 'diger'

export interface Belge extends Kayit {
  ad: string
  tur: BelgeTuru
  dosyaId?: Id
  muvekkilId?: Id
  /** Dekont/makbuz bir finans kalemine bağlanır. */
  finansKaydiId?: Id
  mimeTur: string
  boyut: number
  /** İçerik cihazdan çıkmaz; IndexedDB'de Blob olarak durur. */
  icerik: Blob
  etiketler: string[]
  not?: string
}

/* ------------------------------------------------------------------ *
 * Dosyayla ilgili kişiler
 * ------------------------------------------------------------------ */

export type KisiRolu =
  | 'karsi-taraf'
  | 'karsi-vekil'
  | 'hakim'
  | 'bilirkisi'
  | 'tanik'
  | 'arabulucu'
  | 'icra-muduru'
  | 'diger'

export interface Kisi extends Kayit {
  dosyaId: Id
  ad: string
  rol: KisiRolu
  telefon?: string
  eposta?: string
  not?: string
}

/* ------------------------------------------------------------------ *
 * Not
 * ------------------------------------------------------------------ */

export type NotTuru = 'genel' | 'gorusme' | 'durusma-ozeti'

export interface Not extends Kayit {
  icerik: string
  tur: NotTuru
  dosyaId?: Id
  muvekkilId?: Id
  baslik?: string
}

/* ------------------------------------------------------------------ *
 * Hatırlatma
 * ------------------------------------------------------------------ */

export type HatirlatmaKanali = 'uygulama' | 'push' | 'sms' | 'eposta'

export type HatirlatmaDurumu = 'bekliyor' | 'gonderildi' | 'iptal' | 'basarisiz'

export interface Hatirlatma extends Kayit {
  /** Hangi kayda bağlı: olay, süre ya da ödeme. */
  hedefTuru: 'olay' | 'sure' | 'finans'
  hedefId: Id
  /** Hedef zamandan kaç dakika önce. 0 = aynı an. */
  ofsetDakika: number
  kanallar: HatirlatmaKanali[]
  planlananZaman: IsoDateTime
  durum: HatirlatmaDurumu
  gonderimZamani?: IsoDateTime
  /** Kanal sunucu gerektiriyorsa neden gönderilemediği. */
  hataNotu?: string
}

/* ------------------------------------------------------------------ *
 * Hareket günlüğü ("Son hareketler")
 * ------------------------------------------------------------------ */

export type HareketTuru =
  | 'dosya-olusturuldu'
  | 'belge-yuklendi'
  | 'gorev-tamamlandi'
  | 'hatirlatma-gonderildi'
  | 'not-eklendi'
  | 'odeme-kaydedildi'
  | 'sure-hesaplandi'
  | 'olay-eklendi'
  | 'muvekkil-eklendi'

export interface Hareket {
  readonly id: Id
  tur: HareketTuru
  baslik: string
  /** "Bilirkişi raporu · Demir İnşaat" biçiminde ikinci satır. */
  ayrinti?: string
  dosyaId?: Id
  muvekkilId?: Id
  zaman: IsoDateTime
}

/* ------------------------------------------------------------------ *
 * Büro kullanıcısı
 * ------------------------------------------------------------------ */

export interface Kullanici extends Kayit {
  ad: string
  unvan: string
  /** Avatar arka planı için kategori rengi anahtarı. */
  renk: 'red' | 'amber' | 'purple' | 'blue' | 'green' | 'slate'
  eposta?: string
  aktif: boolean
}

/* ------------------------------------------------------------------ *
 * Ayarlar — tek satırlık kayıt
 * ------------------------------------------------------------------ */

/** Şartnamedeki varsayılan hatırlatma merdiveni (md. 2), dakika cinsinden. */
export const VARSAYILAN_HATIRLATMA_OFSETLERI = [
  30 * 24 * 60, // 30 gün önce
  15 * 24 * 60, // 15 gün önce
  7 * 24 * 60, // 7 gün önce
  3 * 24 * 60, // 3 gün önce
  1 * 24 * 60, // 1 gün önce
  0, // aynı gün
  60, // 1 saat önce
] as const

export interface Ayarlar {
  readonly id: 'tekil'
  kullaniciAdi: string
  unvan: string
  /** Olay türüne göre hatırlatma ofsetleri; yoksa varsayılan merdiven. */
  hatirlatmaOfsetleri: Partial<Record<OlayTuru, number[]>>
  varsayilanKanallar: HatirlatmaKanali[]
  sessizSaatBaslangic?: string // "22:00"
  sessizSaatBitis?: string // "08:00"
  /** Uygulama kilidi açıksa PIN'in türetilmiş özeti. */
  pinOzeti?: string
  kilitEtkin: boolean
  /** Arka planda kalınca kaç dakika sonra yeniden kilitlensin (0 = hemen). */
  oturumZamanAsimiDk?: number
  /** Biyometri (WebAuthn) ile açma kayıtlı mı. */
  biyometriKimlikB64?: string
  /** LLM katmanı varsayılan olarak kapalı — müvekkil verisi cihazdan çıkmasın. */
  llmEtkin: boolean
  /** OpenAI uyumlu sohbet uç noktası (kullanıcının kendi sunucusu/geçidi). */
  llmUcNokta?: string
  /** Kullanılacak model adı, ör. "gpt-4o-mini". */
  llmModel?: string
  /** Kullanıcının kendi API anahtarı; yalnızca bu cihazda saklanır. */
  llmAnahtar?: string
  sonYedeklemeZamani?: IsoDateTime
  /**
   * Ertelenen hatırlatmalar: türetilmiş hatırlatma kimliği → yeniden gösterileceği
   * an (ISO). Süresi geçen kayıtlar yok sayılır; hatırlatmalar tabloda tutulmadığı
   * için erteleme durumu burada saklanır.
   */
  hatirlatmaErtelemeleri?: Record<string, string>
  /** İlk açılış öğretici modu görüldü/atlandı mı. */
  onboardingTamam?: boolean
  /** Hukuki onay kaydı; metin sürümü değişince yeniden istenir. */
  hukukiOnay?: {
    zaman: IsoDateTime
    surum: string
    hash: string
  }
  /** Kayıt sırasında alınan profil alanları. */
  ad?: string
  soyad?: string
  eposta?: string
  /** Seçilen giriş yöntemi (yerel profil; OAuth entegrasyonu ayrı). */
  girisYontemi?: 'eposta' | 'google' | 'apple'
  /** Kayıt/profil adımı tamamlandı mı. */
  profilKuruldu?: boolean
  /** Uygulama içi rehberli tur görüldü/atlandı mı. */
  turGoruldu?: boolean
}

/* ------------------------------------------------------------------ *
 * Türetilmiş görünüm tipleri
 * ------------------------------------------------------------------ */

/** Hazırlık durumu kontrol listesi maddesi (md. 11). */
export interface HazirlikMaddesi {
  anahtar: string
  etiket: string
  tamam: boolean
  /** Eksikse kullanıcıya gösterilecek bir sonraki adım. */
  eylem?: string
}

export interface HazirlikOzeti {
  dosyaId: Id
  yuzde: number
  maddeler: HazirlikMaddesi[]
  sonrakiAdim?: string
  seviye: 'iyi' | 'orta' | 'dikkat'
}
