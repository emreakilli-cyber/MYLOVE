import { describe, expect, it } from 'vitest'
import { dakikaya, sessizSaatteMi } from './sessizSaat'

describe('dakikaya', () => {
  it('geçerli HH:MM değerini dakikaya çevirir', () => {
    expect(dakikaya('00:00')).toBe(0)
    expect(dakikaya('08:30')).toBe(510)
    expect(dakikaya('23:59')).toBe(1439)
  })

  it('boş/geçersiz girdide null döner', () => {
    expect(dakikaya(undefined)).toBeNull()
    expect(dakikaya('')).toBeNull()
    expect(dakikaya('7:00')).toBeNull() // tek haneli
    expect(dakikaya('24:00')).toBeNull() // saat aşımı
    expect(dakikaya('12:60')).toBeNull() // dakika aşımı
    expect(dakikaya('abc')).toBeNull()
  })
})

describe('sessizSaatteMi', () => {
  it('pencere yoksa (uç eksik/geçersiz) her zaman false', () => {
    expect(sessizSaatteMi(600, undefined, '08:00')).toBe(false)
    expect(sessizSaatteMi(600, '22:00', undefined)).toBe(false)
    expect(sessizSaatteMi(600, '22:00', 'xx')).toBe(false)
    expect(sessizSaatteMi(600, '09:00', '09:00')).toBe(false) // eşit uç
  })

  it('aynı gün penceresi [bas, bitis)', () => {
    // 13:00–14:00 sessiz
    expect(sessizSaatteMi(12 * 60, '13:00', '14:00')).toBe(false) // önce
    expect(sessizSaatteMi(13 * 60, '13:00', '14:00')).toBe(true) // başlangıç dâhil
    expect(sessizSaatteMi(13 * 60 + 30, '13:00', '14:00')).toBe(true) // içeride
    expect(sessizSaatteMi(14 * 60, '13:00', '14:00')).toBe(false) // bitiş hariç
  })

  it('gece yarısını aşan pencere 22:00–08:00', () => {
    expect(sessizSaatteMi(23 * 60, '22:00', '08:00')).toBe(true) // gece
    expect(sessizSaatteMi(2 * 60, '22:00', '08:00')).toBe(true) // gece yarısı sonrası
    expect(sessizSaatteMi(22 * 60, '22:00', '08:00')).toBe(true) // başlangıç dâhil
    expect(sessizSaatteMi(8 * 60, '22:00', '08:00')).toBe(false) // bitiş hariç
    expect(sessizSaatteMi(12 * 60, '22:00', '08:00')).toBe(false) // öğlen
    expect(sessizSaatteMi(21 * 60 + 59, '22:00', '08:00')).toBe(false) // hemen önce
  })
})
