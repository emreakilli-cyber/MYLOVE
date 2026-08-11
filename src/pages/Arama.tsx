import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { BelgeOnizleme } from '../components/BelgeOnizleme'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import { useGlobalArama } from '../data/aramaSorgulari'
import {
  belgeTuruEtiketleri,
  boyutMetni,
  useBelgelerToplamBoyut,
  useDepolamaDurumu,
} from '../data/belgeIslemleri'
import { goreliZaman, kisaTarih } from '../domain/tarih'
import type { Belge, GorevDurumu } from '../domain/types'

const gorevDurumEtiketleri: Record<GorevDurumu, string> = {
  bekliyor: 'Bekliyor',
  tamamlandi: 'Tamamlandı',
}

/*
 * Genel arama: dosya, müvekkil, görev ve belgelerde tek kutudan (şartname
 * md. 12'nin "global belge arama" maddesi de burada). Belgeler önizlenebilir;
 * üstte cihaz depolama göstergesi var.
 */

function DepolamaGostergesi() {
  const toplam = useBelgelerToplamBoyut()
  const durum = useDepolamaDurumu(toplam)
  if (!durum || !durum.destekleniyor) return null

  const yuzde = Math.round(durum.oran * 100)
  const dolu = durum.oran >= 0.85
  return (
    <section className="card depolama-kart">
      <div className="depolama-ust">
        <span className="depolama-etiket">
          <Icon name="folder" size={15} /> Cihaz depolaması
        </span>
        <span className="depolama-deger">
          {boyutMetni(durum.kullanilan)}
          {durum.kota > 0 ? ` / ${boyutMetni(durum.kota)}` : ''}
        </span>
      </div>
      {durum.kota > 0 ? (
        <div
          className="depolama-bar"
          role="progressbar"
          aria-valuenow={yuzde}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="depolama-dolu"
            data-dolu={dolu}
            style={{ width: `${Math.max(2, yuzde)}%` }}
          />
        </div>
      ) : null}
      <p className="depolama-not">
        {toplam !== undefined ? `Belgeler ${boyutMetni(toplam)} yer tutuyor. ` : ''}
        {dolu
          ? 'Alan azalıyor — eski belgeleri indirip silebilirsiniz.'
          : 'Belgeler cihazda saklanır; yedek almayı unutmayın.'}
      </p>
    </section>
  )
}

export function Arama() {
  const [sorgu, setSorgu] = useState('')
  const [onizlenen, setOnizlenen] = useState<Belge | null>(null)
  const girisRef = useRef<HTMLInputElement>(null)
  const sonuclar = useGlobalArama(sorgu)

  useEffect(() => {
    girisRef.current?.focus()
  }, [])

  const aramaYapildi = sorgu.trim().length >= 2

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Ara</h1>
      </div>

      <div className="search-wrap">
        <Icon name="search" size={18} className="search-icon" />
        <input
          ref={girisRef}
          className="search-input"
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          placeholder="Dosya, müvekkil, görev, belge…"
          aria-label="Her yerde ara"
          autoComplete="off"
        />
        {sorgu ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => setSorgu('')}
          >
            <Icon name="close" size={16} title="Aramayı temizle" />
          </button>
        ) : null}
      </div>

      {!aramaYapildi ? <DepolamaGostergesi /> : null}

      {!aramaYapildi ? (
        <section className="card section-card">
          <p className="section-empty">
            Aramak için en az iki harf yazın. Dosya adı ve esas no, müvekkil,
            görev ve belge adları/etiketleri taranır.
          </p>
        </section>
      ) : sonuclar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={4} />
        </section>
      ) : sonuclar.toplam === 0 ? (
        <section className="card section-card">
          <p className="section-empty" role="status">
            “{sorgu.trim()}” için sonuç yok.
          </p>
        </section>
      ) : (
        <>
          <p className="list-count" role="status">
            {sonuclar.toplam} sonuç
          </p>

          {sonuclar.dosyalar.length > 0 ? (
            <section className="arama-grup">
              <p className="arama-grup-baslik">
                Dosyalar · {sonuclar.dosyalar.length}
              </p>
              <div className="card divide-rows">
                {sonuclar.dosyalar.map((d) => (
                  <Link key={d.id} to={`/dosyalar/${d.id}`} className="row accent-blue">
                    <span className="row-tile">
                      <Icon name="folder" size={18} />
                    </span>
                    <span className="row-main">
                      <span className="row-title truncate">{d.baslik}</span>
                      <span className="row-sub truncate">
                        {[d.mahkeme, d.esasNo].filter(Boolean).join(' · ') ||
                          'Dosya'}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {sonuclar.muvekkiller.length > 0 ? (
            <section className="arama-grup">
              <p className="arama-grup-baslik">
                Müvekkiller · {sonuclar.muvekkiller.length}
              </p>
              <div className="card divide-rows">
                {sonuclar.muvekkiller.map((m) => (
                  <Link
                    key={m.id}
                    to={`/muvekkiller/${m.id}`}
                    className="row accent-purple"
                  >
                    <span className="row-tile">
                      <Icon name="users" size={18} />
                    </span>
                    <span className="row-main">
                      <span className="row-title truncate">{m.ad}</span>
                      <span className="row-sub truncate">
                        {[m.telefon, m.eposta].filter(Boolean).join(' · ') ||
                          (m.tur === 'tuzel' ? 'Tüzel kişi' : 'Gerçek kişi')}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {sonuclar.gorevler.length > 0 ? (
            <section className="arama-grup">
              <p className="arama-grup-baslik">
                Görevler · {sonuclar.gorevler.length}
              </p>
              <div className="card divide-rows">
                {sonuclar.gorevler.map((g) => (
                  <Link
                    key={g.id}
                    to={`/gorevler/${g.id}`}
                    className="row accent-amber"
                  >
                    <span className="row-tile">
                      <Icon name="checklist" size={18} />
                    </span>
                    <span className="row-main">
                      <span className="row-title truncate">{g.baslik}</span>
                      <span className="row-sub truncate">
                        {gorevDurumEtiketleri[g.durum]}
                        {g.vadeTarihi ? ` · ${kisaTarih(g.vadeTarihi)}` : ''}
                      </span>
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {sonuclar.belgeler.length > 0 ? (
            <section className="arama-grup">
              <p className="arama-grup-baslik">
                Belgeler · {sonuclar.belgeler.length}
              </p>
              <div className="card divide-rows">
                {sonuclar.belgeler.map(({ belge, dosyaBaslik }) => (
                  <button
                    key={belge.id}
                    type="button"
                    className="row accent-green"
                    onClick={() => setOnizlenen(belge)}
                  >
                    <span className="row-tile">
                      <Icon name="folder" size={18} />
                    </span>
                    <span className="row-main">
                      <span className="row-title truncate">{belge.ad}</span>
                      <span className="row-sub truncate">
                        {belgeTuruEtiketleri[belge.tur]} ·{' '}
                        {boyutMetni(belge.boyut)}
                        {dosyaBaslik ? ` · ${dosyaBaslik}` : ''} ·{' '}
                        {goreliZaman(belge.olusturmaTarihi)}
                      </span>
                      {belge.etiketler.length > 0 ? (
                        <span className="etiket-serit">
                          {belge.etiketler.map((e) => (
                            <span key={e} className="tag tag-quiet">
                              {e}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <Icon name="chevron-right" size={16} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {onizlenen ? (
        <BelgeOnizleme belge={onizlenen} onKapat={() => setOnizlenen(null)} />
      ) : null}
    </>
  )
}
