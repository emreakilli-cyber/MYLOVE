import { describe, expect, it } from 'vitest'
import {
  aktifMi,
  ertelemeAktif,
  etkinTetik,
  gectiMi,
  GUN_MS,
  ofsetMetni,
  pencere,
  pencereDe,
  tetikAni,
} from './hatirlatma'

const DK_MS = 60_000

describe('ofsetMetni', () => {
  it('sıfır ofset "aynı gün"dür', () => {
    expect(ofsetMetni(0)).toBe('aynı gün')
  })
  it('bir saatten az dakika olarak yazılır', () => {
    expect(ofsetMetni(30)).toBe('30 dk önce')
  })
  it('saat aralığı saate yuvarlanır', () => {
    expect(ofsetMetni(60)).toBe('1 saat önce')
    expect(ofsetMetni(90)).toBe('2 saat önce') // 1.5 → 2
  })
  it('gün aralığı güne yuvarlanır', () => {
    expect(ofsetMetni(24 * 60)).toBe('1 gün önce')
    expect(ofsetMetni(7 * 24 * 60)).toBe('7 gün önce')
    expect(ofsetMetni(30 * 24 * 60)).toBe('30 gün önce')
  })
})

describe('tetikAni', () => {
  it('hedeften ofset dakika öncedir', () => {
    const hedef = 1_000_000_000
    expect(tetikAni(hedef, 0)).toBe(hedef)
    expect(tetikAni(hedef, 60)).toBe(hedef - 60 * DK_MS)
    expect(tetikAni(hedef, 24 * 60)).toBe(hedef - GUN_MS)
  })
})

describe('pencere', () => {
  it('geçmiş 3 gün ile ufukGun gün ileriyi kapsar', () => {
    const simdi = 10 * GUN_MS
    const { alt, ufuk } = pencere(simdi, 30)
    expect(alt).toBe(simdi - 3 * GUN_MS)
    expect(ufuk).toBe(simdi + 30 * GUN_MS)
  })
})

describe('pencereDe (yaklaşan liste — alt sınır DÂHİL)', () => {
  const alt = 100
  const ufuk = 200
  it('sınırlar dâhil edilir', () => {
    expect(pencereDe(100, alt, ufuk)).toBe(true)
    expect(pencereDe(200, alt, ufuk)).toBe(true)
    expect(pencereDe(150, alt, ufuk)).toBe(true)
  })
  it('sınır dışı elenir', () => {
    expect(pencereDe(99, alt, ufuk)).toBe(false)
    expect(pencereDe(201, alt, ufuk)).toBe(false)
  })
})

describe('gectiMi', () => {
  it('tetik şimdiye eşit ya da öncesiyse geçmiştir', () => {
    expect(gectiMi(100, 100)).toBe(true)
    expect(gectiMi(90, 100)).toBe(true)
    expect(gectiMi(110, 100)).toBe(false)
  })
})

describe('aktifMi (aktif sayaç — alt sınır HARİÇ)', () => {
  const simdi = 1000
  const { alt } = pencere(simdi, 0)
  it('alt ile şimdi arasındaki tetik aktiftir', () => {
    expect(aktifMi(simdi, alt, simdi)).toBe(true) // tam şimdi
    expect(aktifMi(simdi - GUN_MS, alt, simdi)).toBe(true)
  })
  it('alt sınırın kendisi HARİÇtir (yaklaşan listeden farkı)', () => {
    expect(aktifMi(alt, alt, simdi)).toBe(false)
    // Aynı tetik yaklaşan listede DÂHİL olurdu:
    expect(pencereDe(alt, alt, simdi + GUN_MS)).toBe(true)
  })
  it('gelecekteki tetik aktif değildir', () => {
    expect(aktifMi(simdi + 1, alt, simdi)).toBe(false)
  })
})

describe('etkinTetik (erteleme çözümü)', () => {
  const simdi = 1_000_000
  const tetik = 500_000

  it('erteleme yoksa özgün tetik döner', () => {
    expect(etkinTetik({}, 'x-0', tetik, simdi)).toEqual({
      tetik,
      ertelendi: false,
    })
    expect(etkinTetik(undefined, 'x-0', tetik, simdi)).toEqual({
      tetik,
      ertelendi: false,
    })
  })

  it('ileri erteleme tetiklemeyi o ana taşır', () => {
    const ileri = new Date(simdi + GUN_MS).toISOString()
    const sonuc = etkinTetik({ 'x-0': ileri }, 'x-0', tetik, simdi)
    expect(sonuc.ertelendi).toBe(true)
    expect(sonuc.tetik).toBe(simdi + GUN_MS)
  })

  it('süresi geçmiş erteleme yok sayılır (özgün zamanına döner)', () => {
    const gecmis = new Date(simdi - GUN_MS).toISOString()
    expect(etkinTetik({ 'x-0': gecmis }, 'x-0', tetik, simdi)).toEqual({
      tetik,
      ertelendi: false,
    })
  })
})

describe('ertelemeAktif', () => {
  const simdi = 1_000_000
  it('ileri erteleme aktiftir (şu an gizli)', () => {
    const ileri = new Date(simdi + GUN_MS).toISOString()
    expect(ertelemeAktif({ 'x-0': ileri }, 'x-0', simdi)).toBe(true)
  })
  it('geçmiş ya da yok erteleme aktif değildir', () => {
    const gecmis = new Date(simdi - GUN_MS).toISOString()
    expect(ertelemeAktif({ 'x-0': gecmis }, 'x-0', simdi)).toBe(false)
    expect(ertelemeAktif({}, 'x-0', simdi)).toBe(false)
    expect(ertelemeAktif(undefined, 'x-0', simdi)).toBe(false)
  })
})
