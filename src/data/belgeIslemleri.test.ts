import { describe, expect, it } from 'vitest'
import { belgeTuruTahmini, boyutMetni } from './belgeIslemleri'

/** belgeTuruTahmini yalnız `name` ve `type` okur; test için minimal sahte File. */
function sahteDosya(name: string, type = ''): File {
  return { name, type } as unknown as File
}

/*
 * Belge boyutu gösterimi. Byte → B / KB / MB. Eşik 1024 tabanlı; KB tam sayıya
 * yuvarlanır, MB tek ondalıkla gösterilir. Kullanıcı depolama kullanımını bu
 * metinden okur.
 */

describe('boyutMetni', () => {
  it('1 KB altını byte olarak yazar', () => {
    expect(boyutMetni(0)).toBe('0 B')
    expect(boyutMetni(512)).toBe('512 B')
    expect(boyutMetni(1023)).toBe('1023 B')
  })

  it('1 KB – 1 MB arasını KB olarak (yuvarlayarak) yazar', () => {
    expect(boyutMetni(1024)).toBe('1 KB')
    expect(boyutMetni(1536)).toBe('2 KB') // Math.round(1.5) = 2
    expect(boyutMetni(10 * 1024)).toBe('10 KB')
  })

  it('1 MB ve üzerini tek ondalıkla MB olarak yazar', () => {
    expect(boyutMetni(1024 * 1024)).toBe('1.0 MB')
    expect(boyutMetni(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(boyutMetni(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

/*
 * Belge türü tahmini. Önce MIME (görsel/ses), sonra dosya adı deseni. Ad Türkçe
 * küçük harfe (`toLocaleLowerCase('tr')`) indirgeniyor ki BÜYÜK Türkçe adlar da
 * ("BİLİRKİŞİ", "VEKÂLET") eşleşsin — düz toLowerCase() İ'yi birleşik noktalı
 * yapıp regex eşleşmesini bozardı.
 */
describe('belgeTuruTahmini', () => {
  it('MIME görsel/ses türünü ada bakmadan sınıflar', () => {
    expect(belgeTuruTahmini(sahteDosya('taranmis.jpg', 'image/jpeg'))).toBe('foto')
    expect(belgeTuruTahmini(sahteDosya('kayit.m4a', 'audio/mp4'))).toBe('ses')
    // MIME görsel ise ad "dilekçe" içerse bile foto kazanır (MIME önce).
    expect(belgeTuruTahmini(sahteDosya('dilekce.png', 'image/png'))).toBe('foto')
  })

  it('dosya adı deseninden türü çıkarır (Türkçe ve ASCII yazımlar)', () => {
    expect(belgeTuruTahmini(sahteDosya('vekâletname.pdf'))).toBe('vekaletname')
    expect(belgeTuruTahmini(sahteDosya('vekaletname.pdf'))).toBe('vekaletname')
    expect(belgeTuruTahmini(sahteDosya('cevap-dilekcesi.pdf'))).toBe('dilekce')
    expect(belgeTuruTahmini(sahteDosya('gerekçeli-karar.pdf'))).toBe('karar')
    expect(belgeTuruTahmini(sahteDosya('bilirkişi-raporu.pdf'))).toBe('bilirkisi-raporu')
    expect(belgeTuruTahmini(sahteDosya('dekont.pdf'))).toBe('dekont')
    expect(belgeTuruTahmini(sahteDosya('fatura-2026.pdf'))).toBe('makbuz')
    expect(belgeTuruTahmini(sahteDosya('kira-sözleşmesi.docx'))).toBe('sozlesme')
  })

  it('BÜYÜK harfli Türkçe adları da eşler (toLocaleLowerCase("tr"))', () => {
    // Kritik: "İ" düz toLowerCase() ile birleşik noktalı olup regex'i bozardı.
    expect(belgeTuruTahmini(sahteDosya('BİLİRKİŞİ RAPORU.PDF'))).toBe('bilirkisi-raporu')
    expect(belgeTuruTahmini(sahteDosya('VEKÂLETNAME.PDF'))).toBe('vekaletname')
  })

  it('eşleşme yoksa "diger"', () => {
    expect(belgeTuruTahmini(sahteDosya('rastgele-not.txt'))).toBe('diger')
    expect(belgeTuruTahmini(sahteDosya('', 'application/pdf'))).toBe('diger')
  })
})
