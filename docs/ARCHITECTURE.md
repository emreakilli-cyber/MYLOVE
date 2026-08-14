# ARCHITECTURE — `packages/hukuk-ai`

Plan M10. Bu belge kod yazmaz, var olanı haritalar. Kaynak: `src/**` (M0–M8,
M11–M13 tamamlandı), çapraz bağlar `docs/CAPABILITIES.md`, `docs/PROTOCOL.md`,
`docs/API.md`.

---

## 1. Modül haritası ve bağımlılık yönü (M10.1)

Oklar **gerçek `import` yönünü** gösterir (kaynak: dosya taraması, aşağıdaki
tabloya elle eklenmedi). `index.ts` tek dışa açılan kapıdır (M13.1); hiçbir iç
modül `index.ts`'i geri import etmez.

```
types/entities.ts  (temel tip — kimse ondan import etmez, herkes ona bağımlı)
        ^
        │
        ├── mask/rules/shared.ts ─┬─> caseNo.ts, date.ts, email.ts, iban.ts,
        │                         │   phone.ts, plate.ts, tckn.ts
        │                         └─> rules/index.ts (runRuleLayer) [toplayıcı]
        │
        ├── mask/overlap.ts        (resolveOverlaps — çakışma çözümü)
        │
        ├── mask/token.ts          (token dilbilgisi + kaçış)
        │
        ├── mask/table.ts ────────> token.ts
        │
        ├── mask/ner/types.ts      (NerBackend arayüzü)
        │        ^
        │        └── mask/ner/dictionary.ts ──> turkish/suffix.ts
        │                 ^
        │                 └── mask/ner/index.ts (runNer/runNerAsync) [toplayıcı]
        │
        ├── turkish/suffix.ts      (bağımsız — hiçbir iç modülden import etmez)
        │
        ├── handoff/threshold.ts   (BAĞIMSIZ — hiçbir modülden import etmez)
        │
        └── write/structure.ts     (BAĞIMSIZ)
                 ^
                 └── write/style.ts ──> structure.ts (yalnız numaralandırma sayımı için)

        write/fewshot.ts  (BAĞIMSIZ)
        write/draft.ts    (BAĞIMSIZ — backend arayüzleri dışarıdan gelir)

mask/mask.ts ──> ner/index.ts, ner/types.ts, overlap.ts, rules/index.ts, table.ts, token.ts, types/entities.ts
        ^
        ├── mask/preflight.ts ──> mask.ts, types/entities.ts
        └── mask/review.ts    ──> mask.ts, table.ts, token.ts, turkish/suffix.ts, types/entities.ts

research/guard.ts    ──> mask/ner/index.ts, mask/ner/types.ts, mask/overlap.ts, mask/rules/index.ts, types/entities.ts
        ^                (KIRMIZI ÇİZGİ: mask/table.ts'e HİÇ dokunmaz — bkz. §6)
        └── research/client.ts    ──> guard.ts
                 ^
                 └── research/summarize.ts ──> guard.ts, client.ts (yalnız tip)

index.ts ──> yukarıdakilerin TAMAMINI toplar, tek kapıdan dışa açar (M13.1)
```

**Okunuşu:** Bir modül yalnız kendinden "yukarıda" (bu diyagramda daha soldaki
sütunlarda) duran modülleri import edebilir; hiçbir döngü yoktur —
`package.test.ts`'teki paket yalıtımı testi bunu dolaylı doğrular
(paket-dışı import yok), döngüsellik ise TypeScript derleyicisinin kendisi
tarafından reddedilir.

---

## 2. Telefon–masaüstü iş bölümü — `CAPABILITIES.md` A/B ile birebir (M10.2)

| `CAPABILITIES.md` | Bu pakette karşılığı | Telefonda mı? |
|---|---|---|
| A1 (kayıt/CRUD) | *(bu paketin dışında — ana uygulama Dexie ile yapar)* | — |
| A2 (süre hesabı) | *(bu paketin dışında)* | — |
| **A3 (maskeleme, kısıtsız)** | `mask` / `maskAsync` / `unmask` / `MaskTable` / kural + NER katmanı | **Evet, her zaman** |
| **A6 (araştırma)** | `ResearchClient`, `assertMasked`, `summarizeDocuments`, `correlateWithCase` | Evet — ağ **isteğe bağlı taşıma** üzerinden; `transport` verilmezse `localIndex`'e (§A6 çevrimdışı dizin) düşer |
| **A8 (üslup profili)** | `extractStyleProfile` / `mergeStyleProfiles` | Evet, artımlı |
| **A9 (mevcut dilekçeyi düzenleme)** | `generateSections` (bölüm bazlı) + `SectionBackend` | Evet, bölüm bölüm |
| **A13 (uzun layiha, aşamalı)** | `generateOutline` → `generateSections` → `checkDocumentConsistency` / `checkNumberingConsistency` | Evet, üç aşama da telefonda çalışan backend'lerle koşabilir |
| M6 (onay ekranı) | `MaskReview` | Evet — DOM'a dokunmaz, saf veri (M6.7) |
| M11 (kaçak yakalama) | `preflightCheck` | Evet |
| §C (devir eşiği) | `shouldOfferHandoff`, `THRESHOLDS` | Evet — **karar** telefonda verilir; devrin kendisi bu paketin dışındadır (§3) |
| B1–B3 (27B çıkarım, LoRA eğitimi, kuantizasyon) | *(bu pakette YOK)* | Hayır — bilerek yok; `docs/MODEL.md` §3.3, `docs/TRAINING.md` |

**Sonuç (M10.4'ü de kanıtlar):** Bu paketteki hiçbir dışa açık fonksiyon
`fetch`/`WebSocket` çağırmaz ya da masaüstüne muhtaç değildir — modele/ağa
erişim her zaman `Backend`/`Transport` arayüzleriyle **dışarıdan enjekte
edilir** (`NerBackend`, `AsyncNerBackend`, `ResearchTransport`,
`LocalResearchIndex`, `SummaryBackend`, `CorrelationBackend`, `OutlineBackend`,
`SectionBackend`, `ConsistencyBackend`). Ana uygulama bu arayüzlerin hepsini
**cihaz içi** bir uygulamayla doldurabilir; o zaman paketin tamamı, masaüstü
hiç var olmasa da, uçtan uca çalışır.

---

## 3. Devir teslim mimarisi — `PROTOCOL.md`'ye birebir (M10.3)

Bu paket devrin **taşıma katmanını** (mDNS keşfi, WebSocket, zarf/mesaj
gönderimi, PROTOCOL §3–§7 durum makineleri) **uygulamaz** — bunlar ana
uygulamanın networking katmanının işidir. Paketin PROTOCOL'e verdiği üç parça:

| PROTOCOL alanı | Bu paketten geldiği yer |
|---|---|
| §C.8 / eşik kararı: devir teklifi gösterilsin mi | `shouldOfferHandoff(job, calibration, device)` — `HandoffOutcome.kind === 'offer'` |
| §5.3 `maskEvidence.maskTableHash` | `MaskTable.digest()` (yalnız bu, tablo kendisi asla) |
| §5.3 `maskEvidence` ön koşulu: giden metin gerçekten maskeli mi | `assertMasked(text)` — geçmezse `UnmaskedContentError`, devir hiç başlamaz |

Kalan her şey (G1–G7 değişmezleri, zarf biçimi, durum makineleri, hata
kodları) `PROTOCOL.md`'de tanımlıdır ve **bu paketin dışındaki** bir modülün
sorumluluğudur. Bu paket PROTOCOL'ü **ihlal edebilecek** hiçbir şey yapmaz —
özellikle: maske tablosunu asla serileştirmez (S2/G1), ham metni asla ağa
göndermez (S3/G2, `assertMasked` bunu zorlar).

---

## 4. "Telefon tek başına tam işlevsel" (M10.4)

Masaüstü modülü **hiç kurulmasa**, hangi kod yolu çalışır?

| Yetenek | Masaüstü yoksa ne olur |
|---|---|
| Maskeleme (A3) | Değişmez — zaten yalnız cihazda çalışır, devir kavramı hiç girmez |
| Araştırma (A6) | `ResearchTransport` app tarafından bir internet bağlantısıyla (masaüstü DEĞİL, doğrudan ağ) sağlanabilir; hiçbiri yoksa `localIndex`'e düşer, o da yoksa `source: 'unavailable'` — çökmez |
| Üslup/few-shot/aşamalı üretim (A8/A13) | `OutlineBackend`/`SectionBackend`/`ConsistencyBackend` cihaz içi modeli çağıran bir uygulamayla doldurulur; masaüstü hiç görünmez |
| Devir kararı (§C) | `shouldOfferHandoff` her zaman çalışır; `device.desktopPaired === false` ise zaten `{ kind: 'none' }` döner — teklif hiç üretilmez |

Bu, `PROTOCOL.md` G7'nin ("masaüstünün yokluğu hiçbir özelliği kapatmaz") bu
pakette **nasıl** sağlandığının kanıtıdır: paket hiçbir yerde "masaüstü var
mı" diye sormaz; yalnız "bana bir backend/transport verildi mi" diye sorar, ve
o backend'in cihaz içi mi uzak mı olduğu paketin bilgisi dışındadır.

---

## 5. Veri akışı diyagramı (M10.5)

```
ham metin (kullanıcı girdisi / eski belge)
        │
        ▼
   mask() / maskAsync()  ──────────────► MaskTable (bellek içi, S2: ağa çıkmaz)
        │  (metin artık [TIP_N] token'lı)
        │
        ├──► YEREL İŞLEM (A8/A13): extractStyleProfile, selectFewShotExamples,
        │     generateOutline/generateSections/checkDocumentConsistency
        │     → maskeli metin hiç cihaz dışına çıkmaz
        │
        ├──► ARAŞTIRMA (A6): assertMasked() KAPISI ──► ResearchClient.search()
        │     │                                          │
        │     │  (geçmezse: UnmaskedContentError,        │ transport (ağ) veya
        │     │   hiçbir veri gitmez — S3)                │ localIndex (cihaz)
        │     ▼                                          ▼
        │   iş durur                              ResearchResponse
        │
        └──► DEVİR (§C, opsiyonel): shouldOfferHandoff() → 'offer' ise
              kullanıcı onayı (G5) → PROTOCOL taşıma katmanı (bu paketin DIŞINDA)
              → masaüstü sonucu üretir → JOB_RESULT_* → telefon doğrular
        │
        ▼
   unmask(text, table)  ──► orijinal metin geri gelir (S1: birebir)
        │
        ▼
   kullanıcı
```

Onay ekranı (`MaskReview`) bu akışın `mask()` adımını sarar: kullanıcı
müdahalesi olduğunda aynı tablo yeniden hesaplanır (M6.6), akışın geri kalanı
değişmez.

---

## 6. Kırmızı çizgiler (M10.6)

Bunlar yorum değil, ya derleyicinin ya da testin zorladığı kurallardır.

| Kırmızı çizgi | Nasıl zorlanıyor |
|---|---|
| **Araştırma ↛ maske tablosu.** `research/*` hiçbir dosyası `mask/table.ts`'i import etmez. | `import` taraması (yukarıdaki §1 haritası); `research/guard.ts` yalnız `mask/ner`, `mask/overlap`, `mask/rules`'ı import eder, `mask/table`'ı ASLA |
| **Yazma ↛ ağ.** `write/*` hiçbir dosyası `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` çağırmaz. | `write/write.test.ts` — M8.1, dosya taramasıyla test |
| **Masaüstü ↛ kalıcı depolama.** Masaüstü durumsuzdur (G3); iş bitince/iptalde/kopmada her şeyi siler. | Bu paketin **dışındaki** bir kural — burada uygulanacak kod yok, çünkü masaüstü modülü bu paketin parçası değil. Sözleşme `PROTOCOL.md` G3'te, uygulaması masaüstü kod tabanının işi |
| **Ağ yalnız araştırma katmanından.** Paketin geri kalanında hiçbir ağ API çağrısı yok. | `research/research.test.ts` — M7.5, dosya taramasıyla test (research hariç HER dosya) |
| **Maske tablosu asla serileştirilemez.** | `MaskTable.toJSON()` her zaman fırlatır (S2) — derleme zamanı değil çalışma zamanı zorlaması, ama istisnasız |
| **İç modüller `index.ts` dışına sızmaz.** | Uygulama kodu yalnız `src/index.ts`'ten import eder (M13.1); iç dosya yollarına (`packages/hukuk-ai/src/mask/table` gibi) bağımlı üretim kodu yazılmaz — bu bir derleme kısıtı değil, kod inceleme kuralıdır |

---

## Kapsam dışı not

Bu belge `packages/hukuk-ai`'nin **kendi** mimarisini anlatır. Ana uygulamanın
(`src/`, kök) hangi ekranın bu paketi nasıl çağıracağı, masaüstü eşleştirme
UI'ı, gerçek WebSocket taşıması gibi konular bu paketin kapsamı dışındadır
(oturum kuralı: yalnız `packages/hukuk-ai/` içinde çalışılır).
