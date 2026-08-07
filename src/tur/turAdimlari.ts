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

/*
 * Anlatı: senaryo, "bir cevap dilekçesi hazırlamanız gerekiyor" örneğinden akar
 * ve panelleri gerçek işleyişiyle gösterir — kullanıcının kendi vurguladığı
 * "menüden AI Asistan'a geç, gerçek panelden göster" senaryosu.
 */
export const turAdimlari: readonly TurAdimi[] = [
  {
    id: 'panel',
    rota: '/',
    hedef: '[data-tur="panel"]',
    baslik: 'Gününüz burada başlar',
    metin:
      'Bugünkü duruşmalar, yaklaşan süreler ve işleriniz tek bakışta burada. Kısa bir turla birlikte gezelim — diyelim yeni bir işe başlıyorsunuz.',
  },
  {
    id: 'menu',
    rota: '/',
    hedef: '[data-tur="menu"]',
    baslik: 'Her yere buradan',
    metin:
      'Tüm bölümlere soldaki menüden ulaşırsınız. Bir cevap dilekçesi hazırlamanız gerektiğini düşünelim; menüyü açıp Asistan’a geçelim.',
  },
  {
    id: 'menu-asistan',
    rota: '/',
    hedef: '.drawer [href*="/asistan"]',
    drawer: true,
    baslik: 'Menüden Asistan’a',
    metin:
      'İşte menü. Dilekçe için tek yapmanız gereken “Asistan”a dokunmak. İleri deyin, sizi oraya götüreyim.',
  },
  {
    id: 'asistan',
    rota: '/asistan',
    hedef: '[data-tur="asistan"]',
    baslik: 'Gerçek panel: Dosyaya danışın',
    metin:
      'Buradayız. Dosyayı seçip taslak ister ya da soru sorarsınız. Gönderdiğinizde kimlik bilgileri maskelenir; sağlayıcıya yalnızca maskeli metin gider.',
  },
  {
    id: 'dosya',
    rota: '/dosyalar',
    hedef: '.fab',
    baslik: 'Yeni dava geldiğinde',
    metin:
      'Yeni bir dosyayı buradan açarsınız; süre, görev ve hazırlık durumu dosyanın içinde toplanır.',
  },
  {
    id: 'takvim',
    rota: '/takvim',
    hedef: '[data-tur="takvim"]',
    baslik: 'Duruşma ve süreler',
    metin:
      'Duruşmalarınız ve hukuki süreleriniz bu takvimde tek bir zaman çizelgesinde buluşur.',
  },
  {
    id: 'sure',
    rota: '/sure',
    hedef: '[data-tur="sure"]',
    baslik: 'Süreyi hesaplayın',
    metin:
      'Süre türünü ve tebligat tarihini seçin; son günü resmî tatil ve adli tatili gözeterek bulur. Sonuç bilgilendirme amaçlıdır; teyit sizde.',
  },
  {
    id: 'bitis',
    rota: '/',
    hedef: null,
    baslik: 'Hazırsınız',
    metin:
      'Turu bitirdik. İstediğiniz an Ayarlar → Yardım’dan yeniden başlatabilirsiniz. Kolay gelsin.',
  },
]
