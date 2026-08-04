import { describe, expect, it } from 'vitest'
import {
  dosyaBulgulari,
  niyetCikar,
  soruyuCevapla,
  type DosyaBaglami,
} from './asistan'
import { dateToIsoDate } from './tarih'
import type { Dosya, FinansKaydi, Sure } from './types'

/*
 * Asistan veriden deterministik cevap verir; şartnamedeki iki örnek
 * ("Bilirkişi ücreti henüz yatırılmadı", "İstinaf süresinin dolmasına iki gün
 * kaldı") bu testlerle sabitlenir.
 */

const artiGun = (n: number) => dateToIsoDate(new Date(Date.now() + n * 86_400_000))

function damga() {
  const t = new Date().toISOString()
  return { olusturmaTarihi: t, guncellemeTarihi: t }
}

const temelDosya: Dosya = {
  id: 'd1',
  baslik: 'Demir İnşaat',
  muvekkilId: 'm1',
  tur: 'ticaret',
  durum: 'derdest',
  mahkeme: 'İstanbul 5. Asliye Ticaret',
  esasNo: '2025/1 E.',
  acilisTarihi: '2025-01-01',
  arsivlendi: false,
  ...damga(),
}

function baglam(kismi: Partial<DosyaBaglami>): DosyaBaglami {
  return {
    dosya: temelDosya,
    olaylar: [],
    sureler: [],
    gorevler: [],
    finans: [],
    // Vekâletname var say ki "eksik vekâlet" bulgusu testi kirletmesin.
    belgeler: [
      {
        id: 'b1',
        ad: 'Vekâletname.pdf',
        tur: 'vekaletname',
        mimeTur: 'application/pdf',
        boyut: 100,
        icerik: new Blob(['x']),
        etiketler: [],
        ...damga(),
      },
    ],
    ...kismi,
  }
}

const bilirkisiKaydi: FinansKaydi = {
  id: 'f1',
  dosyaId: 'd1',
  yon: 'gider',
  kategori: 'bilirkisi',
  baslik: 'Bilirkişi ücreti',
  tutar: 1_250_000,
  odenenTutar: 0,
  tarih: artiGun(-2),
  odemeDurumu: 'bekliyor',
  ...damga(),
}

const istinafSuresi: Sure = {
  id: 's1',
  dosyaId: 'd1',
  kuralId: 'istinaf-hmk-345',
  kuralAdi: 'İstinaf başvuru süresi',
  kanunReferansi: 'HMK m. 345',
  baslangicTarihi: artiGun(-12),
  hamSonTarih: artiGun(2),
  sonTarih: artiGun(2),
  durum: 'acik',
  ...damga(),
}

describe('asistan kural motoru', () => {
  it('ödenmemiş bilirkişi ücretini tespit eder', () => {
    const bulgular = dosyaBulgulari(baglam({ finans: [bilirkisiKaydi] }))
    const odeme = bulgular.find((b) => b.tur === 'odeme')
    expect(odeme).toBeDefined()
    expect(odeme!.mesaj).toContain('Bilirkişi ücreti')
  })

  it('iki gün kalan istinaf süresini kritik bulgu yapar', () => {
    const bulgular = dosyaBulgulari(baglam({ sureler: [istinafSuresi] }))
    const sure = bulgular.find((b) => b.tur === 'sure')
    expect(sure).toBeDefined()
    expect(sure!.oncelik).toBe('kritik')
    expect(sure!.mesaj).toContain('İstinaf başvuru süresi')
    expect(sure!.mesaj).toContain('2 gün kaldı')
  })

  it('kritik bulguları uyarılardan önce sıralar', () => {
    const bulgular = dosyaBulgulari(
      baglam({ sureler: [istinafSuresi], finans: [bilirkisiKaydi] }),
    )
    // İlk bulgu kritik olmalı (istinaf 2 gün ya da vadesi geçmiş ödeme).
    expect(bulgular[0]?.oncelik).toBe('kritik')
  })

  it('eksik vekâletnameyi işaretler', () => {
    const bulgular = dosyaBulgulari(
      baglam({ belgeler: [] }), // vekâletname yok
    )
    expect(bulgular.some((b) => b.mesaj.includes('Vekâletname'))).toBe(true)
  })

  it('sorunsuz dosyada olumlu cevap verir', () => {
    const cevap = soruyuCevapla(baglam({}), 'Bu dosyada eksik bir işlem var mı?')
    expect(cevap).toContain('eksik işlem görünmüyor')
  })
})

describe('niyet çıkarımı', () => {
  it('anahtar kelimeden niyeti bulur', () => {
    expect(niyetCikar('Bu dosyada eksik bir işlem var mı?')).toBe('eksik')
    expect(niyetCikar('İstinaf süresi ne zaman doluyor?')).toBe('sure')
    expect(niyetCikar('Bekleyen ödeme var mı?')).toBe('odeme')
    expect(niyetCikar('Dosyanın durumunu özetle')).toBe('ozet')
    expect(niyetCikar('Duruşma ne zaman?')).toBe('durusma')
  })

  it('"bu dosyada eksik işlem var mı" sorusuna ödeme eksiğini verir', () => {
    const cevap = soruyuCevapla(
      baglam({ finans: [bilirkisiKaydi] }),
      'Bu dosyada eksik bir işlem var mı?',
    )
    expect(cevap).toContain('Bilirkişi ücreti')
  })

  it('"yaklaşan süre var mı" sorusuna istinaf süresini verir', () => {
    const cevap = soruyuCevapla(
      baglam({ sureler: [istinafSuresi] }),
      'Yaklaşan süre var mı?',
    )
    expect(cevap).toContain('İstinaf başvuru süresi')
  })
})
