import { PlaceholderPage } from '../components/PlaceholderPage'
import { Icon } from '../components/Icon'
import { Link, type RouteDefinition } from '../router'
import { GenelBakis } from '../pages/GenelBakis'
import { Takvim } from '../pages/Takvim'
import { OlayForm } from '../pages/OlayForm'
import { Dosyalar } from '../pages/Dosyalar'
import { DosyaDetay } from '../pages/DosyaDetay'
import { DosyaForm } from '../pages/DosyaForm'
import { SureHesapla } from '../pages/SureHesapla'

/*
 * Bölümler sırayla gerçek ekranlara dönüşecek (bkz. docs/PLAN.md).
 * Dönüşene kadar hepsi aynı tanıtım düzenini paylaşır; metinler referans
 * videodaki metinlerin aynısıdır.
 */

export const routes: readonly RouteDefinition[] = [
  {
    path: '/',
    render: () => <GenelBakis />,
  },
  {
    path: '/takvim',
    render: () => <Takvim />,
  },
  {
    path: '/takvim/yeni',
    render: () => <OlayForm />,
  },
  {
    path: '/sure',
    render: () => <SureHesapla />,
  },
  {
    path: '/takvim/olay/:id',
    render: (params) => <OlayForm id={params['id']} />,
  },
  {
    path: '/dosyalar',
    render: () => <Dosyalar />,
  },
  // "yeni" ve ":id/duzenle" literal segmentleri, ":id" kalıbından önce
  // eşlenmeli; matchPath sıralı denediği için sıralama önemli.
  {
    path: '/dosyalar/yeni',
    render: () => <DosyaForm />,
  },
  {
    path: '/dosyalar/:id/duzenle',
    render: (params) => <DosyaForm id={params['id']} />,
  },
  {
    path: '/dosyalar/:id',
    render: (params) => <DosyaDetay id={params['id']} />,
  },
  {
    path: '/muvekkiller',
    render: () => (
      <PlaceholderPage
        crumb="Müvekkiller"
        title="İlişkiler, bağlamını korur."
        description="Müvekkil listenizi ve onlarla ilgili dosyaları tek bakışta yönetebileceğiniz alan çok yakında."
        icon="users"
        accent="green"
        phase="F6"
      />
    ),
  },
  {
    path: '/muvekkiller/:id',
    render: (params) => (
      <PlaceholderPage
        crumb={`Müvekkiller / ${params['id'] ?? ''}`}
        title="Müvekkil profili."
        description="İletişim bilgileri, açık ve kapalı dosyalar, ödeme durumu ve görüşme geçmişi burada toplanacak."
        icon="users"
        accent="green"
        phase="F6"
      />
    ),
  },
  {
    path: '/gorevler',
    render: () => (
      <PlaceholderPage
        crumb="Görevler"
        title="Yapılacaklar, sırasıyla."
        description="Dosya bazlı görev listeleri, öncelikler ve büro içinde görev atama bu ekrana gelecek."
        icon="checklist"
        accent="red"
        phase="F7"
      />
    ),
  },
  {
    path: '/finans',
    render: () => (
      <PlaceholderPage
        crumb="Finans"
        title="Harçtan tahsilata, tek defter."
        description="Gider avansı, bilirkişi ve keşif masrafları, vekâlet ücretleri ve dekont arşivi burada tutulacak."
        icon="wallet"
        accent="purple"
        phase="F8"
      />
    ),
  },
  {
    path: '/asistan',
    render: () => (
      <PlaceholderPage
        crumb="Asistan"
        title="Eksiği o fark etsin."
        description="Yaklaşan süreleri ve dosyadaki eksik işlemleri kendiliğinden tespit eden asistan hazırlanıyor."
        icon="sparkles"
        accent="green"
        phase="F12"
      />
    ),
  },
  {
    path: '/raporlar',
    render: () => (
      <PlaceholderPage
        crumb="Raporlar"
        title="İşinizin resmini görün."
        description="Dosya performansı, iş yükü ve takvim sağlığı için sade raporlar hazırlanıyor."
        icon="chart"
        accent="amber"
        phase="F13"
      />
    ),
  },
  {
    path: '/ayarlar',
    render: () => (
      <PlaceholderPage
        crumb="Ayarlar"
        title="Kendi kurallarınızla."
        description="Hatırlatma tercihleri, bildirim kanalları, yedekleme ve uygulama kilidi bu ekrandan yönetilecek."
        icon="settings"
        accent="slate"
        phase="F11"
      />
    ),
  },
  {
    path: '/ara',
    render: () => (
      <PlaceholderPage
        crumb="Arama"
        title="Aradığınız her yerde."
        description="Dosya, müvekkil, görev ve belgelerde tek kutudan arama yakında burada."
        icon="search"
        accent="slate"
        phase="F4"
      />
    ),
  },
  {
    path: '/bildirimler',
    render: () => (
      <PlaceholderPage
        crumb="Bildirimler"
        title="Kaçırmamanız gerekenler."
        description="Hatırlatmalar, yaklaşan süreler ve ödeme uyarıları bu kutuda toplanacak."
        icon="bell"
        accent="amber"
        phase="F11"
      />
    ),
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
