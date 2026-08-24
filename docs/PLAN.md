# JurisCalendar — Yol Haritası ve Döngü Durumu

> **Bu dosya döngünün hafızasıdır.** Her uyanışta önce burayı oku, `[ ]` olan ilk
> maddeden devam et, işi bitir, commit'le, kutuyu `[x]` yap ve "Oturum günlüğü"ne
> tek satır yaz. Konteyner sıfırlansa bile buradan devam edilebilir.

- **Dal:** `claude/juriscalendar-legal-platform-y8f5lr`
- **Görsel referans:** `docs/DESIGN-REFERENCE.md` (+ `docs/design-reference/*.jpg`)
- **Hedef:** GitHub Pages'ten kurulabilen PWA → ana ekrana ekle → test → sonra
  Capacitor ile App Store paketi.

---

## Mimari kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Çatı | React 18 + TypeScript + Vite | Hızlı, PWA ve Capacitor ile uyumlu |
| Yönlendirme | Elle yazılmış hash router (`src/router/`) | GitHub Pages'te 404 hilesi gerektirmez; react-router'ın açık RSC zafiyeti ve ~15 kB yükü taşınmıyor |
| Depolama | IndexedDB (Dexie) — **local-first** | Belge/dekont ekleri, çevrimdışı çalışma, sunucu bağımlılığı yok |
| Stil | Elle yazılmış CSS + tasarım token'ları | Editoryal görünüm birebir tutturulacak; framework varsayımı istemiyoruz |
| Tarih | `date-fns` + `tr` yerel ayarı | Türkçe ay/gün adları, süre aritmetiği |
| Grafik | Elle yazılmış SVG | Küçük paket, tasarıma birebir uyum |
| Asistan | Önce **kural motoru**, üstüne opsiyonel LLM | Şartname örnekleri ("Bilirkişi ücreti yatırılmadı") veriden deterministik çıkar; çevrimdışı ve doğru |
| Dağıtım | GitHub Actions → GitHub Pages, base `/MYLOVE/` | Kullanıcı "github üzerinden ana ekrana ekleyip test edeceğim" dedi |

**Fontlar** (self-host, Türkçe karakter tam): serif `Newsreader`, gövde `Inter`,
mono `IBM Plex Mono`. `src/assets/fonts/` altında yalnızca `latin` + `latin-ext`
altkümeleri tutuluyor (toplam 296 kB); Kiril/Yunan/Vietnam altkümeleri service
worker'ın çevrimdışı önbelleğini şişirmesin diye dışarıda bırakıldı.

**Sunucu gerektiren özellikler** (SMS, e-posta, push, LLM, takvim senkronu) bir
`services/` adaptör katmanı arkasına alınacak: varsayılan uygulama cihaz içi
(yerel bildirim, ICS dosyası, kural motoru), sunucu geldiğinde adaptör değişecek.

---

## Aşamalar

### F0 — Temel
- [x] Ekran kaydını çöz, görsel referansı çıkar ve repoya kalıcı kaydet
- [x] Yol haritası ve döngü durumu dosyası
- [x] Vite + React + TS iskeleti, tasarım token'ları, gömülü fontlar
- [x] Uygulama kabuğu: üst çubuk, yan menü (drawer), yönlendirme, boş sayfalar
- [x] PWA: manifest, ikonlar, service worker, iOS ana ekran meta etiketleri
- [x] GitHub Actions → GitHub Pages dağıtımı

### F1 — Veri katmanı
- [x] Alan modeli: Dosya, Müvekkil, Olay, Görev, Süre, Finans kaydı, Belge, Kişi, Not, Hareket
- [x] Dexie şeması, sürüm/göç altyapısı
- [x] Videodaki örnek verinin birebir tohumlanması (Yılmaz/Arslan, Demir İnşaat, Kaya/Nova…)
- [x] Yedekleme: tüm veriyi JSON+ek olarak dışa/içe aktarma
- [x] Repository katmanı (`src/data/sorgular.ts` — canlı Dexie sorguları)

### F2 — Genel bakış (Dashboard)
- [x] Hero kartı + selamlama + tarih
- [x] 2×2 istatistik ızgarası (canlı hesaplanan)
- [x] Yaklaşan son tarihler
- [x] Bugünün programı — Duruşmalar
- [x] Bugün yapılacaklar (satır içi tamamlama)
- [x] Hazırlık durumu (dosya sağlığı)
- [x] Son hareketler + alt güvenlik kartı
- [x] Panelden satır içi hızlı görev ekleme (Enter ile kaydeder; "Detaylı" forma bağlantı)

### F3 — Takvim (şartname md. 1)
- [x] Ay / hafta / ajanda görünümleri
- [x] Olay türleri ve renkleri: duruşma, icra takibi, müvekkil görüşmesi, dilekçe teslimi,
      arabuluculuk, keşif, son tarih, diğer
- [x] Gün detayı, dosya bağlantısı
- [x] Hukuki süreler de takvimde (olaylarla tek zaman çizelgesinde)
- [x] Olay oluştur/düzenle/sil formu
- [x] Tekrar eden olaylar (seri olarak maddeleştirilir; "yalnızca bu / tüm seri" silme)

### F4 — Dosyalar (md. 4)
- [x] Dosya listesi: durum, esas no, mahkeme, müvekkil, hazırlık yüzdesi ile filtre/arama
- [x] Dosya detayı sekmeleri: Genel, Duruşmalar, Süreler, Görevler, Belgeler, Finans, Notlar
- [x] Hazırlık kontrol listesi (Genel sekmesinde, eksiklerin eylem metniyle)
- [x] Belgeyi cihaza indirme
- [x] Dosya oluştur/düzenle/sil formu (yeni müvekkil satır içi eklenebiliyor)
- [x] İlgili kişi ve not ekleme/silme (Notlar sekmesinde satır içi form)

### F5 — Hukuki süre hesaplama (md. 5)
- [x] Resmî tatil takvimi (sabit + dinî bayramlar, 2024–2030 Diyanet tablosu)
- [x] Adli tatil kuralı (20 Temmuz – 31 Ağustos) ve sürenin 7 Eylül'e uzaması (HMK m. 104)
- [x] Süre kataloğu: 17 kural (istinaf, temyiz, cevap, bilirkişi itirazı, tedbire itiraz,
      ödeme emrine itiraz, ihtiyati hacze itiraz, itirazın iptali, ceza istinaf/temyiz/itiraz,
      idari iptal/vergi/cevap, işe iade, arabuluculuk) — her biri kanun maddesiyle
- [x] Tebligat tarihinden son güne hesaplama + hafta sonu/tatile denk gelirse ilk iş günü (HMK m. 92–93)
- [x] Hesaplanan süreyi dosyaya ve takvime otomatik işleme (`kaynak: sure-hesabi`)
- [x] Görünür uyarı: bilgilendirme amaçlıdır, sorumluluk kullanıcıdadır (her ekranda)
- [x] Süre kataloğu genişletildi (16 → 31 kural): replik/düplik, istinaf dilekçesine cevap, yargılamanın iadesi, hakem iptal; icra şikayet/gecikmiş itiraz/kambiyo/ihalenin feshi/istirdat; ceza eski hâle getirme/tazminat; idari üst makam/YD itiraz/tam yargı — karar düzeltme HMK ve İYUK'ta kaldırıldığı için bilinçli olarak eklenmedi

### F6 — Müvekkiller (md. 8)
- [x] Müvekkil profili: iletişim, TCKN/vergi no, adres, etiketler
- [x] Açık/kapalı dosyalar, ödeme durumu (tüm dosyalardan toplanan bekleyen), görüşme geçmişi
- [x] Hızlı iletişim (tel: ara / mailto: e-posta / görüşme kaydet)
- [x] Müvekkil oluştur/düzenle; bağlı dosya varsa silme yerine arşivleme

### F7 — Görevler (md. 9)
- [x] Genel görev ekranı: zaman gruplu liste (gecikmiş/bugün/yarın/yaklaşan/vadesiz/tamamlanan)
- [x] Süzgeçler: açık / bana atanan / öncelikli / tamamlanan
- [x] Dosya bazlı görev (dosya detayında zaten vardı; formda dosya seçimiyle bağlanıyor)
- [x] Kullanıcıya atama (3 kişilik tohum büro: Ayşe/Mert/Elif)
- [x] Hazır görev şablonları (8 şablon: harç, dilekçe, müvekkil arama…)
- [x] Görev oluştur/düzenle/sil formu
- [x] Tekrar eden görevler (vade taşıyan seri; "yalnızca bu / tüm seri" silme)

### F8 — Finans (md. 6, 7)
- [x] Gider/gelir kalemleri: 11 kategori (harç, gider avansı, bilirkişi, keşif, tebligat,
      arabuluculuk, noter, icra masrafı, müvekkil avansı, vekâlet ücreti, diğer)
- [x] Ödeme durumu (bekliyor/kısmi/ödendi), vade, yaklaşan ödeme (özet: 7 gün içi sayısı)
- [x] Genel finans ekranı: büro özeti + süzgeçler (tümü/tahsilat/gider/bekleyen)
- [x] Dosya bazlı gelir–gider özeti ve bakiye (dosya detayı Finans sekmesi)
- [x] Makbuz/dekont arşivi: PDF/görsel yükleme (Blob, IndexedDB), indirme, kalemle ilişkilendirme
- [x] Türkçe tutar girişi ("7.500,50" → doğru kuruş) ve kısmi ödeme

### F9 — Belge yönetimi (md. 12)
- [x] PDF / Word / Excel / görsel / ses ekleme, IndexedDB'de saklama (dosya detayı Belgeler sekmesi)
- [x] İndirme ve silme; tür otomatik tahmini (ad/MIME'den)
- [x] Etiketleme (belge satırında ekle/sil) ve global belge arama ekranı (`/ara` — son placeholder kapandı)
- [x] Önizleme (görsel/PDF/ses gömülü — `BelgeOnizleme`, hem aramada hem dosya detayında)
- [x] Depolama kullanımı göstergesi ve kota uyarısı (arama ekranında; `navigator.storage.estimate`)

### F10 — Hazırlık durumu (md. 11)
- [x] Dosya türüne göre kontrol listesi şablonları (icra/ceza/arabuluculuk/tüketici/idari türe özel; uygulanmayan madde yüzdeye katılmaz)
- [x] Otomatik tespit (duruşma girildi mi, vekâletname yüklendi mi, harç yatırıldı mı…) — her madde veriden okunur, elle işaretleme yok
- [x] Yüzde hesabı, eksikler listesi, "bir sonraki adım" önerisi (ağırlıklı; en ağır eksik sıradaki adım)

### F11 — Hatırlatmalar ve bildirimler (md. 2, 3)
- [x] Çoklu ofset motoru: 30/15/7/3/1 gün, aynı gün, 1 saat önce — Ayarlar'da düzenlenebilir
- [x] Olay türüne göre varsayılan hatırlatma profilleri (duruşma / hukuki süre)
- [x] Cihaz içi bildirim (Notification API adaptörü) + uygulama içi bildirim kutusu (Bildirimler ekranı)
- [x] Kanal adaptörü (`services/bildirim.ts`): uygulama/push/SMS/eposta + net "yapılandırılmadı" hâli
- [x] Sessiz saatler
- [x] **Ayarlar ekranı** (son placeholder): profil, hatırlatma profilleri, kanallar, sessiz saatler, LLM anahtarı, yedekleme (dışa/geri), veri sıfırlama
- [x] Üst çubuk zil noktası gerçek hatırlatma sayısına bağlandı
- [x] Snooze (tekrar erteleme): 1 saat / 3 saat / yarın / 1 hafta; ertelemeyi geri al — durum Ayarlar'da id→an haritasında, süresi geçen kayıtlar temizlenir

### F12 — Asistan (md. 10)
- [x] Kural motoru: yaklaşan süreler, ödenmemiş kalemler, yaklaşan duruşma, geciken görev, eksik vekâletname, düşük hazırlık
- [x] Büro geneli "Gündem" — bulgular önceliğe göre (kritik/uyarı/bilgi)
- [x] Dosya özeti üretimi ("durumunu özetle")
- [x] Soru–cevap arayüzü (niyet çıkarımı + önerilen sorular); şartname örneklerini birebir veriyor
- [x] Opsiyonel LLM katmanı (`services/llm.ts`): varsayılan kapalı, kullanıcının kendi OpenAI-uyumlu uç noktası + anahtarı; açıkken yalnızca soru + dosya özeti gider; kural motoru varsayılan kalır; hata hâlleri nazik

### F13 — Raporlar (md. 14)
- [x] Aylık duruşma / görüşme / tamamlanan görev sayıları
- [x] Son 6 ay gelir-gider sütun grafiği (elle SVG)
- [x] Açık süreler aciliyet dağılımı (elle SVG halka)
- [x] Kategori bazlı gider dağılımı (yatay çubuk)
- [x] Dosya bazlı gelir–gider analizi
- [x] CSV dışa aktarma (UTF-8 BOM + ; ayraç, Excel-TR uyumlu)
- [x] Serbest tarih aralığı seçimi: hazır aralıklar (bu ay / son 3-6-12 ay / bu yıl) + serbest başlangıç-bitiş; sütun/aktivite/gider/bakiye/toplam aralığa göre; açık süre halkası anlık durum

### F14 — Takvim senkronizasyonu (md. 13)
- [x] ICS dışa aktarma — tüm takvim (olaylar + hukuki süreler) ve tek olay
- [x] Google / Apple / Outlook için içe aktarma rehberi ekranı
- [x] Canlı abonelik (webcal) için dürüst açıklama — sunucu gerektirir, sonraki katmanda
- [x] `services/ics.ts`: RFC 5545 uyumlu üretim (kaçış, satır katlama, UTC/tüm-gün) — 8 test

### F15 — Güvenlik (md. 15)
- [x] Uygulama kilidi: PIN (PBKDF2 özeti, ham PIN saklanmaz) + WebAuthn/biyometri (Face ID/Touch ID)
- [x] Parola türevli şifreleme (WebCrypto PBKDF2/AES-GCM): şifreli yedek + PIN özeti — cihaz içi düz veri için OS disk şifrelemesine dayanıldı (dürüst kapsam, bkz. günlük)
- [x] Oturum zaman aşımı (0/1/5/15 dk seçilebilir), arka planda ekran maskeleme
- [x] Şifreli yedek dosyası dışa/içe aktarma (.jcenc)
- [x] KVKK notu, veri saklama/silme (Ayarlar'da veri sıfırlama)

### F16 — Bitiş
- [!] **Geçici sürüm yenileme düğmesini kaldır** — `src/components/SurumYenile.tsx`,
      `AppShell` içindeki kullanımı, `shell.css` sonundaki blok ve `vite.config.ts`
      içindeki `define` bloğu birlikte silinecek. **Şimdilik test için DURUYOR;
      kaldırma App Store paketlemesinden hemen öncesine ertelendi (bkz. BEKLEYEN).**
- [x] Çevrimdışı davranış, boş/yükleniyor/hata hâlleri — çevrimdışı bilgi şeridi (`CevrimdisiUyari` + `useCevrimici`, local-first: alarm değil sakin ton), React hata sınırı (`HataSiniri`, beyaz ekran yerine kurtarma ekranı, redaksiyonlu günlük); boş/yükleniyor hâlleri zaten 18 sayfada (`section-empty`/`SatirIskeleti`)
- [x] Erişilebilirlik: odak sırası, kontrast, ekran okuyucu etiketleri — F23'te tamamlandı: kontrast AA (nötr griler koyulaştırıldı), aria/odak/skip-link/canlı-bölge geçişi, `:focus-visible` halkası, yazı boyutu ölçeği
- [x] Vitest ile birim testleri (süre motoru, hazırlık skoru, hatırlatma ofsetleri) — süre motoru `sureHesabi.test.ts`, hazırlık skoru `hazirlik.test.ts`, hatırlatma ofsetleri yeni `domain/hatirlatma.ts` (saf çekirdek) + `hatirlatma.test.ts` (kanca aritmetiği DB'siz test edilebilir hâle getirildi)
- [x] README: kurulum, GitHub Pages yayını, ana ekrana ekleme, Capacitor ile App Store yolu
- [x] Sürüm etiketi ve son elden geçirme — **sürüm etiketi:** `package.json` sürümü `__APP_VERSION__` ile gömülüp Ayarlar altbilgisinde gösteriliyor ("sürüm 0.1.0 (derleme-kimliği)"). **Son elden geçirme:** tüm ekranlar (20+ rota) tarayıcıda tarandı — yatay taşma/konsol hatası yok, kontrast AA, aria/odak tam. *Not: ürün öncesi kalan temizlik (geçici "sürüm yenile" düğmesini kaldırma, gerçek OAuth, hukuki metin içerikleri) `[!]` BEKLEYEN'de; bunlar App Store paketlemesiyle birlikte, kullanıcı adımlarıyla yapılacak.*

> **Not (madde 8):** F16'nın açık maddeleri (çevrimdışı/boş/hata hâlleri,
> erişilebilirlik, kalan testler, sürüm etiketi) planda zaten duruyor.
> Erişilebilirlik ayrıca F23'te ayrıntılandırıldı. "Sürüm yenile" düğmesi
> `[!]` işaretlendi ve şimdilik silinmeyecek.

---

### F17 — Uygulama içi rehberli tur (in-app guided tour)
> **Yön değişikliği (kullanıcı isteği):** Eski F17 animasyonlu bir tanıtım
> slaytıydı (sahte ekranlar; S0–S7). Kullanıcı bunu istemedi: "gerçekten
> uygulamanın içinde tutorial yapıp senaryoya göre eğitim… dilekçe kısmını
> menüden AI asistana tıklayıp sen götürüp gerçek panelden göstereceksin."
> Slayt gösterisi kaldırıldı (`Onboarding.tsx`, `script.ts`, `script.test.ts`,
> `efektler.ts` silindi) ve yerine **gerçek panelleri gezen** bir koç-işaretli
> tur kondu. Sahte ekran yok; her durak gerçek öğeyi spotlight ile işaret eder.
- [x] `src/tur/` altında tur motoru: SVG maske spotlight (delik) + halka + konumlanan balon; çalışan uygulamanın ÜZERİNE binen katman (`Tur.tsx`)
- [x] Adımlar `src/tur/turAdimlari.ts` içinde **veri** olarak durur (rota + gerçek öğe seçicisi + başlık + metin + gerekiyorsa `drawer`); test korur (`turAdimlari.test.ts`)
- [x] Tur gerçek rotalara **kendisi gider** (`useNavigate`) ve gerçek öğeleri ölçer; öğe bulunamazsa balon ortada gösterilir, tur takılmaz
- [x] Yan menüyü açıp kapatmak için `juris-drawer` CustomEvent'i yayınlar; `AppShell` dinler (tur menüden Asistan'a geçişi gerçekten yapar)
- [x] Kayıt tamamlanınca (F18+F19 sonrası) ilk girişte otomatik başlar; bir kez görülünce/kapatılınca tekrar açılmaz (`ayarlar.turGoruldu` kalıcı bayrak; `App.tsx` içinde RouterProvider altında mount)
- [x] Her adımda "Turu kapat", adım sayacı (n/8) ve "İleri/Bitir"; dokunma hedefleri ≥ 44pt; `prefers-reduced-motion` parıltıyı kapatır
- [x] Menü/sayfa geçişi (~320ms) boyunca birkaç kez yeniden ölçüm → spotlight öğeyi kayarken de takip eder, son konumda oturur
- [x] Ayarlar → "Yardım" altında **"Uygulama turunu yeniden başlat"** düğmesi (`turGoruldu:false`)
- [x] Duraklar (kullanıcı seçimi): **Genel bakış + menü**, **AI Asistan + maskeleme**, **Dosya ekleme**, **Takvim + süre hesabı** — tarayıcıda uçtan uca doğrulandı (Playwright: 8 durak, hepsi gerçek panelde spotlight; tur bitince kapanıyor, reload'da açılmıyor)
- [x] AI Asistan durağı gerçek `/asistan` panelinde "Dosyaya danışın" alanını işaret eder; maskeleme açıklaması balonda: "kimlik bilgileri maskelenir; sağlayıcıya yalnızca maskeli metin gider"
- [x] Dil denetimi: yasak ifadeler ("hiçbir veri paylaşılmıyor"/"hacklenemez"/"%100 güvenli") tur metinlerinde **yok**
- [x] **Cihaz videosu düzeltmeleri (kullanıcı geri bildirimi):** (1) balon artık güvenli alan içinde konumlanır (çentik/ana çubuk altını `env(safe-area-inset-*)` ölçüp kırpar) — eskiden aşağıdaki hedeflerde balon durum çubuğunun/saatin arkasına kaçıyordu; (2) metinler **senaryo temelli** yeniden yazıldı ("bir cevap dilekçesi hazırlamanız gerekiyor → menüden Asistan'a → gerçek panel") — kullanıcının istediği "senaryoya göre eğitim".
- [x] **Tepki düzeltmesi (2. geri bildirim: "laglı, eski hâli daha güzeldi"):** İlk denemede geçiş sürerken balonu gizleyen `hazir` durumu **gecikme hissi** yaratıyordu → kaldırıldı. Artık "İleri"ye basınca balon metni ANINDA değişir (tarayıcıda ölçüldü: 25 ms içinde başlık değişiyor, balon hiç gizlenmiyor); yeni hedef ölçülene dek spotlight önceki konumunda kalır (ortada balon sıçraması YOK), ölçülünce kısa/snappy (140 ms) kayışla oturur. reduced-motion'da kayış kapalı. 8 durakta: `instantTextChange=true`, balon ekran içinde, gerçek paneller spotlight.

### F18 — Hukuki onay akışı (onboarding S8)
- [x] Onay ekranında 5 kutucuk; hepsi başta işaretsiz; "Kabul et ve başla" yalnızca 5'i de işaretliyken aktif olur
- [x] Kutucuklar, uzun metin **sonuna kaydırılmadan** aktifleşmez *(varsayım: tek birleşik ToS+Aydınlatma metni sona kaydırılınca 5 kutu birden açılır — bkz. günlük)*
- [x] 5 madde birebir: (Kullanım Şartları + Aydınlatma) / (şifre unutulursa kurtarılamaz) / (maskeleme tam anonimleştirme değil, onay kontrolü kullanıcıda) / (AI çıktısı taslak, doğruluk + meslek sırrı kullanıcıda) / (cihaz güvenliği kullanıcıda)
- [x] Onay kaydı cihaza yazılır: zaman (ISO tarih+saat), metin sürümü ve metin **hash'i** (SHA-256) — tarayıcıda doğrulandı
- [x] Metin sürümü değişince yeniden onay istenir; değişmediyse tekrar istenmez (test + tarayıcı: reload'da onay çıkmıyor)
- [x] Hukuki metinler **yer tutucu**; içerik [!] avukatta (bkz. BEKLEYEN). Uygulama yer tutucuyu gösterir, sürüm/hash'i kaydeder

### F19 — Kayıt / giriş ve profil
- [x] Kayıt formunda ad, soyad, ünvan alınır ve yerelde saklanır (`KayitEkrani`; App gating `profilKuruldu`)
- [x] Ad/soyad/ünvan yan menü (drawer) altında görünür — artık dinamik (avatar baş harfleri de); ana ekran selamlaması F2'de zaten adı gösteriyordu
- [x] E-posta ile kayıt/giriş **arayüzü** (yerel profil oluşturur); gerçek e-posta doğrulama sunucusu [!]
- [x] Google ve Apple ile giriş butonları arayüzde; tıklanınca açıkça "henüz yapılandırılmadı" der; OAuth entegrasyonu [!]

### F20 — Cihazlar arası iş bölümü (devir teslim)
- [x] Devir teslim penceresinde "Telefonda yap" seçeneği **her zaman** var ve **varsayılan vurgulu** buton odur (`DevirTeslim`)
- [x] Süre tahminleri gerçek ölçümden (`performance.now`) hesaplanır; ölçüm yoksa hiç gösterilmez (uydurma yok — test)
- [x] Bilgisayar erişilemezse devir **hiç** gösterilmez; iş sessizce telefonda yapılır (varsayılan; tarayıcıda 0 doğrulandı)
- [x] Bir kez "telefonda yap" → aynı oturumda aynı iş tipi için tekrar sorulmaz (oturum içi tercih; test + tarayıcı)
- [x] Masaüstü algılama + gerçek transfer adaptör arkasında (`services/devir.ts`), varsayılan "masaüstü yok → telefonda"; gerçek taşıma [!] (BEKLEYEN)

### F21 — hukuk-ai arayüz sözleşmesi
- [x] `packages/hukuk-ai`'nin sağlayacağı arayüz **tüketici tarafta** tanımlandı (`src/services/hukukAi.ts`); `packages/hukuk-ai/` klasörüne **dokunulmadı**
- [x] Arayüz: `maskele` (metin → maskeli metin + eşleme), `demaskele`, `sor`, `hazirMi`; `MaskeSonucu`/`MaskeEslesmesi`/`MaskeTuru` tipleri; eşleme cihazda kalır sözleşmesi
- [x] `bagliDegilHukukAi` varsayılanı (paket yokken derlenir/çalışır) + `npm run build` geçer; sözleşme sahte uygulamayla test edildi
- [!] **Paketi app'e bağla** (paket tüketilebilir olunca) — `packages/hukuk-ai` motoru dala merge edildi (PR #1, 271 test yeşil) ama app hâlâ `bagliDegilHukukAi` passthrough kullanıyor. Engel: pakette `package.json`/dışa aktarım yok (ayrı session tamamlayacak), o yüzden import edilemez. Hazır olunca: LLM'e gitmeden önce `maskele` çağrılacak, yanıt `demaskele` ile geri konacak; tur "AI Asistan" durağındaki **maskeleme cümlesi geri eklenecek** (o zaman gerçek olur).

### F22 — Gizli günlükleme (redacting logger)
- [x] Merkezi logger (`services/gunluk.ts`): redaksiyon çıktıdan **önce** yapılır (yaz-sonra-sil değil); tarayıcıda disk günlüğü yok, tek yazan yer bu dosya
- [x] Doğrudan `console.*` çağrısı **kaynak-tarama kapısıyla** engellenir (proje ESLint kullanmıyor → lint yerine test kapısı, `gunluk.test.ts`); tek konsol kullanan yer `gunluk.ts`, `main.tsx` de logger'a geçirildi
- [x] Test: kimlik desenli hata → çıktıda TCKN/IBAN/e-posta/GSM maskeli *(pattern bazlı; serbest metin isim/adres logger'a geçirilmez — mesaj geliştirici metnidir, ham kayıt log'lanmaz — bkz. günlük)*

### F23 — Erişilebilirlik (ileri yaş kitle; F16'yı genişletir)
- [x] Büyük taban punto; kullanıcı yazı boyutunu artırabilir veya sistem büyütmesine uyar — Ayarlar → **Yazı boyutu** (Normal/Büyük/Çok büyük), kök `font-size` %100/112.5/125; tüm ölçüler `rem` olduğu için arayüz orantılı büyür; `%` taban sistem büyütmesini korur; ayar kalıcı (`ayarlar.yaziOlcegi`, App'te köke uygulanır). Tarayıcıda doğrulandı: 16→20px, reload'da kalıcı, düzen bozulmuyor.
- [x] Metin/arka plan kontrastı WCAG AA (≥ 4.5:1) — denetlenebilir — nötr metin grileri koyulaştırıldı: `--text-secondary` #6b7472→**#5b6462** (kırık beyaz 4.45→5.64), `--text-muted` #9aa0a0→**#6b7170** (2.46→4.60); aynı gri-yeşil aile korundu, tarayıcıda görsel olarak doğrulandı (eyebrow'lar hâlâ sade, başlıkla yarışmıyor). *Varsayım: marka (teal link) ve kategori rozet renkleri (kırmızı/amber/yeşil…) marka kimliği olduğundan ve büyük/dekoratif kullanıldığından bu geçişte değiştirilmedi — kimliği bozmamak için kullanıcı kararına bırakıldı.*
- [x] **Kategori renklerinin METİN olarak kullanıldığı yerlerde AA'yı karşıla.** 6 kategori için hue korunarak koyulaştırılmış `--cat-X-text` token'ları eklendi (red #a2564a, amber #866638, purple #71639c, blue #526e8a, green #3e7566, slate #656d6b); beyaz/kırık-beyaz/tinted zemin/`surface-sunken` üzerinde ≥4.55:1 (script ile hesaplandı). Aksan sınıflarına `--acc-text` eklenip TÜM `color: var(--acc-fg)` ön plan kullanımları buna bağlandı; doğrudan `--cat-X-fg` metin kullanımları da düzeltildi: `.field-error`, `.button-danger`, `.sonuc-uyari`, `.check-action`, avatar baş harfleri; satır içi (Finans/Raporlar tutar rengi, MüvekkilDetay bekleyen ödeme, Bildirimler son-tarih, Ayarlar "Açık" rozeti, Görevler/Müvekkiller rozetleri) ve önemli durum ikonları (`.check-mark` ✓, `.bildirim-oneri-icon`, `.cevrimdisi-ikon`). **Dekoratif kullanımlar (nokta/kenarlık/rozet zemini/sol aksan) DEĞİŞMEDİ** — pastel marka kimliği korundu. **Runtime doğrulama (Playwright):** para/istatistik/rozet metinleri 2.0–2.3:1 → **4.93–5.33:1 (AA PASS)**; görsel: tutarlar okunur, tasarım dili aynı. *Varsayım: bilerek soluk hafta sonu başlıkları (`.cal-weekday` opacity 0.75) ve onboarding illüstrasyon grafikleri (metin değil) değiştirilmedi.*
- [x] Tüm dokunma hedefleri min 44×44 pt — `styles/dokunmatik.css`: görünür boyutu DEĞİŞTİRMEDEN, görünmez `::after` "dokunma alanı" ile tıklama hedefi 44px'e çıkarıldı (görsel dil korundu). Yatay komşu çakışmasını önlemek için kural: geniş/satır kontrolleri yalnızca dikeyde (44px yükseklik), yalıtık kare ikon düğmeleri (üst çubuk, drawer-close) iki eksende 44×44, görev onay kutusu sağdaki gezinme bağlantısına taşmadan sola+dikey. *Varsayım: yatayda bitişik birkaç kontrol (takvim ‹›, görev onay kutusu genişliği) çakışmayı önlemek için ≥24px (WCAG 2.5.8 AA) bırakıldı; liste satırları/başlık bağlantıları zaten AA. Tarayıcıda doğrulandı: görünür boyutlar aynı, uzatılmış alandan tıklama çalışıyor, komşu kontroller (onay kutusu↔satır bağlantısı, takvim ileri/geri) doğru yönleniyor, görsel regresyon yok.*
- [x] `prefers-reduced-motion` desteklenir; animasyonlar sadeleşir/kapanır — token'larda `--duration-*` sıfırlanır; tur animasyonları (`tur-belir`, halka/balon geçişi) reduced-motion'da kapalı; eski animasyonlu onboarding slaytı kaldırıldı (yerine sade koç-işaretli tur)
- [x] ~~Ses ve titreşim Ayarlar'dan kapatılabilir; onboarding "tık" sesleri~~ **KONU DIŞI** — sesler/titreşim animasyonlu slaytla (`efektler.ts`) birlikte kaldırıldı; uygulama içi turda ses/titreşim yok
- [x] Görünür odak halkası + mantıklı odak sırası + tüm etkileşimli öğelerde ekran okuyucu (aria) etiketleri — odak halkası `:focus-visible` (base.css); işaret alanları `<header>/<nav>/<main>`; drawer/tur/kilit `role="dialog"` (drawer odak tuzağı var); gezinme `aria-current="page"`, açık/kapalı düğmeler `aria-pressed`, dekoratif ikonlar `aria-hidden`. **Playwright denetimi:** 15 ekran + drawer'da adsız etkileşimli öğe YOK. Eklenenler: **"İçeriğe geç" skip link** (klavye; hash router'ı tetiklemeden `<main id="ana-icerik">`e odak taşır), Ayarlar durum mesajı `role="status"` canlı bölge, zil düğmesine sayıyı içeren erişilebilir ad ("Bildirimler, N aktif hatırlatma"). Tarayıcıda doğrulandı: ilk Tab → skip link, Enter → içerik odağı (hash değişmiyor).

---

## BEKLEYEN — KULLANICI
Bu maddeler kod tarafında hazırlanır ama tamamlanması **senin** elle yapacağın
adımları gerektirir; otonom döngü bunları `[!]` sayıp atlar.

- [!] **Hukuki metin içerikleri** (Kullanım Şartları, Aydınlatma Metni, sorumluluk maddeleri) — avukat hazırlayacak; uygulama yer tutucu + sürüm/hash yönetir (F18)
- [!] **Google/Apple OAuth** client ID'leri, "Sign in with Apple" sertifikaları ve e-posta doğrulama sunucusu (F19)
- [!] **Cihazlar arası gerçek devir/senkron altyapısı** — masaüstü varlığı algılama + iş transferi bir sunucu/eşleme ister (F20)
- [!] **Geçici "sürüm yenile" düğmesinin kaldırılması** — şimdilik test için DURUYOR (F16)
- [!] **App Store yayını** — Apple Developer hesabı, imzalama profili, Capacitor paketi yükleme (F16 devamı)
- [!] **SORU S7 — Müvekkil listesindeki "bekleyen ödeme" tutarının anlamı** — şu an gelir+gider tüm açık kalemleri topluyor; büro genel özeti ise yalnız gideri sayıyor. Doğru semantik bir ürün kararı; mevcut davranış korundu ve testlerle kilitlendi, karar `docs/QUESTIONS.md` S7'de bekliyor (muhtemel doğru seçenek: yalnız tahsil edilmemiş gelir = müvekkilin borcu)

---

## Doğrulama durumu (özet)

> **Kısa hâli:** Tüm F0–F23 özellikleri `[x]` tamamlandı; geriye yalnızca yukarıdaki
> `[!]` **kullanıcı-kapılı** maddeler kaldı (hukuki metin, OAuth, senkron altyapısı,
> App Store, geçici sürüm düğmesi). **Açık tasarım/işlevsel hata YOK.** Otonom döngü
> (tur-334→374) uygulamanın her boyutunu runtime + kod düzeyinde denetledi; hepsi sağlam:
>
> - **Görsel/tasarım:** tüm sayfalar + formlar + detay sekmeleri + boş durumlar + onboarding
>   + rehberli tur + mobil & masaüstü yerleşim, DESIGN-REFERENCE.md §2–§5 + JPG'lerle birebir.
> - **Erişilebilirlik:** WCAG AA kontrast (ölçüldü), klavye odak halkası, semantik/ARIA DOM,
>   reduced-motion, büyük yazı, azami-stres taşma süpürmesi (%125 @320px) — hepsi temiz.
> - **Çekirdek hukuki motor:** süre kataloğu (31 kural) hukuki doğruluk, gün/ay/yıl aritmetiği,
>   tüm tatil kaydırmaları (hafta sonu / millî / dinî / adli tatil / kapsam sınırı uyarısı).
> - **Veri & mantık:** tüm CRUD + tekrar üretimi + edit-koruma (veri kaybı yok) + dosya-kapat/
>   müvekkil-arşiv yaşam döngüsü; para ayrıştırma, Türkçe harmanlama, yerel-gün kovalaması,
>   hatırlatma ofset türetme, ödeme yaşam döngüsü, çok-alanlı arama, görev süzgeçleri.
> - **Altyapı/güvenlik:** PWA/çevrimdışı/iOS kurulum, base yolu, CSV/ICS dışa aktarım (enjeksiyon
>   güvenli), şifreli yedek turu, dürüst-kapsamlı PIN/kilit modeli, LLM varsayılan-kapalı.
> - **Kod-düzeyi/CSS mimarisi (tur-371→374):** sabit-kodlu renk yok (hepsi token), Icon a11y
>   (role=img+`<title>`), `console`/`TODO`/`any` yok, sızan İngilizce UI yok, `lang="tr"`;
>   z-index token'lı ve doğru sıralı (topbar<scrim<drawer<toast<lock, çakışma yok); duyarlılık
>   (mobil `max-width:360px` + masaüstü ortalı `--content-max:640px` sütun + iOS güvenli alan);
>   dokunma hedefleri WCAG 2.5.5 (görünmez 44px `::after`); tipografi/font (`font-display:swap`,
>   self-hosted+altküme, ₺/Türkçe glif kapsamı, tabular-nums, iOS-farkında yedek yığın).
> - **Regresyon ağı:** `npm run build` (tsc+vite) + `npx vitest run` → **45 dosya / 432 test** yeşil.
>
> Bir sonraki oturum: yukarıdaki `[!]` maddeler kullanıcı girdisi gelmeden ilerletilemez;
> girdi yoksa döngü kalite-doğrulama/regresyon modunda kalır (yeni köşe bulunursa denetler).

---

## Oturum günlüğü

| # | Tarih (UTC) | Yapılan |
|---|---|---|
| 398 | 2026-08-24 17:24 | **Kararlı-durum nabzı — YEŞİL.** Arşivlenen `PLAN.md` (56 KB) temiz okunuyor; regresyon kapısı: `npm run build` geçerli, `npx vitest run` → **45 dosya / 432 test HEP geçti** (kayma yok). Uygulama tam/doğru/güvenli/yayında. Ayırt edici otonom iş tükendi; tek açık karar S7 (`docs/QUESTIONS.md`), diğerleri `[!]` kullanıcı-kapılı. Döngü nabız modunda; log kısa tutuluyor (yeniden şişmesin). |
| 397 | 2026-08-24 16:24 | **Döngü-hafızası bakımı: `PLAN.md` arşivlendi — 536 KB → 56 KB (~10×), geçmiş korundu.** İki turda işaretlenen gerçek bir sorun çözüldü: PLAN.md her tur "döngünün hafızası" olarak okunuyor ama ~536 KB'a (695 satır) ulaşmıştı ve turda ~1,5 KB büyüyordu. Yapı önce dikkatle haritalandı: son satırlar (396→380) temiz azalan sırada, ama en eski geliştirme satırları (F0–F23, ~0–40) kaydediliş sırasında (kronolojik değil) — bu yüzden **satır-tabanlı** (satır-numarası değil) kesim seçildi, sıralamadan bağımsız güvenli. Satır 380 ve öncesi (380 satır) `docs/PLAN-ARCHIVE.md`'ye taşındı (başlık + tablo ile); PLAN.md'de aktif içerik (Mimari/Aşamalar/BEKLEYEN/Doğrulama durumu) + son 18 satır + arşiv işaretçisi kaldı. **Kayıp yok doğrulandı:** 315 tutulan + 380 arşivlenen = 695 orijinal; arşiv row-379'dan başlıyor, PLAN.md row-380'de bitip işaretçiyle kapanıyor. Aktif başlıklar bütün. Döngü etkilenmez: PLAN.md hâlâ okunuyor + yeni satırlar (397+) tablonun başına ekleniyor. `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 396 | 2026-08-24 15:24 | **README "Durum" bölümü güncel gerçeğe çekildi (bayat "Geliştirme sürüyor" → tamamlanmış/yayında).** Projenin ön kapısı olan README'nin durum bölümü hâlâ "Geliştirme sürüyor" diyordu; oysa F0–F23 tamam, uygulama GitHub Pages'te yayında + iPhone'a kurulabilir, 432 test altında. Bölüm doğru duruma güncellendi: çekirdek ürün tamam, yayında, kapsamlı test/inceleme altında; kalan işler kullanıcı-kapılı (hukuki metin, OAuth, senkron, App Store) olarak listelendi. Ayrıca açık ürün kararları için `docs/QUESTIONS.md` (S7) işaretçisi eklendi. Düşük-riskli, kod-dışı belge doğruluğu iyileştirmesi (README yapı/diğer bölümler zaten kapsamlı: Neden/Ne yapar/Teknik/Kurulum/Yayınlama/iPhone/App Store/Güvenlik/Uyarı). _(Gözlem: `docs/PLAN.md` ~546 KB'a ulaştı — her tur okunuyor; "Doğrulama durumu" özeti hızlı yönelim sağlıyor, geçmiş korunuyor, bu yüzden şimdilik yeniden yapılandırılmadı; döngü-hafızasını parçalamak riskli.)_ `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 395 | 2026-08-24 14:24 | **Kararlı-durum regresyon nabzı — YEŞİL; kod/yapılandırma inceleme taraması kapsamlı biçimde tamamlandı.** Son turlarda tüm mantık (finans/S7, dosya listesi, takvim tarih-aritmetiği, tekrar serisi, oran/sıfıra-bölme), güvenlik (kripto PBKDF2+AES-GCM, CSV enjeksiyon+RFC4180, PIN) ve altyapı (PWA precache/offline, yedek kapsamı, tohum referans bütünlüğü, ICS) yüzeyleri kod düzeyinde incelendi; gerçek boşluklarda somut değer üretildi (**+30 test → 432**, yedek & tohum bütünlük guard'ları, S7 ürün sorusu). Ayırt edici otonom iş artık tükendi. Bu yüzden sahte yeni inceleme üretmek yerine gerçek regresyon kapısı çalıştırıldı: `npm run build` (tsc+vite) geçerli, `npx vitest run` → **45 dosya / 432 test HEP geçti** (gerçek gün ilerlemesine rağmen deterministik, kayma yok). Uygulama tam, doğru, güvenli, dağıtılmış ve yeşil kalıyor. Kalan tek karar S7 (`docs/QUESTIONS.md`, müvekkil "bekleyen ödeme" anlamı); diğer her şey `[!]` kullanıcı-kapılı (hukuki metin, OAuth, senkron, App Store, geçici sürüm düğmesi, hukuk-ai). Kullanıcı girdisi gelene dek döngü regresyon/nabız modunda. |
| 394 | 2026-08-24 13:30 | **Altyapı incelemesi: PWA precache/offline yapılandırması (VitePWA/workbox) — doğru ve kaymaya-dayanıklı; çevrimdışı + iOS ana-ekran vaadi sağlam.** Çevrimdışı çalışma ve iOS ana ekrana kurulum uygulamanın çekirdek vaadi; row-350 davranışsal doğrulamıştı, bu tur yapılandırma düzeyinde incelendi. (1) **`globPatterns: ['**/*.{js,css,html,svg,png,woff2}']`** — precache derleme çıktısındaki TÜM js/css/html/svg/png/woff2'yi (fontlar dâhil) otomatik kapsıyor → elle URL listesi yok, kayma riski yok (yedek durumunun aksine, burada glob otomatik). (2) **`navigateFallback: 'index.html'`** — HashRouter SPA için her rota çevrimdışı yükleniyor. (3) **`registerType: 'autoUpdate'`** — SW kendini güncelliyor. (4) `includeAssets` favicon/apple-touch-icon'u garantiliyor. (5) Yapılan build: precache **24 giriş / 886 KiB** — workbox varsayılan 2 MiB dosya sınırının çok altında → sessiz dışlama yok (ileride bundle 2 MiB'i geçerse sessizce düşerdi; şu an 886 KiB güvenli). Manifest tam: standalone/portrait, tema renkleri token'larla uyumlu (#F7F6F3/#16262E), 192/512/maskable ikon, lang=tr, scope/start_url '.'. Kod düzeyinde çevrimdışı vaadi doğrulandı; kusur/kayma yok. Tüm mantık + güvenlik + altyapı yüzeyleri artık kod düzeyinde incelendi — inceleme taraması kapsamlı biçimde tamam. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 393 | 2026-08-24 12:39 | **Güvenlik incelemesi: CSV dışa aktarım (`csvHucre`/`raporCsv`) — formül enjeksiyonu + RFC 4180 kod düzeyinde doğru, tam test edilmiş.** Crypto incelemesinin tamamlayıcısı: ikinci güvenlik-hassas dışa-aktarma yolu (Excel formül enjeksiyonu gerçek bir tehdit). `csvHucre` incelendi: (1) **Formül enjeksiyonu** — `/^[=+\-@\t\r]/` ile başlıyorsa `'` öneki; OWASP tehlikeli-baş-karakter kümesinin tamamı (`= + - @` + tab + CR). (2) **RFC 4180 tırnaklama** — `/["\n\r;]/` içeriyorsa çift tırnakla sarılıp içteki tırnak ikilenir; `;` ayracı, tırnak, satır sonu doğru ele alınıyor. (3) **Sıra doğru** — önce önek sonra tırnak → `"'=…;…"` (neutralize eden `'` tırnak içinde kalıyor). (4) **Metin/sayı ayrımı** — `csvHucre` yalnız metin hücrelerine (başlık); tutarlar ayrı `csvTutar`'dan geçtiği için `-` öneki negatif sayıları bozmuyor. (5) BOM + `;` Türkçe Excel için. **Test durumu:** `raporSorgulari.test.ts` dört önek (`=+-@`) enjeksiyonunu, RFC 4180 `;`/`"` kaçışını, Türkçe virgül ondalık + BOM/ayraç'ı kapsıyor. Her iki güvenlik-kritik dışa-aktarma yolu (şifreli yedek + CSV) artık kod düzeyinde doğru + test edilmiş onaylandı. Güvenlik hatası/kapsam boşluğu yok. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 392 | 2026-08-24 11:26 | **Güvenlik incelemesi: `kripto.ts` (PBKDF2 + AES-GCM — PIN özeti + şifreli yedek) — doğru ve güvenli, kapsamlı test edilmiş.** Müvekkil verisi cihaz dışına yalnız bu katmandan (şifreli) çıktığı için kod-düzeyi güvenlik incelemesi yapıldı. Anahtar güvenlik özellikleri doğrulandı: (1) **Nonce/IV tekrarı YOK** — her işlemde taze 16-bayt rastgele tuz + 12-bayt rastgele IV, ayrıca her yedekte taze türetilmiş anahtar (tuz taze), yani IV çakışsa bile anahtar farklı → GCM nonce-reuse açığı yok. (2) **Güçlü KDF** — PBKDF2-SHA256, 210k iterasyon (OWASP 2023), 256-bit AES-GCM anahtar, `extractable:false`. (3) **Kimlik-doğrulamalı şifreleme** — AES-GCM; yanlış parola/kurcalama auth-tag uyuşmazlığıyla `decrypt` fırlatıyor → jenerik `SifreCozmeHatasi` (hangi olduğu sızmıyor). (4) Tuz/IV zarfta saklanıyor (gizli değil, güvenli), parola hiçbir yerde saklanmıyor. (5) `b64` karakter-karakter (spread değil) → büyük yedekte yığın taşması yok. Sabit-zamanlı-olmayan PIN karşılaştırması açıkça belgeli ve yerel geçit için gereksiz (doğru kapsam). **Test durumu:** `kripto.test.ts` round-trip, yanlış-parola-reddi, tuz benzersizliği (aynı PIN→farklı özet), düz-metin-sızmıyor, bozuk-girdi-reddi, Türkçe koruma — tam. Güvenlik hatası/kapsam boşluğu yok. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 391 | 2026-08-24 10:23 | **Doğruluk incelemesi: oran/yüzde hesaplarında sıfıra bölme (NaN/Infinity sızıntısı) sınıfı — tüm örnekler korumalı, kilit olan test edilmiş.** Sıfıra bölme, kullanıcıya "NaN%"/"Infinity" göstererek gösterge panelini bozabilecek gerçek bir bug sınıfı. Kod tabanındaki TÜM oran hesapları tarandı: (1) **`yuzdeDegisim`** (aylık tahsilat değişimi, "%12 geçen aya göre") — `onceki === 0` ise `null` döner (yeni kullanıcıda geçen-ay verisi yoksa bölme yok); `yuzdeMetni` `null`'ı "karşılaştırma yok"a çeviriyor (NaN/"null%" değil), `−` için tipografik eksi. (2) **`belgeIslemleri`** depolama oranı — `kota > 0 ? ... : 0`. (3) **`hazirlik`** hazırlık yüzdesi — `toplamAgirlik === 0 ? 100 : ...`. Üçü de sıfır paydayı koruyor. **Test durumu:** `para.test.ts` `yuzdeDegisim`i sıfır-payda dâhil test ediyor (`yuzdeDegisim(150, 0)).toBeNull()`) + `yuzdeMetni`. Yani hem korumalı hem (kilit yol) test edilmiş — UI'a NaN/Infinity sızamaz, düzeltilecek hata yok. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 390 | 2026-08-24 09:23 | **Doğruluk incelemesi: ICS (iCalendar/RFC 5545) dışa aktarma — örnek düzeyde uyumlu VE hâlihazırda kapsamlı test edilmiş; kusur/kapsam boşluğu yok.** ICS kullanıcı-yüzlü ve birlikte-çalışma-kritik (bozuk .ics Google/Apple/Outlook'a sessizce içe aktarılamaz). Klasik tuzaklar satır satır incelendi ve sağlam: (1) **Metin kaçışı** doğru sırada (`\` önce, sonra `;`, `,`, satır sonu). (2) **75-oktet satır katlama** UTF-8 bayt ölçümüyle (`TextEncoder`), kod-noktası bazında ilerleyip çok-baytlı Türkçe harf/em-tireyi asla bölmüyor, devam satırı boşlukla başlıyor (RFC §3.1'in en sık yanlış yapılan yeri — doğru). (3) **Tüm gün olay** `yerelGun` ile yerel güne yazılıyor (ham UTC-slice bir gün erken kaydırırdı), DTEND dışlayıcı ertesi gün. (4) CRLF her yerde; zorunlu VEVENT (UID/DTSTAMP/DTSTART) + VCALENDAR (VERSION/PRODID) alanları tam; UID'ler `olay-`/`sure-` önekiyle benzersiz. **Test durumu:** `ics.test.ts` bu iki ince noktayı da AÇIKÇA test ediyor (satır 108-127 yerel-gün UTC-sınırı; satır 170 çok-baytlı 75-oktet katlama) + kaçış/CRLF/iptal-atlama/benzersiz-UID. Yani hem doğru hem tam test edilmiş — eklenecek test, düzeltilecek hata yok. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 432 test** yeşil. |
| 389 | 2026-08-24 08:23 | **Tohum verisi çapraz-referans bütünlüğü guard'ı TAMAMLANDI (kısmi → bütünsel) — sarkan referans/yetim demo kaydı sınıfını önler.** `seed.test.ts` yalnız 3 referansı kapsıyordu (dosya→müvekkil, olay/görev→dosya). Kimlikler string olduğundan tip sistemi çapraz referansları zorlamıyor; sarkan tek bir referans demo'da yetim kayıt üretir (hiçbir dosyaya bağlı olmayan finans satırı, eksik müvekkilli belge vb.). KALAN tüm referanslar için 6 yeni kontrol eklendi (mevcut desenle): süre→dosya; finans→dosya + (varsa) müvekkil; belge→(varsa) dosya/müvekkil/finansKaydı; görev→(varsa) müvekkil/atananKullanıcı; olay→(varsa) müvekkil/süre; hareket→(varsa) dosya/müvekkil. İsteğe bağlı alanlar `gecerli()` ile "yoksa geçerli, varsa çözülmeli" mantığıyla kontrol ediliyor. Tümü geçti → mevcut tohum verisinde HİÇ sarkan referans yok; ayrıca ileride biri geçersiz kimlik yazarsa test kırmızıya döner. Davranış değişmedi (yalnız test); önceki 426 test geçiyor. `npm run build` geçerli, `npx vitest run` → **45 dosya / 432 test** (+6). |
| 388 | 2026-08-24 07:25 | **Benzer "kayma" tehlikeleri tarandı — yedek dışında un-guarded tehlike yok; sözde bir katalog-tutarsızlığı araştırıldı, kasıtlı çıktı (yanlış guard eklemekten kaçınıldı).** row-387'deki yedek guard'ı gerçek bir kayma tehlikesiydi; analog tehlikeler arandı. **Enum→görünüm eşlemeleri** (`olayGorunumleri`, tüm `*Etiketleri`) `Record<Enum,…>` tipli → `tsc -b` zaten eksiksizliği zorluyor (derleme-zamanı guard; runtime guard gereksiz). **Katalog kuralId'leri:** `SureKurali.id` union değil `string`, seed süreleri kuralId'i string literal ile referanslıyor ve katalog testi yalnız benzersizliği kontrol ediyor — potansiyel kayma gibi göründü. İncelendi: seed `sure-bilirkisi-demir` `kuralId: 'bilirkisi-ucreti'` katalogda YOK — AMA bu kasıtlı bir **manuel/mahkeme-kesin-süresi** (kanunReferansi: "HMK m. 283 — mahkeme kesin süresi"); süre kendi denormalize alanlarını (kuralAdi/kanunReferansi/sonTarih) taşıdığından katalog kaydı olmadan sorunsuz render/çalışıyor. Doğrulandı: HİÇBİR kod mevcut bir süre üzerinde `kuralBul(sure.kuralId)` yapmıyor (`kuralBul` yalnız SureHesapla'da kullanıcının canlı seçimi için; `undefined` güvenli döner). Yani "her süre.kuralId katalogda" bir değişmez DEĞİL — manuel süreler meşru; katalog-üyeliği zorlayan bir guard YANLIŞ olurdu. Sonuç: yedek, benzersiz gerçek un-guarded tehlikeydi; tip sistemi + denormalize süre modeli gerisini zaten doğru kapsıyor. Kaynak değişmedi; `npm run build` geçerli; **45 dosya / 426 test** yeşil. |
| 387 | 2026-08-24 06:28 | **Yedek/geri-yükleme kapsamı sertleştirildi — şema↔yedek kayması için build-zamanı guard testi (gerçek veri-kaybı sınıfını önler).** Yedek, local-first uygulamada verinin TEK güvencesi; en kritik altsistem. İnceleme: 13 DB tablosunun (`db.ts`) **hepsi** `yedek.ts`'te yedekleniyor VE geri yükleniyor — mevcut kusur YOK. Kod örnek düzeyde: yıkıcı `clear()`'dan ÖNCE doğrulama (`dogrula`), atomik transaction, sürüm-guard, parçalı base64 (yığın-güvenli), `ayarlar` için bulkPut, yerel-gün dosya adı. **Bulunan latent tehlike:** geri yükleme `db.tables`'ın TAMAMINI `clear()` ediyor ama yalnız açıkça listelenen tabloları `bulkAdd` ediyor → gelecekte şemaya eklenip yedeğe eklenmeyen bir tablo, geri yüklemede sessizce SİLİNİR (veri kaybı). Bu gelecekteki koşullu hata için: (1) `export const YEDEK_TABLOLARI` kapsam sözleşmesi + "şemaya tablo eklenince buraya ve yedekOlustur/geriYukle'ye ekle" uyarı yorumu eklendi; (2) `yedek.test.ts`'e guard testi: `YEDEK_TABLOLARI` sıralı === `db.tables` adları sıralı (probe ile node ortamında db.tables'ın erişilebilir olduğu doğrulandı — kod tabanı normalde testte db import etmez). Şema büyüyüp yedek güncellenmezse test kırmızıya döner. Davranış değişmedi (sabit + test); önceki 425 test hâlâ geçiyor. `npm run build` geçerli, `npx vitest run` → **45 dosya / 426 test** (+1). |
| 386 | 2026-08-24 05:23 | **Doğruluk incelemesi: tekrar serisi (seriesId) oluştur/düzenle/sil akışı — sağlam; "düzenlemede tekrar sessizce yok sayılıyor mu?" endişesi doğrulandı, hayır.** Tekrar eden olaylarda seri yönetimi klasik bug tuzağıdır (tek yineleme vs seri düzenleme/silme). İncelendi: **Model** — `olayEkle` seri için ayrı kayıtlar + ortak `seriesId` üretiyor (`tekrarGunleri` maddeleştirmesi tekrar.test.ts'te test edilmiş); doğru. **Düzenle** — `olayGuncelle` tek yinelemeyi günceller, `seriesId`'yi güncelleme setine koymadığı için korur (yineleme seride kalır). **Kritik endişe doğrulandı:** `olayGuncelle` `OlayGirdisi`'ndeki `tekrar/tekrarAdet`'i yok sayıyor — AMA bu sessiz-yok-sayma değil, çünkü `OlayForm` tekrar seçiciyi (`TekrarSecici`) YALNIZ oluşturma modunda (`!duzenleme`) render ediyor; düzenlemede seri üyesine salt-okunur bir not ("Bu kayıt N kayıtlık serinin parçası") gösteriyor, düzenlenebilir tekrar kontrolü değil. Satır 117 de tekrar alanlarını yalnız oluşturmada gönderiyor → uçtan uca tutarlı. **Sil** — `olaySil` tek yineleme, `olaySeriSil` primaryKeys+bulkDelete ile tüm seri; form seri üyesinde "Yalnızca bu" vs "Tüm seri (N)" doğru iki-yol onayı sunuyor. Genuine kusur yok; endişelenilen kontrol düzenlemede doğru şekilde gizli. Kaynak değişmedi; `npm run build` (tsc+vite) geçerli; **45 dosya / 425 test** yeşil. |
| 385 | 2026-08-24 04:23 | **Doğruluk incelemesi: takvim tarih-aritmetiği (ay ızgarası üretimi + ay/hafta gezinme) — hata sınıfının en yoğunu, sağlam; klasik tuzaklar bilinçli çözülmüş.** Tarih-ızgara matematiği (hafta başı, artık/eksik günler, DST, UTC gün-kayması, ay-taşması) klasik bug kaynağıdır ve `Takvim.tsx`'te birim-test dışı gömülü mantık. Satır satır incelendi: (1) **Ay ızgarası** — pazartesi-tabanlı ofset `(getDay()+6)%7` doğru; ayın 1'inden negatif gün ile haftanın pazartesisine geri sarma doğru; 42 hücre `setDate`+i ile **takvim-tabanlı** (DST-güvenli, ms-toplama değil) üretiliyor. (2) **Kritik bağımlılık doğrulandı (varsayılmadı):** `dateToIsoDate` YEREL getter'ları kullanıyor (`getFullYear/Month/Date`), `toISOString()` DEĞİL — yoksa yerel-gece-yarısı `d`, UTC+3'te önceki güne kayıp her hücreyi yanlış yerleştirirdi; `isoDateToDate` de `T00:00:00` ekleyip yerel ayrıştırıyor. (3) **Ay gezinme (`ayKaydir`)** klasik ay-taşması tuzağını doğru çözüyor: `ankraj` hep ayın 1'i (taşma yok), seçili gün yeni aya taşınırken `new Date(y, m+1, 0).getDate()` ile ayın uzunluğuna sabitleniyor → 31 Oca → 28 Şub (3 Mar değil; yorumda belgeli). (4) **Hafta gezinme** `setDate(±7)` — sınır/DST güvenli. Kod, timezone ve ay-taşması endişelerini açık yorumlarla belgeliyor; yazar bu bug'ların farkında ve kasıtlı çözmüş. Genuine kusur yok; kaynak değişmedi. `npm run build` (tsc+vite) geçerli; tam paket **45 dosya / 425 test** yeşil. |
| 384 | 2026-08-24 03:23 | **Doğruluk incelemesi: `useDosyaListesi` (dosya listesi süzme/sıralama/"sıradaki iş"/"duruşması yakın") — sağlam; iki sınır seçeneği yakından incelendi, ikisi de savunulabilir.** S7'yi dikkatli okuma bulmuştu; aynı yöntemle mantık-yoğun ama denetlenmemiş dosya-listesi kancası incelendi. **Sağlam bulunanlar:** Türkçe küçültmeli arama (başlık/konu/mahkeme/esasNo/karşıTaraf/müvekkil.ad); "sıradaki iş" = en yakın planlı duruşma ile en yakın açık sürenin ERKEN olanı (yerel-gün ile takvimle hizalı); ISO-lexicographic tarih karşılaştırmaları UTC damgalarında doğru; sıralama (yakın-iş→alfabetik Türkçe). **İncelenen iki sınır (ikisi de kasıtlı, hata değil):** (1) "sıradaki iş" bugünün başlangıcını (`>= bugun`) kullanır, `>= now` değil — bugün erken saatte geçmiş bir duruşma gün boyu "sıradaki iş" olarak görünmeye devam eder; bu iyi bir tercih (avukat "bugün 09:30 duruşma"yı gün boyu görmek ister). (2) `durusmasiYakin` üst sınırı `bugun + 14 gün` (yerel gece yarısı) olduğundan 14. günün gündüzündeki duruşma teknik olarak dışta kalır; bulanık bir "yakın" çipi için önemsiz (duruşma yine "Açık" ve takvimde görünür), değiştirmek istenen davranışı bozabilir. Genuine kusur yok; kaynak değişmedi. `npm run build` (tsc+vite) geçerli; tam paket **45 dosya / 425 test** yeşil. Açık hata yok; S7 kararı QUESTIONS.md'de bekliyor. |
| 383 | 2026-08-24 02:23 | **Veri katmanı birim-test kapsam taraması TAMAMLANDI — gerçek boşluk kalmadı (dürüst sonuç, sahte test üretilmedi).** Son 3 turdaki test-genişletme damarını sonuçlandırmak için tüm `src/data/*` modülleri denetlendi. Doldurulmuş gerçek boşluklar: `gorevSorgulari` (grupAnahtari + karsilastirGorevSatiri), `muvekkilSorgulari` (bekleyenOdemeHaritasi), `dosyaSorgulari` (finansOzeti). Kalan test-siz modüller incelendi ve **kasıtlı olarak atlandı** çünkü genuine birim-test hedefi içermiyorlar: `asistanSorgulari` → zaten test edilen `domain/asistan`'a ince sarmalayıcı; `hatirlatmaSorgulari` → tüm saf yardımcıları (`etkinTetik`, `tetikAni`, `pencere`, `pencereDe`, `gectiMi`, `aktifMi`, `ertelemeAktif`, `ofsetMetni`) `domain/hatirlatma`'dan geliyor ve orada tam test edilmiş; `bildirimTetikleyici` → `useEffect` kancası, saf mantık yok (`sessizSaatteMi` zaten test edilmiş); `*Islemleri` → DB-yazma fonksiyonları (kod tabanı bunları birim-test etmiyor; saf yardımcıları — `muvekkilTuruTahmin` vb. — zaten test edilmiş). Yani kod tabanının "yalnız saf fonksiyonu test et" felsefesine göre kapsam artık eksiksiz; ince-sarmalayıcı/DB-yazma için düşük değerli test üretmek yanlış olurdu. Bu tur kaynak değişmedi (yalnız inceleme); regresyon gate teyit: `npm run build` geçerli, `npx vitest run` → **45 dosya / 425 test** yeşil. Açık hata yok; S7 kararı QUESTIONS.md'de bekliyor, diğer işler `[!]` kullanıcı-kapılı. |
| 382 | 2026-08-24 01:23 | **`finansOzeti` (dosya gelir/gider özeti) test altına alındı — refactor gerekmeden; S7 kapsamı netleşti.** `dosyaSorgulari.ts`'teki `finansOzeti` zaten saf ve dışa açık ama hiç doğrudan testi yoktu; dosya detayı + müvekkil profili özetini besleyen finansal-kritik bir fonksiyon (en temiz kazanç: refactor gerekmedi). Yeni `dosyaSorgulari.test.ts`: 6 test — boş liste sıfır; gelir/gider yalnız ÖDENEN tutarı sayar (faturalanan değil — kısmi ödenen gelirde 3000, 8000 değil); bakiye = gelir−gider; bekleyen = `odendi` olmayanların kalanı; `odendi` bekleyene girmez; ve S7 karakterizasyonu. **S7 kapsam netleşmesi:** `finansOzeti.bekleyen` de (dosya düzeyi) gelir+gider'i birlikte sayıyor — yani S7'deki "varlık-bazlı bekleyen gelir+gider içerir" davranışı `bekleyenOdemeHaritasi` ile `finansOzeti` arasında TUTARLI bir konvansiyon (tek yerde kaza değil); yalnız büro geneli gider-only. Bu bilgi QUESTIONS.md S7'ye "Ek bilgi" olarak eklendi: karar iki fonksiyonu birlikte etkiler. Kaynak (finansOzeti) değişmedi; yalnız test + belge. `npm run build` geçerli, `npx vitest run` → **45 dosya / 425 test** (44/419 → +1 dosya/+6 test). Yeni tasarım hatası yok; finansal özet mantığı artık regresyon koruması altında. |
| 381 | 2026-08-24 00:23 | **Müvekkil bekleyen-ödeme toplamı test altına alındı + gerçek bir semantik tutarsızlık bulundu (SORU S7, kullanıcıya bırakıldı).** `muvekkilSorgulari.ts`'te müvekkil-bazlı bekleyen tutar toplaması (`kalan = tutar - odenenTutar`, yalnız `odendi` olmayan, müvekkile bağlı) kancanın içine gömülüydü ve test yoktu; para olduğu için önemli. Güvenli refactor: mantık `bekleyenOdemeHaritasi(finans)` saf fonksiyonuna çıkarıldı (kanca davranışı birebir korunur), `muvekkilSorgulari.test.ts` ile 7 test kilitlendi (tam kalan, kısmi ödeme kalanı, `odendi` atlanır, müvekkilsiz atlanır, aynı/farklı müvekkil toplama). **BULGU:** müvekkil rozeti `bekleyenOdeme` GELİR+GİDER tüm açık kalemleri topluyor; oysa büro genel özeti (`finansGenelOzetHesapla`) "bekleyen ödeme"yi YALNIZ GİDER sayıyor, tahsil edilmemiş geliri ayrı "bekleyen tahsilat" kabul ediyor (alan adı "ödeme" ile içerik ve genel özetle tutarsız). Bu bir para göstergesi olduğundan tahminle değiştirmedim: mevcut davranış korundu, `// SORU: S7` kod işareti + `docs/QUESTIONS.md` S7 (seçenekler + muhtemel doğru B: yalnız gelir) + PLAN "BEKLEYEN—KULLANICI" maddesi eklendi; karar kullanıcıya bırakıldı (`bana soru sorma` ilkesiyle uyumlu — sorular QUESTIONS.md kanalından). Refactor davranış-korumalı: önceki 412 test hâlâ geçiyor. `npm run build` geçerli, `npx vitest run` → **44 dosya / 419 test** (43/412 → +1 dosya/+7 test). |
| 380 | 2026-08-23 23:23 | **Test kapsamı genişletildi: görev zaman-grubu sınıflandırması + grup-içi sıralama birim testleri (yeni değer, güvenli refactor).** Nabız yerine gerçek geliştirme: `gorevSorgulari.ts`'te güvenlik-ilgili mantık (görevin GECİKMİŞ/BUGÜN/YARIN/YAKLAŞAN/VADESİZ/TAMAMLANAN grubuna atanması + grup-içi vade→öncelik sıralaması) `useLiveQuery` kancasının içine gömülüydü ve yalnız davranışsal doğrulanmıştı. Kod tabanının kendi desenine (saf fonksiyonu dışa aç + birim test, bkz. `durumNotuUret`) uyarak: `grupAnahtari` enjekte edilebilir `bugun` parametresiyle **export** edildi (kanca davranışı birebir korunur — parametresiz çağırınca yine bugünü kullanır), sıralama karşılaştırıcısı `karsilastirGorevSatiri` olarak çıkarıldı, kanca `liste.sort(karsilastirGorevSatiri)` kullanacak şekilde sadeleşti (davranış aynı). Yeni `gorevSorgulari.test.ts`: 10 test — 6 sınıflandırma (tamamlanan gecikmeyi geçersiz kılar; fark<0/=0/=1/>1 sınırları; vadesiz) + 4 sıralama (erken vade önce, vadesiz sona, aynı vadede yüksek öncelik önce, kararlı liste sıralaması). **Refactor davranış-korumalı:** önceki 402 testin hepsi hâlâ geçiyor. Regresyon ağı: `npm run build` (tsc+vite) geçerli, `npx vitest run` → **43 dosya / 412 test** (42/402 → +1 dosya/+10 test). Yeni tasarım hatası yok; güvenlik-kritik görev-listesi mantığı artık deterministik regresyon koruması altında. Kalan işler `[!]` kullanıcı-kapılı. |
| ⋯ | — | **Daha eski satırlar (379 ve öncesi) arşive taşındı → [`docs/PLAN-ARCHIVE.md`](PLAN-ARCHIVE.md).** Geçmiş korundu (silinmedi, taşındı); dosya-hafızası okunabilir kalsın diye. Durum özeti için yukarıdaki Doğrulama durumu bölümü. |
