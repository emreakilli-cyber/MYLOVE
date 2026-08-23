import { describe, expect, it } from 'vitest'
import {
  grupAnahtari,
  karsilastirGorevSatiri,
  type GorevSatiri,
} from './gorevSorgulari'
import type { Gorev, GorevDurumu, GorevOnceligi, IsoDate } from '../domain/types'

/*
 * Görev listesi mantığı bir avukatın "neyi kaçırdım, bugün ne var" sorusuna
 * cevap verir; bu yüzden zaman-grubu sınıflandırması (özellikle GECİKMİŞ vs
 * BUGÜN sınırı) doğru olmalı. `grupAnahtari` artık enjekte edilebilir `bugun`
 * ile deterministik test edilebiliyor.
 */

const AN = '2026-01-01T00:00:00.000Z'
const BUGUN: IsoDate = '2026-08-23'

function gorev(
  over: Partial<Gorev> & { oncelik?: GorevOnceligi; durum?: GorevDurumu } = {},
): Gorev {
  return {
    id: over.id ?? 'g1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    baslik: over.baslik ?? 'Dilekçe hazırla',
    oncelik: over.oncelik ?? 'normal',
    durum: over.durum ?? 'bekliyor',
    ...over,
  }
}

function satir(over: Partial<Gorev> = {}): GorevSatiri {
  return { gorev: gorev(over) }
}

describe('grupAnahtari — görev zaman-grubu sınıflandırması', () => {
  it('tamamlanmış görev vadesi geçmiş olsa bile "tamamlanan" grubuna girer', () => {
    // Tamamlanma, gecikme durumunu geçersiz kılmalı (öncelik sırası).
    const g = gorev({ durum: 'tamamlandi', vadeTarihi: '2026-01-01' })
    expect(grupAnahtari(g, BUGUN)).toBe('tamamlanan')
  })

  it('vade tarihi olmayan bekleyen görev "vadesiz"dir', () => {
    expect(grupAnahtari(gorev({ vadeTarihi: undefined }), BUGUN)).toBe('vadesiz')
  })

  it('vadesi geçmiş görev "gecikmis"tir', () => {
    expect(grupAnahtari(gorev({ vadeTarihi: '2026-08-22' }), BUGUN)).toBe(
      'gecikmis',
    )
  })

  it('vadesi bugün olan görev "bugun"dur (henüz gecikmemiş)', () => {
    // Sınır: fark 0 hâlâ bugündür, "gecikmis" değil.
    expect(grupAnahtari(gorev({ vadeTarihi: '2026-08-23' }), BUGUN)).toBe(
      'bugun',
    )
  })

  it('vadesi yarın olan görev "yarin"dır', () => {
    expect(grupAnahtari(gorev({ vadeTarihi: '2026-08-24' }), BUGUN)).toBe(
      'yarin',
    )
  })

  it('vadesi 2+ gün sonra olan görev "yaklasan"dır', () => {
    expect(grupAnahtari(gorev({ vadeTarihi: '2026-08-30' }), BUGUN)).toBe(
      'yaklasan',
    )
  })
})

describe('karsilastirGorevSatiri — grup içi sıralama', () => {
  it('erken vade önce gelir', () => {
    const erken = satir({ id: 'a', vadeTarihi: '2026-08-24' })
    const gec = satir({ id: 'b', vadeTarihi: '2026-08-30' })
    expect(karsilastirGorevSatiri(erken, gec)).toBeLessThan(0)
    expect(karsilastirGorevSatiri(gec, erken)).toBeGreaterThan(0)
  })

  it('vadesiz görev, vadeli görevden sonra gelir', () => {
    const vadeli = satir({ id: 'a', vadeTarihi: '2026-12-31' })
    const vadesiz = satir({ id: 'b', vadeTarihi: undefined })
    expect(karsilastirGorevSatiri(vadeli, vadesiz)).toBeLessThan(0)
  })

  it('aynı vadede yüksek öncelik önce gelir', () => {
    const yuksek = satir({ id: 'a', vadeTarihi: '2026-08-24', oncelik: 'yuksek' })
    const dusuk = satir({ id: 'b', vadeTarihi: '2026-08-24', oncelik: 'dusuk' })
    expect(karsilastirGorevSatiri(yuksek, dusuk)).toBeLessThan(0)
  })

  it('bir listeyi vade sonra önceliğe göre kararlı biçimde sıralar', () => {
    const liste: GorevSatiri[] = [
      satir({ id: 'yaklasan', vadeTarihi: '2026-08-30', oncelik: 'yuksek' }),
      satir({ id: 'vadesiz', vadeTarihi: undefined, oncelik: 'yuksek' }),
      satir({ id: 'bugun-dusuk', vadeTarihi: '2026-08-24', oncelik: 'dusuk' }),
      satir({ id: 'bugun-yuksek', vadeTarihi: '2026-08-24', oncelik: 'yuksek' }),
    ]
    const sirali = [...liste].sort(karsilastirGorevSatiri).map((s) => s.gorev.id)
    expect(sirali).toEqual([
      'bugun-yuksek',
      'bugun-dusuk',
      'yaklasan',
      'vadesiz',
    ])
  })
})
