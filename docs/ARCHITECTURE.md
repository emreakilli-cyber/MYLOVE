# ARCHITECTURE — `packages/hukuk-ai`

Plan M10. Bu belge kod yazmaz, var olan kodu ve sözleşmeleri (`docs/SPEC.md`,
`docs/PROTOCOL.md`, `docs/CAPABILITIES.md`) tek bir haritada birleştirir.
Modül haritası (§1) **gerçek `import` grafiğinden** çıkarıldı, tahminden
değil — doğrulama komutu §1 sonunda.

---

## 1. Modül haritası ve bağımlılık yönü (M10.1)

```
                         types/entities.ts   turkish/suffix.ts
                          (temel, bağımsız)   (temel, bağımsız)
                                │  ▲                │
              ┌─────────────────┼──┼────────────────┤
              │                 │  │                │
              ▼                 │  │                ▼
        mask/rules/*      mask/token.ts       mask/ner/*
        mask/overlap.ts         │                   │
              │                 │                   │
              └────────┬────────┴─────────┬─────────┘
                        ▼                  │
                  mask/table.ts            │
                        │                  │
                        └────────┬─────────┘
                                 ▼
                            mask/mask.ts  ◄──────────────┐
                            (mask/maskAsync/unmask)       │
                                 │                        │
                        ┌────────┴────────┐               │
                        ▼                 ▼               │
                mask/review.ts   mask/preflight.ts         │
                (MaskReview)     (preflightCheck)          │
                                                            │
        research/guard.ts ──────────────────────────────── ┘
        (mask/ner, mask/overlap, mask/rules'i DOĞRUDAN     mask/mask.ts'i DEĞİL,
         kullanır — ters yönde aynı tespiti koşar)         alt katmanları kullanır (§6)
              │
              ▼
        research/client.ts (ResearchClient)
              │
        ┌─────┴─────┐
        ▼           ▼
  research/       research/
  summarize.ts    correlate.ts


        write/structure.ts   write/textStats.ts
        (ikisi de bağımsız — mask/'a, research/'a HİÇ dokunmuyor)
                    │               │
                    └───────┬───────┘
                             ▼
                    write/styleProfile.ts
                             │
                    ┌────────┴────────┐
                    ▼                 │
             write/fewShot.ts         │
                    │                 │
                    └────────┬────────┘
                             ▼
                     write/generate.ts


        handoff/threshold.ts  (tamamen bağımsız — hiçbir iç modülü import etmez)


                          src/index.ts
             (hepsinin TEK dışa açılan kapısı — M13.1)
```

**Doğrulama:** grafiğin kendisi `grep -rn "^import" src --include="*.ts"`
çıktısından üretildi (test dosyaları hariç); bu belge o çıktının elle
çizilmiş hâlidir. `package.test.ts` (M0.3) paketin dışına çıkan bir import
olmadığını zaten doğruluyor; bu diyagram paketin **içindeki** yönü gösterir.

**Dikkat çeken üç şey:**
1. `research/guard.ts`, `mask/mask.ts`'i import ETMEZ — kural/NER
   katmanlarını **doğrudan**, kendi başına, ters yönde koşar (`guard.ts`
   dosya başı yorumu: "maskeleme neyi bulup gizliyorsa, kapı da aynı şeyi
   bulup engeller"). Bu bilinçli bir ayrıklıktır, eksiklik değil.
2. `write/*` hiçbir `mask/` ya da `research/` dosyasını import etmez.
   Yazma katmanı üslup/iskelet/few-shot için maskelenmiş ya da maskelenmemiş
   metin farkı gözetmez — kendi girdisini olduğu gibi işler, çağıran taraf
   (ana uygulama) maskelemeyi ne zaman uygulayacağına karar verir.
3. `handoff/threshold.ts` paketin geri kalanından **tamamen** izole —
   yalnız sayısal eşik kararı verir, hiçbir veri modeline dokunmaz.

---

## 2. Telefon–masaüstü iş bölümü (M10.2)

`CAPABILITIES.md` A/B listesiyle birebir. Bu paketteki kod karşılığı:

| CAPABILITIES | Kapsam | Bu pakette karşılığı |
|---|---|---|
| A3 (maskeleme, kısıtsız) | Telefon, her zaman | `mask/*` — tamamı, koşulsuz |
| A6 (araştırma/özet/ilişkilendirme) | Telefon, ağa çıkan tek nokta | `research/*` |
| A7–A9 (şablon, üslup, düzenleme) | Telefon, aşamalı | `write/*` |
| A10–A13 (dosya sentezi, arşiv, ses, uzun layiha) | Ana uygulama (Dexie + kuyruk); bu paket yalnız A13'ün **orkestrasyon şeklini** (`write/generate.ts`) sağlar | Paket dışı + `write/generate.ts` |
| B1 (27B model çıkarımı) | Masaüstü, isteğe bağlı | Bu pakette kod YOK — yalnız `docs/MODEL.md` §3.3 kararı ve `write/generate.ts`'teki pluggable `OutlineBackend`/`SectionBackend`/`ConsistencyBackend` arayüzlerinin **arkasında** çalışabilir |
| B2 (LoRA/QLoRA eğitimi) | Masaüstü, ileri aşama | Bu pakette kod YOK — `docs/TRAINING.md` (M9) yalnız belge; eğitilmiş adapter, yine `SectionBackend` gibi bir arka uç olarak eklenir |
| B3 (model hazırlama/kuantizasyon) | Masaüstü, kurulum işi | Bu pakette kod YOK |

**Önemli:** B listesindeki hiçbir madde bu paketin **arayüzünü**
değiştirmez. B1/B2/B3, `write/generate.ts`'teki `SectionBackend` gibi
arayüzleri uygulayan **farklı bir uygulama** olarak eklenir — pakette "eğer
masaüstü varsa şunu yap" biçiminde dallanan kod yoktur ve olmayacaktır (bkz.
§4).

---

## 3. Devir teslim mimarisi (M10.3)

Bu paket devir teslimin **taşıma protokolünü uygulamaz** — `docs/PROTOCOL.md`
G1–G7 değişmezlerini tanımlayan sözleşme, WebSocket/mDNS/eşleşme kodu ana
uygulama katmanındadır. Paketin buradaki tek sorumluluğu, protokolün G2'sini
("Masaüstüne yalnız maskelenmiş içerik gider") **üretebilecek** yapı
taşlarını sağlamaktır:

| PROTOCOL kavramı | Bu pakette karşılık gelen |
|---|---|
| G1 — tablo ağa çıkmaz | `MaskTable.toJSON()` fırlatır; ağa çıkabilen tek biçim `.digest()` (§PROTOCOL §5.3 `maskTableHash` ile aynı sha256) |
| G2 — yalnız maskelenmiş içerik | `mask()`/`maskAsync()` çıktısı; `PROTOCOL.maskEvidence.entityCount`/`entityTypes` `MaskResult.spans`'tan türetilir |
| §5.3 `maskEvidence.maskContractVersion` | `docs/SPEC.md` başındaki `maskContractVersion: 1.0.0` |
| §7.1.4 — "yarım kalan iş kaybolmaz, ara ürün diske yazılmıştır" | `write/generate.ts`'teki `resume: {outline, sections}` — aynı aşamalı-devam ilkesinin kod karşılığı |
| §6 masaüstü durum makinesi `RUNNING` | `SectionBackend.writeSection`/`OutlineBackend.outline`/`ConsistencyBackend.review` — hangi taraf (telefon içi model mi, masaüstü mü) çalıştırdığı bu arayüzlerin **arkasında**, pakete görünmez |

Paket kasıtlı olarak "kim çalıştırıyor" sorusuna kör bırakılmıştır: bir
`SectionBackend` uygulaması yerel modeli de sarabilir, masaüstüne
PROTOCOL üzerinden devredilmiş bir işi de sarabilir — `generateDraft`
ikisini ayırt etmez. Devir kararının kendisi (`shouldOfferHandoff`,
§M10.2 tablosundaki eşik) ile devrin **yürütülmesi** (PROTOCOL) bu şekilde
ayrışır.

---

## 4. Telefon tek başına tam işlevsel (M10.4)

`PROTOCOL.md` G7: "Masaüstünün yokluğu hiçbir özelliği kapatmaz." Bu
pakette bunun kod karşılığı **negatif bir olgu**: hiçbir dosya "masaüstü var
mı" diye sormaz.

- `mask/*`, `research/*` çekirdeği (guard, client), `write/structure.ts`,
  `write/styleProfile.ts`, `write/fewShot.ts` — hiçbiri bir arka uç (backend)
  parametresi bile almaz; her zaman aynı kod yolu çalışır, cihazdan
  bağımsız.
- `research/summarize.ts`, `research/correlate.ts`, `write/generate.ts` —
  arka uç (`SummaryBackend`, `CorrelationBackend`, `OutlineBackend`,
  `SectionBackend`, `ConsistencyBackend`) **zorunlu parametredir** (ya da
  `summarize.ts`'te olduğu gibi modelsiz varsayılanı vardır,
  `createExtractiveSummaryBackend`). Masaüstü **eşleşmemişse**, çağıran
  taraf bu arka uca telefon içi modeli (`docs/MODEL.md` §3.2 — 2B sınıfı,
  Q4) sarar; masaüstü **eşleşmişse**, aynı arayüzün arkasına PROTOCOL
  üzerinden devredilmiş bir çağrı sarılır. Paket kodu **iki durumda da
  aynıdır** — dallanma yoktur, dallanma çağıranın arka uç seçiminde yaşar.
- `handoff/threshold.ts` — `device.desktopPaired === false` girdisi
  verildiğinde `shouldOfferHandoff` zaten `{kind:'none'}` döner
  (§C.6/bellek dışında); masaüstü hiç kurulmasa bu dal hiç tetiklenmez,
  geri kalan her şey (mask, research yerel dizin, write) zaten çalışıyordu.

**Sonuç:** Masaüstü modülü silinse, bu paketin **derlemesi bile etkilenmez**
— çünkü paket masaüstüne ait hiçbir tip veya kodu import etmiyor (§1). Tek
gözlenebilir fark, `research.search()`'ün `source: 'local'`/`'unavailable'`
dönmesi (ağ da yoksa) ve `write/generate.ts`'e verilen arka uçların telefon
içi modeli sarması.

---

## 5. Veri akışı (M10.5)

```
  ham metin (kullanıcı girdisi / eski dilekçe / duruşma notu)
        │
        ▼
  ┌───────────────────────────────────────────────┐
  │  mask() / maskAsync()           (mask/mask.ts) │
  │  kural katmanı → NER katmanı → çakışma çözümü  │
  └───────────────────────────────────────────────┘
        │
        ▼
  MaskResult { text: maskelenmiş metin, table, spans, suspects }
        │
        ├──────────────────────────┬───────────────────────────┐
        ▼                          ▼                            ▼
  YEREL İŞLEM                 ARAŞTIRMA                     DEVİR (B1/B2 arka ucu)
  write/structure.ts          research/client.ts             write/generate.ts'teki
  write/styleProfile.ts       └─ önce assertMasked()          Section/Outline/Consistency
  write/fewShot.ts               (research/guard.ts) —        Backend arayüzü ÜZERİNDEN,
  write/generate.ts              maskelenmemiş metin           PROTOCOL.md G2 uyarınca YALNIZ
  (maskelenmiş VEYA               kapıyı GEÇEMEZ                maskelenmiş metin (maskEvidence
   maskelenmemiş girdiyle                                       ile) masaüstüne gider
   çalışır — §1 not 2)
        │                          │                            │
        └──────────────┬───────────┴────────────────────────────┘
                        ▼
              model/işlem çıktısı (hâlâ maskelenmiş — token'lar aynen çıktıda geçer)
                        │
                        ▼
              unmask(text, table)          (mask/mask.ts)
                        │
                        ▼
              UnmaskResult { text: kullanıcının okuyacağı gerçek metin, unresolved }
                        │
                        ▼
                    KULLANICI
```

**Ok üzerindeki tek asimetri:** araştırma dalına giden metin `assertMasked`
kapısından geçmek **zorundadır** (M7.2 — atlanamaz); yerel işlem ve devir
dallarına giden metin için bu kapı **çağıranın sorumluluğudur** — paket
onu dayatmaz çünkü A9 gibi bazı yerel işler (mevcut dilekçeyi düzenleme)
zaten maskelenmemiş kendi belgesi üzerinde çalışabilir. Devir dalında
zorunluluk PROTOCOL.md G2/G1 tarafında (§3) sağlanır, bu paketin dışındadır.

---

## 6. Kırmızı çizgiler (M10.6)

| Kırmızı çizgi | Şu an kodda | Nasıl doğrulanır |
|---|---|---|
| **araştırma ↛ maske tablosu** | `research/*` hiçbir dosyada `mask/table` import etmez (§1 grafiği) — `research/guard.ts` kural/NER'i **doğrudan**, `MaskTable`'a hiç dokunmadan koşar | `grep -rL "mask/table" research/*.ts` boş küme (test dosyaları hariç) |
| **yazma ↛ ağ** | `write/*`'ta `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` çağrısı yok | `write/network.test.ts` (M8.1) + paket geneli `research.test.ts`'teki tarama (M7.5) |
| **masaüstü ↛ kalıcı depolama** | Bu paket masaüstü kodu içermiyor (§1, §4) — kural `PROTOCOL.md` G3'te ("Masaüstü durumsuzdur... Kalıcı depolama yapmaz") tanımlı ve masaüstü modülünün kendi sorumluluğu | `PROTOCOL.md` §6 durum makinesi: her yol `WIPED`'de biter; bu paketin test edebileceği bir şey değil (kod burada yok) |
| **(ek) yazma ↛ maskeleme dahili** | `write/*` `mask/`'ın hiçbir iç modülünü import etmez (§1) — girdisini olduğu gibi işler, maskeleme kararını dayatmaz | `grep -rn "from '\.\./mask" write/*.ts` boş küme |
| **(ek) hiçbir modül paket dışına çıkmaz** | M0.3 — paket sıfır bağımlı, ana uygulamadan import yok | `package.test.ts` |

İlk üçü doğrudan görev tanımındaki kırmızı çizgilerdir; son ikisi bu
paketin kendi iç tutarlılığından doğal olarak çıkan, aynı sınıftan ek
gözlemlerdir.
