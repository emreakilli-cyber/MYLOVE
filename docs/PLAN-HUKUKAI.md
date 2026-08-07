# PLAN — `packages/hukuk-ai`

> Bu dosya bu oturumun hafızasıdır. `docs/PLAN.md`'ye **dokunulmaz** (o, ana
> uygulama döngüsünün dosyasıdır). Her uyanışta buradan devam edilir: `[ ]`
> işaretli **ilk** maddeden başla, bitir, `[x]` yap, oturum günlüğüne satır ekle.

**Kapsam:** yalnız `packages/hukuk-ai/`. Ana uygulama kodu **okunur, yazılmaz,
import edilmez**.
**Git:** bu oturumda git işlemi yapılmaz.
**Soru:** kullanıcıya soru sorulmaz. Takılınca `docs/QUESTIONS.md`'ye soru +
seçenekler + seçilen varsayım yazılır, koda `// SORU: S<no>` yorumu düşülür,
varsayımla devam edilir.
**Tıkanma:** bir madde 3 kez denenip olmuyorsa `[?]` işaretlenir,
`docs/BLOCKED.md`'ye yazılır, atlanır, devam edilir.

## Bağlayıcı belgeler

| Belge | Ne söyler |
|---|---|
| `docs/CAPABILITIES.md` | Hangi iş telefonda, hangisi masaüstünde, hangi eşikte devir |
| `docs/PROTOCOL.md` | Telefon ↔ masaüstü sözleşmesi (değiştirilemez) |
| `docs/SPEC.md` | Maskeleme sözleşmesi (M1'de yazılacak) |

## Öncelik kuralları

1. **`CAPABILITIES.md`'deki A listesi bitmeden B listesine geçilmez.**
   M1–M8, M11–M13 A listesine hizmet eder. M9 (TRAINING) ve M10'un masaüstü
   yarısı B'dir; en sona kalır.
2. **Devir teslim teklifi, `CAPABILITIES.md` §C eşiği aşılmadıkça gösterilemez.**
   Bu bir yorum satırı değil, testle doğrulanan davranıştır (M12.9).
3. Her madde için: `npm run build` geçer, testler yeşil kalır, kutu `[x]` olur,
   oturum günlüğüne tek satır eklenir.

---

## M0 — Paket iskeleti

- [x] M0.1 `packages/hukuk-ai/` dizin yapısı: `src/mask/`, `src/research/`,
      `src/write/`, `src/protocol/`, `src/types/`, `docs/`
- [x] M0.2 Paketin kendi `tsconfig.json`'ı (kök `tsconfig.app.json` yalnız `src`
      içerdiği için kök derlemesi etkilenmez; ortak dosyaya dokunulmaz)
- [x] M0.3 Bağımlılık **sıfır**: paket yalnız TypeScript standart kütüphanesi
      kullanır; ana uygulamadan import yok. Testle doğrula: kaynak dosyalarda
      `../../src` veya paket dışı göreli import bulunmayacak
      → `src/package.test.ts`; `@types/node` istisnası S3'te gerekçeli
- [x] M0.4 `npx tsc -p packages/hukuk-ai/tsconfig.json --noEmit` temiz geçer
- [x] M0.5 Kök `npm test` paketin testlerini de koşar (vitest kök deseni), kök
      `npm run build` etkilenmez

## M1 — `docs/SPEC.md`: maskeleme sözleşmesi

- [x] M1.1 Varlık tipleri tablosu: kod, açıklama, örnek, tespit katmanı (kural/NER),
      duyarlılık derecesi
- [x] M1.2 Maske token biçimi: dilbilgisi (gramer), kaçış kuralları, çakışmazlık
      garantisi, metinde doğal olarak geçemeyeceğinin gerekçesi
- [x] M1.3 Deterministik eşleme kuralı: aynı girdi + aynı oturum → aynı token;
      sıra numarası verme kuralı; oturumlar arası davranış
- [x] M1.4 Unmask algoritması: adım adım, en uzun eşleşme önceliği, kısmi/bozuk
      token davranışı
- [x] M1.5 Bilinen sınırlar bölümü: neyi yakalayamayacağımızın açık listesi
- [x] M1.6 `maskContractVersion` tanımı ve `PROTOCOL.md` §8 ile bağı
- [x] M1.7 Değişmezler: "tablo ağa çıkmaz", "mask→unmask birebir", "maskeleme
      koşamazsa dışarı veri gitmez"

## M2 — Maskeleme: kural katmanı (deterministik)

- [x] M2.1 `TCKN` — 11 hane + resmî doğrulama algoritması (10. ve 11. hane kontrolü),
      geçersiz olanı maskeleme
- [x] M2.2 `IBAN` — TR IBAN biçimi + mod-97 checksum; boşluklu/boşluksuz yazım
- [x] M2.3 `PHONE` — 0(5xx), +90, 5xx, sabit hat, dahili; ayırıcı çeşitleri
- [x] M2.4 `PLATE` — Türk plaka biçimleri (`34 ABC 123`, `06AB1234`, `81 A 1234`)
- [x] M2.5 `DATE` — `12.03.2024`, `12/03/2024`, `12 Mart 2024`, `2024-03-12`
- [x] M2.6 `CASE_NO` — esas/karar no (`2024/1234 E.`, `2023/456 K.`), dosya no
- [x] M2.7 `EMAIL` — RFC'ye yakın pratik desen
- [x] M2.8 Çakışan eşleşme çözümü: en uzun eşleşme kazanır; eşitlikte öncelik sırası
      sabit ve belgelenmiş
- [x] M2.9 Her tip için pozitif + negatif test (yanlış TCKN maskelenmemeli,
      IBAN'a benzeyen ama checksum tutmayan dizge maskelenmemeli)
- [x] M2.10 Başarım: 150.000 karakterlik metinde kural geçişi < 250 ms (test)

## M3 — Maskeleme: NER katmanı (lokal, API yok)

- [x] M3.1 Varlık tipleri: `PERSON`, `ORG`, `ADDRESS`, `WORKPLACE`
- [x] M3.2 Model bağımsız arayüz (`NerBackend`): girdi metin parçası → etiketli
      aralıklar. Uygulamalar takılabilir olsun
- [x] M3.3 Modelsiz varsayılan uygulama: cihazdaki müvekkil/karşı taraf/vekil
      kayıtlarından üretilen yerel sözlük + unvan ipuçları (`Av.`, `Dr.`, `A.Ş.`,
      `Ltd. Şti.`, `Mah.`, `Sok.`, `No:`). Model yokken de sistem çalışır
- [x] M3.4 `docs/MODEL.md`: **Mizan-27B** ve **ytu-ce-cosmos/Turkish-Gemma-9b**
      karşılaştırması + telefon için 2–4B sınıfı alternatifler. Sütunlar: lisans,
      VRAM, kuantize boyut, bağlam, Türkçe hukuki metin kalitesi, cihazda
      çalışabilirlik
- [x] M3.5 `MODEL.md` sonucu bir **karar** ile biter: telefonda hangi model,
      masaüstünde hangi model, gerekçesiyle
- [x] M3.6 API çağrısı yasağı: NER katmanında ağ erişimi olmadığını doğrulayan test
- [x] M3.7 Kural katmanı + NER katmanı birleşimi: kural her zaman önce koşar,
      NER yalnız kalan metinde çalışır

## M4 — Türkçe çekim eki normalizasyonu

- [x] M4.1 Ek ayırma: `Ahmet'in`, `Ahmet'e`, `Ahmet'ten`, `Ahmet'le`, `Ahmet'i`,
      `Ahmet'imiz` → kök `Ahmet` + ek
- [x] M4.2 Kesme işaretsiz yazım: `Ahmete`, `Ahmetin` (yaygın hata) → kök
- [x] M4.3 Ünsüz yumuşaması / ünlü düşmesi: `Mehmet` → `Mehmed'in`,
      `Ahmet` → `Ahmed'e`; `burun` → `burnu` sınıfı kelimelerde kök koruma
- [x] M4.4 Büyük/küçük ünlü uyumuna göre ek varyantları (`-in/-ın/-un/-ün`,
      `-e/-a`, `-den/-dan/-ten/-tan`)
- [x] M4.5 Kurum adlarında ek: `Egeperla AVM'nin`, `X A.Ş.'ye`
- [x] M4.6 **Aynı maskeye bağlama:** bir kökün tüm çekimli biçimleri tek maske
      token'ına düşer (test)
- [x] M4.7 Unmask'ta ek geri getirme: `[KISI_1]'in` → `Ahmet'in` (ek maskede değil,
      metinde kalır)

## M5 — Deterministik eşleme tablosu + unmask

- [x] M5.1 `MaskTable` veri yapısı: kök → token, token → kök, tip başına sayaç
- [x] M5.2 Deterministik numaralandırma: metinde ilk görülme sırasına göre
      `[KISI_1]`, `[KISI_2]`…; aynı girdi → aynı çıktı (test)
- [x] M5.3 Aynı soyisimli iki kişi ayrımı: `Ahmet Yılmaz` ≠ `Mehmet Yılmaz`;
      yalnız `Yılmaz` geçtiğinde belirsizlik işaretlenir, kullanıcıya sorulur
- [x] M5.4 `unmask(text, table)` — birebir geri dönüş
- [x] M5.5 **Serileştirme yasağı:** `MaskTable` üzerinde `toJSON` tanımlı değil;
      `JSON.stringify` çağrısı sessizce veri sızdıramaz. Testle doğrula
- [x] M5.6 Tablonun ağa gidebileceği tek biçim `sha256` özetidir
      (`PROTOCOL.md` §5.3 `maskTableHash`); testle doğrula
- [x] M5.7 Tablo yaşam döngüsü: bellek içi, oturum sonunda temizlenir; kalıcı
      saklama gerekiyorsa şifreli

## M6 — Onay ekranı API'si

- [x] M6.1 `listMasks()` → maske listesi: token, tip, kök, metindeki geçiş sayısı,
      ilk geçiş konumu, güven derecesi
- [x] M6.2 `addMask(span, type)` — elle maske ekle
- [x] M6.3 `linkToExisting(span, token)` — mevcut maskeye bağla
- [x] M6.4 `removeMask(token)` — kaldır (maskeleme geri alınır)
- [x] M6.5 `applyToAll(span)` — "tümüne uygula": aynı kökün tüm çekimli
      biçimlerini de kapsar (M4 ile bağlantılı)
- [x] M6.6 Her işlem sonrası tablo tutarlılığı: numaralandırma bozulmaz,
      mask→unmask birebirliği korunur (test)
- [x] M6.7 API saf veri döndürür; arayüz bileşeni içermez (paket UI'dan bağımsız)

## M7 — Araştırma katmanı (internete çıkan **tek** modül)

- [x] M7.1 `ResearchClient` arayüzü: Yargıtay kararı ve mevzuat sorgulama
- [x] M7.2 **Zorlayıcı kapı:** dışarı çıkan her sorgu `MaskGuard`'dan geçer;
      maskelenmemiş metin fonksiyona **girerse hata fırlatır**, sessizce geçmez
- [x] M7.3 `MaskGuard` kural katmanının tamamını ters yönde koşar: çıkan metinde
      TCKN/IBAN/telefon/plaka deseni varsa `UnmaskedContentError`
- [x] M7.4 Test: maskelenmemiş metinle çağrı **her zaman** hata verir (kaçış yolu yok)
- [x] M7.5 Test: ağ katmanı yalnız bu modülden erişilebilir; başka modülde ağ
      çağrısı yok
- [ ] M7.6 Sonuç özetleme ve olayla ilişkilendirme (`CAPABILITIES.md` A6):
      K bağımsız kısa geçiş, uzun bağlam yok
- [x] M7.7 Çevrimdışı davranış: ağ yoksa yerel dizinden cevap, hata değil

## M8 — Yazma katmanı (lokal model, internet YOK)

- [ ] M8.1 Ağ erişimi yasağı: modülde ağ çağrısı bulunmadığını doğrulayan test
- [ ] M8.2 **(a) Yapı/iskelet çıkarma:** eski dilekçelerden başlık düzeni,
      numaralandırma şeması, bölüm sırası
- [ ] M8.3 **(b) Üslup profili JSON şeması:** cümle uzunluğu dağılımı, paragraf
      uzunluğu, kalıp ifadeler, numaralandırma biçimi, hitap/kapanış biçimi,
      atıf biçimi, terim tercihleri
- [ ] M8.4 Profil **artımlı** üretilir: belge belge, birleştirilebilir
      (`CAPABILITIES.md` A8)
- [ ] M8.5 **(c) Few-shot seçimi:** en benzer 2–3 dilekçeyi bağlama koyma;
      benzerlik ölçütü ve bağlam bütçesi (≤ 2.000 token) belgelenmiş
- [ ] M8.6 **Fine-tuning ile başlanmaz.** Bu karar koda yorum olarak değil,
      `MODEL.md` ve `TRAINING.md`'ye gerekçesiyle yazılır
- [ ] M8.7 Üretim aşamalı: iskelet → bölüm bölüm → tutarlılık geçişi
      (`CAPABILITIES.md` A13)

## M9 — `docs/TRAINING.md` *(B listesi — en sona)*

- [ ] M9.1 Veri formatı: JSONL şeması, alan adları, örnek kayıt
- [ ] M9.2 Veri hazırlama: maskelenmiş korpustan eğitim seti üretme; **ham
      müvekkil verisi eğitime girmez**
- [ ] M9.3 Örnek sayısı: LoRA için alt sınır, önerilen aralık, doygunluk noktası
- [ ] M9.4 Hiperparametreler: rank, alpha, dropout, öğrenme oranı, epoch, batch,
      gradyan biriktirme — tablo hâlinde, gerekçeli
- [ ] M9.5 Donanım gereksinimi: VRAM tablosu (7B/9B/27B × LoRA/QLoRA)
- [ ] M9.6 Tahminî süre ve maliyet: yerel GPU ve kiralık GPU için ayrı
- [ ] M9.7 Adım adım çalıştırma yönergesi — kullanıcının kendisi koşabileceği
      netlikte, komut komut
- [ ] M9.8 Değerlendirme: eğitim sonrası kalite nasıl ölçülür, geri alma nasıl yapılır

## M10 — `docs/ARCHITECTURE.md`

- [ ] M10.1 Modül haritası ve bağımlılık yönü (ok diyagramı)
- [ ] M10.2 Telefon-masaüstü iş bölümü, `CAPABILITIES.md` A/B listesiyle birebir
- [ ] M10.3 Devir teslim mimarisi, `PROTOCOL.md`'ye birebir uyumlu
- [ ] M10.4 **Telefon tek başına tam işlevsel** — masaüstü modülü hiç kurulmasa
      hangi kod yolunun çalıştığı açıkça gösterilir
- [ ] M10.5 Veri akışı diyagramı: ham metin → maske → (yerel işlem | araştırma |
      devir) → unmask → kullanıcı
- [ ] M10.6 Kırmızı çizgiler: hangi modül hangi modülü **import edemez**
      (araştırma ↛ maske tablosu, yazma ↛ ağ, masaüstü ↛ kalıcı depolama)

## M11 — Kaçak kimlik bilgisi yakalama

- [x] M11.1 `preflightCheck(text)` — gönderim öncesi çalışan kapı
- [x] M11.2 Kullanıcı maskeleme akışını atlayıp doğrudan AI kutusuna yazarsa,
      **gönderimden önce** yakala
- [x] M11.3 Dönen sonuç: bulunan varlıklar + önerilen maskeler + "maskeleyeyim mi?"
      sorusu için gereken veri
- [x] M11.4 Kullanıcı seçenekleri: maskele ve gönder / maskesiz gönder (yalnız
      **yerel** hedefler için) / iptal
- [x] M11.5 **İnternete çıkan hedefte "maskesiz gönder" seçeneği yoktur** (M7.2
      zaten fırlatır); testle doğrula
- [x] M11.6 Test: kimlik verisi içeren serbest metin hiçbir yoldan kapıyı atlayamaz

## M12 — Test seti

- [x] M12.1 **Birebirlik:** `unmask(mask(x)) === x` — özellik temelli test,
      rastgele üretilmiş metinlerle
- [x] M12.2 Kenar durum: çekim ekleri (M4'ün tüm biçimleri)
- [x] M12.3 Kenar durum: aynı soyisimli iki kişi
- [x] M12.4 Kenar durum: kişisel veri içermeyen metin → hiç maske yok, metin aynen
- [x] M12.5 Kenar durum: bozuk token dönüşü (`[KISI_`, `[KISI_99]` tabloda yok,
      `[KISI_1` kapanmamış) → çökmez, tanımlı davranış
- [x] M12.6 Kenar durum: iç içe geçmiş varlık — `Egeperla AVM sahibi Ahmet Yılmaz`
      → `ORG` ve `PERSON` ayrı ayrı, doğru sınırlarla
- [x] M12.7 Kenar durum: aynı dizge iki farklı tip (`Yılmaz` hem soyad hem şirket adı)
- [x] M12.8 Kenar durum: maske token'ına benzeyen ham metin (`[KISI_1]` kullanıcı
      metninde geçiyorsa) → kaçışlanır, unmask bozulmaz
- [x] M12.9 **Devir eşiği testi:** eşik altında `shouldOfferHandoff()` **her
      zaman** `false`; `CAPABILITIES.md` §C'deki her eşik için sınır değeri testi
- [x] M12.10 Başarım testi (M2.10) süreklilik altında koşar

## M13 — Public API dokümantasyonu

- [x] M13.1 Dışa açılan yüzey tek dosyada toplanır (`src/index.ts`); iç modüller
      dışarı sızmaz
- [ ] M13.2 Her public fonksiyon: imza, parametreler, dönüş, fırlatabileceği
      hatalar, örnek
- [ ] M13.3 Hata tipleri kataloğu
- [ ] M13.4 `docs/API.md` üretilir ve `SPEC.md`/`PROTOCOL.md` ile çapraz bağlanır
- [ ] M13.5 Kararlılık sözü: hangi API'ler kararlı, hangileri deneysel

---

## Oturum günlüğü

| # | Tarih | Yapılan | Biten maddeler | Not |
|---|---|---|---|---|
| 1 | 2026-08-07 | `CAPABILITIES.md` bölünebilirlik testinden geçirildi; B'deki 4 madde A'ya taşındı (A10–A13), `PROTOCOL.md` ve bu plan yazıldı | — | B'de yalnız bölünemez bellek işleri kaldı |
| 2 | 2026-08-07 | Paket iskeleti, sıfır bağımlılık, yalıtım testi | M0.1–M0.5 | Ortak dosyaya dokunulmadı; gerekçe S2 |
| 3 | 2026-08-07 | `docs/SPEC.md` maskeleme sözleşmesi yazıldı | M1.1–M1.7 | Token kaçış kuralı eşleme (bijection) olarak kuruldu |
| 4 | 2026-08-07 | Kural katmanı: 7 tip dedektör + çakışma çözümü + eşleme tablosu | M2.1–M2.10, M5.1/2/4/5/6 | Tablo geçiş kaydı tutuyor; yoksa S1 çöküyordu |
| 5 | 2026-08-07 | `docs/MODEL.md`: model karşılaştırması ve karar | M3.4, M3.5 | HF egress kapalı; satırlar doğrulandı/tahmin diye işaretli |
| 6 | 2026-08-07 | NER katmanı arayüzü + sözlük tabanlı varsayılan uygulama | M3.1–M3.3, M3.6, M3.7 | S5 framework'te zorlanıyor, backend'in iyi niyetine bırakılmadı |
| 7 | 2026-08-07 | Türkçe çekim eki normalizasyonu | M4.1–M4.7 | Eksiz soyma yalnız bilinen kökte; sıradan sözcük parçalanmıyor |
| 8 | 2026-08-07 | Kenar durum testleri | M12.1–M12.6, M12.8, M12.10 | 73 test; kök `npm test` 167/167 yeşil, `npm run build` temiz |
| 9 | 2026-08-07 | Onay ekranı API'si (`MaskReview`) | M6.1–M6.7 | Her müdahalede baştan hesap; M6.6 tanım gereği sağlanıyor |
| 10 | 2026-08-07 | Araştırma katmanı + `MaskGuard` zorlayıcı kapı | M7.1–M7.5, M7.7 | Ağ taşıması dışarıdan veriliyor; paket ağ API'sine hiç dokunmuyor |
| 11 | 2026-08-07 | Kaçak kimlik yakalama (`preflightCheck`) | M11.1–M11.6 | Ağ hedefinde "maskesiz gönder" seçeneği hiç üretilmiyor |
| 12 | 2026-08-07 | Devir eşiği motoru + sınır değeri testleri | M12.9 | Eşik altında `offer` üretilmediği kapsamlı taramayla doğrulandı |
| 13 | 2026-08-07 | Belirsiz soyisim isaretleme, sifreli tablo saklama, ayni dizge iki tip testi | M5.3, M5.7, M12.7 | Guard da artik cakisma cozumu kosuyor; SPEC'e S7 degismezi eklendi |
