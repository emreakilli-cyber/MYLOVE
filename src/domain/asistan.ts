import type {
  Belge,
  Dosya,
  FinansKaydi,
  Gorev,
  Muvekkil,
  Olay,
  Sure,
} from './types'
import {
  aciliyet,
  bugunIso,
  gunFarki,
  kalanSureMetni,
  kisaTarih,
  yerelGun,
} from './tarih'
import { hazirlikHesapla } from './hazirlik'

/*
 * Asistan kural motoru (şartname md. 10).
 *
 * Neden LLM değil kural motoru: şartnamedeki örneklerin ikisi de
 * ("Bilirkişi ücreti henüz yatırılmadı", "İstinaf süresinin dolmasına iki gün
 * kaldı") veriden deterministik çıkar. Kural motoru çevrimdışı çalışır, yanlış
 * cevap üretmez ve müvekkil verisini hiçbir yere göndermez. LLM katmanı ileride
 * bunun ÜSTÜNE, kullanıcının kendi anahtarıyla ve varsayılan kapalı gelebilir.
 */

export type BulguTuru = 'sure' | 'odeme' | 'eksik' | 'hazirlik' | 'durusma'
export type BulguOnceligi = 'kritik' | 'uyari' | 'bilgi'

export interface Bulgu {
  id: string
  tur: BulguTuru
  oncelik: BulguOnceligi
  /** Kısa, tek cümlelik tespit — asistanın "söylediği" şey. */
  mesaj: string
  dosyaId: string
  dosyaBaslik: string
  /** İlgili ekrana götüren yol. */
  yol: string
}

export interface DosyaBaglami {
  dosya: Dosya
  muvekkil?: Muvekkil | undefined
  olaylar: Olay[]
  sureler: Sure[]
  gorevler: Gorev[]
  finans: FinansKaydi[]
  belgeler: Belge[]
}

const oncelikSira: Record<BulguOnceligi, number> = {
  kritik: 0,
  uyari: 1,
  bilgi: 2,
}

/** Ödenmemiş bir kalemi okunur bir isimle anar. */
const kategoriAdi: Record<string, string> = {
  harc: 'Harç',
  'gider-avansi': 'Gider avansı',
  bilirkisi: 'Bilirkişi ücreti',
  kesif: 'Keşif gideri',
  teblig: 'Tebligat masrafı',
  arabuluculuk: 'Arabuluculuk ücreti',
  noter: 'Noter masrafı',
  'icra-masrafi': 'İcra masrafı',
  'muvekkil-avansi': 'Müvekkil avansı',
  'vekalet-ucreti': 'Vekâlet ücreti',
  diger: 'Ödeme',
}

/**
 * Tek dosya için bulgular. Sıralama önceliğe, sonra aciliyete göredir.
 */
export function dosyaBulgulari(baglam: DosyaBaglami): Bulgu[] {
  const { dosya, olaylar, sureler, gorevler, finans, belgeler } = baglam
  const bulgular: Bulgu[] = []
  const yol = `/dosyalar/${dosya.id}`

  // 1) Açık hukuki süreler.
  for (const sure of sureler) {
    if (sure.durum !== 'acik') continue
    const acil = aciliyet(sure.sonTarih)
    const kalan = kalanSureMetni(sure.sonTarih)
    if (acil === 'gecti') {
      bulgular.push({
        id: `sure-gecti-${sure.id}`,
        tur: 'sure',
        oncelik: 'kritik',
        mesaj: `${sure.kuralAdi} doldu (${kisaTarih(sure.sonTarih)}); ${kalan}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    } else if (acil === 'kritik') {
      // Ek almadan ifade: "süresinın" gibi ünlü uyumu hatasından kaçınmak için
      // kural adına doğrudan iyelik/tamlama eki eklemiyoruz.
      bulgular.push({
        id: `sure-kritik-${sure.id}`,
        tur: 'sure',
        oncelik: 'kritik',
        mesaj: `${sure.kuralAdi} doluyor; ${kalan}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    } else if (acil === 'yakin') {
      bulgular.push({
        id: `sure-yakin-${sure.id}`,
        tur: 'sure',
        oncelik: 'uyari',
        mesaj: `${sure.kuralAdi} yaklaşıyor; ${kalan}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    }
  }

  // 2) Ödenmemiş kalemler (bilirkişi/harç öne çıkar).
  for (const f of finans) {
    if (f.yon !== 'gider' || f.odemeDurumu === 'odendi') continue
    const ad = kategoriAdi[f.kategori] ?? f.baslik
    const vadeMetni = f.vadeTarihi
      ? ` (vade ${kisaTarih(f.vadeTarihi)})`
      : ''
    const gecikti =
      f.vadeTarihi && gunFarki(f.vadeTarihi) < 0
    bulgular.push({
      id: `odeme-${f.id}`,
      tur: 'odeme',
      oncelik: gecikti ? 'kritik' : 'uyari',
      mesaj: gecikti
        ? `${ad} vadesi geçti${vadeMetni}, henüz ödenmedi.`
        : `${ad} henüz yatırılmadı${vadeMetni}.`,
      dosyaId: dosya.id,
      dosyaBaslik: dosya.baslik,
      yol,
    })
  }

  // 3) Yaklaşan duruşma.
  const bugunStr = bugunIso()
  for (const o of olaylar) {
    if (o.tur !== 'durusma' || o.durum !== 'planlandi') continue
    const gun = yerelGun(o.baslangic)
    if (gun < bugunStr) continue
    const fark = gunFarki(gun)
    if (fark <= 7) {
      bulgular.push({
        id: `durusma-${o.id}`,
        tur: 'durusma',
        oncelik: fark <= 1 ? 'kritik' : 'uyari',
        mesaj:
          fark === 0
            ? `Bugün duruşma var${o.yer ? ` (${o.yer})` : ''}.`
            : `Duruşmaya ${fark} gün kaldı${o.yer ? ` (${o.yer})` : ''}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    }
  }

  // 4) Geciken görevler.
  for (const g of gorevler) {
    if (g.durum !== 'bekliyor' || !g.vadeTarihi) continue
    if (gunFarki(g.vadeTarihi) < 0) {
      bulgular.push({
        id: `gorev-${g.id}`,
        tur: 'eksik',
        oncelik: 'uyari',
        mesaj: `Geciken görev: ${g.baslik}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    }
  }

  // 5) Eksik temel işlemler (hazırlık motorundan).
  if (dosya.durum !== 'kapali') {
    const ozet = hazirlikHesapla({
      dosya,
      muvekkil: baglam.muvekkil,
      olaylar,
      sureler,
      gorevler,
      finans,
      belgeler,
    })
    const vekaletVar = belgeler.some((b) => b.tur === 'vekaletname')
    if (!vekaletVar) {
      bulgular.push({
        id: `eksik-vekalet-${dosya.id}`,
        tur: 'eksik',
        oncelik: 'uyari',
        mesaj: 'Vekâletname dosyaya yüklenmemiş.',
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    }
    if (ozet.yuzde < 50 && ozet.sonrakiAdim) {
      bulgular.push({
        id: `hazirlik-${dosya.id}`,
        tur: 'hazirlik',
        oncelik: 'bilgi',
        mesaj: `Hazırlık %${ozet.yuzde}. Sıradaki adım: ${ozet.sonrakiAdim}.`,
        dosyaId: dosya.id,
        dosyaBaslik: dosya.baslik,
        yol,
      })
    }
  }

  return bulgular.sort(
    (a, b) => oncelikSira[a.oncelik] - oncelikSira[b.oncelik],
  )
}

/** Büro genelindeki tüm bulgular, önceliğe göre. */
export function tumBulgular(baglamlar: DosyaBaglami[]): Bulgu[] {
  return baglamlar
    .flatMap((b) => dosyaBulgulari(b))
    .sort((a, b) => oncelikSira[a.oncelik] - oncelikSira[b.oncelik])
}

/* ------------------------------------------------------------------ *
 * Dosya özeti — "dosyanın mevcut durumunu özetle"
 * ------------------------------------------------------------------ */

export function dosyaOzeti(baglam: DosyaBaglami): string {
  const { dosya, muvekkil, olaylar, sureler, finans, belgeler } = baglam
  const parcalar: string[] = []

  parcalar.push(
    `${dosya.baslik}${muvekkil ? ` (${muvekkil.ad})` : ''}, ${dosya.mahkeme ?? 'mahkeme girilmemiş'}.`,
  )

  const acikSure = sureler
    .filter((s) => s.durum === 'acik')
    .sort((a, b) => a.sonTarih.localeCompare(b.sonTarih))[0]
  if (acikSure) {
    parcalar.push(
      `En yakın süre: ${acikSure.kuralAdi}, ${kalanSureMetni(acikSure.sonTarih)}.`,
    )
  }

  const bugunStr = bugunIso()
  const sonrakiDurusma = olaylar
    .filter((o) => o.tur === 'durusma' && yerelGun(o.baslangic) >= bugunStr)
    .sort((a, b) => a.baslangic.localeCompare(b.baslangic))[0]
  if (sonrakiDurusma) {
    parcalar.push(
      `Sonraki duruşma ${kisaTarih(yerelGun(sonrakiDurusma.baslangic))}.`,
    )
  }

  const bekleyen = finans
    .filter((f) => f.yon === 'gider' && f.odemeDurumu !== 'odendi')
    .reduce((t, f) => t + (f.tutar - f.odenenTutar), 0)
  if (bekleyen > 0) {
    parcalar.push(
      `Bekleyen ödeme: ${(bekleyen / 100).toLocaleString('tr-TR')} ₺.`,
    )
  }

  parcalar.push(`${belgeler.length} belge dosyada.`)

  return parcalar.join(' ')
}

/* ------------------------------------------------------------------ *
 * Basit soru–cevap: niyet eşleştirme
 * ------------------------------------------------------------------ */

export type Niyet = 'eksik' | 'sure' | 'odeme' | 'ozet' | 'durusma' | 'genel'

/** Kullanıcı sorusundan niyeti çıkarır (anahtar kelimeyle). */
export function niyetCikar(soru: string): Niyet {
  const s = soru.toLocaleLowerCase('tr')
  if (/eksik|yapılmam|unut|kalan iş|ne yapmam/.test(s)) return 'eksik'
  if (/süre|kaç gün|istinaf|temyiz|itiraz|cevap|dol/.test(s)) return 'sure'
  if (/ödeme|öde|borç|bekleyen|harç|bilirkişi|ücret|tahsil/.test(s))
    return 'odeme'
  if (/özet|durum|nerede|ne aşama/.test(s)) return 'ozet'
  if (/duruşma|celse|mahkeme|ne zaman/.test(s)) return 'durusma'
  return 'genel'
}

/**
 * Bir dosya bağlamı ve soru alıp deterministik cevap üretir.
 * Cevap her zaman veriden gelir; motor bilmediğini uydurmaz.
 */
export function soruyuCevapla(baglam: DosyaBaglami, soru: string): string {
  const niyet = niyetCikar(soru)
  const bulgular = dosyaBulgulari(baglam)

  if (niyet === 'ozet') return dosyaOzeti(baglam)

  const filtre: Record<Exclude<Niyet, 'ozet' | 'genel'>, BulguTuru[]> = {
    eksik: ['eksik', 'hazirlik', 'odeme'],
    sure: ['sure'],
    odeme: ['odeme'],
    durusma: ['durusma'],
  }

  if (niyet !== 'genel') {
    const ilgili = bulgular.filter((b) => filtre[niyet].includes(b.tur))
    if (ilgili.length === 0) {
      const olumsuz: Record<Exclude<Niyet, 'ozet' | 'genel'>, string> = {
        eksik: 'Bu dosyada öne çıkan bir eksik işlem görünmüyor.',
        sure: 'Bu dosyada yaklaşan açık bir süre yok.',
        odeme: 'Bu dosyada bekleyen bir ödeme yok.',
        durusma: 'Önümüzdeki hafta için planlanmış duruşma yok.',
      }
      return olumsuz[niyet]
    }
    return ilgili.map((b) => `• ${b.mesaj}`).join('\n')
  }

  // Genel: en öncelikli birkaç bulgu ya da her şey yolunda.
  if (bulgular.length === 0) {
    return 'Bu dosyada dikkat gerektiren bir şey görünmüyor.'
  }
  return bulgular
    .slice(0, 4)
    .map((b) => `• ${b.mesaj}`)
    .join('\n')
}

export const onerilenSorular: readonly string[] = [
  'Bu dosyada eksik bir işlem var mı?',
  'Yaklaşan süre var mı?',
  'Bekleyen ödeme var mı?',
  'Dosyanın durumunu özetle.',
]
