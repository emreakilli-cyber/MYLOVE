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
- [ ] Çevrimdışı davranış, boş/yükleniyor/hata hâlleri
- [ ] Erişilebilirlik: odak sırası, kontrast, ekran okuyucu etiketleri
- [ ] Vitest ile birim testleri (süre motoru, hazırlık skoru, hatırlatma ofsetleri)
- [x] README: kurulum, GitHub Pages yayını, ana ekrana ekleme, Capacitor ile App Store yolu
- [ ] Sürüm etiketi ve son elden geçirme

> **Not (madde 8):** F16'nın açık maddeleri (çevrimdışı/boş/hata hâlleri,
> erişilebilirlik, kalan testler, sürüm etiketi) planda zaten duruyor.
> Erişilebilirlik ayrıca F23'te ayrıntılandırıldı. "Sürüm yenile" düğmesi
> `[!]` işaretlendi ve şimdilik silinmeyecek.

---

### F17 — İlk açılış öğretici modu (onboarding)
- [ ] `src/onboarding/` altında akış; ilk açılışta (hukuki onay yoksa) otomatik başlar, tamamlanınca/atlanınca bir daha açılmaz (kalıcı bayrak)
- [ ] Sahne metinleri ve zamanlamalar `src/onboarding/script.ts` içinde **veri** olarak durur; bileşen script'i okuyup oynatır (metin/süre bileşene gömülü değil)
- [ ] Demo verisi yalnızca bellekte; gerçek Dexie tablolarına yazılmaz ve akış bitince/çıkışta iz bırakmaz (test: onboarding sonrası `db.dosyalar` sayısı değişmez)
- [ ] Maskeleme animasyonu tamamen hardcoded script; hiçbir gerçek modülü (LLM, kripto, db) çağırmaz
- [ ] Her sahnede "Atla" var; atlanınca doğrudan hukuki onaya (F18) gidilir; onay ekranı atlanamaz
- [ ] **S0** Açılış: logo + "Verileriniz bu cihazdan çıkmaz"; bulut ikonu belirir → üstü çizilir → telefon ikonuna döner
- [ ] **S1** Müvekkil kaydı: form kendi kendine yazılır (Kemal Arslan / 2026/1184 E. / Kira Alacağı / karşı taraf Nuray Öztürk / duruşma 14 Eylül 2026 / 45.000 TL tahsil edilmedi)
- [ ] **S2** Bildirim: "Duruşmaya 38 gün, cevap dilekçesi süresi 9 gün"; takvim açılır, geri sayım halkası dolar
- [ ] **S3** Ücret takibi: kırmızı "62 gündür tahsil edilmedi"; telefon ikonu parlar, KULLANICI dokunur → arama simülasyonu + dosyaya not düşme
- [ ] **S4** Acil iş: turuncu "karşı taraf cevap dilekçesi sundu, beyan için 6 gün"; "AI Asistan'a Yaz" butonuna KULLANICI dokunur
- [ ] **S5** AI Asistan tanıtımı: üç satır yetenek; mesaj kendi kendine yazılır, dosya eklenir, KULLANICI GÖNDER'e dokunur
- [ ] **S6a** Maskeleme: tarama ışığı geçer; isim, TCKN, adres, işyeri, IBAN, dosya no tek tek maskeye döner (her biri "tık" sesiyle); "İzmir" ve "14 Eylül 2026" yeşil çerçeveli kalır + "yetkili mahkeme için"/"süre hesabı için" etiketi
- [ ] **S6b** Onay ekranı: "7 bilgi maskelendi, kontrol edin" + "Orijinali Göster" tuşu (1 sn gerçek metni gösterip geri döner)
- [ ] **S6c** Bölünmüş ekran: sol "Cihazınız" / sağ "Yapay Zekâ"; hattan yalnızca maskeli metin akar; soldaki kasa ikonundaki eşleme tablosu hatta girmez, yerinde titrer; alt yazı "Sağa giden: maskelenmiş metin. Cihazda kalan: kim olduğu."
- [ ] **S6d** Dilekçe geri döner; "Gerçek bilgilerle değiştir" tuşuna KULLANICI dokunur, maskeler sırayla açılır; son satır "Dilekçe hazır. Kimliği hiç dışarı çıkmadı."
- [ ] **"Neyi nerede yaparsınız?"** sahnesi (S7'den önce): iki sütun (telefon | bilgisayar); maddeler sırayla sol/telefon tarafa düşer, çoğunluk solda ve görsel olarak baskın; altta "Bilgisayarınız kapalıyken de çalışır."; toplam ≤ 8 sn
- [ ] **S7** Özet: 📵 bulut yok · 🎭 AI'a giden metinde kimlik yok · ⏱ süreler kendiliğinden · 📶 internetsiz çalışır · 💻 AI kendi cihazınızda
- [ ] Dil denetimi: onboarding metinlerinde "hiçbir veri paylaşılmıyor" / "hacklenemez" / "%100 güvenli" **geçmez** (test: `script.ts` bu ifadeleri içermez); yalnızca "kimlik bilgileri gitmiyor" / "maskelenmiş metin gidiyor" dili

### F18 — Hukuki onay akışı (onboarding S8)
- [ ] Onay ekranında 5 kutucuk; hepsi başta işaretsiz; "Kabul et/Devam" yalnızca 5'i de işaretliyken aktif olur
- [ ] Her kutucuk, ilgili metin **sonuna kaydırılmadan** aktifleşmez
- [ ] 5 madde birebir: (Kullanım Şartları + Aydınlatma) / (şifre unutulursa kurtarılamaz) / (maskeleme tam anonimleştirme değil, onay kontrolü kullanıcıda) / (AI çıktısı taslak, doğruluk + meslek sırrı kullanıcıda) / (cihaz güvenliği kullanıcıda)
- [ ] Onay kaydı cihaza yazılır: tarih, saat, metin sürümü ve metin **hash'i** (test: onaydan sonra kayıt Dexie'de mevcut)
- [ ] Metin sürümü/hash değişince yeniden onay istenir; değişmediyse tekrar istenmez (test: aynı sürümde ikinci açılışta onay çıkmaz)
- [ ] Hukuki metinler **yer tutucu**; içerik [!] avukatta (bkz. BEKLEYEN). Uygulama yer tutucuyu + sürüm/hash'i gösterir

### F19 — Kayıt / giriş ve profil
- [ ] Kayıt formunda ad, soyad, ünvan alınır ve yerelde saklanır
- [ ] Ad/soyad/ünvan yan menü (drawer) altında görünür *(ana ekran selamlaması F2'de zaten adı gösteriyor — bkz. çakışma notu)*
- [ ] E-posta ile kayıt/giriş **arayüzü** (yerel profil); gerçek e-posta doğrulama sunucusu [!]
- [ ] Google ve Apple ile giriş butonları arayüzde; bağlanmamışken açıkça "yapılandırılmadı"; OAuth entegrasyonu [!]

### F20 — Cihazlar arası iş bölümü (devir teslim)
- [ ] Devir teslim ekranında "Telefonda yap" seçeneği **her zaman** var ve **varsayılan vurgulu** buton odur
- [ ] Süre tahminleri gerçek ölçümden hesaplanır (uydurma sabit sayı yok; test: tahmin fonksiyonu bir ölçüm kaynağından türetir)
- [ ] Bilgisayar kapalı/erişilemezse devir seçeneği **hiç** gösterilmez; iş sessizce telefonda yapılır
- [ ] Kullanıcı bir kez "telefonda yap" derse, aynı oturumda aynı iş tipi için tekrar sorulmaz (oturum içi tercih hatırlanır)
- [ ] Masaüstü varlığı algılama + gerçek iş transferi bir eşleme/sunucu gerektirir → adaptör arkasında, varsayılan "masaüstü yok → telefonda" (gerçek taşıma [!], bkz. BEKLEYEN)

### F21 — hukuk-ai arayüz sözleşmesi
- [ ] `packages/hukuk-ai`'nin sağlayacağı arayüz, **tüketici tarafta** tanımlanır (ör. `src/services/hukukAi.ts`); `packages/hukuk-ai/` klasörüne **DOKUNULMAZ**
- [ ] Arayüz tip düzeyinde: maskele (metin → maskeli metin + eşleme), demaskele, AI sorusu sözleşmelerini içerir; çalışma zamanı bağımlılığı yok
- [ ] `npm run build` geçer (yalnızca tip; gerçek uygulama başka session'da)

### F22 — Gizli günlükleme (redacting logger)
- [ ] Merkezi logger: ham veri diske **hiç** yazılmaz (redaksiyon çıktıdan önce; "yaz-sonra-sil" değil)
- [ ] Doğrudan `console.*`/ham log çağrısı **lint hatası** verir (ESLint kuralı); yalnızca merkezi logger'a izin
- [ ] Test: müvekkil verili bir hata fırlatılır; logger çıktısında hiçbir tanımlayıcı (isim, TCKN, IBAN, telefon, e-posta, adres) geçmez

### F23 — Erişilebilirlik (ileri yaş kitle; F16'yı genişletir)
- [ ] Büyük taban punto; kullanıcı yazı boyutunu artırabilir veya sistem büyütmesine uyar
- [ ] Metin/arka plan kontrastı WCAG AA (≥ 4.5:1) — denetlenebilir
- [ ] Tüm dokunma hedefleri min 44×44 pt
- [ ] `prefers-reduced-motion` desteklenir; onboarding dâhil animasyonlar sadeleşir/kapanır
- [ ] Ses ve titreşim Ayarlar'dan kapatılabilir; kapalıyken onboarding "tık" sesleri ve titreşim çalışmaz
- [ ] Görünür odak halkası + mantıklı odak sırası + tüm etkileşimli öğelerde ekran okuyucu (aria) etiketleri

---

## BEKLEYEN — KULLANICI
Bu maddeler kod tarafında hazırlanır ama tamamlanması **senin** elle yapacağın
adımları gerektirir; otonom döngü bunları `[!]` sayıp atlar.

- [!] **Hukuki metin içerikleri** (Kullanım Şartları, Aydınlatma Metni, sorumluluk maddeleri) — avukat hazırlayacak; uygulama yer tutucu + sürüm/hash yönetir (F18)
- [!] **Google/Apple OAuth** client ID'leri, "Sign in with Apple" sertifikaları ve e-posta doğrulama sunucusu (F19)
- [!] **Cihazlar arası gerçek devir/senkron altyapısı** — masaüstü varlığı algılama + iş transferi bir sunucu/eşleme ister (F20)
- [!] **Geçici "sürüm yenile" düğmesinin kaldırılması** — şimdilik test için DURUYOR (F16)
- [!] **App Store yayını** — Apple Developer hesabı, imzalama profili, Capacitor paketi yükleme (F16 devamı)

---

## Oturum günlüğü

| # | Tarih (UTC) | Yapılan |
|---|---|---|
| 0 | 2026-08-03 22:45 | Video çözümlendi, görsel referans + yol haritası repoya işlendi. 3 saatlik bekleme kuruldu. |
| 1 | 2026-08-04 02:30 | **F0 tamam.** Vite+React+TS iskeleti, token'lar, gömülü fontlar, ikon seti, kabuk (üst çubuk + drawer), 13 yol, PWA (manifest/SW/ikonlar), Pages iş akışı. Varsayım: react-router yerine kendi hash router'ımız — kalan iki yüksek zafiyet yalnızca RSC modunda ve düzeltmesi yok, bizim kullanmadığımız kod yolu. `npm audit` sıfır. Derleme 157 kB JS (50 kB gzip). |
| 27 | 2026-08-05 05:20 | **F12 — Opsiyonel LLM katmanı tamam.** `services/llm.ts` adaptörü (bildirim.ts deseninde): `llmDurumu` kapali/yapilandirilmadi/hazir; `llmSor` OpenAI-uyumlu `/chat/completions` gövdesiyle kullanıcının kendi uç noktasına POST atıyor (OpenAI/Azure/OpenRouter/Ollama/kendi vekili). Gizlilik kararı: varsayılan **kapalı**, kural motoru varsayılan asistan; açıkken cihazdan çıkan tek şey soru + `dosyaOzeti` (ham müvekkil kaydı/TCKN/tam finans değil). Ayarlar'da açınca uç nokta + model + anahtar alanları çıkıyor, ne gönderildiği net yazıyor. Asistan'da yapılandırılmışsa "Yapay zekâya sor" düğmesi; yanıtın altında "soru ve özet {host} adresine gönderildi" notu; ağ/HTTP hatalarında nazik mesaj, kural motoruna düşüş. **5 yeni test** (toplam 94): durum kapısı, sağlayıcı adı. Tarayıcıda uçtan uca doğrulandı: kapalıyken düğme yok + kural motoru çalışıyor; yapılandırınca düğme çıkıyor; bozuk uç nokta nazik hata veriyor (uygulama çökmedi). CORS gerçeği ve tarayıcıdan doğrudan çağrı sınırı arayüzde belirtildi. |
| 26 | 2026-08-05 04:55 | **F13 — Rapor serbest tarih aralığı tamam.** `useRaporVerisi` artık `(baslangic, bitis)` alıyor; sütun grafiği aralığın dokunduğu her ay için kova üretiyor (en çok 24), aktivite sayıları (duruşma/görüşme/tamamlanan görev), gider dağılımı, dosya bakiyesi ve toplamlar aralığa göre süzülüyor. Açık süre halkası bilinçli olarak **anlık durum** (o anki açık süreler) — tarihe bağlı değil, alt yazıda belirtildi. Raporlar ekranına hazır aralık çipleri (Bu ay / Son 3 / Son 6 / Son 12 / Bu yıl / Serbest) + serbest modda başlangıç-bitiş tarih girişleri (min/max ile tutarlı) eklendi; grafik alt yazısı seçili aralığı gösteriyor. `buAy*` alanları `donem*` olarak yeniden adlandırıldı. Tarayıcıda doğrulandı: son 6 ay → 6 çubuk, son 12 ay → 12 çubuk, bu ay → 1 çubuk, serbest → 2 tarih girişi; konsol temiz. 89 test yeşil. |
| 25 | 2026-08-05 04:30 | **F11 — Hatırlatma snooze tamam.** Hatırlatmalar tabloda tutulmadığı (olay+süre × ofsetten anlık türetildiği) için erteleme durumu Ayarlar'da `hatirlatmaErtelemeleri` haritasında saklanıyor: türetilmiş hatırlatma kimliği (`olayId-ofset` / `sureId-ofset`) → yeniden gösterileceği ISO an. `useYaklasanHatirlatmalar` ve aktif sayaç, erteleme aktifse tetiklemeyi ileri ana taşıyor; süresi geçen erteleme yok sayılıp hatırlatma özgün zamanında yeniden beliriyor (harita böylece sızmıyor, `hatirlatmaErtele` de eski kayıtları temizliyor). Bildirimler ekranında aktif ("Şimdi") hatırlatmalara 1 saat / 3 saat / yarın (09:00) / 1 hafta erteleme düğmeleri; ertelenmiş olanlarda "ertelendi" rozeti + "geri al". Karar: reddedilen değil ertelenen kayıt yeniden görünür — kaçırma riskini artırmamak için erteleme kalıcı gizleme değil. Tarayıcıda uçtan uca doğrulandı: 16 aktif → biri ertelendi (harita 1, aktif 15, rozet çıktı) → geri al (harita 0, aktif 16); konsol temiz. 89 test yeşil. |
| 24 | 2026-08-05 04:05 | **F2 hızlı görev + F5 süre kataloğu genişletme tamam.** Genel bakışta "Yeni görev ekle" artık forma yönlendirmek yerine **satır içi** açılıyor: başlık yaz, Enter'la kaydet (panelden ayrılmadan), "Detaylı" ile tam forma geçiş; Esc ile kapanır. Süre kataloğu 16 → **31 kural**: replik/düplik (HMK 136), istinaf dilekçesine cevap (347), yargılamanın iadesi (377), hakem kararına iptal (439); icra şikayet (İİK 16), gecikmiş itiraz (65), kambiyo ödeme emrine itiraz (168/5 gün), ihalenin feshi (134), istirdat (72); ceza eski hâle getirme (CMK 42), koruma tedbiri tazminatı (142); idari üst makama başvuru (İYUK 11), YD kararına itiraz (27/7 gün), idari eylemden tam yargı (13). Karar düzeltme HMK ve İYUK'ta kaldırıldığından bilinçli eklenmedi (hukuki doğruluk). adliTatileTabi belirsiz/kısa usul sürelerinde güvenli tarafta (false) tutuldu. **8 yeni test** (toplam 89): yeni kuralların ham son günü elle sabitlendi, katalog sayısı ve id benzersizliği, tüm katalog×başlangıç taraması hâlâ çalışma günü veriyor. Tarayıcıda doğrulandı: panelden görev eklendi (21→22), yeni kurallar süre seçicisinde çıkıyor; konsol temiz. |
| 23 | 2026-08-05 03:35 | **F3 + F7 — Tekrar eden olay ve görevler tamam.** Yeni `domain/tekrar.ts`: saf üreteç `tekrarGunleri` (günlük / hafta-içi / haftalık / iki-haftalık / aylık / yıllık; ay-sonu taşması date-fns ile kırpılıyor, hafta-içi hafta sonlarını atlıyor, azami 60). Karar: kural saklamak yerine seri **maddeleştiriliyor** — oluşturmada her yineleme ayrı kayıt, ortak `seriesId` ile bağlı; böylece takvim/gösterge/ICS/hatırlatma okuma yolları hiç değişmiyor, tek yinelemeyi düzenlemek doğal kalıyor. DB v2: `olaylar`/`gorevler`'e `seriesId` indeksi (toplu silme için; eski tablolar devrediyor). Paylaşılan `TekrarSecici` bileşeni her iki forma eklendi (yalnızca yeni kayıtta); silmede seri üyesi için "yalnızca bu / tüm seri (N)" seçeneği. Görevde tekrar vade tarihi gerektiriyor (yineleme vadeyi taşır), vade yoksa uyarı. **8 yeni test** (toplam 87): bilinen tarihlerle günlük/haftalık/aylık/yıllık/hafta-içi ve sınır. Tarayıcıda uçtan uca doğrulandı: haftalık×4 olay tek seriesId ile oluştu, "tüm seri" hepsini sildi; aylık×3 görev 15 Eylül/Ekim/Kasım vadeleriyle oluştu, vadesiz tekrar reddedildi; konsol temiz. |
| 22 | 2026-08-05 03:05 | **F9 — Belge yönetimi tamam + son placeholder kapandı.** `/ara` artık gerçek **genel arama** ekranı (tanıtım ekranı yerine): dosya (başlık/esas no/mahkeme/karşı taraf/konu), müvekkil (ad/kimlik/telefon/e-posta/etiket), görev (başlık/açıklama) ve belge (ad/etiket/not) tek kutudan taranıyor (`aramaSorgulari.ts`, Türkçe `toLocaleLowerCase('tr')`, ≥2 harf, canlı Dexie sorgusu, gruplu sonuçlar). **Belge önizleme** (`BelgeOnizleme`): görsel/PDF/ses gömülü açılıyor, önizlenemeyen türde indirmeye yönlendiriyor; object URL kapanışta serbest bırakılıyor, Esc ile kapanıyor — hem aramada hem dosya detayı Belgeler sekmesinde. **Etiketleme:** belge satırında etiket ekle/sil (Enter ile), tekilleştirme; arama etiketlerle eşleşiyor. **Depolama göstergesi:** `navigator.storage.estimate` ile kullanılan/kota çubuğu + belgelerin toplam boyutu, %85 üstünde kırmızı uyarı. Tarayıcıda uçtan uca doğrulandı: "Demir" → dosya+müvekkil grupları; belgeye "acil" etiketi eklenip yeniden yüklemede korundu; önizleme açıl/Esc kapan; konsol temiz. Placeholder bileşeni artık hiçbir route'ta kullanılmıyor. |
| 21 | 2026-08-05 02:45 | **F16 (kısmi) — README genişletildi.** Kurulum/geliştirme komutları (dev/build/preview/test), yerel base-siz derleme vs Pages `BASE_PATH=/MYLOVE/` notu, GitHub Pages yayın adımları (Source → GitHub Actions, `main`'e push, yayın adresi), iPhone Safari ile ana ekrana ekleme adımları + simge sabitleme uyarısı, Capacitor ile App Store paketleme yolu (init/add ios/sync/Xcode Archive) ve dürüst güvenlik/gizlilik bölümü (PIN PBKDF2 özeti, Face ID/Touch ID, şifreli `.jcenc` yedek, OS disk şifrelemesi). Deploy iş akışı doğrulandı: `main` push tetikliyor, `BASE_PATH=/MYLOVE/` ayarlı. F16'da kalanlar: erişilebilirlik geçişi, boş/yükleniyor/hata hâlleri, sürüm etiketi ve geçici "sürüm yenile" düğmesinin kaldırılması — düğme kullanıcı hâlâ test ettiği için şimdilik duruyor. |
| 20 | 2026-08-05 02:40 | **F10 — Hazırlık durumu tamam.** Hazırlık motoru (`domain/hazirlik.ts`) artık **dosya türüne duyarlı**: her tür için ayrı kontrol listesi şablonu (`TUR_MADDELERI`). İcra takibinde duruşma ve gider avansı beklenmez, "mahkeme" → "İcra dairesi", "esas no" → "takip no"; ceza (kamu davası) harçsız ve gider avanssız; arabuluculukta mahkeme/esas no/harç/duruşma/gider avansı yok; tüketici davası harçtan muaf (6502 s.K. m. 73/2); idari yargı dosya üzerinden karar verdiği için duruşma beklenmez. Uygulanmayan madde yüzdeye hiç katılmaz — icra dosyası "duruşma yok" diye haksız düşmüyor. Maddeler yine tamamen veriden okunuyor (elle işaretleme yok), ağırlıklı yüzde ve en ağır eksikten "sıradaki adım" korunuyor. **8 yeni test** (toplam 79): tür bazlı madde seçimi, icra etiket düzeltmeleri, tam dosyada %100, kaçmış sürenin etkisi, icra'nın duruşmasızlıktan ceza almaması. Tarayıcıda 4 dosya detayında kontrol listesi + yüzde doğrulandı (Demir İnşaat %82, Özkan %100), konsol temiz. |
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
