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
| **Güvenlik** | Cihazda şifreli saklama, uygulama kilidi, KVKK'ya uygun tasarım |

## Durum

Geliştirme sürüyor. Güncel ilerleme ve sıradaki iş: **[`docs/PLAN.md`](docs/PLAN.md)**.
Arayüzün tasarım kaynağı: **[`docs/DESIGN-REFERENCE.md`](docs/DESIGN-REFERENCE.md)**.

## Teknik

Local-first bir PWA. Veriler cihazın kendi IndexedDB'sinde tutulur; sunucuya
müvekkil verisi gönderilmez.

React 18 · TypeScript · Vite · Dexie · date-fns

## Uyarı

Hukuki süre hesaplamaları **bilgilendirme amaçlıdır** ve hukuki tavsiye
niteliği taşımaz. Sürelerin doğruluğunun teyidi kullanıcının sorumluluğundadır.
