# API — `packages/hukuk-ai` genel yüzeyi

Plan M13.2–M13.5. Bu dosya, `packages/hukuk-ai/src/index.ts`'ten dışa açılan
**her** fonksiyon/sınıf/tip için imza, parametre, dönüş, fırlatabileceği
hatalar ve bir örnek verir (M13.2). Tek giriş kapısı `index.ts`'tir (M13.1);
burada listelenmeyen hiçbir şey pakedin dışından erişilebilir değildir.

Sözleşme belgeleriyle bağ: davranışın **neden** böyle olduğu burada değil,
`docs/SPEC.md` (maskeleme sözleşmesi) ve `docs/PROTOCOL.md`'de (telefon ↔
masaüstü) yazılıdır. Bu dosya yalnız **ne** çağrılacağını anlatır; her bölüm
ilgili SPEC/PROTOCOL maddesine atıf yapar.

**Örneklerdeki import satırı hakkında:** paketin henüz kendi `package.json`'ı
yok (S2 — ortak dosyalara dokunulmadı), dolayısıyla dışarıdan gerçek bir paket
adıyla import edilmiyor. Aşağıdaki `import { ... } from '@juriscalendar/hukuk-ai'`
satırları **gösterimseldir**: hangi sembolün nereden geldiğini anlatır, ana
uygulamaya bağlanma yolu değildir. Ana uygulama bu paketi kullanmaya
başladığında (bu paketin kapsamı dışında bir karar) gerçek import yolu burada
güncellenecektir.

## Kararlılık sözü (M13.5)

| Grup | Durum | Anlamı |
|---|---|---|
| Maskeleme (`mask`, `unmask`, `maskAsync`, `MaskReview`, `MaskTable`, `preflightCheck`, kural/NER dedektörleri) | **Kararlı** | `SPEC.md` §1 (S1–S7) değişmezleriyle korunur; imza kırılırsa `SPEC.md` §8'e göre `MAJOR` bump gerekir. |
| Araştırma kapısı (`assertMasked`, `findUnmaskedContent`, `UnmaskedContentError`, `ResearchClient`) | **Kararlı** | `PROTOCOL.md` G1/G2'nin doğrudan uygulayıcısı; gevşetilemez. |
| Devir eşikleri (`shouldOfferHandoff`, `THRESHOLDS`) | **Kararlı** | `CAPABILITIES.md` §C'nin doğrudan uygulayıcısı. |
| Sonuç özetleme/ilişkilendirme (`summarizeDocument(s)`, `correlateWithEvent`) | **Deneysel** | M7.6'da yeni eklendi; bütçe sabitleri (`MAX_EVENT_SUMMARY_TOKENS` vb.) gerçek model ölçümüyle değişebilir. |
| Yazma katmanı (`extractSkeleton`, `StyleProfile` ailesi, `selectFewShot`, `planSkeleton`/`writeSections`/tutarlılık geçişi) | **Deneysel** | M8'de yeni eklendi; `StyleProfile`'ın alan kümesi ve bütçe sabitleri gerçek kullanımla değişebilir. Değişiklik `MINOR` sayılır (yeni alan eklenmesi mevcut kodu kırmaz), alan **silinmesi/anlamının değişmesi** `MAJOR` sayılır. |

"Deneysel" olmak, sözleşme dışı olmak anlamına gelmez: `runsLocally: true`
gibi güvenlik/mimari garantiler (M8.1, M3.6 ile aynı desen) deneysel modüllerde
de değişmez. Deneysel olan yalnız veri şekli ve bütçe sabitleridir.

## Hata tipleri kataloğu (M13.3)

| Hata | Fırlatan | Ne zaman | `SPEC`/`PROTOCOL` bağı |
|---|---|---|---|
| `MaskReviewError` | `MaskReview` | Bilinmeyen token, geçersiz aralık, token üretilemedi | M6 |
| `MaskTableSerializationError` | `MaskTable.toJSON()`, `exportEncrypted()` | `JSON.stringify` denemesi; 8 karakterden kısa parola | SPEC S2 / PROTOCOL G1 |
| `MaskTableDecryptError` | `MaskTable.importEncrypted()` | Bilinmeyen biçim; yanlış parola veya bozulmuş veri (ayırt edilmez) | SPEC §9 |
| `UnmaskedContentError` | `assertMasked`, `ResearchClient.search` | Ağa çıkan metinde maskelenmemiş kimlik verisi bulundu | SPEC S3, PROTOCOL 6003 |
| `EventSummaryTooLongError` | `correlateWithEvent` | Olay özeti `MAX_EVENT_SUMMARY_TOKENS`'ı aşıyor | `CAPABILITIES.md` A6 |
| `DocumentTooLongForSummaryError` | `summarizeDocument(s)` | Belge `MAX_DOCUMENT_TOKENS_FOR_SUMMARY`'yi aşıyor | `CAPABILITIES.md` A6 |
| `SkeletonPlanningInputTooLongError` | `planSkeleton` | Olay özeti `SKELETON_MAX_CONTEXT_TOKENS`'ı aşıyor | `CAPABILITIES.md` A13 |
| `ConsistencyReviewInputTooLongError` | `reviewNarrativeConsistency` | Özetler `CONSISTENCY_PASS_MAX_TOKENS`'ı aşıyor | `CAPABILITIES.md` A13 |

Ortak desen: bu paket **asla sessizce kırpıp devam etmez**. Bütçe aşılınca
işlem başlamadan önce hata fırlatılır (bkz. her bölümdeki "Fırlatır"
satırları). `unmask` bu kuralın TEK istisnasıdır: SPEC §5.1 gereği bilinmeyen
token'da çökmez, `unresolved` listesine ekler — çünkü çökmek, ham model
çıktısını kullanıcıdan tamamen gizlemekten daha kötüdür.

---

## `mask/mask.ts` — maskeleme ve geri alma

Bağ: `SPEC.md` §3, §5, §6.

### `mask(input: string, options?: MaskOptions): MaskResult`

- **Parametreler:** `input` — ham metin. `options.table?: MaskTable` (var olan
  tabloya ekler, SPEC §4.2), `options.maskDates?: boolean` (varsayılan `true`,
  SPEC §7/8), `options.ner?: NerBackend` (verilmezse yalnız kural katmanı).
- **Dönüş:** `MaskResult = { text, table, spans, suspects }`.
- **Fırlatır:** Fırlatmaz.

```ts
import { mask } from '@juriscalendar/hukuk-ai'

const result = mask('Müvekkil TC 10000000146, 0532 111 22 33 numarasından arandı.')
result.text // "Müvekkil TC [TCKN_1], [TEL_1] numarasından arandı."
```

### `maskAsync(input: string, options?: MaskAsyncOptions): Promise<MaskResult>`

- **Parametreler:** `mask` ile aynı; `options.ner?: NerBackend | AsyncNerBackend`
  — model tabanlı (eşzamansız) NER arka uçları için.
- **Dönüş:** `Promise<MaskResult>`.
- **Fırlatır:** Fırlatmaz (backend'in kendi hatası dışında).

```ts
const result = await maskAsync(text, { ner: myAsyncModelBackend })
```

### `unmask(text: string, table: MaskTable): UnmaskResult`

- **Parametreler:** `text` — token içeren metin (model çıktısı olabilir).
  `table` — `mask()`'in ürettiği tablo.
- **Dönüş:** `UnmaskResult = { text, unresolved }`. `unresolved` boş değilse
  model uydurmuş/bozmuş bir token var demektir (SPEC §5.1) — çağıran taraf
  kullanıcıyı uyarmalıdır.
- **Fırlatır:** Fırlatmaz. Bozuk/bilinmeyen token'da bile çökmez.

```ts
const { text, unresolved } = unmask('[KISI_1] ile görüşüldü.', result.table)
if (unresolved.length > 0) warnUser(unresolved)
```

**Tipler:** `MaskOptions`, `MaskAsyncOptions`, `MaskResult`, `UnmaskResult` —
bkz. `mask/mask.ts` kaynak yorumları.

---

## `mask/ner/` — NER katmanı arayüzü ve varsayılan uygulama

Bağ: `SPEC.md` §6/S5, `MODEL.md` §3.1.

### `createDictionaryNerBackend(options?: DictionaryNerOptions): NerBackend`

- **Parametreler:** `options.people?`, `options.organizations?`,
  `options.workplaces?` — cihazdaki kayıtlardan gelen ad listeleri.
- **Dönüş:** `NerBackend` (`runsLocally: true`) — `mask()`/`maskAsync()`'e
  `ner` olarak verilir.
- **Fırlatır:** Fırlatmaz.

```ts
const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
mask(text, { ner })
```

### `freeRegions(textLength: number, taken: readonly {start,end}[]): readonly FreeRegion[]`

- **Parametreler:** `textLength` — tam metin uzunluğu. `taken` — kural
  katmanının işgal ettiği aralıklar.
- **Dönüş:** Kural katmanının DOKUNMADIĞI aralıklar — özel NER backend
  yazanlar için yardımcı (S5'i elle uygulamak isteyenler).
- **Fırlatır:** Fırlatmaz.

```ts
const regions = freeRegions(text.length, ruleSpans)
```

**Tipler:** `NerBackend`, `AsyncNerBackend`, `NerCandidate`, `FreeRegion`,
`NerEntityType`, `DictionaryNerOptions`.

---

## `mask/review.ts` — onay ekranı API'si

Bağ: plan M6. Saf veri, DOM'a dokunmaz.

### `new MaskReview(originalText: string, options?: MaskOptions)`

- **Parametreler:** `mask()` ile aynı `options`.
- **Fırlatır:** Fırlatmaz (kurucu).

### `MaskReview.listMasks(): readonly ReviewMask[]`

- **Dönüş:** İlk geçiş sırasına göre maske listesi (token, tip, kök, geçiş
  sayısı, güven, katman).

```ts
const review = new MaskReview(text)
for (const m of review.listMasks()) console.log(m.token, m.canonical)
```

### `MaskReview.addMask(range: TextRange, type: EntityType): string`

- **Parametreler:** `range` — `sourceText` üzerinde `{start, end}`. `type` —
  atanacak varlık tipi.
- **Dönüş:** Üretilen/eşlenen token.
- **Fırlatır:** `MaskReviewError` — `range` metin sınırları dışındaysa.

```ts
review.addMask({ start: 12, end: 24 }, 'ADRES')
```

### `MaskReview.linkToExisting(range: TextRange, token: string): void`

- **Parametreler:** `range`, hedef `token`.
- **Fırlatır:** `MaskReviewError` — `token` tabloda yoksa; `range` geçersizse.

```ts
review.linkToExisting({ start: 40, end: 46 }, '[KISI_1]')
```

### `MaskReview.removeMask(token: string): void`

- **Fırlatır:** `MaskReviewError` — `token` tabloda yoksa.

```ts
review.removeMask('[KISI_1]')
```

### `MaskReview.applyToAll(range: TextRange, type: EntityType): string`

- **Dönüş:** Üretilen/eşlenen token; kökün metindeki TÜM geçişleri (çekim ekli
  biçimler dâhil, M4) aynı maskeye bağlanır.
- **Fırlatır:** `MaskReviewError` — `range` geçersizse.

```ts
review.applyToAll({ start: 0, end: 5 }, 'KISI')
```

### Salt-okunur alanlar

`review.sourceText`, `review.maskedText`, `review.table` (`MaskTable`),
`review.result` (`MaskResult`) — hiçbiri fırlatmaz.

**Tipler:** `TextRange`, `ReviewMask`, `MaskReviewError`.

---

## `mask/preflight.ts` — kaçak kimlik bilgisi yakalama

Bağ: plan M11.

### `preflightCheck(text: string, options: PreflightOptions): PreflightResult`

- **Parametreler:** `text`. `options.destination: 'local' | 'network'`
  (M11.5 — ağa giden hedefte `canSendUnmasked` HER ZAMAN `false`),
  artı `mask()`'in `MaskOptions` alanları.
- **Dönüş:** `PreflightResult = { clean, entities, suspects, maskedPreview,
  canSendUnmasked }`.
- **Fırlatır:** Fırlatmaz.

```ts
const result = preflightCheck(userInput, { destination: 'network' })
if (!result.clean) showMaskPrompt(result)
```

**Tipler:** `Destination`, `PreflightEntity`, `PreflightOptions`, `PreflightResult`.

---

## `mask/table.ts` — `MaskTable`

Bağ: `SPEC.md` §4, §9, PROTOCOL G1.

### `new MaskTable()`

Boş tablo. Fırlatmaz.

### `MaskTable.tokenFor(type, key, surface, index): string`

Genelde doğrudan çağrılmaz — `mask()` içeriden kullanır. Aynı `(type, key)`
her zaman aynı token'ı döner (SPEC S4). Fırlatmaz.

### `MaskTable.surfaceAt(token: string, nth: number): string | undefined`

`unmask()` içeriden kullanır. Fırlatmaz; kayıt yoksa `undefined`.

### `MaskTable.lookup(token: string): MaskEntry | undefined`

Fırlatmaz.

```ts
const entry = result.table.lookup('[KISI_1]')
```

### `MaskTable.hasKey(type: EntityType, key: string): boolean` / `MaskTable.tokenOf(type, key): string | undefined`

Fırlatmaz.

### `MaskTable.markAmbiguous(token: string, candidates?: readonly string[]): void`

SPEC §7/7. Bilinmeyen `token` sessizce yok sayılır. Fırlatmaz.

### `MaskTable.entries(): readonly MaskEntry[]`

İlk geçiş sırasına göre tüm kayıtlar (M6.1'in temeli). Fırlatmaz.

### `MaskTable.remove(token: string): boolean`

Fırlatmaz; bulunamazsa `false`.

### `MaskTable.clear(): void`

Oturum sonunda çağrılır (M5.7). Fırlatmaz.

### `MaskTable.digest(): Promise<string>`

Tablonun ağa çıkabilen TEK biçimi (`sha256:...`). Fırlatmaz.

```ts
const hash = await table.digest() // PROTOCOL §5.3 maskTableHash
```

### `MaskTable.toJSON(): never`

**Her zaman fırlatır:** `MaskTableSerializationError`. `JSON.stringify(table)`
çağrısını da tetikler — bu kasıtlıdır (SPEC S2).

### `MaskTable.exportEncrypted(passphrase: string, iterations?: number): Promise<EncryptedMaskTable>`

- **Fırlatır:** `MaskTableSerializationError` — parola 8 karakterden kısaysa.

```ts
const blob = await table.exportEncrypted('en-az-8-karakter')
```

### `MaskTable.importEncrypted(blob: EncryptedMaskTable, passphrase: string): Promise<MaskTable>` *(static)*

- **Fırlatır:** `MaskTableDecryptError` — bilinmeyen `format`; yanlış parola
  veya bozulmuş veri (ikisi ayırt edilmez, SPEC §9).

```ts
const table = await MaskTable.importEncrypted(blob, passphrase)
```

**Tipler/sabitler:** `MaskEntry`, `Occurrence`, `EncryptedMaskTable`,
`MASK_TABLE_FORMAT`, `MaskTableSerializationError`, `MaskTableDecryptError`.

---

## `mask/token.ts` — token dilbilgisi

### `isMaskToken(candidate: string): boolean`

- **Dönüş:** `candidate` tam olarak `[TIP_N]` biçimindeyse `true` (SPEC §3.1).
- **Fırlatır:** Fırlatmaz.

```ts
isMaskToken('[KISI_1]') // true
isMaskToken('[kisi_1]') // false — küçük harf
```

---

## `mask/rules/index.ts` — kural katmanı

Bağ: `SPEC.md` §2 (varlık tipleri), plan M2.

### `runRuleLayer(text: string, options?: RuleLayerOptions): RuleResult`

- **Parametreler:** `options.maskDates?: boolean` (varsayılan `true`).
- **Dönüş:** `RuleResult = { spans, suspects }` — çakışma çözümü
  YAPILMAMIŞTIR, `mask()` bunu NER sonuçlarıyla birlikte tek elden yapar.
- **Fırlatır:** Fırlatmaz.

```ts
const { spans, suspects } = runRuleLayer(text, { maskDates: false })
```

### `isValidTckn(value: string): boolean`

11 haneli TCKN algoritmik doğrulaması (10./11. hane kontrolü). Fırlatmaz.

### `isValidIban(value: string): boolean`

TR IBAN mod-97 checksum. Fırlatmaz.

### `normalizePhone(value: string): string | undefined`

Ayırıcıları temizler, kanonik biçime döner; tanınmayan biçimde `undefined`.
Fırlatmaz.

**Tipler:** `RuleLayerOptions`, `RuleResult`, `RuleDetector` (dolaylı, `RuleResult` üzerinden).

---

## `types/entities.ts` — varlık modeli

### `ENTITY_TYPES: readonly EntityType[]`

Sabit dizi — SPEC §2'deki 11 tip.

### `TYPE_PRIORITY: Readonly<Record<EntityType, number>>`

Çakışma çözümünde eşitlik bozucu öncelik tablosu (SPEC §6.1).

**Tipler:** `EntityType`, `DetectionLayer`, `EntitySpan`, `SuspectSpan`.

---

## `turkish/suffix.ts` — çekim eki normalleştirmesi

Bağ: `SPEC.md` §4.1/S6, plan M4.

### `nameKey(root: string): string`

- **Dönüş:** Türkçe büyütülmüş + ünsüz sertleştirilmiş eşleme anahtarı.
  `nameKey('Ahmet') === nameKey('Ahmed')`.
- **Fırlatır:** Fırlatmaz.

```ts
nameKey('Ahmet') // 'AHMET'
```

### `splitName(word: string, isKnownRoot?: (candidate: string) => boolean): SplitName`

- **Dönüş:** `{ root, suffix }`. Kesme işaretli yazımda güvenilir ayırma;
  kesmesiz yazımda yalnız `isKnownRoot` doğrularsa soyar.
- **Fırlatır:** Fırlatmaz.

```ts
splitName("Ahmet'in") // { root: 'Ahmet', suffix: "'in" }
```

**Tipler:** `SplitName`.

---

## `research/client.ts` — `ResearchClient`

Bağ: `CAPABILITIES.md` A6, plan M7.1/M7.4/M7.7. **İnternete çıkan tek modül.**

### `new ResearchClient(options?: ResearchClientOptions)`

- **Parametreler:** `options.transport?: ResearchTransport` (ağa çıkan kısım,
  DIŞARIDAN verilir — paket kendi ağ API'sine dokunmaz), `options.localIndex?:
  LocalResearchIndex` (çevrimdışı yedek, M7.7), `options.ner?: NerBackend`
  (guard'ın ad/kurum/adres de görmesi için).

### `ResearchClient.search(query: ResearchQuery): Promise<ResearchResponse>`

- **Parametreler:** `query.text` **MASKELENMİŞ** olmalı. `query.kind:
  'yargitay' | 'mevzuat'`. `query.limit?`.
- **Dönüş:** `ResearchResponse = { documents, source, note? }`;
  `source: 'network' | 'local' | 'unavailable'`.
- **Fırlatır:** `UnmaskedContentError` — `query.text` maskelenmemiş kimlik
  verisi içeriyorsa; taşımaya HİÇ ulaşmaz (M7.4). Ağ hatası fırlatmaz, yerel
  dizine düşer (M7.7).

```ts
const client = new ResearchClient({ transport, localIndex })
const response = await client.search({ text: mask(query).text, kind: 'yargitay' })
```

**Tipler:** `ResearchQuery`, `ResearchDocument`, `ResearchSource`,
`ResearchResponse`, `ResearchTransport`, `LocalResearchIndex`,
`ResearchClientOptions`, `ResearchKind`.

---

## `research/guard.ts` — `MaskGuard`

Bağ: `SPEC.md` S3, PROTOCOL 6003. Kapının kendisi.

### `assertMasked(text: string, options?: GuardOptions): void`

- **Fırlatır:** `UnmaskedContentError` — kimlik verisi bulunursa.
  Geçerse sessizdir.

```ts
assertMasked(outgoingText) // throws if unsafe
```

### `findUnmaskedContent(text: string, options?: GuardOptions): readonly GuardFinding[]`

- **Dönüş:** Bulunan her varlık için `{ type, start, end, preview }` — ham
  değer BİLEREK taşınmaz, yalnız uçları görünen `preview` (`05••••••••33`).
- **Fırlatır:** Fırlatmaz (bu, `assertMasked`'in kontrol ettiği ham veri).

```ts
const findings = findUnmaskedContent(text, { ner })
```

**Tipler:** `GuardFinding`, `GuardOptions`, `UnmaskedContentError`
(`.findings: readonly GuardFinding[]`).

---

## `research/correlate.ts` — sonuç özetleme ve olayla ilişkilendirme

Bağ: `CAPABILITIES.md` A6, plan M7.6. Cihaz içi model (`runsLocally: true`),
ağa çıkmaz.

### `summarizeDocument(document: ResearchDocument, backend: SummaryBackend): Promise<DocumentSummary>`

- **Dönüş:** `{ documentId, summary }`.
- **Fırlatır:** `DocumentTooLongForSummaryError` — `document.excerpt` tahmini
  `MAX_DOCUMENT_TOKENS_FOR_SUMMARY`'yi (6000) aşarsa; backend'e hiç gitmez.

```ts
const { summary } = await summarizeDocument(doc, backend)
```

### `summarizeDocuments(documents, backend): Promise<readonly DocumentSummary[]>`

Her belgeyi `summarizeDocument` ile bağımsız işler (bir belgenin bütçesi
diğerini etkilemez).

### `correlateWithEvent(eventSummary: string, documents, backend: CorrelationBackend, options?: CorrelateOptions): Promise<CorrelationBatchResult>`

- **Parametreler:** `options.limit?` (varsayılan `DEFAULT_CORRELATION_LIMIT` =
  10 — "ilk-K").
- **Dönüş:** `{ verdicts, evaluatedCount, skippedCount }`. Her aday, olay
  özetiyle **TEK BAŞINA** değerlendirilir (`backend.evaluate` diğer adayları
  hiç görmez) — A6'nın "K bağımsız kısa geçiş" iddiasının mimari garantisi.
- **Fırlatır:** `EventSummaryTooLongError` — `eventSummary` tahmini
  `MAX_EVENT_SUMMARY_TOKENS`'ı (800) aşarsa; hiçbir aday değerlendirilmeden.

```ts
const { verdicts, skippedCount } = await correlateWithEvent(caseSummary, candidates, backend)
```

**Sabitler:** `MAX_EVENT_SUMMARY_TOKENS`, `MAX_DOCUMENT_TOKENS_FOR_SUMMARY`,
`DEFAULT_CORRELATION_LIMIT`. **Tipler:** `SummaryBackend`, `DocumentSummary`,
`CorrelationBackend`, `CorrelationVerdict`, `CorrelateOptions`,
`CorrelationBatchResult`.

---

## `handoff/threshold.ts` — devir teslim eşikleri

Bağ: `CAPABILITIES.md` §C, plan M12.9.

### `shouldOfferHandoff(job: JobEstimate, calibration: DeviceCalibration, device?: DeviceState): HandoffOutcome`

- **Dönüş:** `{ kind: 'none' | 'offer' | 'postpone' | 'info', ... }`. Eşik
  altında HER ZAMAN `'none'` — bu bir yorum değil, `handoff/threshold.test.ts`
  ile sınır değerlerinde doğrulanan davranıştır.
- **Fırlatır:** Fırlatmaz.

```ts
const outcome = shouldOfferHandoff(
  { foregroundWaitSeconds: 700, queueable: false },
  { measured: true },
)
```

**Sabit:** `THRESHOLDS`. **Tipler:** `JobEstimate`, `DeviceCalibration`,
`DeviceState`, `HandoffOutcome`, `HandoffTrigger`, `ThermalState`.

---

## `write/skeleton.ts` — yapı/iskelet çıkarma

Bağ: `CAPABILITIES.md` A8(a), plan M8.2. Model YOK, tamamen deterministik.

### `extractSkeleton(document: string): DocumentSkeleton`

- **Dönüş:** `{ sections, dominantNumberingStyle }`. `sections[].numberingStyle:
  'arabic-dot' | 'roman-dot' | 'letter-paren' | 'none'`.
- **Fırlatır:** Fırlatmaz.

```ts
const { sections, dominantNumberingStyle } = extractSkeleton(oldPetitionText)
```

**Tipler:** `DocumentSkeleton`, `SkeletonSection`, `NumberingStyle`.

---

## `write/style.ts` — üslup profili

Bağ: `CAPABILITIES.md` A8(b), plan M8.3/M8.4. `StyleProfile` doğrudan
JSON'a yazılabilir düz veridir — "JSON şeması" budur.

### `extractStyleFeatures(document: string): StyleProfile`

Tek belgeden profil çıkarır (`documentCount: 1`). Fırlatmaz.

### `mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile`

İki profili birleştirir; sıra fark etmez (değişmeli). Fırlatmaz.

### `buildStyleProfile(documents: readonly string[]): StyleProfile`

`extractStyleFeatures` + `mergeStyleProfiles` katlaması — "belge belge,
artımlı" (M8.4) kolaylık sarmalayıcısı. Fırlatmaz.

### `emptyStyleProfile(): StyleProfile`

Birleştirmede kimlik (identity) elemanı. Fırlatmaz.

### `aggregateMean(aggregate: LengthAggregate): number` / `aggregateMedian(aggregate: LengthAggregate): number`

`sentenceWordCounts`/`paragraphSentenceCounts` üzerinde türetilmiş istatistik.
Fırlatmaz.

```ts
const profile = buildStyleProfile([petition1, petition2, petition3])
aggregateMean(profile.sentenceWordCounts)
```

**Tipler:** `StyleProfile`, `LengthAggregate`, `PhraseFrequency`.

---

## `write/fewshot.ts` — few-shot seçimi

Bağ: `CAPABILITIES.md` A8(c)/A9, plan M8.5.

### `jaccardSimilarity(a: string, b: string): number`

Normalize edilmiş kelime kümeleri üzerinde Jaccard benzerliği (`|A∩B|/|A∪B|`,
0–1 arası). Fırlatmaz.

### `selectFewShot(target: string, corpus: readonly FewShotCandidate[], options?: SelectFewShotOptions): readonly FewShotExample[]`

- **Parametreler:** `options.maxExamples?` (varsayılan `FEW_SHOT_MAX_EXAMPLES` =
  3), `options.maxContextTokens?` (varsayılan `FEW_SHOT_MAX_CONTEXT_TOKENS` =
  2000).
- **Dönüş:** Benzerliğe göre azalan, bütçe içinde kalan adaylar. Sıfır
  benzerlikli aday hiç seçilmez.
- **Fırlatır:** Fırlatmaz.

```ts
const examples = selectFewShot(targetParagraph, profile.sampleParagraphs.map((p, i) => ({
  documentId: String(i),
  paragraph: p,
})))
```

**Sabitler:** `FEW_SHOT_MAX_EXAMPLES`, `FEW_SHOT_MAX_CONTEXT_TOKENS`.
**Tipler:** `FewShotCandidate`, `FewShotExample`, `SelectFewShotOptions`.

---

## `write/generate.ts` — aşamalı layiha üretimi

Bağ: `CAPABILITIES.md` A13, plan M8.7. Üç bağımsız aşama — bilerek TEK bir
"belgeyi üret" fonksiyonuna gizlenmedi (her bölüm ayrı onaylanabilsin diye).

### `planSkeleton(context: SkeletonPlanningContext, planner: SkeletonPlanner): Promise<DocumentPlan>`

- **Fırlatır:** `SkeletonPlanningInputTooLongError` — `context.caseSummary`
  tahmini `SKELETON_MAX_CONTEXT_TOKENS`'ı (500) aşarsa; `planner`'a hiç gitmez.

### `writeSections(plan, styleProfile, fewShotBySection, writer: SectionWriter): Promise<readonly GeneratedSection[]>`

Her bölümü BAĞIMSIZ yazar — `writer.writeSection` diğer bölümlerin tam
metnini asla görmez (M7.6'daki "K bağımsız geçiş" ile aynı mimari desen).
Fırlatmaz (writer'ın kendi hatası dışında).

### `checkNumberingConsistency(sections: readonly GeneratedSection[]): readonly ConsistencyIssue[]`

TAMAMEN deterministik — model gerekmez, `extractSkeleton` yeniden kullanılır.
Fırlatmaz.

### `reviewNarrativeConsistency(summaries: readonly SectionSummary[], reviewer: ConsistencyReviewer): Promise<readonly ConsistencyIssue[]>`

- **Fırlatır:** `ConsistencyReviewInputTooLongError` — birleşik özet tahmini
  `CONSISTENCY_PASS_MAX_TOKENS`'ı (1500) aşarsa; `reviewer`'a hiç gitmez.

```ts
const plan = await planSkeleton({ caseSummary, styleProfile }, planner)
const fewShotBySection = new Map(plan.sections.map((s) => [s.title, selectFewShot(s.title, corpus)]))
const sections = await writeSections(plan, styleProfile, fewShotBySection, writer)

const numberingIssues = checkNumberingConsistency(sections)
const narrativeIssues = await reviewNarrativeConsistency(
  sections.map((s) => ({ title: s.title, summary: summarize(s.text) })),
  reviewer,
)
```

**Sabitler:** `SKELETON_MAX_CONTEXT_TOKENS`, `SECTION_MAX_CONTEXT_TOKENS`,
`CONSISTENCY_PASS_MAX_TOKENS`. **Tipler:** `SectionPlan`, `DocumentPlan`,
`SkeletonPlanningContext`, `SkeletonPlanner`, `SectionWritingContext`,
`SectionWriter`, `GeneratedSection`, `ConsistencyIssue`, `SectionSummary`,
`ConsistencyReviewer`.
