import { describe, expect, it } from 'vitest'
import { boyutMetni } from './belgeIslemleri'

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
