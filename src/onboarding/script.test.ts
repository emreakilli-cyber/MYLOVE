import { describe, expect, it } from 'vitest'
import {
  isBolumu,
  korunanParcalar,
  maskeParcalari,
  ozetMaddeleri,
  sahneler,
} from './script'

/*
 * Öğretici mod metin kuralları. Yanıltıcı güvenlik iddiaları YASAK:
 * "hiçbir veri paylaşılmıyor", "hacklenemez", "%100 güvenli". Doğru dil:
 * "kimlik bilgileri gitmiyor" / "maskelenmiş metin gidiyor".
 */

const tumMetinler: string[] = [
  ...sahneler.flatMap((s) => [s.etiket, s.baslik, s.metin ?? '']),
  ...ozetMaddeleri.map((m) => m.metin),
  ...isBolumu.map((k) => k.is),
  ...korunanParcalar.map((k) => k.neden),
].map((t) => t.toLocaleLowerCase('tr'))

const YASAK = [
  'hiçbir veri paylaş',
  'hacklenemez',
  '%100 güvenli',
  '100% güvenli',
  'tamamen güvenli',
]

describe('onboarding metin kuralları', () => {
  it('yanıltıcı güvenlik iddiası içermez', () => {
    for (const metin of tumMetinler) {
      for (const yasak of YASAK) {
        expect(metin.includes(yasak), `"${yasak}" geçmemeli: ${metin}`).toBe(
          false,
        )
      }
    }
  })

  it('doğru gizlilik dilini kullanır (en az bir yerde)', () => {
    const hepsi = tumMetinler.join(' ')
    expect(
      hepsi.includes('kimlik') || hepsi.includes('maskele'),
    ).toBe(true)
  })
})

describe('maskeleme verisi', () => {
  it('7 maskeli bilgi vardır', () => {
    expect(maskeParcalari).toHaveLength(7)
  })

  it('yetkili mahkeme ve süre korunur (maskelenmez)', () => {
    const korunan = korunanParcalar.map((k) => k.metin)
    expect(korunan).toContain('İzmir')
    expect(korunan).toContain('14 Eylül 2026')
  })

  it('her maskeli parçanın ham metni ve etiketi vardır', () => {
    for (const p of maskeParcalari) {
      expect(p.ham.length).toBeGreaterThan(0)
      expect(p.etiket.length).toBeGreaterThan(0)
    }
  })
})
