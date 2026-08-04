import { db, simdi, yeniId } from './db'
import type {
  Belge,
  Dosya,
  FinansKaydi,
  Gorev,
  Hareket,
  IsoDate,
  Kullanici,
  Muvekkil,
  Olay,
  Sure,
} from '../domain/types'
import { VARSAYILAN_HATIRLATMA_OFSETLERI } from '../domain/types'

/*
 * İlk açılış verisi.
 *
 * Referans videodaki dört dosya (Yılmaz / Arslan, Demir İnşaat, Kaya / Nova,
 * Özkan Holding) birebir; kalanlar gösterge panelindeki sayıların gerçekten
 * veriden hesaplanabilmesi için üretildi. Videodaki rakamlar korunuyor:
 * 24 aktif dosya, bu hafta 8 duruşma (2'si bugün), 17 bekleyen görev
 * (4'ü öncelikli), bu ay 184.500 ₺ tahsilat (geçen aya göre +%12).
 *
 * Tarihler sabit değil, **bugüne göre** kurulur. Uygulama ne zaman ilk kez
 * açılırsa açılsın "bugünün duruşmaları" ve "2 gün kaldı" doğru görünsün;
 * sabit tarihler bir hafta sonra ölü demoya dönerdi.
 */

const gun = 86_400_000

function bugunBaslangic(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Bugüne N gün ekleyip "2026-08-12" biçiminde döner. */
function tarih(ofsetGun: number): IsoDate {
  const d = new Date(bugunBaslangic().getTime() + ofsetGun * gun)
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${ay}-${g}`
}

/** Bugüne N gün ekleyip verilen saate sabitler, tam ISO döner. */
function zaman(ofsetGun: number, saat: number, dakika = 0): string {
  const d = new Date(bugunBaslangic().getTime() + ofsetGun * gun)
  d.setHours(saat, dakika, 0, 0)
  return d.toISOString()
}

/** N dakika önce. */
function dakikaOnce(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

function damga() {
  const t = simdi()
  return { olusturmaTarihi: t, guncellemeTarihi: t }
}

/* ------------------------------------------------------------------ *
 * Büro
 * ------------------------------------------------------------------ */

const kullanicilar: Kullanici[] = [
  {
    id: 'kullanici-ayse',
    ad: 'Ayşe Kaya',
    unvan: 'Kıdemli avukat',
    renk: 'amber',
    aktif: true,
    ...damga(),
  },
  {
    id: 'kullanici-mert',
    ad: 'Mert Doğan',
    unvan: 'Avukat',
    renk: 'blue',
    aktif: true,
    ...damga(),
  },
  {
    id: 'kullanici-elif',
    ad: 'Elif Şahin',
    unvan: 'Stajyer avukat',
    renk: 'green',
    aktif: true,
    ...damga(),
  },
]

/* ------------------------------------------------------------------ *
 * Müvekkiller — ilk dördü referanstan, kalanı dolgu
 * ------------------------------------------------------------------ */

interface MuvekkilTohum {
  id: string
  ad: string
  tur: 'gercek' | 'tuzel'
  telefon?: string
  eposta?: string
}

const muvekkilTohumlari: MuvekkilTohum[] = [
  {
    id: 'muv-seda-yilmaz',
    ad: 'Seda Yılmaz',
    tur: 'gercek',
    telefon: '0532 000 00 01',
    eposta: 'seda.yilmaz@ornek.com',
  },
  {
    id: 'muv-demir-insaat',
    ad: 'Demir İnşaat A.Ş.',
    tur: 'tuzel',
    telefon: '0212 000 00 02',
    eposta: 'hukuk@demirinsaat.ornek',
  },
  {
    id: 'muv-mert-kaya',
    ad: 'Mert Kaya',
    tur: 'gercek',
    telefon: '0533 000 00 03',
  },
  {
    id: 'muv-ozkan-holding',
    ad: 'Özkan Holding A.Ş.',
    tur: 'tuzel',
    telefon: '0216 000 00 04',
  },
  { id: 'muv-05', ad: 'Aydın Tekstil Ltd. Şti.', tur: 'tuzel' },
  { id: 'muv-06', ad: 'Fatma Şen', tur: 'gercek' },
  { id: 'muv-07', ad: 'Burak Aksoy', tur: 'gercek' },
  { id: 'muv-08', ad: 'Nehir Lojistik A.Ş.', tur: 'tuzel' },
  { id: 'muv-09', ad: 'Zeynep Türkmen', tur: 'gercek' },
  { id: 'muv-10', ad: 'Karadeniz Gıda Ltd. Şti.', tur: 'tuzel' },
  { id: 'muv-11', ad: 'Hakan Yıldırım', tur: 'gercek' },
  { id: 'muv-12', ad: 'Selin Arı', tur: 'gercek' },
  { id: 'muv-13', ad: 'Marmara Enerji A.Ş.', tur: 'tuzel' },
  { id: 'muv-14', ad: 'Emre Çetin', tur: 'gercek' },
  { id: 'muv-15', ad: 'Gülay Korkmaz', tur: 'gercek' },
  { id: 'muv-16', ad: 'Anadolu Makine Ltd. Şti.', tur: 'tuzel' },
  { id: 'muv-17', ad: 'Serkan Polat', tur: 'gercek' },
  { id: 'muv-18', ad: 'Deniz Yapı A.Ş.', tur: 'tuzel' },
  { id: 'muv-19', ad: 'Merve Aslan', tur: 'gercek' },
  { id: 'muv-20', ad: 'Onur Balcı', tur: 'gercek' },
  { id: 'muv-21', ad: 'Ege Turizm Ltd. Şti.', tur: 'tuzel' },
  { id: 'muv-22', ad: 'Canan Erdem', tur: 'gercek' },
  { id: 'muv-23', ad: 'Bora Şimşek', tur: 'gercek' },
  { id: 'muv-24', ad: 'Yıldız Ambalaj A.Ş.', tur: 'tuzel' },
]

const muvekkiller: Muvekkil[] = muvekkilTohumlari.map((m) => ({
  id: m.id,
  ad: m.ad,
  tur: m.tur,
  ...(m.telefon ? { telefon: m.telefon } : {}),
  ...(m.eposta ? { eposta: m.eposta } : {}),
  etiketler: [],
  arsivlendi: false,
  ...damga(),
}))

/* ------------------------------------------------------------------ *
 * Dosyalar — 24 açık + 3 kapalı
 * ------------------------------------------------------------------ */

interface DosyaTohum {
  id: string
  baslik: string
  muvekkilId: string
  tur: Dosya['tur']
  durum: Dosya['durum']
  konu: string
  mahkeme: string
  esasNo: string
  karsiTaraf?: string
  acilisOfset: number
  sozlesmeUcreti?: number
}

const dosyaTohumlari: DosyaTohum[] = [
  {
    id: 'dosya-yilmaz-arslan',
    baslik: 'Yılmaz / Arslan',
    muvekkilId: 'muv-seda-yilmaz',
    tur: 'is',
    durum: 'derdest',
    konu: 'İşçilik alacağı',
    mahkeme: 'İstanbul 14. İş Mahkemesi',
    esasNo: '2025/412 E.',
    karsiTaraf: 'Arslan Metal San. Tic. Ltd. Şti.',
    acilisOfset: -286,
    sozlesmeUcreti: 8_500_000,
  },
  {
    id: 'dosya-demir-insaat',
    baslik: 'Demir İnşaat',
    muvekkilId: 'muv-demir-insaat',
    tur: 'ticaret',
    durum: 'derdest',
    konu: 'Tazminat davası',
    mahkeme: 'İstanbul 5. Asliye Ticaret Mahkemesi',
    esasNo: '2025/298 E.',
    karsiTaraf: 'Batı Yapı Denetim A.Ş.',
    acilisOfset: -204,
    sozlesmeUcreti: 24_000_000,
  },
  {
    id: 'dosya-kaya-nova',
    baslik: 'Kaya / Nova',
    muvekkilId: 'muv-mert-kaya',
    tur: 'ticaret',
    durum: 'derdest',
    konu: 'Ticari uyuşmazlık',
    mahkeme: 'Kadıköy 2. Sulh Hukuk Mahkemesi',
    esasNo: '2026/57 E.',
    karsiTaraf: 'Nova Bilişim Ltd. Şti.',
    acilisOfset: -118,
    sozlesmeUcreti: 6_000_000,
  },
  {
    id: 'dosya-ozkan-holding',
    baslik: 'Özkan Holding',
    muvekkilId: 'muv-ozkan-holding',
    tur: 'ticaret',
    durum: 'derdest',
    konu: 'Sözleşme feshi',
    mahkeme: 'İstanbul 9. Asliye Ticaret Mahkemesi',
    esasNo: '2025/731 E.',
    acilisOfset: -152,
    sozlesmeUcreti: 32_000_000,
  },
]

// Kalan 20 açık dosya: gösterge panelindeki "24 aktif dosya" gerçek olsun diye.
const dolguDosyalar: Array<[string, Dosya['tur'], string, string, number]> = [
  ['Aydın Tekstil / Vural', 'is', 'Kıdem tazminatı', 'Bakırköy 3. İş Mahkemesi', -95],
  ['Şen / Şen', 'aile', 'Boşanma', 'İstanbul 8. Aile Mahkemesi', -240],
  ['Aksoy / Merkez Sigorta', 'hukuk', 'Tazminat', 'İstanbul 2. Asliye Hukuk', -61],
  ['Nehir Lojistik / Ege Nakliyat', 'ticaret', 'Alacak', 'İstanbul 12. Asliye Ticaret', -178],
  ['Türkmen / Belediye', 'idari', 'İptal davası', 'İstanbul 4. İdare Mahkemesi', -134],
  ['Karadeniz Gıda icra', 'icra', 'İlamsız takip', 'Kadıköy 7. İcra Müdürlüğü', -47],
  ['Yıldırım / Öz Yapı', 'is', 'İşe iade', 'İstanbul 21. İş Mahkemesi', -83],
  ['Arı / Arı', 'aile', 'Velayet', 'Kadıköy 3. Aile Mahkemesi', -166],
  ['Marmara Enerji / EPDK', 'idari', 'İdari para cezası', 'Ankara 6. İdare Mahkemesi', -112],
  ['Çetin / Sarı Otomotiv', 'tuketici', 'Ayıplı mal', 'İstanbul 5. Tüketici Mahkemesi', -38],
  ['Korkmaz / Korkmaz', 'hukuk', 'Miras taksimi', 'Üsküdar 1. Asliye Hukuk', -221],
  ['Anadolu Makine / Kuzey Çelik', 'ticaret', 'Cari hesap', 'İstanbul 3. Asliye Ticaret', -73],
  ['Polat ceza', 'ceza', 'Güveni kötüye kullanma', 'İstanbul 22. Asliye Ceza', -129],
  ['Deniz Yapı / Kat malikleri', 'hukuk', 'Kat mülkiyeti', 'Beşiktaş 2. Sulh Hukuk', -56],
  ['Aslan / Yıldız Market', 'is', 'Fazla mesai', 'İstanbul 18. İş Mahkemesi', -101],
  ['Balcı icra', 'icra', 'İlamlı takip', 'İstanbul 14. İcra Müdürlüğü', -29],
  ['Ege Turizm / Acar Tur', 'ticaret', 'Haksız rekabet', 'İstanbul 1. Fikri ve Sınai Haklar', -190],
  ['Erdem / Güven Sigorta', 'hukuk', 'Trafik kazası tazminatı', 'İstanbul 7. Asliye Hukuk', -145],
  ['Şimşek arabuluculuk', 'arabuluculuk', 'İşçilik alacağı', 'İstanbul Arabuluculuk Bürosu', -18],
  ['Yıldız Ambalaj / Ünal', 'ticaret', 'Marka hakkına tecavüz', 'İstanbul 2. Fikri ve Sınai Haklar', -207],
]

/**
 * Bu ayın ilk günlerinden birine denk gelen, bugünü geçmeyen tarih.
 * "+3 bu ay" sayacının ayın kaçında olursak olalım doğru çıkmasını sağlar.
 */
function buAyAcilis(sira: number): number {
  const bugun = bugunBaslangic()
  const hedefGun = Math.min(sira, bugun.getDate())
  const hedef = new Date(bugun.getFullYear(), bugun.getMonth(), hedefGun)
  return Math.round((hedef.getTime() - bugun.getTime()) / gun)
}

// Son üç dosya bu ay açılmış sayılır; kalanlar geçmişte.
const buAyAcilanlar = new Set([17, 18, 19])

dolguDosyalar.forEach((satir, i) => {
  const [baslik, tur, konu, mahkeme, gecmisOfset] = satir
  const acilisOfset = buAyAcilanlar.has(i)
    ? buAyAcilis(i - 16)
    : gecmisOfset
  dosyaTohumlari.push({
    id: `dosya-dolgu-${i + 1}`,
    baslik,
    muvekkilId: `muv-${String(i + 5).padStart(2, '0')}`,
    tur,
    durum: 'derdest',
    konu,
    mahkeme,
    esasNo: `2025/${100 + i * 7} E.`,
    acilisOfset,
    sozlesmeUcreti: (40 + i * 3) * 100_000,
  })
})

// Kapalı dosyalar — "aktif dosya" sayımının dışında kalmalı.
const kapaliTohumlar: DosyaTohum[] = [
  {
    id: 'dosya-kapali-1',
    baslik: 'Ünsal / Beta Tekstil',
    muvekkilId: 'muv-11',
    tur: 'is',
    durum: 'kapali',
    konu: 'İşçilik alacağı',
    mahkeme: 'İstanbul 11. İş Mahkemesi',
    esasNo: '2024/318 E.',
    acilisOfset: -520,
  },
  {
    id: 'dosya-kapali-2',
    baslik: 'Doğan / Kent Sigorta',
    muvekkilId: 'muv-14',
    tur: 'hukuk',
    durum: 'kapali',
    konu: 'Tazminat',
    mahkeme: 'İstanbul 6. Asliye Hukuk',
    esasNo: '2024/902 E.',
    acilisOfset: -463,
  },
  {
    id: 'dosya-kapali-3',
    baslik: 'Yalçın icra',
    muvekkilId: 'muv-17',
    tur: 'icra',
    durum: 'kapali',
    konu: 'İlamsız takip',
    mahkeme: 'Kadıköy 4. İcra Müdürlüğü',
    esasNo: '2024/1155 E.',
    acilisOfset: -388,
  },
]

const dosyalar: Dosya[] = [...dosyaTohumlari, ...kapaliTohumlar].map((d) => ({
  id: d.id,
  baslik: d.baslik,
  muvekkilId: d.muvekkilId,
  tur: d.tur,
  durum: d.durum,
  konu: d.konu,
  mahkeme: d.mahkeme,
  esasNo: d.esasNo,
  ...(d.karsiTaraf ? { karsiTaraf: d.karsiTaraf } : {}),
  acilisTarihi: tarih(d.acilisOfset),
  ...(d.sozlesmeUcreti ? { sozlesmeUcreti: d.sozlesmeUcreti } : {}),
  ...(d.durum === 'kapali' ? { kapanisTarihi: tarih(d.acilisOfset + 300) } : {}),
  arsivlendi: false,
  ...damga(),
}))

/* ------------------------------------------------------------------ *
 * Takvim olayları — bu hafta 8 duruşma, 2'si bugün
 * ------------------------------------------------------------------ */

interface OlayTohum {
  baslik: string
  tur: Olay['tur']
  dosyaId: string
  ofset: number
  saat: number
  dakika?: number
  yer: string
}

const olayTohumlari: OlayTohum[] = [
  // Referanstaki üç kayıt
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-yilmaz-arslan',
    ofset: 0,
    saat: 9,
    dakika: 30,
    yer: 'İstanbul 14. İş Mahkemesi',
  },
  {
    baslik: 'Müvekkil görüşmesi',
    tur: 'muvekkil-gorusmesi',
    dosyaId: 'dosya-demir-insaat',
    ofset: 0,
    saat: 14,
    yer: 'Ofis — Toplantı odası 2',
  },
  {
    baslik: 'Keşif',
    tur: 'kesif',
    dosyaId: 'dosya-kaya-nova',
    ofset: 1,
    saat: 11,
    dakika: 15,
    yer: 'Kadıköy, Rasimpaşa Mah.',
  },
  // Haftanın kalan duruşmaları
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-ozkan-holding',
    ofset: 0,
    saat: 11,
    yer: 'İstanbul 9. Asliye Ticaret Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-1',
    ofset: 1,
    saat: 9,
    yer: 'Bakırköy 3. İş Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-4',
    ofset: 2,
    saat: 10,
    dakika: 30,
    yer: 'İstanbul 12. Asliye Ticaret Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-7',
    ofset: 2,
    saat: 14,
    dakika: 15,
    yer: 'İstanbul 21. İş Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-9',
    ofset: 3,
    saat: 9,
    dakika: 45,
    yer: 'Ankara 6. İdare Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-13',
    ofset: 3,
    saat: 13,
    dakika: 30,
    yer: 'İstanbul 22. Asliye Ceza Mahkemesi',
  },
  {
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'dosya-dolgu-15',
    ofset: 4,
    saat: 10,
    yer: 'İstanbul 18. İş Mahkemesi',
  },
  // Diğer türler
  {
    baslik: 'Arabuluculuk toplantısı',
    tur: 'arabuluculuk',
    dosyaId: 'dosya-dolgu-19',
    ofset: 2,
    saat: 15,
    yer: 'İstanbul Arabuluculuk Bürosu',
  },
  {
    baslik: 'Müvekkil görüşmesi',
    tur: 'muvekkil-gorusmesi',
    dosyaId: 'dosya-dolgu-11',
    ofset: 4,
    saat: 16,
    yer: 'Ofis — Toplantı odası 1',
  },
  {
    baslik: 'Haciz işlemi',
    tur: 'icra',
    dosyaId: 'dosya-dolgu-16',
    ofset: 5,
    saat: 10,
    dakika: 30,
    yer: 'İstanbul 14. İcra Müdürlüğü',
  },
]

const olaylar: Olay[] = olayTohumlari.map((o) => {
  const dosya = dosyalar.find((d) => d.id === o.dosyaId)
  return {
    id: yeniId(),
    baslik: o.baslik,
    tur: o.tur,
    dosyaId: o.dosyaId,
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    baslangic: zaman(o.ofset, o.saat, o.dakika ?? 0),
    tumGun: false,
    yer: o.yer,
    durum: 'planlandi' as const,
    kaynak: 'manuel' as const,
    ...damga(),
  }
})

/* ------------------------------------------------------------------ *
 * Hukuki süreler — referanstaki üç kayıt
 * ------------------------------------------------------------------ */

const sureler: Sure[] = [
  {
    id: 'sure-istinaf-yilmaz',
    dosyaId: 'dosya-yilmaz-arslan',
    kuralId: 'istinaf-hmk-345',
    kuralAdi: 'İstinaf başvuru süresi',
    kanunReferansi: 'HMK m. 345',
    baslangicTarihi: tarih(-12),
    hamSonTarih: tarih(2),
    sonTarih: tarih(2),
    durum: 'acik',
    ...damga(),
  },
  {
    id: 'sure-bilirkisi-demir',
    dosyaId: 'dosya-demir-insaat',
    kuralId: 'bilirkisi-ucreti',
    kuralAdi: 'Bilirkişi ücreti yatırılacak',
    kanunReferansi: 'HMK m. 283 — mahkeme kesin süresi',
    baslangicTarihi: tarih(-9),
    hamSonTarih: tarih(5),
    sonTarih: tarih(5),
    durum: 'acik',
    ...damga(),
  },
  {
    id: 'sure-cevap-kaya',
    dosyaId: 'dosya-kaya-nova',
    kuralId: 'cevap-dilekcesi-hmk-127',
    kuralAdi: 'Cevap dilekçesi son günü',
    kanunReferansi: 'HMK m. 127',
    baslangicTarihi: tarih(-5),
    hamSonTarih: tarih(9),
    sonTarih: tarih(9),
    durum: 'acik',
    ...damga(),
  },
]

/* ------------------------------------------------------------------ *
 * Görevler — 17 bekleyen, 4'ü öncelikli
 * ------------------------------------------------------------------ */

interface GorevTohum {
  baslik: string
  dosyaId: string
  vadeOfset: number
  oncelik: Gorev['oncelik']
  durum?: Gorev['durum']
  atanan?: string
}

const gorevTohumlari: GorevTohum[] = [
  // Referanstaki dört kayıt
  {
    baslik: 'İstinaf dilekçesini son kez kontrol et',
    dosyaId: 'dosya-yilmaz-arslan',
    vadeOfset: 0,
    oncelik: 'yuksek',
  },
  {
    baslik: 'Bilirkişi raporunu dosyaya yükle',
    dosyaId: 'dosya-demir-insaat',
    vadeOfset: 0,
    oncelik: 'yuksek',
  },
  {
    baslik: 'Müvekkilden eksik belgeleri iste',
    dosyaId: 'dosya-kaya-nova',
    vadeOfset: 1,
    oncelik: 'normal',
  },
  {
    baslik: 'Vekâlet ücret makbuzunu oluştur',
    dosyaId: 'dosya-ozkan-holding',
    vadeOfset: 3,
    oncelik: 'normal',
    durum: 'tamamlandi',
  },
  // Kalan bekleyen görevler
  { baslik: 'Harç yatırılacak', dosyaId: 'dosya-dolgu-1', vadeOfset: 2, oncelik: 'yuksek' },
  { baslik: 'Cevaba cevap dilekçesi hazırla', dosyaId: 'dosya-dolgu-4', vadeOfset: 4, oncelik: 'yuksek' },
  { baslik: 'Müvekkil aranacak', dosyaId: 'dosya-dolgu-2', vadeOfset: 1, oncelik: 'normal', atanan: 'kullanici-elif' },
  { baslik: 'Tanık listesi sun', dosyaId: 'dosya-dolgu-7', vadeOfset: 5, oncelik: 'normal' },
  { baslik: 'Gider avansı tamamlanacak', dosyaId: 'dosya-dolgu-5', vadeOfset: 6, oncelik: 'normal' },
  { baslik: 'Keşif raporunu incele', dosyaId: 'dosya-kaya-nova', vadeOfset: 4, oncelik: 'normal' },
  { baslik: 'İcra dosyasına haciz talebi ekle', dosyaId: 'dosya-dolgu-16', vadeOfset: 3, oncelik: 'normal', atanan: 'kullanici-mert' },
  { baslik: 'Vekâletname aslını dosyaya koy', dosyaId: 'dosya-dolgu-10', vadeOfset: 7, oncelik: 'dusuk' },
  { baslik: 'Müvekkile duruşma özeti gönder', dosyaId: 'dosya-dolgu-3', vadeOfset: 2, oncelik: 'normal' },
  { baslik: 'Bilirkişi raporuna itiraz hazırla', dosyaId: 'dosya-dolgu-12', vadeOfset: 8, oncelik: 'normal' },
  { baslik: 'Arabuluculuk son tutanağını al', dosyaId: 'dosya-dolgu-19', vadeOfset: 5, oncelik: 'normal', atanan: 'kullanici-elif' },
  { baslik: 'Noter masrafı makbuzunu tara', dosyaId: 'dosya-dolgu-17', vadeOfset: 9, oncelik: 'dusuk' },
  { baslik: 'Duruşma zaptını dosyaya ekle', dosyaId: 'dosya-dolgu-8', vadeOfset: 10, oncelik: 'dusuk', atanan: 'kullanici-mert' },
  { baslik: 'Ödeme emrine itiraz süresini kontrol et', dosyaId: 'dosya-dolgu-14', vadeOfset: 3, oncelik: 'normal' },
  // Geçmişte tamamlanmış birkaç kayıt — raporlar için
  { baslik: 'Dava dilekçesini sun', dosyaId: 'dosya-dolgu-18', vadeOfset: -6, oncelik: 'normal', durum: 'tamamlandi' },
  { baslik: 'Delil listesi hazırla', dosyaId: 'dosya-dolgu-20', vadeOfset: -12, oncelik: 'normal', durum: 'tamamlandi' },
  { baslik: 'Müvekkil bilgilendirme yazısı', dosyaId: 'dosya-dolgu-11', vadeOfset: -3, oncelik: 'dusuk', durum: 'tamamlandi' },
]

const gorevler: Gorev[] = gorevTohumlari.map((g) => {
  const dosya = dosyalar.find((d) => d.id === g.dosyaId)
  const durum = g.durum ?? 'bekliyor'
  return {
    id: yeniId(),
    baslik: g.baslik,
    dosyaId: g.dosyaId,
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    vadeTarihi: tarih(g.vadeOfset),
    oncelik: g.oncelik,
    durum,
    ...(durum === 'tamamlandi' ? { tamamlanmaTarihi: dakikaOnce(90) } : {}),
    ...(g.atanan ? { atananKullaniciId: g.atanan } : {}),
    ...damga(),
  }
})

/* ------------------------------------------------------------------ *
 * Finans — bu ay 184.500 ₺ tahsilat, geçen ay ~%12 daha az
 * ------------------------------------------------------------------ */

/** Bu ayın N'inci gününe ait tarih; ay sonunu taşırmaz. */
function buAy(gunNo: number): IsoDate {
  const bugun = bugunBaslangic()
  const sonGun = new Date(
    bugun.getFullYear(),
    bugun.getMonth() + 1,
    0,
  ).getDate()
  const g = String(Math.min(gunNo, sonGun)).padStart(2, '0')
  const ay = String(bugun.getMonth() + 1).padStart(2, '0')
  return `${bugun.getFullYear()}-${ay}-${g}`
}

function gecenAy(gunNo: number): IsoDate {
  const bugun = bugunBaslangic()
  const d = new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1)
  const sonGun = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const g = String(Math.min(gunNo, sonGun)).padStart(2, '0')
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${ay}-${g}`
}

interface FinansTohum {
  dosyaId: string
  yon: FinansKaydi['yon']
  kategori: FinansKaydi['kategori']
  baslik: string
  tutar: number
  tarih: IsoDate
  odemeDurumu: FinansKaydi['odemeDurumu']
  vadeOfset?: number
}

// Bu ayki tahsilatlar — toplamı tam 184.500,00 ₺ (18.450.000 kuruş)
const buAyTahsilat: Array<[string, string, number, number]> = [
  ['dosya-yilmaz-arslan', 'Vekâlet ücreti — 2. taksit', 4_250_000, 3],
  ['dosya-demir-insaat', 'Vekâlet ücreti — peşinat', 6_000_000, 7],
  ['dosya-ozkan-holding', 'Vekâlet ücreti — ara ödeme', 4_500_000, 11],
  ['dosya-dolgu-4', 'Müvekkil avansı', 1_800_000, 14],
  ['dosya-dolgu-9', 'Vekâlet ücreti — bakiye', 1_900_000, 18],
]

// Geçen ay: 164.732,00 ₺ → bu ay +%12
const gecenAyTahsilat: Array<[string, string, number, number]> = [
  ['dosya-dolgu-1', 'Vekâlet ücreti — peşinat', 5_500_000, 5],
  ['dosya-dolgu-7', 'Müvekkil avansı', 4_200_000, 12],
  ['dosya-dolgu-12', 'Vekâlet ücreti — 1. taksit', 3_873_200, 19],
  ['dosya-dolgu-17', 'Vekâlet ücreti — bakiye', 2_900_000, 26],
]

const finansTohumlari: FinansTohum[] = []

for (const [dosyaId, baslik, tutar, gunNo] of buAyTahsilat) {
  finansTohumlari.push({
    dosyaId,
    yon: 'gelir',
    kategori: baslik.includes('avans') ? 'muvekkil-avansi' : 'vekalet-ucreti',
    baslik,
    tutar,
    tarih: buAy(gunNo),
    odemeDurumu: 'odendi',
  })
}

for (const [dosyaId, baslik, tutar, gunNo] of gecenAyTahsilat) {
  finansTohumlari.push({
    dosyaId,
    yon: 'gelir',
    kategori: baslik.includes('avans') ? 'muvekkil-avansi' : 'vekalet-ucreti',
    baslik,
    tutar,
    tarih: gecenAy(gunNo),
    odemeDurumu: 'odendi',
  })
}

// Giderler — bir kısmı ödenmemiş ki hazırlık durumu ve uyarılar çalışsın
const giderTohumlari: FinansTohum[] = [
  {
    dosyaId: 'dosya-yilmaz-arslan',
    yon: 'gider',
    kategori: 'harc',
    baslik: 'Başvurma harcı',
    tutar: 61_500,
    tarih: buAy(2),
    odemeDurumu: 'odendi',
  },
  {
    dosyaId: 'dosya-demir-insaat',
    yon: 'gider',
    kategori: 'bilirkisi',
    baslik: 'Bilirkişi ücreti',
    tutar: 1_250_000,
    tarih: tarih(-2),
    odemeDurumu: 'bekliyor',
    vadeOfset: 5,
  },
  {
    dosyaId: 'dosya-kaya-nova',
    yon: 'gider',
    kategori: 'gider-avansi',
    baslik: 'Gider avansı tamamlama',
    tutar: 340_000,
    tarih: tarih(-4),
    odemeDurumu: 'bekliyor',
    vadeOfset: 8,
  },
  {
    dosyaId: 'dosya-kaya-nova',
    yon: 'gider',
    kategori: 'kesif',
    baslik: 'Keşif gideri',
    tutar: 480_000,
    tarih: tarih(-1),
    odemeDurumu: 'bekliyor',
    vadeOfset: 1,
  },
  {
    dosyaId: 'dosya-ozkan-holding',
    yon: 'gider',
    kategori: 'teblig',
    baslik: 'Tebligat masrafı',
    tutar: 42_000,
    tarih: buAy(6),
    odemeDurumu: 'odendi',
  },
  {
    dosyaId: 'dosya-dolgu-16',
    yon: 'gider',
    kategori: 'icra-masrafi',
    baslik: 'İcra dosya masrafı',
    tutar: 87_500,
    tarih: tarih(-7),
    odemeDurumu: 'odendi',
  },
  {
    dosyaId: 'dosya-dolgu-19',
    yon: 'gider',
    kategori: 'arabuluculuk',
    baslik: 'Arabuluculuk ücreti',
    tutar: 320_000,
    tarih: tarih(-3),
    odemeDurumu: 'bekliyor',
    vadeOfset: 4,
  },
  {
    dosyaId: 'dosya-dolgu-11',
    yon: 'gider',
    kategori: 'noter',
    baslik: 'Noter masrafı',
    tutar: 128_000,
    tarih: tarih(-15),
    odemeDurumu: 'odendi',
  },
]

// Aynı gerekçe harç için: dava açılmışsa harcı yatırılmıştır.
for (const dosya of dosyalar) {
  if (dosya.durum === 'kapali') continue
  const zatenVar = [...finansTohumlari, ...giderTohumlari].some(
    (f) => f.dosyaId === dosya.id && f.kategori === 'harc',
  )
  if (zatenVar) continue
  giderTohumlari.push({
    dosyaId: dosya.id,
    yon: 'gider',
    kategori: 'harc',
    baslik: 'Başvurma harcı',
    tutar: 61_500,
    tarih: dosya.acilisTarihi,
    odemeDurumu: 'odendi',
  })
}

const finans: FinansKaydi[] = [...finansTohumlari, ...giderTohumlari].map(
  (f) => {
    const dosya = dosyalar.find((d) => d.id === f.dosyaId)
    return {
      id: yeniId(),
      dosyaId: f.dosyaId,
      ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
      yon: f.yon,
      kategori: f.kategori,
      baslik: f.baslik,
      tutar: f.tutar,
      odenenTutar: f.odemeDurumu === 'odendi' ? f.tutar : 0,
      tarih: f.tarih,
      ...(f.vadeOfset !== undefined
        ? { vadeTarihi: tarih(f.vadeOfset) }
        : {}),
      odemeDurumu: f.odemeDurumu,
      ...(f.odemeDurumu === 'odendi' ? { odemeTarihi: f.tarih } : {}),
      ...damga(),
    }
  },
)

/* ------------------------------------------------------------------ *
 * Belgeler
 *
 * İçerikler örnek metin: gerçek bir vekâletname taklidi üretmek yanıltıcı
 * olurdu. Tür alanı doğru olduğu için hazırlık durumu motoru çalışır, dosyayı
 * açan kullanıcı da bunun örnek veri olduğunu görür.
 * ------------------------------------------------------------------ */

function ornekBelge(baslik: string): Blob {
  return new Blob(
    [
      `${baslik}\n\n` +
        'Bu, JurisCalendar ilk kurulumunda oluşturulan örnek bir belgedir.\n' +
        'Kendi belgenizi yükleyince bu dosyayı silebilirsiniz.\n',
    ],
    { type: 'text/plain' },
  )
}

interface BelgeTohum {
  ad: string
  tur: Belge['tur']
  dosyaId: string
}

const belgeTohumlari: BelgeTohum[] = [
  { ad: 'Vekâletname (örnek).txt', tur: 'vekaletname', dosyaId: 'dosya-yilmaz-arslan' },
  { ad: 'Dava dilekçesi (örnek).txt', tur: 'dilekce', dosyaId: 'dosya-yilmaz-arslan' },
  { ad: 'Vekâletname (örnek).txt', tur: 'vekaletname', dosyaId: 'dosya-demir-insaat' },
  { ad: 'Bilirkişi raporu (örnek).txt', tur: 'bilirkisi-raporu', dosyaId: 'dosya-demir-insaat' },
  { ad: 'Vekâletname (örnek).txt', tur: 'vekaletname', dosyaId: 'dosya-ozkan-holding' },
  { ad: 'Vekâlet ücret makbuzu (örnek).txt', tur: 'makbuz', dosyaId: 'dosya-ozkan-holding' },
  { ad: 'Sözleşme (örnek).txt', tur: 'sozlesme', dosyaId: 'dosya-dolgu-1' },
  { ad: 'Vekâletname (örnek).txt', tur: 'vekaletname', dosyaId: 'dosya-dolgu-1' },
]

// Gerçek bir büroda her açık dosyada vekâletname vardır. Dolgu dosyalarına da
// eklemezsek hazırlık sıralaması onları yapay olarak "eksik" gösterir.
for (const dosya of dosyalar) {
  if (dosya.durum === 'kapali') continue
  if (belgeTohumlari.some((b) => b.dosyaId === dosya.id)) continue
  belgeTohumlari.push({
    ad: 'Vekâletname (örnek).txt',
    tur: 'vekaletname',
    dosyaId: dosya.id,
  })
}

const belgeler: Belge[] = belgeTohumlari.map((b) => {
  const dosya = dosyalar.find((d) => d.id === b.dosyaId)
  const icerik = ornekBelge(b.ad.replace(' (örnek).txt', ''))
  return {
    id: yeniId(),
    ad: b.ad,
    tur: b.tur,
    dosyaId: b.dosyaId,
    ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
    mimeTur: 'text/plain',
    boyut: icerik.size,
    icerik,
    etiketler: [],
    ...damga(),
  }
})

/* ------------------------------------------------------------------ *
 * Son hareketler — referanstaki dört satır
 * ------------------------------------------------------------------ */

const hareketler: Hareket[] = [
  {
    id: yeniId(),
    tur: 'belge-yuklendi',
    baslik: 'Yeni belge yüklendi',
    ayrinti: 'Bilirkişi raporu · Demir İnşaat',
    dosyaId: 'dosya-demir-insaat',
    zaman: dakikaOnce(12),
  },
  {
    id: yeniId(),
    tur: 'gorev-tamamlandi',
    baslik: 'Görev tamamlandı',
    ayrinti: 'Vekâlet ücret makbuzu · Özkan Holding',
    dosyaId: 'dosya-ozkan-holding',
    zaman: dakikaOnce(60),
  },
  {
    id: yeniId(),
    tur: 'hatirlatma-gonderildi',
    baslik: 'Hatırlatma gönderildi',
    ayrinti: 'İstinaf başvuru süresi · Yılmaz / Arslan',
    dosyaId: 'dosya-yilmaz-arslan',
    zaman: dakikaOnce(120),
  },
  {
    id: yeniId(),
    tur: 'not-eklendi',
    baslik: 'Dosya notu eklendi',
    ayrinti: 'Müvekkil görüşme özeti · Kaya / Nova',
    dosyaId: 'dosya-kaya-nova',
    zaman: (() => {
      const d = new Date(bugunBaslangic().getTime() - gun)
      d.setHours(16, 42, 0, 0)
      return d.toISOString()
    })(),
  },
]

/* ------------------------------------------------------------------ *
 * Kurulum
 * ------------------------------------------------------------------ */

/**
 * Üretilen tohum tabloları. Dexie'ye yazmadan da incelenebilsin diye dışa
 * açık — testler referans videodaki sayıları buradan doğruluyor.
 */
export const tohumVerisi = {
  kullanicilar,
  muvekkiller,
  dosyalar,
  olaylar,
  sureler,
  gorevler,
  finans,
  belgeler,
  hareketler,
} as const

/**
 * Veritabanı boşsa örnek veriyi yazar. Doluysa hiçbir şey yapmaz — kullanıcının
 * kendi verisinin üzerine yazmak kabul edilemez.
 */
export async function tohumlaGerekiyorsa(): Promise<boolean> {
  const mevcut = await db.dosyalar.count()
  if (mevcut > 0) return false

  await db.transaction(
    'rw',
    [
      db.kullanicilar,
      db.muvekkiller,
      db.dosyalar,
      db.olaylar,
      db.sureler,
      db.gorevler,
      db.finans,
      db.belgeler,
      db.hareketler,
      db.ayarlar,
    ],
    async () => {
      await db.kullanicilar.bulkAdd(kullanicilar)
      await db.muvekkiller.bulkAdd(muvekkiller)
      await db.dosyalar.bulkAdd(dosyalar)
      await db.olaylar.bulkAdd(olaylar)
      await db.sureler.bulkAdd(sureler)
      await db.gorevler.bulkAdd(gorevler)
      await db.finans.bulkAdd(finans)
      await db.belgeler.bulkAdd(belgeler)
      await db.hareketler.bulkAdd(hareketler)
      await db.ayarlar.put({
        id: 'tekil',
        kullaniciAdi: 'Ayşe Kaya',
        unvan: 'Kıdemli avukat',
        hatirlatmaOfsetleri: {
          durusma: [...VARSAYILAN_HATIRLATMA_OFSETLERI],
          'son-tarih': [...VARSAYILAN_HATIRLATMA_OFSETLERI],
        },
        varsayilanKanallar: ['uygulama'],
        kilitEtkin: false,
        llmEtkin: false,
      })
    },
  )

  return true
}
