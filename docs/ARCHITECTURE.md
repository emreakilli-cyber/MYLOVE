# ARCHITECTURE — `packages/hukuk-ai`

Plan M10. Bu belge kod içermez; `docs/SPEC.md`, `docs/PROTOCOL.md` ve
`docs/CAPABILITIES.md`'nin **birlikte nasıl bir sistem oluşturduğunu** gösterir.
Çelişki varsa bu belge değil, o üçü bağlayıcıdır — burada yalnız onların
haritası çizilir.

---

## 1. Modül haritası ve bağımlılık yönü (M10.1)

```
types/entities.ts   ── varlık tipleri, çakışma önceliği. HİÇBİR ŞEYE bağımlı değil.
turkish/suffix.ts   ── Türkçe ek soyma. HİÇBİR ŞEYE bağımlı değil.
handoff/threshold.ts── devir eşiği motoru. HİÇBİR ŞEYE bağımlı değil.

mask/
  rules/*      → types
  ner/*        → types
  overlap.ts   → types
  token.ts     → types
  table.ts     ── bağımsız (kendi tipleri)
  mask.ts      → rules, ner, overlap, table, token, types
  review.ts    ── bağımsız (kendi tipleri; MaskTable ile aynı sözleşmeyi
                   paylaşır ama import etmez — M6.7 "paket UI'dan bağımsız")
  preflight.ts → mask.ts, types

research/
  guard.ts     → mask/ner, mask/overlap, mask/rules, types   (MaskGuard)
  client.ts    → guard.ts                                    (ResearchClient)
  correlate.ts → client.ts (yalnız ResearchDocument tipi)     (K bağımsız geçiş)

write/
  types.ts        ── bağımsız (WriteBackend, estimateTokens)
  skeleton.ts      ── bağımsız (deterministik iskelet çıkarma)
  styleProfile.ts  → mask/mask.ts, mask/ner/types, skeleton.ts
  fewShot.ts       → types.ts
  staged.ts        → skeleton.ts, fewShot.ts, styleProfile.ts, types.ts

index.ts  → hepsinden dışa açık yüzeyi toplar (M13.1)
```

**Genel yön:** `types` → `mask` → `research` / `write` → `index`. Ok hep
"daha genel"den "daha özel"e gider; tersine bağımlılık yoktur (bkz. §6 kırmızı
çizgiler, bunu testle de doğrular).

---

## 2. Telefon-masaüstü iş bölümü (M10.2)

`CAPABILITIES.md`'nin A/B ayrımı, bu paketin modülleriyle birebir örtüşür:

| CAPABILITIES bölümü | Karşılık gelen modül(ler) | Nerede çalışır |
|---|---|---|
| A1–A2 (kayıt, süre) | paket dışı — ana uygulama, `packages/hukuk-ai` kapsamında değil | telefon |
| A3 (maskeleme) | `mask/*` | telefon, **kısıtsız** |
| A4–A5 (çıkarım, özetleme) | `write/*` (özetleme kısmı `research/correlate.ts`'e benzer desende, ama belge kaynaklı işler A6 değil A4/A5'tir — ayrı model çağrısı) | telefon |
| A6 (Yargıtay/mevzuat) | `research/*` | telefon; **ağa çıkan tek modül** |
| A7–A9, A13 (evrak, üslup, düzenleme, uzun layiha) | `write/*` | telefon |
| A10–A13 (bölünebilirlik testinden geçenler) | `write/staged.ts` (A13), üst seviye orkestrasyon ana uygulamada | telefon |
| B (TRAINING) | `docs/TRAINING.md` — kod paket İÇİNDE YOK, M9 hâlâ B listesinde | yalnız masaüstü, **isteğe bağlı** |
| C (devir eşiği) | `handoff/threshold.ts` | eşik hesabı telefonda; devrin kendisi PROTOCOL'e göre |

**Sonuç:** `packages/hukuk-ai` içindeki kod tabanının neredeyse tamamı A
listesine hizmet eder ve telefonda çalışacak şekilde yazılmıştır. Masaüstüne
özel kod yalnız `docs/TRAINING.md`'de bir **belge** olarak durur; paket
içinde masaüstüne özel bir modül yoktur (G7 ile tutarlı, bkz. §4).

---

## 3. Devir teslim mimarisi (M10.3)

`docs/PROTOCOL.md`'nin özeti, bu paketin sınırları içinden:

- Telefon **her zaman işin sahibidir** (G4). Bu paket, sahiplik devri yapan
  hiçbir API sunmaz — `write/*` ve `research/*`'teki tüm fonksiyonlar telefon
  sürecinde çağrılmak üzere tasarlıdır; masaüstü tarafı ayrı bir süreçte
  PROTOCOL zarfını çözüp aynı `WriteBackend`/`ConsistencyReviewBackend`
  arayüzlerini (ya da daha güçlü bir modeli) kendi tarafında uygular.
- **G2** (yalnız maskelenmiş içerik gider) bu paket içinde iki yerde
  zorlanır: `research/guard.ts` (ağa giden sorgu, M7.2) ve dolaylı olarak
  `write/styleProfile.ts` (kalıcı profile giren her metin, S7 kararıyla
  `mask()`'tan geçer — devre bir masaüstü aktarımı olmasa bile aynı ilke
  uygulanır).
- **G3** (masaüstü durumsuzdur): bu paket kalıcı depolama API'si içermez;
  `MaskTable` (M5.7) şifreli saklanabilir ama bu telefon tarafının kararıdır,
  paket kendisi bir dosya sistemine yazmaz.
- **G1** (maske tablosu ağa çıkmaz): `MaskTable`'da `toJSON` tanımsızdır
  (M5.5); ağa çıkabilen tek biçim `sha256` özeti (`PROTOCOL.md` §5.3
  `maskTableHash`, M5.6).

Bu paket PROTOCOL zarfının kendisini (mesaj tipleri, durum makineleri,
yeniden bağlanma) **uygulamaz** — o, ana uygulamanın taşıma katmanının işi.
Paket yalnız PROTOCOL'ün varsaydığı içerik sözleşmesini (maskelenmiş metin,
backend arayüzleri) üretir.

---

## 4. Telefon tek başına tam işlevsel (M10.4)

Masaüstü modülü **hiç kurulmasa** hangi kod yolu çalışır?

```
mask(text)                    → hep telefonda, ağ yok, koşulsuz çalışır
preflightCheck(text, dest)    → hep telefonda
ResearchClient.search(query)  → transport verilmezse localIndex'e düşer (M7.7);
                                  o da yoksa `source: 'unavailable'`, hata FIRLATMAZ
summarizeResults / correlateResults → WriteBackend/CorrelationBackend telefonda
                                        koşan 2B modelle de sağlanabilir (MODEL.md §3.2)
addDocument / selectFewShot / writeStaged → tamamı telefon modeliyle çalışır
shouldOfferHandoff(...)       → eşik altında HER ZAMAN false (M12.9); masaüstü
                                  hiç yokmuş gibi davranır
```

**Tek koşullu davranış:** `ResearchClient`'ın `source: 'network'` dönmesi
gerçek ağ bağlantısına bağlıdır — ama bu masaüstüyle değil, doğrudan
internetle ilgilidir (A6). Masaüstünün varlığı/yokluğu bu paketteki hiçbir
kod yolunu **hiç** değiştirmez; bu G7'nin doğrudan sonucu.

---

## 5. Veri akışı (M10.5)

```
ham metin
   │
   ▼
mask()  ──────────────► MaskTable (bellekte, ağa çıkmaz — G1)
   │  maskelenmiş metin
   ▼
┌──────────────┬──────────────────┬───────────────────┐
│  yerel işlem │     araştırma    │   devir (opsiyonel)│
│ write/*      │  research/*      │   PROTOCOL (paket  │
│ (telefon     │  (A6 — TEK ağa   │    dışı, ana        │
│  modeli)     │   çıkan modül,   │    uygulama)        │
│              │   MaskGuard      │                     │
│              │   zorunlu geçit) │                     │
└──────────────┴──────────────────┴───────────────────┘
   │  maskelenmiş çıktı
   ▼
unmask(text, table)
   │
   ▼
kullanıcı (ham metni yalnız burada, telefonda görür)
```

Üç kolun ortak noktası: **hiçbiri unmask edilmiş metni görmez.** `write/*`
telefon modeline maskelenmiş metin verir, `research/*` ağa maskelenmiş metin
verir (M7.2 zorunlu kapı), devir de PROTOCOL G2 gereği maskelenmiş içerik
taşır. `unmask` yalnız telefonda, en son adımda çalışır.

---

## 6. Kırmızı çizgiler — hangi modül hangisini import edemez (M10.6)

Bunlar `research.test.ts` ve `write.test.ts`'teki dosya taramalarıyla
**testle** doğrulanır; burada yazılı olması yeterli değildir:

| Kural | Neden | Doğrulayan test |
|---|---|---|
| **`research/*` dışında hiçbir dosya ağ API'sine dokunamaz** (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`) | A6 dışındaki her şey telefonda kısıtsız/ağsız çalışmak zorunda (A3, A7–A9, A13) | `research.test.ts` "ağ erişimi yalnız research modülünde" |
| **`research/*` içi de ağ API'sine DOĞRUDAN dokunamaz** — taşıma (`ResearchTransport`) dışarıdan verilir | "Hangi modül ağa çıkabilir" sorusunun cevabı tek satırda (arayüz) kalsın; gerçek taşıma test edilebilir olsun | `research.test.ts` "taşıma dışarıdan gelir" |
| **`write/*` ağ API'sine hiç dokunamaz** | Yazma katmanı A7/A8/A9/A13 — hepsi telefon modeli, hiçbiri ağ istemiyor (MODEL.md §1) | `write.test.ts` "yazma katmanında hiçbir ağ API çağrısı yok" (M8.1) |
| **`research/*`, `MaskTable`'ı serileştirip taşıyamaz** — yalnız `maskTableHash` (sha256) taşınabilir | G1 | `mask.test.ts`/`table` testleri (M5.5, M5.6) |
| **Hiçbir modül `../../src` veya paket dışı göreli yol import edemez** | Paket ana uygulamadan bağımsız kalmalı (M0.3); `packages/hukuk-ai` yalnız OKUNUR | `package.test.ts` |
| **`write/*`, ham (maskelenmemiş) metni kalıcı bir alana yazamaz** | S7 — üslup profili kalıcıdır, "ham kişisel veri hiç yazılmaz" kuralı | `write.test.ts` "profile giren örnek paragraflar maskelenmiş olur" |

Bu tablo `docs/QUESTIONS.md` S7'deki kararla birlikte okunmalı: A8'in "ham
paragraf" beklentisi, değişmez kuralla çatıştığı için maskeli biçime
indirgendi; bu satır o kararın mimari izdüşümüdür.
