import { describe, expect, it } from 'vitest'
import { eslesir, nrm } from './aramaSorgulari'

/*
 * Genel arama Türkçe küçük/büyük harf kurallarıyla katlanmalı. Klasik hata:
 * düz `toLowerCase()` "İ"yi birleşik noktalı "i̇"ye, "I"yı "i"ye çevirir; o
 * zaman "İstanbul" araması "istanbul"u, "IŞIK" araması "ışık"ı bulamaz. Bu
 * testler Türkçe katlamanın (`toLocaleLowerCase('tr')`) korunduğunu güvenceler.
 */

describe('nrm — Türkçe küçük harf katlama', () => {
  it('İ büyük → i (noktasız birleşik değil)', () => {
    expect(nrm('İSTANBUL')).toBe('istanbul')
    // Düz toLowerCase() burada 'i̇stanbul' (birleşik nokta) verirdi.
    expect(nrm('İSTANBUL')).not.toBe('İSTANBUL'.toLowerCase())
  })

  it('I büyük → ı (noktasız)', () => {
    expect(nrm('IŞIK')).toBe('ışık')
    expect(nrm('IŞIK')).not.toBe('IŞIK'.toLowerCase())
  })

  it('diğer Türkçe harfler korunur', () => {
    expect(nrm('ÇĞÖŞÜ')).toBe('çğöşü')
    expect(nrm('Vekâlet Ücreti')).toBe('vekâlet ücreti')
  })

  it('undefined/boş güvenli', () => {
    expect(nrm(undefined)).toBe('')
    expect(nrm('')).toBe('')
  })
})

describe('eslesir — Türkçe duyarlı alan eşleşmesi', () => {
  it('İ içeren sorgu, İ içeren alanı bulur', () => {
    // Kullanıcı "istanbul" (ya da "İSTANBUL") arar; alan "İstanbul 14. İş
    // Mahkemesi". Sorgu çağrı yerinde nrm'lenir; burada nrm sonucunu veriyoruz.
    expect(eslesir(nrm('İSTANBUL'), 'İstanbul 14. İş Mahkemesi')).toBe(true)
    expect(eslesir(nrm('istanbul'), 'İstanbul 14. İş Mahkemesi')).toBe(true)
  })

  it('ı içeren sorgu, I ile yazılmış alanı bulur', () => {
    expect(eslesir(nrm('ışık'), 'IŞIK Hukuk Bürosu')).toBe(true)
    expect(eslesir(nrm('IŞIK'), 'ışık hukuk')).toBe(true)
  })

  it('birden çok alandan herhangi biri eşleşince true', () => {
    expect(eslesir(nrm('2025/298'), undefined, 'Tazminat', '2025/298 E.')).toBe(true)
  })

  it('hiçbir alan eşleşmezse false', () => {
    expect(eslesir(nrm('bulunmaz'), 'Tazminat davası', 'İstanbul')).toBe(false)
  })
})
