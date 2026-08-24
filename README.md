<div align="center">

# JurisCalendar

**Hukuk profesyonelleri için akıllı dijital takvim ve dosya yönetim sistemi**

Duruşmalar, yasal süreler, müvekkil dosyaları, belgeler ve büro finansı —
tek bir sakin ekranda.

</div>

---

## Neden

Hukuk mesleğinde unutulan bir duruşma tarihi, kaçırılan bir itiraz süresi veya
zamanında yatırılmayan bir harç ciddi sonuçlar doğurur. JurisCalendar bu riski
azaltmak için tasarlandı: kritik tarihleri kendisi hesaplar, birden çok kez
hatırlatır ve her dosyanın eksiğini önünüze koyar.

## Ne yapar

| | |
|---|---|
| **Hukuka özel takvim** | Duruşma, icra takibi, müvekkil görüşmesi, dilekçe teslimi, arabuluculuk, keşif — türüne göre renklenmiş tek takvim |
| **Süre hesaplama** | Tebligat tarihini gir, istinaf/temyiz/cevap/itiraz sürelerini resmî tatil ve adli tatili gözeterek hesaplasın |
| **Çoklu hatırlatma** | 30/15/7/3/1 gün önce, aynı gün ve duruşmadan 1 saat önce — tamamen düzenlenebilir |
| **Dosya yönetimi** | Duruşmalar, süreler, belgeler, notlar, görevler, ilgili kişiler tek ekranda |
| **Hazırlık durumu** | Her dosya için otomatik kontrol listesi ve yüzdelik hazırlık seviyesi |
| **Finans takibi** | Harç, gider avansı, bilirkişi, keşif, noter, vekâlet ücreti; dekont ve makbuz arşiviyle |
| **Müvekkil yönetimi** | İletişim, açık/kapalı dosyalar, ödeme durumu, görüşme geçmişi |
| **Asistan** | Yaklaşan süreleri ve eksik işlemleri kendiliğinden tespit eder, sorularınızı yanıtlar |
| **Raporlar** | Aylık duruşma, görev, tahsilat ve dosya bazlı gelir–gider analizi |
| **Takvim senkronu** | Google, Apple ve Outlook takvimlerine ICS ile aktarım |
| **Güvenlik** | Uygulama kilidi (PIN + Face ID / Touch ID), şifreli yedek, KVKK'ya uygun tasarım |

## Durum

Çekirdek ürün tamamlandı: planlanan tüm özellikler (F0–F23) yazıldı, uygulama
GitHub Pages'te yayında ve iPhone ana ekranına kurulabilir. Kapsamlı test ve
kod incelemesi altında (432 birim testi). Geriye yalnızca **kullanıcı girdisi
gerektiren** adımlar kaldı: hukuki metin içerikleri (avukat hazırlar),
Google/Apple OAuth kimlik bilgileri, cihazlar arası senkron altyapısı ve App
Store yayını.

Güncel ilerleme ve açık ürün kararları: **[`docs/PLAN.md`](docs/PLAN.md)** ·
**[`docs/QUESTIONS.md`](docs/QUESTIONS.md)**. Arayüzün tasarım kaynağı:
**[`docs/DESIGN-REFERENCE.md`](docs/DESIGN-REFERENCE.md)**.

## Teknik

Local-first bir PWA. Veriler cihazın kendi IndexedDB'sinde tutulur; sunucuya
müvekkil verisi gönderilmez.

React 18 · TypeScript · Vite · Dexie · date-fns · vite-plugin-pwa

## Kurulum ve geliştirme

Node 20+ gerekir.

```bash
npm install       # bağımlılıklar
npm run dev       # geliştirme sunucusu (http://localhost:5173)
npm run build     # üretim derlemesi (tsc + vite) → dist/
npm run preview   # derlenmiş çıktıyı yerelde çalıştır (http://localhost:4173)
npm test          # birim testleri (Vitest)
```

> **Not:** Yerel `npm run build`/`preview`, uygulamayı sitenin kökünden
> (base yok) yayımlar. GitHub Pages dağıtımı ise alt yolda çalıştığı için
> `BASE_PATH=/MYLOVE/` ile derlenir — bunu iş akışı otomatik yapar, elle
> ayarlamanıza gerek yok.

## GitHub Pages'te yayınlama

Depo, `main` dalına her push'ta `.github/workflows/deploy.yml` ile kendini
GitHub Pages'e yayınlar.

1. Depo **Settings → Pages → Build and deployment → Source** kısmını
   **GitHub Actions** yapın (ilk kurulumda bir kez; site oluşturma yetkisi
   yalnızca depo sahibinde olduğu için bu adım gereklidir).
2. `main`'e push edin; **Actions** sekmesinden dağıtımı izleyin.
3. Yayın adresi: `https://<kullanici-adi>.github.io/MYLOVE/`

Uygulama tamamen istemci tarafında çalıştığından (HashRouter) Pages'in tek
sayfa uygulamaları için 404 hilesine ihtiyaç duymaz.

## iPhone ana ekrana ekleme

1. Safari ile yukarıdaki yayın adresini açın.
2. **Paylaş** düğmesine (kare + yukarı ok) dokunun.
3. **Ana Ekrana Ekle**'yi seçin, adı onaylayın.
4. Uygulama artık kendi simgesiyle tam ekran açılır ve çevrimdışı çalışır.

> Ana ekran simgesi **ekleme anında** sabitlenir. Yeni bir sürümde simge
> değişirse, kısayolu silip yeniden eklemek gerekir; içerik güncellemeleri
> için buna gerek yoktur (service worker kendini tazeler).

## App Store yolu (Capacitor)

PWA hazır olduğunda aynı kod tabanı [Capacitor](https://capacitorjs.com) ile
yerel bir iOS paketine sarılır — yeniden yazım yok:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios
npx cap init JurisCalendar app.juriscalendar --web-dir=dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios     # Xcode açılır
```

Xcode'da imzalama profilini seçip **Product → Archive** ile derleyin ve
App Store Connect'e yükleyin. Uygulama sunucu gerektirmediğinden yerel
bildirim, ICS dışa aktarma ve tüm veri cihazda kalır; App Store inceleme
notlarında "local-first, sunucusuz" olduğunu belirtmek gözden geçirmeyi
kolaylaştırır.

## Güvenlik ve gizlilik

- Müvekkil verisi **cihazdan dışarı çıkmaz**; üçüncü taraf analitiği yoktur.
- Uygulama kilidi PIN'i PBKDF2 ile özetlenip yalnızca özeti saklar; ham PIN
  hiçbir yerde durmaz. İsteğe bağlı Face ID / Touch ID (WebAuthn) desteklenir.
- Dışa aktarılan yedek, parola verilirse AES-GCM ile şifrelenir (`.jcenc`) —
  cihaz dışına çıkan tek veri budur ve şifresiz çıkmaz.
- Cihaz içi veriler IndexedDB'de tutulur; disk düzeyinde asıl korumayı
  işletim sisteminin cihaz şifrelemesi (iOS'ta varsayılan açık) sağlar.

## Uyarı

Hukuki süre hesaplamaları **bilgilendirme amaçlıdır** ve hukuki tavsiye
niteliği taşımaz. Sürelerin doğruluğunun teyidi kullanıcının sorumluluğundadır.
