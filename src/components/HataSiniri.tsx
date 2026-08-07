import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'
import { gunlukHata } from '../services/gunluk'

/*
 * React hata sınırı. Bir bileşen render sırasında çökerse tüm uygulamanın beyaz
 * ekrana düşmesini engeller; nazik bir kurtarma ekranı gösterir. Hata, kimlik
 * desenleri maskelenerek günlüğe yazılır (bkz. services/gunluk).
 *
 * "Ana sayfaya dön" hash'i köke alıp sınırı sıfırlar: bozuk bir sayfadan çıkış
 * yolu. "Yeniden dene" aynı yerde yeniden render dener. Sınıf bileşeni olduğu
 * için router kancaları yerine doğrudan `location.hash` kullanılır.
 */

interface HataSiniriProps {
  readonly children: ReactNode
}

interface HataSiniriState {
  readonly hata: Error | null
}

export class HataSiniri extends Component<HataSiniriProps, HataSiniriState> {
  state: HataSiniriState = { hata: null }

  static getDerivedStateFromError(hata: Error): HataSiniriState {
    return { hata }
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo): void {
    gunlukHata(hata, `Arayüz çöktü${bilgi.componentStack ? ' (bileşen ağacı)' : ''}`)
  }

  private readonly yenidenDene = () => {
    this.setState({ hata: null })
  }

  private readonly anaSayfayaDon = () => {
    window.location.hash = '#/'
    this.setState({ hata: null })
  }

  render(): ReactNode {
    if (!this.state.hata) return this.props.children

    return (
      <div className="hata-ekran" role="alert">
        <div className="hata-kart">
          <span className="hata-ikon" aria-hidden="true">
            <Icon name="shield" size={26} />
          </span>
          <h1 className="hata-baslik">Bir şeyler ters gitti</h1>
          <p className="hata-metin">
            Bu ekran beklenmedik bir hatayla karşılaştı. Verileriniz cihazınızda
            olduğu gibi duruyor. Yeniden deneyebilir ya da ana sayfaya
            dönebilirsiniz.
          </p>
          <div className="hata-eylemler">
            <button
              type="button"
              className="hata-birincil"
              onClick={this.anaSayfayaDon}
            >
              Ana sayfaya dön
            </button>
            <button
              type="button"
              className="hata-ikincil"
              onClick={this.yenidenDene}
            >
              Yeniden dene
            </button>
          </div>
        </div>
      </div>
    )
  }
}
