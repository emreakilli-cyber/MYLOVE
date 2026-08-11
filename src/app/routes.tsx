import { Icon } from '../components/Icon'
import { Link, type RouteDefinition } from '../router'
import { GenelBakis } from '../pages/GenelBakis'
import { Takvim } from '../pages/Takvim'
import { OlayForm } from '../pages/OlayForm'
import { Dosyalar } from '../pages/Dosyalar'
import { DosyaDetay } from '../pages/DosyaDetay'
import { DosyaForm } from '../pages/DosyaForm'
import { SureHesapla } from '../pages/SureHesapla'
import { Muvekkiller } from '../pages/Muvekkiller'
import { MuvekkilDetay } from '../pages/MuvekkilDetay'
import { MuvekkilForm } from '../pages/MuvekkilForm'
import { Gorevler } from '../pages/Gorevler'
import { GorevForm } from '../pages/GorevForm'
import { Finans } from '../pages/Finans'
import { FinansForm } from '../pages/FinansForm'
import { Raporlar } from '../pages/Raporlar'
import { Asistan } from '../pages/Asistan'
import { Ayarlar } from '../pages/Ayarlar'
import { Arama } from '../pages/Arama'
import { Bildirimler } from '../pages/Bildirimler'
import { TakvimSenkron } from '../pages/TakvimSenkron'

/*
 * Bölümler sırayla gerçek ekranlara dönüşecek (bkz. docs/PLAN.md).
 * Dönüşene kadar hepsi aynı tanıtım düzenini paylaşır; metinler referans
 * videodaki metinlerin aynısıdır.
 */

export const routes: readonly RouteDefinition[] = [
  {
    path: '/',
    baslik: 'Genel Bakış',
    render: () => <GenelBakis />,
  },
  {
    path: '/takvim',
    baslik: 'Takvim',
    render: () => <Takvim />,
  },
  {
    path: '/takvim/yeni',
    baslik: 'Yeni Olay',
    render: () => <OlayForm />,
  },
  {
    path: '/takvim/disa-aktar',
    baslik: 'Takvimi Dışa Aktar',
    render: () => <TakvimSenkron />,
  },
  {
    path: '/sure',
    baslik: 'Süre Hesapla',
    render: () => <SureHesapla />,
  },
  {
    path: '/takvim/olay/:id',
    baslik: 'Olay Düzenle',
    render: (params) => <OlayForm id={params['id']} />,
  },
  {
    path: '/dosyalar',
    baslik: 'Dosyalar',
    render: () => <Dosyalar />,
  },
  // "yeni" ve ":id/duzenle" literal segmentleri, ":id" kalıbından önce
  // eşlenmeli; matchPath sıralı denediği için sıralama önemli.
  {
    path: '/dosyalar/yeni',
    baslik: 'Yeni Dosya',
    render: () => <DosyaForm />,
  },
  {
    path: '/dosyalar/:id/duzenle',
    baslik: 'Dosya Düzenle',
    render: (params) => <DosyaForm id={params['id']} />,
  },
  {
    path: '/dosyalar/:id',
    baslik: 'Dosya Detayı',
    render: (params) => <DosyaDetay id={params['id']} />,
  },
  {
    path: '/muvekkiller',
    baslik: 'Müvekkiller',
    render: () => <Muvekkiller />,
  },
  {
    path: '/muvekkiller/yeni',
    baslik: 'Yeni Müvekkil',
    render: () => <MuvekkilForm />,
  },
  {
    path: '/muvekkiller/:id/duzenle',
    baslik: 'Müvekkil Düzenle',
    render: (params) => <MuvekkilForm id={params['id']} />,
  },
  {
    path: '/muvekkiller/:id',
    baslik: 'Müvekkil Detayı',
    render: (params) => <MuvekkilDetay id={params['id']} />,
  },
  {
    path: '/gorevler',
    baslik: 'Görevler',
    render: () => <Gorevler />,
  },
  {
    path: '/gorevler/yeni',
    baslik: 'Yeni Görev',
    render: () => <GorevForm />,
  },
  {
    path: '/gorevler/:id',
    baslik: 'Görev Düzenle',
    render: (params) => <GorevForm id={params['id']} />,
  },
  {
    path: '/finans',
    baslik: 'Finans',
    render: () => <Finans />,
  },
  {
    path: '/finans/yeni',
    baslik: 'Yeni Finans Kaydı',
    render: () => <FinansForm />,
  },
  {
    path: '/finans/:id',
    baslik: 'Finans Kaydı Düzenle',
    render: (params) => <FinansForm id={params['id']} />,
  },
  {
    path: '/asistan',
    baslik: 'Asistan',
    render: () => <Asistan />,
  },
  {
    path: '/raporlar',
    baslik: 'Raporlar',
    render: () => <Raporlar />,
  },
  {
    path: '/ayarlar',
    baslik: 'Ayarlar',
    render: () => <Ayarlar />,
  },
  {
    path: '/ara',
    baslik: 'Ara',
    render: () => <Arama />,
  },
  {
    path: '/bildirimler',
    baslik: 'Bildirimler',
    render: () => <Bildirimler />,
  },
]

export function NotFound() {
  return (
    <section className="card placeholder">
      <div className="placeholder-body">
        <p className="t-label placeholder-crumb">Hata 404</p>
        <h1 className="t-display placeholder-title">Böyle bir sayfa yok.</h1>
        <p className="t-body placeholder-text">
          Bağlantı eskimiş olabilir. Genel bakışa dönüp devam edebilirsiniz.
        </p>
        <Link to="/" className="placeholder-link">
          Genel bakışa git
          <Icon name="arrow-up-right" size={15} />
        </Link>
      </div>
    </section>
  )
}
