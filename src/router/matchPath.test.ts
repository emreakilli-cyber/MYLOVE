import { describe, expect, it } from 'vitest'
import { matchPath } from './index'

describe('matchPath', () => {
  it('sabit yolları birebir eşler', () => {
    expect(matchPath('/takvim', '/takvim')).toEqual({})
    expect(matchPath('/takvim', '/dosyalar')).toBeNull()
  })

  it('kök yolu eşler', () => {
    expect(matchPath('/', '/')).toEqual({})
  })

  it('parametreyi yakalar', () => {
    expect(matchPath('/dosyalar/:id', '/dosyalar/42')).toEqual({ id: '42' })
    expect(matchPath('/muvekkiller/:id', '/muvekkiller/abc-1')).toEqual({
      id: 'abc-1',
    })
  })

  it('birden çok parametreyi yakalar', () => {
    expect(matchPath('/dosyalar/:id/gorev/:taskId', '/dosyalar/7/gorev/3')).toEqual(
      { id: '7', taskId: '3' },
    )
  })

  it('segment sayısı tutmuyorsa eşleşmez', () => {
    expect(matchPath('/dosyalar/:id', '/dosyalar')).toBeNull()
    expect(matchPath('/dosyalar/:id', '/dosyalar/7/notlar')).toBeNull()
  })

  it('yüzde kodlu Türkçe karakterleri çözer', () => {
    expect(matchPath('/muvekkiller/:ad', '/muvekkiller/Ay%C5%9Fe')).toEqual({
      ad: 'Ayşe',
    })
  })

  it('bozuk yüzde kodlamasında patlamaz, ham değeri döner', () => {
    // Elle yazılmış geçersiz `%` dizisi decodeURIComponent'i URIError'a sokar;
    // matchPath bunu yutup ham parametreyi döndürmeli (ekran çökmesin, gerçek
    // kayda eşleşmeyip "bulunamadı"ya düşsün).
    expect(() => matchPath('/dosyalar/:id', '/dosyalar/foo%')).not.toThrow()
    expect(matchPath('/dosyalar/:id', '/dosyalar/foo%')).toEqual({ id: 'foo%' })
    expect(matchPath('/dosyalar/:id', '/dosyalar/%ZZ')).toEqual({ id: '%ZZ' })
  })

  it('joker sondaki segmentleri yutar', () => {
    expect(matchPath('/belgeler/*', '/belgeler/2026/agustos/dosya')).toEqual({})
    expect(matchPath('/belgeler/*', '/belgeler')).toEqual({})
    expect(matchPath('/belgeler/*', '/dosyalar/1')).toBeNull()
  })

  it('sabit segment parametreden önce gelir', () => {
    expect(matchPath('/dosyalar/yeni', '/dosyalar/yeni')).toEqual({})
    expect(matchPath('/dosyalar/:id', '/dosyalar/yeni')).toEqual({ id: 'yeni' })
  })
})
