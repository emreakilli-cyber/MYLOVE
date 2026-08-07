import { describe, expect, it } from 'vitest'
import { bagliDegilHukukAi, type HukukAi, type MaskeSonucu } from './hukukAi'

/*
 * Arayüz sözleşmesi testi. Sahte bir uygulama sözleşmeye uyuyor mu (derleme +
 * çalışma zamanı) ve "bağlı değil" varsayılanı doğru davranıyor mu?
 */

describe('HukukAi sözleşmesi', () => {
  it('sahte uygulama sözleşmeye uyar ve maskele/demaskele tutarlı', async () => {
    const sahte: HukukAi = {
      async maskele(metin): Promise<MaskeSonucu> {
        const maskeliMetin = metin.replace('Kemal Arslan', '⟦AD1⟧')
        return { maskeliMetin, eslesme: { '⟦AD1⟧': 'Kemal Arslan' } }
      },
      demaskele(maskeliMetin, eslesme) {
        let sonuc = maskeliMetin
        for (const [maske, ham] of Object.entries(eslesme)) {
          sonuc = sonuc.split(maske).join(ham)
        }
        return sonuc
      },
      async sor(maskeliSoru) {
        return `yanıt: ${maskeliSoru}`
      },
      async hazirMi() {
        return true
      },
    }

    const { maskeliMetin, eslesme } = await sahte.maskele('Müvekkil Kemal Arslan')
    expect(maskeliMetin).not.toContain('Kemal Arslan')
    expect(sahte.demaskele(maskeliMetin, eslesme)).toBe('Müvekkil Kemal Arslan')
    expect(await sahte.hazirMi()).toBe(true)
  })
})

describe('bağlı değil varsayılanı', () => {
  it('hazır değildir ve maskeleme metni değiştirmez', async () => {
    expect(await bagliDegilHukukAi.hazirMi()).toBe(false)
    const s = await bagliDegilHukukAi.maskele('Kemal Arslan')
    expect(s.maskeliMetin).toBe('Kemal Arslan')
    expect(s.eslesme).toEqual({})
  })

  it('sor çağrısı açık bir hata verir', async () => {
    await expect(bagliDegilHukukAi.sor('x')).rejects.toThrow('bağlı değil')
  })
})
