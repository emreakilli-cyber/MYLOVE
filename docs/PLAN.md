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
- [ ] Dosya listesi: durum, esas no, mahkeme, müvekkil, hazırlık yüzdesi ile filtre/arama
- [ ] Dosya detayı sekmeleri: Genel, Duruşmalar, Süreler, Görevler, Belgeler, Finans, Notlar, İlgililer
- [ ] İlgili kişiler (karşı taraf, vekil, hâkim, bilirkişi, tanık)
- [ ] Dosya notları ve zaman çizelgesi

### F5 — Hukuki süre hesaplama (md. 5)
- [ ] Resmî tatil takvimi (sabit + dinî bayramlar, çok yıllı)
- [ ] Adli tatil kuralı (20 Temmuz – 31 Ağustos) ve sürenin uzaması
- [ ] Süre kataloğu: istinaf, temyiz, cevap dilekçesi, itiraz, karar düzeltme,
      ödeme emrine itiraz, ihtiyati haciz/tedbire itiraz, tespit, ıslah…
      (her biri kanun maddesi referansıyla)
- [ ] Tebligat tarihinden son güne hesaplama + hafta sonu/tatile denk gelirse ilk iş günü
- [ ] Hesaplanan süreleri takvime ve dosyaya otomatik işleme
- [ ] Görünür uyarı: bilgilendirme amaçlıdır, sorumluluk kullanıcıdadır

### F6 — Müvekkiller (md. 8)
- [ ] Müvekkil profili: iletişim, TCKN/vergi no, adres, etiketler
- [ ] Açık/kapalı dosyalar, ödeme durumu, notlar, görüşme geçmişi
- [ ] Hızlı iletişim (ara / e-posta / not ekle)

### F7 — Görevler (md. 9)
- [ ] Dosya bazlı ve genel görev listeleri, öncelik, vade
- [ ] Kullanıcıya atama (çok kullanıcılı büro senaryosu)
- [ ] Hazır görev şablonları (harç yatırılacak, dilekçe hazırlanacak, müvekkil aranacak…)

### F8 — Finans (md. 6, 7)
- [ ] Gider/gelir kalemleri: harç, gider avansı, bilirkişi, keşif, tebligat,
      arabuluculuk, noter, icra masrafı, müvekkil avansı, vekâlet ücreti
- [ ] Ödeme durumu, vade, yaklaşan ödeme hatırlatması
- [ ] Dosya bazlı gelir–gider özeti ve bakiye
- [ ] Makbuz/dekont arşivi: PDF/görsel yükleme, önizleme, kalemle ilişkilendirme

### F9 — Belge yönetimi (md. 12)
- [ ] PDF / Word / Excel / görsel / ses ekleme, IndexedDB'de saklama
- [ ] Etiketleme, arama, önizleme, indirme
- [ ] Depolama kullanımı göstergesi ve kota uyarısı

### F10 — Hazırlık durumu (md. 11)
- [ ] Dosya türüne göre kontrol listesi şablonları
- [ ] Otomatik tespit (duruşma girildi mi, vekâletname yüklendi mi, harç yatırıldı mı…)
- [ ] Yüzde hesabı, eksikler listesi, "bir sonraki adım" önerisi

### F11 — Hatırlatmalar ve bildirimler (md. 2, 3)
- [ ] Çoklu ofset motoru: 30/15/7/3/1 gün, aynı gün, 1 saat önce — kullanıcı düzenleyebilir
- [ ] Olay türüne göre varsayılan hatırlatma profilleri
- [ ] Cihaz içi bildirim (Notification API) + uygulama içi bildirim kutusu
- [ ] Kanal adaptörü: SMS / e-posta / push için arayüz + sunucusuz durumda net "yapılandırılmadı" hâli
- [ ] Sessiz saatler, tekrar erteleme (snooze)

### F12 — Asistan (md. 10)
- [ ] Kural motoru: yaklaşan süreler, eksik işlemler, ödenmemiş kalemler, boş alanlar
- [ ] Dosya özeti üretimi
- [ ] Soru–cevap arayüzü ("Bu dosyada eksik bir işlem var mı?")
- [ ] Opsiyonel LLM katmanı (kullanıcının kendi anahtarı, yerelde saklanır, varsayılan kapalı)

### F13 — Raporlar (md. 14)
- [ ] Aylık duruşma / görüşme / tamamlanan görev sayıları
- [ ] Yaklaşan süreler dağılımı, tahsilat grafiği
- [ ] Dosya bazlı gelir–gider analizi
- [ ] Tarih aralığı seçimi, CSV dışa aktarma

### F14 — Takvim senkronizasyonu (md. 13)
- [ ] ICS dışa aktarma (tüm takvim / tek olay)
- [ ] Abone olunabilir ICS akışı (webcal) yönergesi
- [ ] Google / Apple / Outlook için kurulum rehberi ekranı

### F15 — Güvenlik (md. 15)
- [ ] Uygulama kilidi: PIN + WebAuthn/biyometri
- [ ] Veritabanının parola türevli anahtarla şifrelenmesi (WebCrypto, PBKDF2/AES-GCM)
- [ ] Oturum zaman aşımı, arka planda ekran maskeleme
- [ ] Şifreli yedek dosyası dışa/içe aktarma
- [ ] KVKK notu, aydınlatma metni, veri saklama/silme ekranı

### F16 — Bitiş
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
| 5 | 2026-08-04 06:05 | **Pages yayında** (`https://emreakilli-cyber.github.io/MYLOVE/`) — depo sahibi ayarı açtıktan sonra dağıtım zinciri baştan sona geçti. Takvime olay ekleme/düzenleme/silme formu bitti: tür seçici, dosya bağlama, yerel tarih/saat seçicileri, tüm gün anahtarı, silme onayı. Varsayım: tarih ve saat için tarayıcının kendi seçicileri kullanıldı — iOS'ta yerel tekerlek arayüzü bizim yazacağımız her şeyden iyi; ABD biçimli tarih gösterimini dengelemek için altına Türkçe tarih ipucu kondu. Olay satırları artık düzenleme formuna gidiyor; süreler motorun ürettiği kayıt olduğu için elle düzenlenmiyor, dosyasına götürüyor. Uçtan uca tarayıcıda doğrulandı. |
| 4 | 2026-08-04 06:00 | **Dağıtım engeli bulundu ve F3 büyük ölçüde bitti.** Üç Pages çalışması da `configure-pages` adımında düşmüş; derleme ve testler her seferinde geçmiş, yalnızca yayın engellenmiş. Sebep: depoda Pages hiç açılmamış. `enablement: true` denendi, Actions token'ı Pages sitesi *oluşturma* yetkisine sahip değil ("Resource not accessible by integration") — bu ayarı yalnızca depo sahibi açabiliyor. Takvim ekranı: ay ızgarası, hafta şeridi (telefonda saat ızgarası okunmadığı için 7 günlük şerit tercih edildi), ajanda; olaylar ve hukuki süreler tek listede. |
| 3 | 2026-08-04 05:50 | **F2 tamam.** Genel bakış artık gerçek: hero, 2×2 istatistik, yaklaşan süreler, günün programı, görev listesi (tıklayınca tamamlanıyor ve hareket günlüğüne yazıyor), hazırlık durumu, son hareketler, güvenlik kartı. Videodaki dört rakam da veriden hesaplanıyor ve tutuyor. Ek olarak: Türkçe tarih/para yardımcıları (`toLocaleUpperCase('tr')` — "NISAN" değil "NİSAN"), ağırlıklı hazırlık motoru, canlı Dexie sorgu katmanı. Varsayım: hazırlık listesi en düşük yüzdeyi değil, **yakında işi olan** dosyalar arasında en düşüğü öne alıyor; duruşması olmayan bir dosyanın eksiği acil değil. Dolgu dosyalarına vekâletname + ödenmiş harç eklendi, yoksa sıralamayı yapay olarak dolduruyorlardı. 31 test yeşil. |
| 2 | 2026-08-04 02:40 | **F1 (repository hariç) tamam.** 13 tablo, alan modeli, Dexie şeması, tohum verisi ve JSON yedekleme. Varsayım: tohum tarihleri sabit değil **bugüne göre** kuruluyor — sabit tarihler bir hafta sonra ölü demoya döner. Tohum, videodaki rakamları gerçekten üretiyor (24 aktif dosya, bu hafta 8 duruşma / 2'si bugün, 17 bekleyen görev / 4 öncelikli, bu ay 184.500 ₺ / +%12); bu sayılar teste bağlandı. Para birimi kuruş tam sayısı, süreler gün (`IsoDate`) olarak saklanıyor. Tarayıcıda tohumlama doğrulandı, tekrar açılışta veri ezilmiyor. |
