# ARCHITECTURE — `packages/hukuk-ai`

Plan M10. Bu belge kod değildir; modül haritasını, telefon-masaüstü iş
bölümünü, devir mimarisini ve veri akışını **var olan koda göre** anlatır.
Diyagramlar `src/` içindeki gerçek `import` ifadelerinden çıkarılmıştır
(aşağıda her ok bir gerçek dosya bağımlılığına karşılık gelir).

---

## 1. Modül haritası ve bağımlılık yönü

```
types/entities.ts   (temel tipler — hiçbir şeye bağımlı değil)
turkish/suffix.ts    (Türkçe ek ayırma — hiçbir şeye bağımlı değil)
handoff/threshold.ts (devir eşiği motoru — hiçbir şeye bağımlı değil)
        ▲                ▲                        ▲
        │                │                        │
mask/token.ts ────────────┘
mask/overlap.ts ───────────┘
mask/rules/*.ts ───────────┘
mask/ner/*.ts ─────────────┴── turkish/suffix.ts
mask/table.ts ── mask/token.ts
        │
        ▼
mask/mask.ts ── (mask/rules, mask/ner, mask/overlap, mask/table, mask/token)
        │
        ├──► mask/preflight.ts   (mask/mask)
        └──► mask/review.ts      (mask/mask, mask/table, mask/token, turkish/suffix)

research/guard.ts ── (mask/rules, mask/ner, mask/overlap, types/entities)
        │             ↑ NOT mask/table — bkz. §6 kırmızı çizgi
        ▼
research/client.ts ── research/guard.ts
        │
        ▼
research/summarize.ts ── research/client.ts (yalnız tip)

write/skeleton.ts    (hiçbir şeye bağımlı değil)
        ▼
write/style.ts ── write/skeleton.ts
write/fewshot.ts     (hiçbir şeye bağımlı değil)
write/generate.ts ── (write/style, write/fewshot — yalnız tip)

index.ts ── hepsi (tek dışa açılan yüzey, M13.1)
```

**Okuma kuralı:** ok `A ── B` "A, B'yi import eder" demektir. `mask/`,
`research/`, `write/` üç kardeş modül birbirini **yatay olarak import etmez**
— yalnız `research/guard.ts` maskeleme mekanizmasını (kural + NER + çakışma
çözümü) tekrar kullanır, çünkü kapı maskelemenin AYNISINI ters yönde koşmak
zorundadır (`SPEC.md` §"Kapı, kural katmanını ters yönde koşar"). `write/`
hiçbir kardeş modülü import etmez.

---

## 2. Telefon-masaüstü iş bölümü — `CAPABILITIES.md` A/B ile birebir

| Kod modülü | `CAPABILITIES.md` maddesi | Nerede çalışır |
|---|---|---|
| `mask/*` | A3 — kısıtsız, tam kapasite | **Yalnız telefon.** Devri yok, eşiği yok |
| `turkish/suffix.ts` | A3'ün alt bileşeni (S6) | Telefon |
| `mask/ner/*` (sözlük backend) | A3.2 — NER katmanı | Telefon; `NerBackend` arayüzü sayesinde model takılabilir |
| `research/client.ts` (`localIndex` yolu) | A6 — çevrimdışı cevap | Telefon, ağ yokken de çalışır (M7.7) |
| `research/client.ts` (`transport` yolu) | A6 — ağa çıkan TEK modül | Telefon, ağ TAŞIMASI dışarıdan verilir |
| `research/summarize.ts` | A6 — özetleme + K bağımsız ilişkilendirme | Telefon; cihaz içi `SummaryBackend`/`CorrelationBackend` |
| `write/skeleton.ts`, `write/style.ts`, `write/fewshot.ts` | A8 — üslup profili, artımlı | Telefon |
| `write/generate.ts` | A7/A9/A13 — aşamalı üretim | Telefon; cihaz içi `WriteBackend` (Qwen3.5-2B sınıfı, `MODEL.md` §3.2) |
| `handoff/threshold.ts` | §C — devir eşikleri | Telefon; **yalnız karar verir**, devrin kendisini yapmaz |
| *(bu pakette yok)* | B1 — Mizan-27B çıkarımı | **Yalnız masaüstü**, isteğe bağlı kalite yükseltmesi |
| *(bu pakette yok)* | B2 — LoRA/QLoRA eğitimi | **Yalnız masaüstü** (`TRAINING.md`, M9 tamamlanınca) |
| *(bu pakette yok)* | B3 — model kuantizasyonu | Kurulum işidir, kullanıcı akışında yok |

Tabloda görüldüğü gibi: **paketin gövdesi (mask/research/write/handoff)
tamamı telefon kodudur.** B listesindeki üç madde bu pakette kod olarak hiç
yoktur — çünkü onlar "telefon + masaüstü" değil, salt "yalnız masaüstünde
çalışabilen ağırlık/eğitim işidir" (§0 bölünemez yerleşik bellek).

---

## 3. Devir teslim mimarisi — `PROTOCOL.md` ile bağ

Bu paketteki **tek** devirle ilgili kod `handoff/threshold.ts`'tir ve tek
sorumluluğu şudur: `shouldOfferHandoff(trigger, state)` — eşik aşıldı mı,
aşılmadıysa asla teklif üretmez (M12.9 sınır değeri testleriyle doğrulanır).

`PROTOCOL.md`'nin tanımladığı zarf biçimi, mesaj tipleri (`JOB_OFFER`,
`JOB_ACCEPT`, …), durum makineleri (§6) ve hata kodları (§9) bu pakette
**kod olarak henüz yazılmadı** — `PLAN-HUKUKAI.md`'de bunu talep eden ayrı
bir M maddesi yok; taşıma/durum makinesi implementasyonu, cihaz içi model
çalıştırma gibi, bu paketin kapsamı dışında (ana uygulama veya ayrı bir
gelecek modül) yaşayacaktır. Bu belgenin görevi, o implementasyon
yazıldığında **hangi kırmızı çizgilere uyması gerektiğini** önceden
sabitlemektir (§6).

`handoff/threshold.ts` → `PROTOCOL.md` bağı:

| `handoff/threshold.ts` | `PROTOCOL.md` karşılığı |
|---|---|
| `shouldOfferHandoff` `false` dönerse | Hiçbir `JOB_OFFER` üretilmez — telefon `LOCAL_QUEUED`'da kalır (§6 durum makinesi) |
| `shouldOfferHandoff` `true` dönerse | Uygulama katmanı kullanıcıya sorar (G5); onaylanırsa `JOB_OFFER` gönderilir |
| `DeviceCalibration` | §C.0 kalibrasyon turunun sonucu — eşik hesaplamasının girdisi |
| `HandoffOutcome` | Denetim kaydının (`PROTOCOL.md` §10) `outcome` alanına eşlenir |

**Devrin maskeleme koşulu** (`PROTOCOL.md` G2, `maskEvidence`) bu paketin
`mask/` çıktısından üretilir: `MaskResult` zaten `maskContractVersion`,
varlık sayısı ve tipleri gibi alanları taşımaya elverişlidir; `maskTableHash`
üretimi (SHA-256 özet) bu paketin dışında, tabloyu asla dışarı vermeyen bir
adaptör katmanında yapılmalıdır (S2, G1).

---

## 4. Telefon tek başına tam işlevsel — hangi kod yolu çalışır

`PROTOCOL.md` G7: "Masaüstünün yokluğu hiçbir özelliği kapatmaz." Bu paket
düzeyinde bunun karşılığı **enjekte edilebilir, isteğe bağlı bağımlılıklardır
— hiçbiri zorunlu değildir:**

| Uzak/isteğe bağlı girdi | Verilmezse ne olur | Kanıtlayan kod |
|---|---|---|
| `ResearchClientOptions.transport` | `#fallback` çalışır → `localIndex` varsa yerel sonuç, yoksa `source: 'unavailable'`, **hata fırlatmaz** | `research/client.ts` `#fallback`, M7.7 testi |
| `ResearchClientOptions.localIndex` | Yukarıdakiyle birlikte yoksa boş sonuç döner, çökmez | `research.test.ts` "ne ağ ne yerel dizin varsa" |
| `GuardOptions.ner` | Kapı yalnız desenli (kural katmanı) tipleri görür; kapı yine de çalışır, zayıflığı `SPEC.md` §7/2'de yazılı | `research/guard.ts` |
| `SummaryBackend` / `CorrelationBackend` | Bu paketin dışında sağlanmak ZORUNDADIR — ama bu backend'in **cihaz içi** (telefonun kendi modeli) olması yeterlidir, masaüstü gerekmez | `research/summarize.ts` arayüzleri |
| `WriteBackend` | Aynı şekilde cihaz içi model; masaüstü değil, telefonun kendi Qwen3.5-2B sınıfı modeli (`MODEL.md` §3.2) bu arayüzü doldurur | `write/generate.ts` arayüzleri |

Sonuç: **"masaüstü" kavramı bu paketin hiçbir fonksiyon imzasında yer
almaz.** Yalnız iki tür dışa bağımlılık var — "ağ taşıması" (yalnız A6/research
için, isteğe bağlı) ve "cihaz içi model backend'i" (write/research-summarize
için zorunlu ama bu bağımlılık **telefonun kendi modelidir**, masaüstü değil).
Masaüstü, `handoff/threshold.ts`'in `true` dediği ve kullanıcının onayladığı
nadir durumlarda devreye giren bir **hızlandırıcıdır**, bir ön koşul değil.

---

## 5. Veri akışı diyagramı

```
ham metin
   │
   ▼
mask/mask.ts  ──── mask/rules (kural, S5 önce koşar)
   │           └── mask/ner   (kalan aralıklarda)
   │           └── mask/overlap (çakışma çözümü, §6.1)
   ▼
maskelenmiş metin + MaskTable (yalnız bellekte / şifreli, S2)
   │
   ├──► YEREL İŞLEM (A2, A4, A5, A7, A8, A9, A10, A11, A12, A13)
   │      write/*, handoff eşiği altındaysa her zaman burada biter
   │
   ├──► ARAŞTIRMA (A6) — research/client.ts
   │      │
   │      ├─ assertMasked() geçmezse ─► UnmaskedContentError, HİÇBİR VERİ GİTMEZ (S3)
   │      │
   │      ├─ transport varsa ─► ağ ─► ResearchDocument[] (source: 'network')
   │      └─ transport yok/patlarsa ─► localIndex ─► (source: 'local' | 'unavailable')
   │
   └──► DEVİR (yalnız handoff eşiği aşıldı VE kullanıcı onayladıysa)
          │
          │  PROTOCOL.md: maskEvidence zorunlu (G2), tablo asla gitmez (G1)
          ▼
        masaüstü (durumsuz işçi, G3) ─► JOB_RESULT_* ─► telefon
   │
   ▼
unmask(text, table)  ── §5 algoritması: soldan sağa, kaçış çözme, unresolved[]
   │
   ▼
kullanıcıya gösterilen metin (+ varsa unresolved uyarısı, SPEC §5)
```

**Kritik gözlem:** `unmask` her zaman **telefonda** çalışır — `MaskTable`
hiçbir dalda (yerel işlem, araştırma, devir) pakedin dışına çıkmaz; devir
dalı bile yalnız *maskelenmiş* metni ve *kanıtı* taşır, tabloyu değil.

---

## 6. Kırmızı çizgiler — hangi modül hangi modülü import edemez

Aşağıdaki satırlar §1'deki gerçek `import` taramasıyla doğrulanmıştır
(bu belge yazılırken `grep -E "^import"` ile tek tek kontrol edildi):

| Kırmızı çizgi | Neden | Şu an kod bunu ihlal ediyor mu? |
|---|---|---|
| `research/*` → `mask/table.ts` (`MaskTable`) import **edemez** | Araştırma katmanı tabloyu hiç görmemeli; görürse yanlışlıkla sızdırma yüzeyi büyür | **Hayır.** `research/guard.ts` yalnız `mask/rules`, `mask/ner`, `mask/overlap`'i kullanır |
| `write/*` → ağ API'si (`fetch`, `WebSocket`, …) çağıramaz | A8/A9/A13 tamamen cihaz içi | **Hayır**, M8.1 testiyle sürekli doğrulanır |
| `mask/*` → `research/*` veya `write/*` import **edemez** | Maskeleme, kendinden sonraki hiçbir katmana bağımlı olmamalı — SPEC'in bağımsız, önce koşan temel katmanı | **Hayır** |
| Paketin geneli → ağ API'sine yalnız `research/client.ts`'in **enjekte edilen** `ResearchTransport`'u üzerinden çıkabilir; doğrudan `fetch`/`WebSocket` çağrısı hiçbir dosyada olamaz | Ağa çıkan tek modül A6; kodun kendisi asla soket açmaz, taşımayı dışarıdan alır | **Hayır**, M7.5 testiyle doğrulanır |
| `write/*` → `mask/*` veya `research/*` import **edemez** | Yazma katmanı üslup/iskelet/few-shot işidir; maskelenmiş veriyle bile doğrudan çalışmaz, girdisini çağıran taraf hazırlar | **Hayır** |
| *(paket dışı, gelecek implementasyon)* masaüstü işçisi → kalıcı depolama yazamaz | `PROTOCOL.md` G3 — durumsuzluk | Bu paketin kapsamı dışında; kod yazıldığında bu tablo genişletilmeli |

Bu tablo, `docs/PLAN-HUKUKAI.md`'nin M0.3 tarzı yalıtım testleriyle aynı
disiplini izler: iddia edilen her kırmızı çizgi, ya bir testle ya da doğrudan
kaynak taramasıyla doğrulanabilir olmalıdır. Yeni bir modül eklenirse bu
tablo güncellenir.
