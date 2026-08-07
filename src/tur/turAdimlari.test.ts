import { describe, expect, it } from 'vitest'
import { turAdimlari } from './turAdimlari'

describe('turAdimlari', () => {
  it('en az bir adım içerir', () => {
    expect(turAdimlari.length).toBeGreaterThan(0)
  })

  it('adım kimlikleri benzersizdir', () => {
    const idler = turAdimlari.map((a) => a.id)
    expect(new Set(idler).size).toBe(idler.length)
  })

  it('her adımın rotası kök işaretiyle başlar', () => {
    for (const adim of turAdimlari) {
      expect(adim.rota.startsWith('/')).toBe(true)
    }
  })

  it('her adımın başlık ve metni doludur', () => {
    for (const adim of turAdimlari) {
      expect(adim.baslik.trim().length).toBeGreaterThan(0)
      expect(adim.metin.trim().length).toBeGreaterThan(0)
    }
  })

  it('AI Asistan adımı gerçek /asistan panelini işaret eder', () => {
    const asistan = turAdimlari.find((a) => a.id === 'asistan')
    expect(asistan?.rota).toBe('/asistan')
    expect(asistan?.hedef).toBe('[data-tur="asistan"]')
  })

  it('AI Asistan adımı maskelemeyi açıklar', () => {
    const asistan = turAdimlari.find((a) => a.id === 'asistan')
    expect(asistan?.metin.toLowerCase()).toContain('maske')
  })

  it('menüden Asistan’a geçiş adımı yan menüyü açar', () => {
    const gecis = turAdimlari.find((a) => a.id === 'menu-asistan')
    expect(gecis?.drawer).toBe(true)
    expect(gecis?.hedef).toContain('/asistan')
  })

  it('son adım hedefsizdir (ortada kapanış balonu)', () => {
    const son = turAdimlari[turAdimlari.length - 1]
    expect(son?.hedef).toBeNull()
  })
})
