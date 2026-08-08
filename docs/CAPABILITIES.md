# Yetenek Sınırları — `packages/hukuk-ai`

> **Tek kural:** Telefon önceliklidir. Devir teslim **son çaredir**, varsayılan
> değildir. Bir iş telefonda makul sürede ve kalitede yapılabiliyorsa **telefonda
> yapılır**. "Masaüstünde daha kaliteli olur" cümlesi bu belgede gerekçe sayılmaz;
> gerekçe ancak ölçülebilir bir fiziksel sınırdır: **bellek**, **bağlam uzunluğu**,
> **işlem süresi**.

> **İkinci kural (bölünebilirlik testi):** Bir iş masaüstüne gitmeden önce şu
> soruyu geçmek zorundadır: *"Bu işi parçalara bölüp telefonda sırayla yapabilir
> miyim?"* Cevap "evet, yavaş olur ama olur" ise iş **A listesindedir**. Yavaşlık
> devir gerekçesi değildir. Kullanıcı bilgisayarına muhtaç kalmaz.

Bu belge `packages/hukuk-ai` paketinin kapsamını tanımlar. Kod içermez; kapsam
sözleşmesidir. Paketteki her yetenek A, B veya C bölümünde yerini bulmak
zorundadır. B'ye madde koymanın tek yolu, işin **bölünemez** olduğunu göstermektir.

---

## 0. Cihaz bütçesi (tüm kararların dayanağı)

Aşağıdaki değerler hedef cihaz sınıfı için **tasarım varsayımıdır**. Uygulama ilk
açılışta bir kalibrasyon turu koşar (§C.0) ve gerçek ölçümü cihaz başına saklar;
bu tablo yalnızca ölçüm yokken kullanılan başlangıç değeridir.

| Bütçe | Varsayılan hedef | Neden bu sayı |
|---|---|---|
| Uygulama tepe belleği | **≤ 1,2 GB** | iOS jetsam sınırı; aşan uygulama öldürülür |
| Cihaz içi dil modeli | 1–3 B parametre, 4-bit | ~0,7–1,8 GB ağırlık + KV önbelleği bu bütçeye sığar |
| Kullanılabilir bağlam | **4.000–8.000 token** | Üstünde KV önbelleği ve ön dolum süresi bütçeyi taşırır |
| Ön dolum (prefill) | ~150–300 token/sn | 8.000 token ≈ 30–55 sn yalnız okuma |
| Üretim (decode) | ~12–25 token/sn | 1.000 token çıktı ≈ 40–80 sn |
| Gömme (embedding) | ~40–80 parça/sn | Dizin kurma hızını bu belirler |
| Ön planda kesintisiz çalışma | ekran açıkken sınırsız; arka planda ~30 sn + `BGProcessingTask` fırsatçı | iOS arka plan yürütmeyi askıya alır |
| Yerel dizin | ≤ 400 MB | 8-bit 384 boyutlu gömme ≈ 384 B/parça → ~1 M parça |

**Tasarım sonucu:** Bağlam ve süre sınırları **bölünebilir** sınırlardır — iş
parçalanarak aşılır. Bölünemeyen tek sınır, **tek bir atomik adımın yerleşik
bellek ayak izidir**. B listesi yalnızca bu sınırdan oluşur.

---

## A.0 — Aşamalı işlem kalıbı (staged processing)

A listesindeki "aşamalı işlem" etiketli her madde bu kalıba uyar. Kalıp bir kez
burada tanımlanır, maddelerde tekrar edilmez.

1. **Parçala.** Girdi, tek geçişte sığan birimlere bölünür (metin: 1.000–1.500
   token; ses: 20–40 sn konuşma bloğu; arşiv: belge).
2. **Sırala ve kuyruğa al.** İş kalıcı bir kuyruğa yazılır. Uygulama kapansa,
   telefon yeniden başlasa, batarya bitse bile kuyruk durur ve bekler.
3. **Ara ürünü diske yaz.** Her parçanın çıktısı anında saklanır. Hiçbir aşama
   yalnız bellekte tutulmaz — çökme, yapılan işi geri almaz.
4. **Sürdür.** İş her zaman **kaldığı parçadan** devam eder; baştan başlamak yok.
5. **Birleştir (reduce).** Ara ürünler ya deterministik olarak (birleştirme,
   çakışma çözümü) ya da bir üst seviye kısa geçişle özetlenir. Gerekirse
   birden çok seviye: parça → bölüm → belge → dosya.
6. **İlerlemeyi göster.** "%37 — 80 sayfanın 30'u — tahminî kalan 4 dk 10 sn",
   ölçülen hıza dayalı. Kullanıcı ekranı kapatıp sonra dönebilir.
7. **Kalite notunu yaz.** Aşamalı üretilen çıktının başına, hangi bilginin hangi
   aşamada özetlenip elendiği not düşülür. Kullanıcı neyi okuduğunu bilir.

**Aşamalı işlemin bedeli dürüstçe söylenir:** Çok seviyeli özetleme kayıplıdır;
ayrıntı üst seviyelere çıkarken elenir. Bu bir kalite farkıdır — ama işin
**yapılamaması** değil. Kalite farkı devir gerekçesi değildir (bkz. ikinci kural);
yalnızca çıktının üstünde not olarak görünür.

---

## A) TELEFON — TEK BAŞINA, DEVİR YOK

Bu listedeki hiçbir madde için "yapılamaz" denmez. Girdi büyükse iş bölünür,
kuyruğa alınır, ilerleme gösterilir ve kaldığı yerden sürer — ama telefonda biter.

### A1. Müvekkil, dosya, duruşma, ücret kaydı ve takibi
- **Nasıl:** Model yok. Dexie (IndexedDB) üzerinde CRUD + indeksli sorgu.
- **Bütçe:** 10.000 kayıt ≈ 15–40 MB; sorgu < 20 ms.
- **Neden telefonda:** Hesaplama yükü yok. Uygulamanın çekirdeği; çevrimdışı ve
  anında çalışmak zorunda.

### A2. Süre hesabı ve bildirimler
- **Nasıl:** Tümüyle deterministik kural motoru — `date-fns` + Türk usul süreleri
  tablosu (tebligat, istinaf, temyiz, cevap, ıslah, adli tatil 20 Temmuz–31
  Ağustos, hafta sonu/resmî tatil kaydırması). Yerel bildirim.
- **Bütçe:** Tek hesap < 1 ms; 500 dosyanın tamamı < 100 ms.
- **Sınır:** Çıktı **bilgilendirme amaçlıdır**; her ekranda ve her hesap
  çıktısında bu uyarı görünür, kullanıcının teyidi esastır.

### A3. Maskeleme — **tam kapasite, kısıtsız**
- **Nasıl:** İki katman, ikisi de cihazda:
  1. **Kural katmanı (deterministik):** TCKN (11 hane + doğrulama algoritması),
     IBAN (mod-97), telefon, e-posta, plaka, tarih, dosya/esas/karar no, tapu
     ada-parsel, tutar; ayrıca cihazdaki müvekkil/karşı taraf/vekil kayıtlarından
     üretilen yerel sözlükle birebir ad eşleşmesi.
  2. **NER katmanı (bağlamsal):** Kalan aday kişi/kurum/adres/işyeri parçaları
     için kısa pencereli (≤ 512 token) cihaz içi etiketleme, akan parçalar
     üzerinde. **Lokal, API yok.**
- **Geri dönüşüm:** Maske tablosu (gerçek değer ↔ maske token) yalnız cihazda,
  şifreli. Tablo **hiçbir koşulda serialize edilip ağa gönderilmez.**
- **Bütçe:** 50 sayfa (~150.000 karakter) kural geçişi < 250 ms; NER geçişi akan
  biçimde sayfa başına ~0,3 sn.
- **Neden telefonda ve neden kısıtsız:** Maskeleme, verinin cihazdan çıkma
  koşuludur. Devre alınırsa maskesiz veri ağa çıkar. Bu yüzden maskelemenin
  **hiçbir eşiği, hiçbir devir yolu, hiçbir düşük kalite modu yoktur.** Maskeleme
  koşamıyorsa dışarı hiçbir şey gitmez — iş durur, devredilmez.

### A4. Belgeden süre, taraf, talep, tutar çıkarma — *aşamalı işlem*
- **Nasıl:** Parça-parça çıkarım. Her parça sabit şemaya (taraf, sıfat, talep
  kalemi, tutar, para birimi, tarih, süre türü) yazılır; parçalar deterministik
  birleştirilir, çakışmalar kuralla çözülür (en spesifik kayıt kazanır, çelişki
  kullanıcıya sorulur).
- **Bütçe:** Sayfa başına ~1,5–3 sn. 30 sayfa ≈ 60–90 sn.

### A5. Belge özetleme — *aşamalı işlem*
- **Nasıl:** Hiyerarşik özet — parça → bölüm → belge. Her seviye ≤ 4.000 token
  pencerede. Ara sonuçlar diske yazılır.
- **Bütçe:** Sayfa başına ~4–8 sn. 40 sayfa ≈ 3–5 dk; 300 sayfa ≈ 25–40 dk,
  kuyrukta, kesilebilir ve sürdürülebilir.

### A6. Yargıtay kararı ve mevzuat arama, özetleme, olayla ilişkilendirme
- **Nasıl:** Arama — cihazdaki gömülü dizinde (8-bit gömme + BM25 karması)
  yaklaşık komşu araması; 200.000 parçada ilk-50 sonuç < 150 ms. Özetleme — tek
  karar tipik 2.000–6.000 token, tek/iki geçiş. İlişkilendirme — kullanıcının
  olay özeti kısa (< 800 token); her aday karar **ayrı ayrı** olay özetiyle tek
  pencerede değerlendirilir. İlk-K karar için K bağımsız kısa geçiş.
- **Ağ:** İnternete çıkan tek modül budur (§A ve `PROTOCOL.md`). Giden sorgu
  **A3 maskelemesinden geçmek zorundadır**; kodda zorlayıcı kontrol vardır.

### A7. Şablon tabanlı evraklar
Kapsam: ihtarname, harç hesabı, basit dilekçeler, kısa beyan dilekçesi, tevkil ilanı.
- **Nasıl:** İskelet deterministik şablon motorudur; alanlar dosya/müvekkil
  kayıtlarından ve A2 süre motorundan dolar. Model yalnız serbest metin
  boşluklarını (200–600 token) yazar.
- **Bütçe:** Belge başına ≈ 20–60 sn.

### A8. Eski dilekçelerden üslup profili çıkarma — *aşamalı işlem*
- **Nasıl:** Birikimli toplama. Her dilekçe **tek tek, bağımsız** işlenir;
  öznitelikler birkaç KB'lık tek profile eklenir: cümle uzunluğu dağılımı,
  paragraf uzunluğu, kalıp ifade sıklığı, hitap/kapanış kalıpları, başlık ve
  numaralandırma düzeni, atıf biçimi, sık kullanılan terim seti; her belgeden
  2–3 temsilî paragraf örneklenip profile iliştirilir.
- **Bütçe:** Belge başına ≈ 2–5 sn, artımlı. 200 dilekçe arka planda birkaç
  oturuma yayılır; kullanıcı beklemez.
- **Neden bağlam sınırı bağlamıyor:** Profil, N belgenin **aynı anda** bağlamda
  olmasını gerektirmez.

### A9. Mevcut dilekçeyi düzenleme, kısaltma, redaksiyon
- **Nasıl:** Bölüm bazlı. Kullanıcı bir paragraf/başlık seçer; model o bölümü
  üslup profili (A8) + komşu bağlam ile ≤ 2.000 token penceresinde yeniden yazar.
  Değişiklik fark (diff) olarak gösterilir, kabul/ret bölüm bölüm.
- **Bütçe:** Bölüm başına ≈ 15–40 sn.

---

### Bölünebilirlik testinden geçip B'den A'ya taşınan maddeler

Aşağıdaki dört madde önceki sürümde B listesindeydi. Bölünebilirlik testi
uygulandı, dördü de geçti, A'ya alındı.

### A10. Bütünsel dosya sentezi — *aşamalı işlem* ⟵ eski B1
"Bu dosyanın tamamını oku; belgeler arası çelişkileri, kronoloji
tutarsızlıklarını çıkar, bütünsel strateji öner."

- **Eski gerekçe:** 800 sayfa ≈ 320.000 token, cihaz penceresi 8.000 token.
- **Nasıl bölünüyor — üç aşama, hiçbiri uzun bağlam istemiyor:**
  1. **Olgu çıkarma (map).** Her belge tek tek işlenir; çıktı, kaynağı ve sayfa
     numarası işaretli **yapılandırılmış olgu kayıtlarıdır** (kim, ne, ne zaman,
     ne kadar, hangi belgede). Serbest metin özeti değil — kayıt. 800 sayfa →
     ~400–1.200 olgu kaydı ≈ 20.000–60.000 token, ama **hiçbir zaman hepsi aynı
     anda bağlamda değil.**
  2. **Çelişki tespiti — deterministik daraltma + kısa karşılaştırma.** Çelişki
     aramak O(n²) karşılaştırma gerektirmiyor: olgu kayıtları alana göre
     indeksleniyor (aynı kişi + aynı tarih, aynı tutar kalemi, aynı olay). Yalnız
     **aynı kovaya düşen** kayıt çiftleri karşılaştırılıyor ve her çift 200
     token'dan küçük. 1.000 olgudan tipik olarak 50–200 aday çift çıkar →
     50–200 kısa geçiş.
  3. **Strateji sentezi.** Girdi artık ham dosya değil; doğrulanmış çelişki
     listesi + kronoloji + talep tablosudur (~3.000–5.000 token). **Tek pencereye
     sığar.**
- **Yeni bütçe:** 800 sayfa için toplam ≈ 60–90 dk kuyrukta; kullanıcı beklemez.
  80 sayfa ≈ 8–12 dk.
- **Kalite notu:** Ayrıntı 1. aşamada olgu kaydına indirgenir. Olgu şemasına
  girmeyen nüans (üslup, ima, vurgular) sentezde görünmez; çıktının başına bu not
  düşülür ve her olgu kaydı kaynak sayfaya bağlantılıdır, kullanıcı denetleyebilir.

### A11. Arşiv ölçeğinde toplu tarama ve karşılaştırma — *aşamalı işlem* ⟵ eski B2
"500 dosyadaki sözleşmelerde şu kaydı ara ve hükümleri karşılaştır."

- **Eski gerekçe:** 10.000 parça × ~5 sn ≈ 14 saat; iOS arka planı askıya alıyor.
- **Neden geçersiz:** İş zaten utanç verecek kadar paralel — belge belge, tamamen
  bağımsız. Bölünmesi bedava. Asıl mesele **kullanıcının beklemesi**, ki aşamalı
  kuyrukta kullanıcı beklemiyor.
- **Nasıl bölünüyor:**
  1. **Deterministik ön eleme.** 500 dosyanın tamamına model koşmak gereksiz.
     Önce yerel dizinde anahtar kelime + gömme araması: 10.000 parçadan tipik
     olarak **200–600 aday parça** kalır. Bu adım < 1 sn.
  2. **Yalnız adaylara model.** 400 parça × 5 sn ≈ 35 dk — 14 saat değil.
  3. **Kuyruk.** Ekran açıkken koşar, kapanınca durur, açılınca kaldığı yerden
     sürer. Kullanıcı "bitince haber ver"i seçer ve telefonu bırakır.
  4. **Karşılaştırma.** Bulunan hükümler kısa; ikili/üçlü gruplar hâlinde
     karşılaştırılır, tek tabloda birleştirilir.
- **Yeni bütçe:** Tipik sorgu 5–40 dk arası, kesintiye dayanıklı.
- **Kalite notu:** 1. aşamadaki ön eleme kayıplıdır — dizinde geçmeyen ama
  ilgili olan bir hüküm elenebilir. Kullanıcı "ön elemeyi atla, hepsini tara"
  diyebilir; o zaman iş uzun sürer ve yine telefonda koşar.

### A12. Uzun ses kaydı transkripsiyonu ve analizi — *aşamalı işlem* ⟵ eski B3
- **Eski gerekçe:** 3 saatlik kayıt ≈ 3 saat ön planda, ekran açık.
- **Neden geçersiz:** Ses doğal olarak bölünebilir — konuşma etkinliği (VAD) ile
  20–40 sn'lik bloklara ayrılır, bloklar sırayla çözülür, her blok bittiğinde
  metin diske yazılır.
- **Nasıl bölünüyor:** 3 saat → ~350 blok. Her blok bağımsız; kullanıcı 20
  dakikalık oturumlarla ilerleyebilir, uygulama nerede kaldığını bilir. Çözülen
  metnin özeti ve analizi zaten A5/A4 kalıbına düşer.
- **Yeni bütçe:** Gerçek zamana yakın (~0,8–1,2×), ama **kesintili**. Kullanıcı
  isterse gece şarjda ekran açık bırakıp tek seferde bitirir; istemezse parça
  parça.
- **Kalite notu:** Blok sınırında bölünen cümleler için bloklar 2 sn örtüşmeli
  çözülür ve dikişte tekrar eden metin deterministik olarak temizlenir.

### A13. Uzun layiha üretimi (istinaf/temyiz, > 15 sayfa) — *aşamalı işlem* ⟵ eski B4
- **Eski gerekçe:** 8.000–10.000 token çıktı ≈ 8–9 dk kesintisiz üretim; ayrıca
  tutarlılık için tüm dosyanın aynı anda bağlamda olması gerekir.
- **Neden geçersiz:** Uzun hukuki metin zaten bölümlü yazılır. İnsan da böyle yazar.
- **Nasıl bölünüyor:**
  1. **İskelet.** Önce başlık planı üretilir (başlıklar + her başlığın altına
     girecek olgu/talep referansları). ~500 token, 30 sn.
  2. **Bölüm bölüm üretim.** Her bölüm, iskelet + o bölüme atanmış olgu kayıtları
     (A10.1) + üslup profili (A8) ile ≤ 2.000 token penceresinde yazılır. 12
     bölüm × ~45 sn ≈ 9 dk — ama **kesintili**, her bölüm ayrı ayrı okunup
     onaylanabilir.
  3. **Tutarlılık geçişi.** Bölümler arası çelişki/tekrar denetimi, bölümlerin
     **özetleri** üzerinde yapılır (12 özet ≈ 1.500 token, tek pencere).
     Numaralandırma, atıf ve terim tutarlılığı deterministik denetlenir.
- **Yeni bütçe:** 15–25 sayfa için 10–20 dk, bölüm bölüm onaylanarak.
- **Kalite notu:** Bölüm bölüm üretim, tek geçişte yazılmış metne göre daha az
  akıcı geçiş verebilir; tutarlılık geçişi bunu kapatmayı hedefler ama garanti
  etmez. Buna karşılık kullanıcı her bölümü ayrı denetler — 15 sayfalık tek
  hamle çıktısında yapamayacağı bir şey.

---

## B) MASAÜSTÜ — BÖLÜNEMEZ İŞLER

Bölünebilirlik testinden sonra B listesinde **kullanıcının yapmak istediği tek bir
hukuki iş kalmadı.** Kalanlar altyapı işleridir ve ortak özellikleri şudur:
**tek bir atomik adımın yerleşik bellek ayak izi bütçeyi aşar.** Süre ve bağlam
bölünerek aşılır; yerleşik bellek bölünemez — bir modelin ağırlıkları ya belleğe
sığar ya sığmaz, "yarısını şimdi yarısını sonra" diye bir şey yoktur.

### B1. 7 B üstü model çıkarımı (ör. Mizan-27B sınıfı)
- **Gerekçe — bölünemez yerleşik bellek:** 27 B model 4-bit kuantize ≈ **15–16 GB
  ağırlık**, üstüne KV önbelleği. Telefon bütçesi 1,2 GB. Ağırlıklar çıkarımın her
  adımında **hepsi birden** gerekir; katman katman diskten akıtmak teorik olarak
  mümkün ama token başına ~16 GB disk okuması demektir → saniyede tek token bile
  çıkmaz. Bu bir "yavaş olur ama olur" durumu değil, iki-üç mertebe farkıdır.
- **Telefonda kalan:** Tüm hukuki işler 1–3 B sınıfı cihaz içi modelle A listesinde
  yapılır. 27 B yalnız **isteğe bağlı kalite yükseltmesidir**; yoksa hiçbir özellik
  kapanmaz.

### B2. LoRA / QLoRA eğitimi
- **Gerekçe — bölünemez yerleşik bellek:** Eğitim, taban modeli + gradyanları +
  optimizasyon durumunu **aynı anda** bellekte tutar. 9 B QLoRA ≈ 12–16 GB VRAM.
  Gradyan biriktirme yığın boyutunu küçültür, **model ayak izini küçültmez** —
  bölme burada işe yaramaz.
- **Telefonda kalan:** `docs/TRAINING.md` bunu ileri bir aşama olarak tanımlar.
  Üslup öğrenme, fine-tuning olmadan A8 + few-shot ile telefonda çalışır.

### B3. Model hazırlama ve kuantizasyon
- **Gerekçe — bölünemez yerleşik bellek:** Kuantizasyon, tam hassasiyetli
  ağırlıkları (27 B fp16 ≈ 54 GB) okuyup dönüştürür. Bir kereliktir, kurulum
  işidir, kullanıcı akışında yeri yoktur.
- **Telefonda kalan:** Telefon hazır kuantize edilmiş modeli indirir.

### Bilinçli olarak B'ye alınmayanlar

| Aday | Neden A'da kaldı |
|---|---|
| Maskeleme | Güvenlik koşulu; hiçbir gerekçe devri haklı çıkarmaz (A3) |
| Bütünsel dosya sentezi | Olgu çıkarma → indeksli çelişki tespiti → kısa sentez (A10) |
| Arşiv taraması | Deterministik ön eleme + kuyruk (A11) |
| Uzun ses | VAD ile bloklara ayrılır, sürdürülebilir (A12) |
| Uzun layiha | İskelet + bölüm bölüm üretim + tutarlılık geçişi (A13) |
| Üslup profili | Artımlı toplama; eşzamanlı bağlam gerekmez (A8) |
| Karar ilişkilendirme | K bağımsız kısa geçiş (A6) |
| Taranmış PDF OCR | Cihaz OCR'ı sayfa başına ~0,3–1 sn; sayfa sayfa |
| Dizin kurma/güncelleme | Artımlı, arka planda, kullanıcı beklemiyor |

---

## C) DEVİR TESLİM EŞİKLERİ

B listesi kullanıcı işi içermediği için devir teslimin anlamı değişti:
**devir artık bir yetenek koşulu değil, yalnızca bir hızlandırma seçeneğidir.**
Masaüstü hiç olmasa da telefon her işi bitirir.

**Kural:** Eşiğin altında devir teklifi **asla** çıkmaz. Uyarı, rozet, "masaüstünde
daha iyi olur" ipucu, gri buton — hiçbiri görünmez. Eşik aşıldığında bile teklif
bir **öneridir**: "Telefonda sürdür" seçeneği her zaman vardır ve varsayılandır.
Bu davranış testle doğrulanır (bkz. `PLAN-HUKUKAI.md` M12).

### C.0 Ölçüm zorunluluğu
Eşikler tahminle değil **ölçümle** karşılaştırılır. İlk açılışta 15 saniyelik
kalibrasyon turu koşar (ön dolum token/sn, üretim token/sn, tepe bellek); sonuç
cihaz başına saklanır, ayda bir tazelenir. Tahminî süre = ölçülen hız × iş
büyüklüğü. Ölçüm yoksa §0 varsayılanları kullanılır **ve eşikler %50 gevşetilir**.

### C.1 Süre — birincil eşik
> Kuyruğa alınamayan, kullanıcının **ekran başında beklemesi gereken** kesintisiz
> süre **> 10 dakika**.

Kuyruğa alınabilen iş bu eşiği tetiklemez, ne kadar uzun sürerse sürsün. A10'un
90 dakikası teklif çıkarmaz; kullanıcı beklemiyor.

### C.2 Bağlam
> **Yürürlükten kalktı.** Bağlam bölünerek aşılır (A10, A13). Bağlam uzunluğu
> artık devir gerekçesi değildir.

### C.3 Toplu iş
> Ön elemeden sonra **> 2.000 parça** kaldıysa ve kullanıcı sonucu **aynı oturumda**
> istiyorsa.

Eski eşik (25 belge / 400 parça) A11'in ön elemesi karşısında anlamsız kaldı;
yukarı çekildi.

### C.4 Çıktı büyüklüğü
> **Yürürlükten kalktı.** Uzun çıktı bölüm bölüm üretilir (A13).

### C.5 Ses / video
> **Yürürlükten kalktı.** Ses bloklara ayrılır (A12). Yalnız kullanıcı "tek
> oturumda, şimdi" derse ve kayıt **> 90 dakika** ise teklif çıkar.

### C.6 Bellek — tek gerçek zorunlu eşik
> Tek atomik adımın tahminî yerleşik belleği **> 1,2 GB**.

Yalnız B1–B3 bunu tetikler. Bu durumda çıkan şey teklif değil bilgilendirmedir:
"Bu model bu cihazda çalışmaz; cihaz içi model kullanılacak." Özellik kapanmaz.

### C.7 Yumuşak koşullar (devir değil, erteleme)
Batarya < %20 veya termal durum `serious`/`critical` ise devir teklifi **çıkmaz**;
"şarja takınca / soğuyunca sürdür" önerisi çıkar. Kuyruk zaten bunu kendi yapar.

### C.8 Devir teslimin kendisi
Ayrıntılı sözleşme: **`docs/PROTOCOL.md`**. Özet kurallar:
- Devir **kullanıcı onayı ile** başlar; sessiz devir yoktur.
- Giden her şey önce A3 maskelemesinden geçer; maskeleme koşamazsa devir iptal.
- Aktarım yerel ağ üzerinden, uçtan uca şifreli, tek kullanımlık eşleştirme kodu ile.
- Telefon her zaman işin sahibidir; masaüstü durumsuz işçidir ve işi geri veremez,
  yalnız teslim eder.
- Bağlantı koparsa telefon işi **geri alır** ve kaldığı aşamadan kendi sürdürür.
- Devir kaydı dosya hareketlerine yazılır: ne gitti, ne zaman, hangi eşik tetikledi.

### Eşik özeti

| Eşik | Değer | Durum |
|---|---|---|
| Beklenen süre | > 10 dk **ekran başında** | Etkin |
| Toplu iş | ön eleme sonrası > 2.000 parça **ve** "şimdi" | Etkin |
| Ses | > 90 dk **ve** "tek oturumda" | Etkin |
| Bellek | tek adım > 1,2 GB | Etkin (bilgilendirme) |
| Bağlam | — | Kalktı (A10, A13) |
| Çıktı | — | Kalktı (A13) |

---

## Açık soru

**A listesinde eksik gördüğünüz madde var mı?** Bu belgeye eklenen her yeni
yetenek varsayılan olarak A'dır. B'ye taşımanın tek yolu, işin **bölünemez**
olduğunu — tek atomik adımın bellek ayak izinin bütçeyi aştığını — göstermektir.
Süre ve bağlam gerekçeleri artık kabul edilmez; ikisi de bölünerek aşılıyor.
