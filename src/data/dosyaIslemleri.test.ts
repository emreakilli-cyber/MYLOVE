import { describe, expect, it } from 'vitest'
import { muvekkilTuruTahmin } from './dosyaIslemleri'

/*
 * Satır içi müvekkil eklerken ad'dan tüzel/gerçek tahmini. Regresyon: eski
 * `\b(a\.?ş\.?|…)\b/i` kalıbı, JS'te `\b` yalnızca ASCII `\w` üzerinde
 * çalıştığından (Türkçe "ş" sözcük karakteri değil) "A.Ş." / "Şti." / "İnşaat"
 * için HİÇ eşleşmiyordu — en yaygın tüzel ekler kaçıyor, şirketler yanlışlıkla
 * "gerçek kişi" işaretleniyordu.
 */

describe('muvekkilTuruTahmin — ad’dan tüzel/gerçek tahmini', () => {
  it('şirket eklerini tüzel sayar (A.Ş., Ltd. Şti., Holding, İnşaat)', () => {
    for (const ad of [
      'Demir İnşaat A.Ş.',
      'Kaya A.Ş.',
      'Yılmaz Ltd. Şti.',
      'ACME Holding',
      'Nova İnşaat',
      'Demir AŞ',
    ]) {
      expect(muvekkilTuruTahmin(ad)).toBe('tuzel')
    }
  })

  it('gerçek kişi adlarını gerçek sayar — "Aş" ile başlayan adlarda yanlış pozitif yok', () => {
    for (const ad of [
      'Ahmet Yılmaz',
      'Aşkın Yıldız', // "Aş" ile başlar ama şirket değil
      'Aşır Demir',
      'Holdingci Mehmet', // "holding" tam sözcük değil
      'Mehmet İnşaatçı', // "inşaat" tam sözcük değil
    ]) {
      expect(muvekkilTuruTahmin(ad)).toBe('gercek')
    }
  })

  it('İ büyük harfini tr yereliyle katlar (İnşaat → inşaat)', () => {
    // Düz `toLowerCase()` "İ"yi birleşik-noktalı "i̇"ye çevirip eşleşmeyi bozardı.
    expect(muvekkilTuruTahmin('İNŞAAT LTD')).toBe('tuzel')
  })
})
