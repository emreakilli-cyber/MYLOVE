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
- [ ] "Yeni görev ekle" şu an görev sayfasına yönlendiriyor; satır içi ekleme F7'de

### F3 — Takvim (şartname md. 1)
- [x] Ay / hafta / ajanda görünümleri
- [x] Olay türleri ve renkleri: duruşma, icra takibi, müvekkil görüşmesi, dilekçe teslimi,
      arabuluculuk, keşif, son tarih, diğer
- [x] Gün detayı, dosya bağlantısı
- [x] Hukuki süreler de takvimde (olaylarla tek zaman çizelgesinde)
- [x] Olay oluştur/düzenle/sil formu
- [ ] Tekrar eden olaylar (F3'ten arta kalan tek madde)

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
- [ ] Süre kataloğunu genişletme (karar düzeltme, tespit, ıslah, temyiz karşı cevap…) — sonraki tur

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
- [ ] Tekrar eden görevler (F3 tekrar eden olaylarla birlikte, sonraki tur)

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
- [ ] Etiketleme ve global belge arama ekranı (sonraki tur)
- [ ] Önizleme (görsel/PDF gömülü)
- [ ] Depolama kullanımı göstergesi ve kota uyarısı (F11 Ayarlar ile)

### F10 — Hazırlık durumu (md. 11)
- [ ] Dosya türüne göre kontrol listesi şablonları
- [ ] Otomatik tespit (duruşma girildi mi, vekâletname yüklendi mi, harç yatırıldı mı…)
- [ ] Yüzde hesabı, eksikler listesi, "bir sonraki adım" önerisi

### F11 — Hatırlatmalar ve bildirimler (md. 2, 3)
- [x] Çoklu ofset motoru: 30/15/7/3/1 gün, aynı gün, 1 saat önce — Ayarlar'da düzenlenebilir
- [x] Olay türüne göre varsayılan hatırlatma profilleri (duruşma / hukuki süre)
- [x] Cihaz içi bildirim (Notification API adaptörü) + uygulama içi bildirim kutusu (Bildirimler ekranı)
- [x] Kanal adaptörü (`services/bildirim.ts`): uygulama/push/SMS/eposta + net "yapılandırılmadı" hâli
- [x] Sessiz saatler
- [x] **Ayarlar ekranı** (son placeholder): profil, hatırlatma profilleri, kanallar, sessiz saatler, LLM anahtarı, yedekleme (dışa/geri), veri sıfırlama
- [x] Üst çubuk zil noktası gerçek hatırlatma sayısına bağlandı
- [ ] Snooze (tekrar erteleme) — sonraki tur

### F12 — Asistan (md. 10)
- [x] Kural motoru: yaklaşan süreler, ödenmemiş kalemler, yaklaşan duruşma, geciken görev, eksik vekâletname, düşük hazırlık
- [x] Büro geneli "Gündem" — bulgular önceliğe göre (kritik/uyarı/bilgi)
- [x] Dosya özeti üretimi ("durumunu özetle")
- [x] Soru–cevap arayüzü (niyet çıkarımı + önerilen sorular); şartname örneklerini birebir veriyor
- [ ] Opsiyonel LLM katmanı (kullanıcının kendi anahtarı, varsayılan kapalı) — arayüzde belirtildi, sonraki tur

### F13 — Raporlar (md. 14)
- [x] Aylık duruşma / görüşme / tamamlanan görev sayıları
- [x] Son 6 ay gelir-gider sütun grafiği (elle SVG)
- [x] Açık süreler aciliyet dağılımı (elle SVG halka)
- [x] Kategori bazlı gider dağılımı (yatay çubuk)
- [x] Dosya bazlı gelir–gider analizi
- [x] CSV dışa aktarma (UTF-8 BOM + ; ayraç, Excel-TR uyumlu)
- [ ] Serbest tarih aralığı seçimi (şimdilik son 6 ay / bu ay sabit) — sonraki tur

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
- [ ] **Geçici sürüm yenileme düğmesini kaldır** — `src/components/SurumYenile.tsx`,
      `AppShell` içindeki kullanımı, `shell.css` sonundaki blok ve `vite.config.ts`
      içindeki `define` bloğu birlikte silinecek
- [ ] Çevrimdışı davranış, boş/yükleniyor/hata hâlleri
- [ ] Erişilebilirlik: odak sırası, kontrast, ekran okuyucu etiketleri
- [ ] Vitest ile birim testleri (süre motoru, hazırlık skoru, hatırlatma ofsetleri)
- [ ] README: kurulum, GitHub Pages yayını, ana ekrana ekleme, Capacitor ile App Store yolu
- [ ] Sürüm etiketi ve son elden geçirme

---

## Oturum günlüğü

| # | Tarih (UTC) | Yapılan |
|---|---|---|
| 0 | 2026-08-03 22:45 | Video çözümlendi, görsel referans + yol haritası repoya işlendi. 3 saatlik bekleme kuruldu. |
| 1 | 2026-08-04 02:30 | **F0 tamam.** Vite+React+TS iskeleti, token'lar, gömülü fontlar, ikon seti, kabuk (üst çubuk + drawer), 13 yol, PWA (manifest/SW/ikonlar), Pages iş akışı. Varsayım: react-router yerine kendi hash router'ımız — kalan iki yüksek zafiyet yalnızca RSC modunda ve düzeltmesi yok, bizim kullanmadığımız kod yolu. `npm audit` sıfır. Derleme 157 kB JS (50 kB gzip). |
| 19 | 2026-08-05 02:35 | **F15 — Güvenlik tamam.** `services/kripto.ts`: PIN'i PBKDF2 (210k tur) ile özetleyip yalnızca özeti saklıyor (ham PIN hiçbir yerde durmaz), şifreli yedek AES-GCM+PBKDF2 ile parola türetip `.jcenc` üretiyor. `services/biyometri.ts`: WebAuthn platform doğrulayıcısıyla Face ID/Touch ID açışı — kayıt kimliği (credential id) saklanıyor, biyometrik veri cihazın güvenli bölgesinde kalıyor. `KilitKapisi`: açılışta + arka plandan seçilen süre (0/1/5/15 dk) sonra PIN/biyometri sorar, arka plandayken içerik maskelenir; PIN pad + "Face ID/Touch ID ile aç" düğmesi. Ayarlar → Güvenlik: PIN kur/değiştir/kaldır, kilitlenme süresi, biyometri etkinleştir/kapat, şifreli yedek parolası, KVKK notu. **4 yeni test** (toplam 71): PIN eşleşme/ham PIN sızmıyor/tuz benzersiz, şifrele-çöz turu, yanlış parola fırlatıyor, Türkçe karakter korunuyor, biyometri WebAuthn yoksa çökmeden false. Dürüst karar: IndexedDB düz kalıyor — her sorguda çözmek anahtarı zaten bellekte tutar, gerçek at-rest korumayı OS disk şifrelemesi (iOS'ta açık) verir; şifreleme cihaz dışına çıkan tek veriye (yedek) uygulandı. Kilit akışı tarayıcıda uçtan uca doğrulandı (PIN kur → kilitle → aç), konsol temiz. TS 5.9 `Uint8Array<ArrayBufferLike>`/`BufferSource` uyumsuzluğu `b64Coz`'da ArrayBuffer'ı doğrudan ayırarak çözüldü. |
| 18 | 2026-08-05 01:20 | **F14 — Takvim senkronu tamam.** `services/ics.ts`: RFC 5545 uyumlu iCalendar üretimi — metin kaçışı, 75 oktet satır katlama, zamanlı olaylar UTC damgayla, tüm-gün olaylar ve hukuki süreler VALUE=DATE ile. Takvimi dışa aktar ekranı: tüm takvimi .ics indir + Apple/Google/Outlook adım adım rehber + canlı abonelik (webcal) için dürüst "sunucu gerekir" notu. Olay formunda tek-olay "telefon takvimine ekle (.ics)". **8 yeni test** (toplam 61): biçim, UTC/tüm-gün ayrımı, UID benzersizliği, karakter kaçışı, iptal atlama. Tarayıcıda gerçek indirme doğrulandı (16 VEVENT). Karar: webcal canlı akış sunucu istediği için dosya dışa aktarma tercih edildi; değişiklikte yeniden indir. |
| 17 | 2026-08-04 21:20 | **F11 tamam — son placeholder kapandı.** Ayarlar ekranı: profil, olay türüne göre hatırlatma ofset profilleri (düzenlenebilir hap ızgarası), bildirim kanalları, sessiz saatler, LLM anahtarı (kapalı), JSON yedek indir/geri yükle, veri sıfırlama. `services/bildirim.ts` kanal adaptörü — SMS/e-posta sunucu gerektirdiği için açıkça "yapılandırılmadı", push için Notification API izni. Bildirimler ekranı: hatırlatmalar tabloda tutulmuyor, olay+süre×ofset profilinden **anlık türetiliyor** (senkron tutulacak ikinci kayıt yok); "Şimdi/Yaklaşan" grupları. Üst çubuk zili artık gerçek aktif hatırlatma sayısını gösteriyor. **Artık her menü hedefi gerçek — hiç tanıtım ekranı kalmadı.** Tarayıcıda doğrulandı (55 hatırlatma, ofset seçimi kaydediliyor). |
| 16 | 2026-08-04 17:25 | **F12 — Asistan tamam (kural motoru).** `domain/asistan.ts`: dosya bağlamından deterministik bulgular (açık süre aciliyeti, ödenmemiş gider, yaklaşan duruşma, geciken görev, eksik vekâletname, düşük hazırlık) + dosya özeti + niyet-çıkarımlı soru-cevap. Ekran: büro geneli öncelik sıralı "Gündem" + dosya seçip danışma. **8 yeni test** (toplam 53): şartname örnekleri birebir doğrulandı — "Bu dosyada eksik bir işlem var mı?" → "Bilirkişi ücreti henüz yatırılmadı (vade 9 Ağustos)."; istinaf 2 gün kritik bulgu. Karar: LLM değil kural motoru — örnekler veriden çıkıyor, çevrimdışı çalışır, yanlış üretmez, müvekkil verisi dışarı gitmez; LLM ileride opsiyonel/kapalı gelecek (arayüzde yazılı). Yakalanan hata: sabit "nın" iyelik eki "süresinın" gibi ünlü uyumu bozuyordu — ek kaldırılıp yeniden ifade edildi. Tarayıcıda doğrulandı. |
| 15 | 2026-08-04 13:45 | **F13 — Raporlar tamam.** Tümü elle çizilmiş SVG (tasarım kısıtı, harici grafik kütüphanesi yok): bu ay aktivite (duruşma/görüşme/tamamlanan görev), son 6 ay gelir-gider sütun grafiği, açık süreler aciliyet halkası (donut), kategori bazlı gider yatay çubukları, dosya bazlı gelir-gider listesi. CSV dışa aktarma UTF-8 BOM + noktalı virgül ayraçla (Excel Türkçe yerel ayarında düzgün açılsın). Yakalanan hata: yatay çubuk dolgusu `span` olduğu için `display:block` olmadan genişlik uygulanmıyordu — düzeltildi, oranlar doğrulandı (316/27/19/9 px). Grafikler token renklerini kullanıyor. **/loop 1h** geldi ama jenerik otonom vekil moduna geçmek yerine mevcut saatlik geliştirme cron'u (`e79b4057`) korundu — kullanıcının net isteği özellik geliştirme. Tarayıcıda doğrulandı. |
| 14 | 2026-08-04 13:30 | **F9 çekirdeği tamam.** Dosya detayı Belgeler sekmesi artık salt-okunur değil: PDF/Word/Excel/görsel/ses yükleniyor (Blob, IndexedDB, 25 MB sınır), indiriliyor, siliniyor; tür ad/MIME'den otomatik tahmin ediliyor. Ortak `belgeIslemleri.ts` (F8 dekont arşiviyle paylaşılan) kullanıldı. Tarayıcıda sahte PDF yükleme doğrulandı. Kalan F9: etiketleme + global belge arama, gömülü önizleme, depolama göstergesi — sonraki turlara. |
| 13 | 2026-08-04 13:20 | **F8 — Finans tamam.** Genel finans ekranı: büro özeti (bu ay tahsilat/gider, toplam bekleyen, 7 gün içi yaklaşan ödeme sayısı) + süzgeçli liste; tahsilat yeşil +, gider −. Form: 11 kategori (kategori seçince gelir/gider yönü otomatik), Türkçe tutar girişi (`metindenKurus`: "7.500,50"→750050 kuruş, canlı önizleme), ödeme durumu (bekliyor/kısmi/ödendi — kısmide ödenen tutar ayrı), vade. **Dekont/makbuz arşivi:** ortak `belgeIslemleri.ts` katmanı (F9'da da kullanılacak) ile PDF/görsel Blob olarak IndexedDB'ye yükleniyor, kalemle ilişkilendiriliyor, indirilebiliyor (25 MB sınır). Dosya detayı Finans sekmesi de tıklanabilir + kayıt ekleme bağlandı. Özet bu ay ₺184.500 tahsilat gösteriyor (referansla tutarlı). Tarayıcıda uçtan uca doğrulandı. |
| 12 | 2026-08-04 11:20 | **F7 — Görevler tamam.** Genel görev ekranı: görevler zamana göre gruplanıyor (gecikmiş/bugün/yarın/yaklaşan/vadesiz/tamamlanan) — avukatın ilk sorusu "neyi kaçırdım, bugün ne var", öncelik ikincil. Süzgeçler (açık/bana atanan/öncelikli/tamamlanan), 8 hazır şablon, kullanıcıya atama, oluştur/düzenle/sil. Not: "Bana atanan" varsayılan büro kullanıcısını (Ayşe Kaya) esas alıyor; tohumdaki görevler Mert/Elif'e atalı olduğu için bu süzgeç şu an boş — doğru davranış. **Döngü durumu:** kalıcı saatlik tetikleyici (`create_trigger`) onay kapısına takılıyor, kullanıcı onaylasa da geçmiyor (harness onay akışı sorunu). İlk oturumdaki 4 saatlik kalıcı Routine hâlâ çalışıyor (09:13 TR oturumunu o başlattı) — güvenilir taban bu; saatlik session-cron `e79b4057` container uyanıkken ek uyanış veriyor. Tarayıcıda uçtan uca doğrulandı. |
| 11 | 2026-08-04 10:20 | **F6 — Müvekkiller tamam.** Liste (isim/telefon/e-posta/etiket araması, açık dosya sayısı, bekleyen ödeme rozeti), profil (künye, hızlı iletişim tel:/mailto:, dosyalar, görüşme geçmişi satır içi ekleme), oluştur/düzenle formu. Kararlar: (1) "ödeme durumu" müvekkilin **tüm dosyalarındaki** bekleyen kalemlerin toplamı — avukat tek bakışta görsün; (2) bağlı dosyası olan müvekkil **silinmez, arşivlenir** (veri kaybını önlemek için), yalnızca hiç dosyası yoksa tam silinir. İkon setine telefon ve zarf eklendi. Cron `e79b4057` her saat :07'de (= TR :07, UTC+3 tam saat kaymalı) uyanıyor; sıradaki 11:07 TR. Tarayıcıda uçtan uca doğrulandı. |
| 10 | 2026-08-04 09:40 | **F5 — süre motoru tamam.** `domain/tatil.ts`: sabit resmî tatiller + 2024–2030 dinî bayram tablosu (Diyanet) + adli tatil. `domain/sureHesabi.ts`: 17 kurallı katalog ve hesaplama (tebliğ günü sayılmaz, hafta/ay/yıl, ay sonu sabitleme, tatil→ilk iş günü, adli tatil→7 Eylül). Arayüz: süre türü + tarih seç → son gün, ham son gün, gerekçeler, uyarı; dosyaya + takvime kaydediyor. **14 yeni test** (toplam 45): bilinen tarihler elle doğrulanıp sabitlendi, ayrıca tüm katalog×başlangıç kombinasyonlarında son günün her zaman çalışma günü olduğu taranıyor. Varsayımlar: (1) arefe ve 28 Ekim öğleden sonrası tam tatil sayılmadı — o günlerde süre "tatil saatinde" hâlâ dolabilir, kaydırma yönü hep ileri olduğu için kullanıcıya fazladan zaman göstermemek güvenli taraf; (2) dinî bayram tarihleri ±1 gün kayabilir, kapsam dışı yıllarda kullanıcı uyarılıyor. Tarayıcıda uçtan uca doğrulandı (istinaf 20 Tem → 7 Eylül; ödeme emri hafta sonu kaydırması). |
| 9 | 2026-08-04 09:30 | **F4 tamamlandı.** Dosya oluştur/düzenle/sil formu: dosya açarken müvekkil kaydı yoksa aynı ekranda "Yeni müvekkil ekle" ile oluşturuluyor (şirket eklerinden — A.Ş./Ltd./Şti. — tüzel kişi sezgisi). Dosya silmede bağlı tüm kayıtlar (olay, süre, görev, finans, belge, kişi, not) tek işlemde temizleniyor, yetim kayıt kalmıyor. Not ve ilgili kişi Notlar sekmesinde satır içi formla eklenip siliniyor. Tarayıcıda uçtan uca doğrulandı. Not: yerel önizleme base'siz derleme ister (`BASE_PATH` yalnızca Pages dağıtımında). |
| 8 | 2026-08-04 06:30 | **iOS ana ekran ikonu düzeltildi** (kullanıcı bildirdi: logo yerine "J" harfi çıkıyor). Sebep: `index.html`'de ikon yolları göreli (`./apple-touch-icon.png`) yazılmıştı; sayfa sondaki eğik çizgi olmadan (`…/MYLOVE`) açıldığında bu, alan adı köküne çözülüyor, dosya 404 dönüyor ve iOS uygulama adının ilk harfinden yedek ikon üretiyordu. Kök-mutlak yola (`/apple-touch-icon.png`) çevrildi; Vite bunu base ile `/MYLOVE/…` olarak yeniden yazıyor (derlemede doğrulandı). Ayrıca apple-touch-icon alfa kanalından arındırılıp düz RGB yapıldı (eski iOS saydamlık uyumu) ve `sizes="180x180"` eklendi. **Not: ana ekran ikonu ekleme anında sabitlenir; kullanıcının kısayolu silip yeniden eklemesi gerekiyor — sürüm yenileme düğmesi içeriği tazeler ama ikonu değiştirmez.** |
| 7 | 2026-08-04 06:25 | **Geçici sürüm yenileme düğmesi** eklendi (kullanıcı isteği). Üst çubukta derleme kimliğini gösteriyor; dokununca service worker'ı güncelletiyor, Cache Storage'ı boşaltıyor ve sorgu parametresiyle yeniden yüklüyor. Ana ekrana eklenmiş PWA'nın eski sürümde takılıp kalması silip yeniden ekleme gerektiriyordu, artık gerektirmiyor. Ayrıca workbox'a açıkça `skipWaiting` + `clientsClaim` eklendi — takılmanın asıl sebebi buydu. Cache Storage temizliği IndexedDB'ye dokunmuyor; tarayıcıda doğrulandı, 27 dosya yenileme sonrası yerinde. F16'ya silme maddesi eklendi. |
| 6 | 2026-08-04 06:15 | **F4 (okuma tarafı) tamam.** Dosya listesi: arama (başlık, müvekkil, esas no, mahkeme, karşı taraf), dört süzgeç, hazırlık yüzdesi, "sırada ne var" satırı; en yakın işi olan dosya üstte. Dosya detayı yedi sekme: Genel (künye + hazırlık kontrol listesi), Duruşmalar, Süreler, Görevler (tıklanabilir), Belgeler (indirilebilir), Finans (gelir/gider/bakiye/bekleyen), Notlar+İlgililer. Arama `toLocaleLowerCase('tr')` kullanıyor — "YILMAZ" ile "Yılmaz" eşleşiyor, varsayılan `toLowerCase` bunu kaçırırdı. Not: dolgu dosyalarına taban veri eklendiği için birçok dosya %100 çıkıyor; kontrol listesi "hazırlık", "risk" değil — yaklaşan süre ayrı gösteriliyor. |
| 5 | 2026-08-04 06:05 | **Pages yayında** (`https://emreakilli-cyber.github.io/MYLOVE/`) — depo sahibi ayarı açtıktan sonra dağıtım zinciri baştan sona geçti. Takvime olay ekleme/düzenleme/silme formu bitti: tür seçici, dosya bağlama, yerel tarih/saat seçicileri, tüm gün anahtarı, silme onayı. Varsayım: tarih ve saat için tarayıcının kendi seçicileri kullanıldı — iOS'ta yerel tekerlek arayüzü bizim yazacağımız her şeyden iyi; ABD biçimli tarih gösterimini dengelemek için altına Türkçe tarih ipucu kondu. Olay satırları artık düzenleme formuna gidiyor; süreler motorun ürettiği kayıt olduğu için elle düzenlenmiyor, dosyasına götürüyor. Uçtan uca tarayıcıda doğrulandı. |
| 4 | 2026-08-04 06:00 | **Dağıtım engeli bulundu ve F3 büyük ölçüde bitti.** Üç Pages çalışması da `configure-pages` adımında düşmüş; derleme ve testler her seferinde geçmiş, yalnızca yayın engellenmiş. Sebep: depoda Pages hiç açılmamış. `enablement: true` denendi, Actions token'ı Pages sitesi *oluşturma* yetkisine sahip değil ("Resource not accessible by integration") — bu ayarı yalnızca depo sahibi açabiliyor. Takvim ekranı: ay ızgarası, hafta şeridi (telefonda saat ızgarası okunmadığı için 7 günlük şerit tercih edildi), ajanda; olaylar ve hukuki süreler tek listede. |
| 3 | 2026-08-04 05:50 | **F2 tamam.** Genel bakış artık gerçek: hero, 2×2 istatistik, yaklaşan süreler, günün programı, görev listesi (tıklayınca tamamlanıyor ve hareket günlüğüne yazıyor), hazırlık durumu, son hareketler, güvenlik kartı. Videodaki dört rakam da veriden hesaplanıyor ve tutuyor. Ek olarak: Türkçe tarih/para yardımcıları (`toLocaleUpperCase('tr')` — "NISAN" değil "NİSAN"), ağırlıklı hazırlık motoru, canlı Dexie sorgu katmanı. Varsayım: hazırlık listesi en düşük yüzdeyi değil, **yakında işi olan** dosyalar arasında en düşüğü öne alıyor; duruşması olmayan bir dosyanın eksiği acil değil. Dolgu dosyalarına vekâletname + ödenmiş harç eklendi, yoksa sıralamayı yapay olarak dolduruyorlardı. 31 test yeşil. |
| 2 | 2026-08-04 02:40 | **F1 (repository hariç) tamam.** 13 tablo, alan modeli, Dexie şeması, tohum verisi ve JSON yedekleme. Varsayım: tohum tarihleri sabit değil **bugüne göre** kuruluyor — sabit tarihler bir hafta sonra ölü demoya döner. Tohum, videodaki rakamları gerçekten üretiyor (24 aktif dosya, bu hafta 8 duruşma / 2'si bugün, 17 bekleyen görev / 4 öncelikli, bu ay 184.500 ₺ / +%12); bu sayılar teste bağlandı. Para birimi kuruş tam sayısı, süreler gün (`IsoDate`) olarak saklanıyor. Tarayıcıda tohumlama doğrulandı, tekrar açılışta veri ezilmiyor. |
