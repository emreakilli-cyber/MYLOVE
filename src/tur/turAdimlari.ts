/*
 * Uygulama içi rehberli tur (koç işaretleri) adımları.
 *
 * Her adım GERÇEK bir panele götürür ve GERÇEK bir öğeyi (spotlight) işaret eder;
 * metin balonda görünür. Böylece kullanıcı özellikleri doğal konumlarında,
 * senaryoya uygun deneyimler. Sahte ekran yok.
 *
 * `hedef` bir CSS seçicisidir; öğe bulunamazsa balon ortada gösterilir (tur
 * takılmaz). `drawer` true ise adım gösterilmeden önce yan menü açılır.
 */

export interface TurAdimi {
  readonly id: string
  /** Gidilecek gerçek rota. */
  readonly rota: string
  /** İşaretlenecek gerçek öğenin seçicisi; null ise ortada balon (kapanış). */
  readonly hedef: string | null
  readonly baslik: string
  readonly metin: string
  /** Bu adımda yan menü açık olsun mu. */
  readonly drawer?: boolean
}

export const turAdimlari: readonly TurAdimi[] = [
  {
    id: 'panel',
    rota: '/',
    hedef: '[data-tur="panel"]',
    baslik: 'Kontrol paneliniz',
    metin:
      'Bugünün duruşmaları, yaklaşan süreler ve işleriniz tek bakışta burada toplanır.',
  },
  {
    id: 'menu',
    rota: '/',
    hedef: '[data-tur="menu"]',
    baslik: 'Menü',
    metin: 'Tüm bölümlere buradaki menüden ulaşırsınız. Hadi Asistan’ı açalım.',
  },
  {
    id: 'menu-asistan',
    rota: '/',
    hedef: '.drawer [href*="/asistan"]',
    drawer: true,
    baslik: 'AI Asistan’a geçiş',
    metin:
      'Örneğin bir dilekçe için menüden “Asistan”a dokunursunuz. İleri deyin, birlikte gidelim.',
  },
  {
    id: 'asistan',
    rota: '/asistan',
    hedef: '[data-tur="asistan"]',
    baslik: 'Dosyaya danışın',
    metin:
      'Dilekçe taslağı isteyin ya da soru sorun. Gönderdiğinizde kimlik bilgileri maskelenir; sağlayıcıya yalnızca maskeli metin gider.',
  },
  {
    id: 'dosya',
    rota: '/dosyalar',
    hedef: '.fab',
    baslik: 'Yeni dosya',
    metin:
      'Dosyalarınızı buradan açar; süre, görev ve hazırlık durumunu dosyanın içinde takip edersiniz.',
  },
  {
    id: 'takvim',
    rota: '/takvim',
    hedef: '[data-tur="takvim"]',
    baslik: 'Takvim',
    metin: 'Duruşmalar ve hukuki süreler tek bir zaman çizelgesinde toplanır.',
  },
  {
    id: 'sure',
    rota: '/sure',
    hedef: '[data-tur="sure"]',
    baslik: 'Süre hesabı',
    metin:
      'Süre türünü ve tebligat tarihini seçin; son günü resmî tatil ve adli tatili gözeterek hesaplasın.',
  },
  {
    id: 'bitis',
    rota: '/',
    hedef: null,
    baslik: 'Hazırsınız',
    metin:
      'Turu istediğiniz zaman Ayarlar’dan yeniden başlatabilirsiniz. Kolay gelsin.',
  },
]
