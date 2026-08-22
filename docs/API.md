# API — `packages/hukuk-ai` genel yüzeyi

Plan M13.2–M13.5. Tek giriş kapısı `src/index.ts`'tir (M13.1); bu belgedeki
her başlık oradan dışa açılan bir isimle birebir eşleşir. Çelişki çıkarsa
**kod** kazanır — bu belge kodu takip eder, tersi değil.

İlgili sözleşmeler: `docs/SPEC.md` (maskeleme), `docs/PROTOCOL.md` (devir
teslim), `docs/CAPABILITIES.md` (kapsam), `docs/STYLE-PROFILE.md` (üslup
profili şeması).

---

## Kararlılık sözü (M13.5)

| Katman | Durum | Neden |
|---|---|---|
| Maskeleme (`mask`, `maskAsync`, `unmask`, `MaskReview`, `preflightCheck`, `MaskTable`, `isMaskToken`, kural katmanı, NER sözlük arka ucu, `turkish/suffix`, `types/entities`) | **Kararlı** | `SPEC.md`'nin `maskContractVersion: 1.0.0`'ına bağlı; S1–S7 değişmezleri sürüm artışıyla bile değişmez (`SPEC.md` §son). İmza değişikliği `maskContractVersion` artışı gerektirir. |
| Devir eşiği (`shouldOfferHandoff`, `THRESHOLDS`) | **Kararlı** | `CAPABILITIES.md` §C'ye bağlı; davranış `threshold.test.ts` ile sınır değerlerinde kilitli. |
| Araştırma kapısı (`ResearchClient`, `assertMasked`, `findUnmaskedContent`) | **Kararlı** | `MaskGuard` ağa çıkan tek yolun kilidi; gevşetilmesi güvenlik sınırını değiştirir. |
| Araştırma sonrası özetleme/ilişkilendirme (`summarizeDocuments`, `correlateDocuments`) | **Deneysel** | M7.6'da yeni eklendi; gerçek bir özetleme/ilişkilendirme arka ucuyla henüz denenmedi. Backend arayüzleri (`SummaryBackend`, `CorrelationBackend`) değişebilir. |
| Yazma katmanı (`extractStructure`, `StyleProfileBuilder`, `selectFewShot`, `generateDraft` ve ilgili tipler) | **Deneysel** | M8'de yeni eklendi. Kalıp ifade/terim sözlüğü bir başlangıç tohumu (`docs/QUESTIONS.md` S7); backend arayüzleri (`OutlineBackend`, `SectionBackend`, `ConsistencyBackend`) gerçek modelle henüz doğrulanmadı. `StyleProfile` alan kümesi genişleyebilir (yalnız ekleme; var olan alan kaldırılmaz). |

"Deneysel" bir API'nin **davranışı** yine testle güvencededir (bu paketteki her
davranış testlidir) — deneysel olan, imzanın minor bir değişiklikte
kırılabilme ihtimalidir, davranışın kendisi değil.

---

## Hata tipleri kataloğu (M13.3)

| Tip | Nerede fırlar | Ne zaman | Sızdırdığı bilgi |
|---|---|---|---|
| `UnmaskedContentError` | `assertMasked`, `ResearchClient.search` | Ağa çıkan metinde maskelenmemiş kimlik verisi varsa | `findings: GuardFinding[]` — yalnız **tip** ve maskelenmiş `preview` (`05••••••••33`); ham değer asla |
| `MaskReviewError` | `MaskReview.addMask/linkToExisting/removeMask/applyToAll` | Bilinmeyen token, geçersiz `TextRange`, ya da iç tutarlılık ihlali | Yalnız hata mesajı (konum/token kimliği); kişisel veri içermez |
| `MaskTableSerializationError` | `MaskTable.toJSON()`, `MaskTable.exportEncrypted()` (parola < 8 karakter) | Düz serileştirme denemesi ya da zayıf parola | Hiçbir veri — sabit mesaj |
| `MaskTableDecryptError` | `MaskTable.importEncrypted()` | Bilinmeyen `format`, yanlış parola, bozulmuş veri | Hiçbiri; yanlış parola ile bozuk veri **ayırt edilmez** (bilerek) |
| `RangeError` | `buildToken` (dolaylı — `MaskTable.tokenFor` üzerinden) | Sıra numarası < 1 (iç tutarlılık ihlali; normal kullanımda oluşmaz) | Yok |

Hepsi `Error`'dan türer ve `name` alanı sınıf adıyla aynıdır (`override
readonly name`). Hiçbiri ham kişisel veri taşımaz — bu, `guard.ts`'teki yorumda
da yazılı: "hata nesnesi de sızıntı yüzeyidir".

---

## 1. Maskeleme çekirdeği — `mask`, `maskAsync`, `unmask`

`SPEC.md` §3/§5/§6. Kaynak: `src/mask/mask.ts`.

| Fonksiyon | İmza |
|---|---|
| `mask` | `(input: string, options?: MaskOptions) => MaskResult` |
| `maskAsync` | `(input: string, options?: MaskAsyncOptions) => Promise<MaskResult>` |
| `unmask` | `(text: string, table: MaskTable) => UnmaskResult` |

**`MaskOptions`** — `table?: MaskTable` (devam eden belge için var olan
tabloya ekler), `maskDates?: boolean` (varsayılan `true`, S4 — bkz.
`docs/QUESTIONS.md`), `ner?: NerBackend`.
**`MaskAsyncOptions`** — aynısı, `ner?: NerBackend | AsyncNerBackend`.

**Dönüş — `MaskResult`:** `text`, `table: MaskTable`, `spans:
readonly EntitySpan[]`, `suspects: readonly SuspectSpan[]`.
**Dönüş — `UnmaskResult`:** `text`, `unresolved: readonly string[]`
(tabloda karşılığı olmayan token'lar; hata değil, uyarı listesidir).

**Fırlatır:** Hiçbiri hata fırlatmaz — kaçak veri M2 kural katmanınca
maskelenir, doğrulanamayan aday `suspects`'e düşer, çökme yoktur (M12.5).

**Örnek:**

```ts
import { mask, unmask } from '@juriscalendar/hukuk-ai'

const { text, table } = mask('Müvekkilim Ahmet Yılmaz, TC 10000000146.')
// text  → 'Müvekkilim [KISI_1], TC [TCKN_1].'  (NER verilmezse KISI yakalanmaz;
//          bu örnekte ad zaten TCKN'nin yanına düştüğü için TCKN kesin yakalanır)

const back = unmask(text, table)
back.text === 'Müvekkilim Ahmet Yılmaz, TC 10000000146.' // birebir (SPEC S1)
```

---

## 2. Onay ekranı — `MaskReview`

M6. Kaynak: `src/mask/review.ts`. Saf veri sınıfı, DOM'a dokunmaz (M6.7).

| Üye | İmza | Fırlatır |
|---|---|---|
| `constructor` | `(originalText: string, options?: MaskOptions)` | — |
| `.sourceText` (get) | `string` | — |
| `.maskedText` (get) | `string` | — |
| `.table` (get) | `MaskTable` | — |
| `.result` (get) | `MaskResult` | — |
| `.listMasks()` | `() => readonly ReviewMask[]` | — |
| `.addMask(range, type)` | `(range: TextRange, type: EntityType) => string` (token) | `MaskReviewError` — geçersiz `range` |
| `.linkToExisting(range, token)` | `(range: TextRange, token: string) => void` | `MaskReviewError` — bilinmeyen token |
| `.removeMask(token)` | `(token: string) => void` | `MaskReviewError` — bilinmeyen token |
| `.applyToAll(range, type)` | `(range: TextRange, type: EntityType) => string` (token) | `MaskReviewError` — geçersiz `range` |

`ReviewMask` = `MaskEntry & { layer: DetectionLayer; confidence: number }`.
Aralıklar **hep** `sourceText` (kaçışlanmış orijinal metin) üzerindeki
konumlardır; kullanıcı müdahaleleri konumları asla kaydırmaz.

**Örnek:**

```ts
import { MaskReview } from '@juriscalendar/hukuk-ai'

const review = new MaskReview('Müvekkilim Ahmet Yılmaz beyanda bulundu.')
const token = review.addMask({ start: 11, end: 23 }, 'KISI')
review.applyToAll({ start: 11, end: 23 }, 'KISI') // metindeki tüm "Ahmet Yılmaz" çekimleri
review.listMasks() // onay ekranının satırları
```

---

## 3. Kaçak kimlik yakalama — `preflightCheck`

M11. Kaynak: `src/mask/preflight.ts`. `MaskGuard`'ın (bkz. §11) **yerine
geçmez**, ondan önce gelir; guard atlanamaz, preflight atlanabilir.

| Fonksiyon | İmza | Fırlatır |
|---|---|---|
| `preflightCheck` | `(text: string, options: PreflightOptions) => PreflightResult` | — |

`PreflightOptions` = `MaskOptions & { destination: 'local' \| 'network' }`.
`PreflightResult`: `clean`, `entities: readonly PreflightEntity[]`,
`suspects`, `maskedPreview: MaskResult`, `canSendUnmasked: boolean` — ağa
giden hedefte (`destination: 'network'`) bu **her zaman** `false`dır (M11.5).

**Örnek:**

```ts
import { preflightCheck } from '@juriscalendar/hukuk-ai'

const result = preflightCheck(userInput, { destination: 'network' })
if (!result.clean) {
  // "maskeleyeyim mi?" diyaloğu — result.maskedPreview.text hazır
}
result.canSendUnmasked // false — ağ hedefinde asla true olmaz
```

---

## 4. Maske tablosu — `MaskTable`

M5. Kaynak: `src/mask/table.ts`. **Kırmızı çizgi:** düz serileştirme yok
(`toJSON` fırlatır); ağa çıkabilen tek biçim `digest()`.

| Üye | İmza | Fırlatır |
|---|---|---|
| `new MaskTable()` | — | — |
| `.size` (get) | `number` | — |
| `.tokenFor(type, key, surface, index)` | `(type: EntityType, key: string, surface: string, index: number) => string` | — |
| `.surfaceAt(token, nth)` | `(token: string, nth: number) => string \| undefined` | — |
| `.lookup(token)` | `(token: string) => MaskEntry \| undefined` | — |
| `.hasKey(type, key)` | `(type: EntityType, key: string) => boolean` | — |
| `.tokenOf(type, key)` | `(type: EntityType, key: string) => string \| undefined` | — |
| `.markAmbiguous(token, candidates?)` | `(token: string, candidates?: readonly string[]) => void` | — |
| `.entries()` | `() => readonly MaskEntry[]` | — |
| `.remove(token)` | `(token: string) => boolean` | — |
| `.clear()` | `() => void` | — |
| `.digest()` | `() => Promise<string>` (`sha256:…`) | — |
| `.toJSON()` | `() => never` | **her zaman** `MaskTableSerializationError` |
| `.exportEncrypted(passphrase, iterations?)` | `(passphrase: string, iterations?: number) => Promise<EncryptedMaskTable>` | `MaskTableSerializationError` — parola < 8 karakter |
| `static .importEncrypted(blob, passphrase)` | `(blob: EncryptedMaskTable, passphrase: string) => Promise<MaskTable>` | `MaskTableDecryptError` — bilinmeyen biçim / yanlış parola / bozuk veri |

`MASK_TABLE_FORMAT = 'hukuk-ai.masktable.v1'` — `EncryptedMaskTable.format`
alanı bununla karşılaştırılır.

**Örnek:**

```ts
import { MaskTable } from '@juriscalendar/hukuk-ai'

const table = new MaskTable()
const blob = await table.exportEncrypted('güçlü-bir-parola')
const restored = await MaskTable.importEncrypted(blob, 'güçlü-bir-parola')
await table.digest() // 'sha256:...' — PROTOCOL §5.3 maskTableHash
```

---

## 5. Token yardımcıları — `isMaskToken`

Kaynak: `src/mask/token.ts`.

| Fonksiyon | İmza |
|---|---|
| `isMaskToken` | `(candidate: string) => boolean` |

Gerçek token biçimi `[TIP_N]` (N ≥ 1, baştan sıfırsız). Fırlatmaz.

```ts
isMaskToken('[KISI_1]')  // true
isMaskToken('[KISI_0]')  // false — sıra 1'den başlar
```

---

## 6. Kural katmanı — `runRuleLayer` ve dedektör yardımcıları

M2. Kaynak: `src/mask/rules/index.ts`. Deterministik, doğrulama algoritmalı.

| Fonksiyon | İmza | Fırlatır |
|---|---|---|
| `runRuleLayer` | `(text: string, options?: RuleLayerOptions) => RuleResult` | — |
| `isValidTckn` | `(value: string) => boolean` | — |
| `isValidIban` | `(value: string) => boolean` | — |
| `normalizePhone` | `(value: string) => string` | — |

`RuleLayerOptions.maskDates` — `false` verilirse `TARIH` dedektörü koşmaz
(S4). `RuleResult`: `{ spans: EntitySpan[]; suspects: SuspectSpan[] }`.
Koşulan dedektörler: TCKN (mod 11 doğrulama), IBAN (mod-97), esas/karar no,
e-posta, plaka, telefon, (varsayılan açık) tarih.

```ts
import { runRuleLayer, isValidTckn } from '@juriscalendar/hukuk-ai'

isValidTckn('10000000146') // true — checksum geçer
runRuleLayer('IBAN: TR330006...').spans // [{ type: 'IBAN', ... }]
```

---

## 7. NER katmanı — `createDictionaryNerBackend`, `freeRegions`

M3. Kaynak: `src/mask/ner/`. Model bağımsız arayüz (`NerBackend`); burada
dışa açılan, **modelsiz varsayılan** sözlük tabanlı uygulamadır.

| Fonksiyon | İmza |
|---|---|
| `createDictionaryNerBackend` | `(options?: DictionaryNerOptions) => NerBackend` |
| `freeRegions` | `(textLength: number, taken: readonly {start,end}[]) => readonly FreeRegion[]` |

`DictionaryNerOptions`: `people?`, `organizations?`, `workplaces?` — cihazdaki
kayıtlardan gelen ad listeleri. Üretilen `NerBackend.runsLocally` her zaman
`true`dur (tip düzeyinde ağ yasağı, M3.6). Fırlatmaz.

```ts
import { createDictionaryNerBackend, mask } from '@juriscalendar/hukuk-ai'

const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
mask('Ahmet Yılmaz beyanda bulundu.', { ner }).text // '[KISI_1] beyanda bulundu.'
```

---

## 8. Türkçe çekim eki — `nameKey`, `splitName`

M4. Kaynak: `src/turkish/suffix.ts`. Özel adlar için dar bir ek soyucu; genel
Türkçe sözcüklere uygulanmaz.

| Fonksiyon | İmza |
|---|---|
| `nameKey` | `(root: string) => string` — eşleme anahtarı (büyütür + ünsüz sertleştirir) |
| `splitName` | `(word: string, isKnownRoot?: (candidate: string) => boolean) => SplitName` |

`SplitName` = `{ root: string; suffix: string }`. Fırlatmaz.

```ts
import { nameKey, splitName } from '@juriscalendar/hukuk-ai'

nameKey('Ahmed') === nameKey('Ahmet') // true — ikisi de 'AHMET'
splitName("Ahmet'in") // { root: 'Ahmet', suffix: "'in" }
```

---

## 9. Varlık tipleri — `ENTITY_TYPES`, `TYPE_PRIORITY`

Kaynak: `src/types/entities.ts`. Sabitler, fonksiyon değil.

| İsim | Tip | İçerik |
|---|---|---|
| `ENTITY_TYPES` | `readonly EntityType[]` | `TCKN, IBAN, TEL, EPOSTA, PLAKA, ESAS, TARIH, KISI, KURUM, ISYERI, ADRES` |
| `TYPE_PRIORITY` | `Readonly<Record<EntityType, number>>` | Çakışma çözümünde uzunluk eşitliğinde öncelik (küçük önce) |

---

## 10. Devir eşiği — `shouldOfferHandoff`, `THRESHOLDS`

M12.9. Kaynak: `src/handoff/threshold.ts`. `CAPABILITIES.md` §C'nin kod
karşılığı.

| İsim | İmza |
|---|---|
| `shouldOfferHandoff` | `(job: JobEstimate, calibration: DeviceCalibration, device?: DeviceState) => HandoffOutcome` |
| `THRESHOLDS` | sabit nesne — `foregroundWaitSeconds: 600`, `chunkCount: 2000`, `audioMinutes: 90`, `peakResidentMemoryMb: 1200`, `lowBatteryPercent: 20` |

`HandoffOutcome` dört biçimden biri: `{kind:'none'}`,
`{kind:'offer', trigger, detail}`, `{kind:'postpone', detail}`,
`{kind:'info', detail}`. Fırlatmaz. Eşik altında **her zaman** `'none'`
(M12.9, testle kilitli).

```ts
import { shouldOfferHandoff } from '@juriscalendar/hukuk-ai'

shouldOfferHandoff(
  { foregroundWaitSeconds: 700, queueable: false },
  { measured: true },
) // { kind: 'offer', trigger: 'time', detail: '...' }
```

---

## 11. Araştırma — `ResearchClient`

M7.1/M7.4/M7.7. Kaynak: `src/research/client.ts`. İnternete çıkan **tek**
modül; ağın kendisi dışarıdan (`ResearchTransport`) verilir.

| Üye | İmza | Fırlatır |
|---|---|---|
| `new ResearchClient(options?)` | `options?: ResearchClientOptions` (`transport?`, `localIndex?`, `ner?`) | — |
| `.search(query)` | `(query: ResearchQuery) => Promise<ResearchResponse>` | `UnmaskedContentError` — sorgu maskelenmemişse (kapı ilk iş) |

`ResearchQuery`: `text` (MASKELENMİŞ olmalı), `kind: 'yargitay' \|
'mevzuat'`, `limit?`. `ResearchResponse`: `documents`, `source: 'network' \|
'local' \| 'unavailable'`, `note?`. Ağ patlarsa hata fırlatmaz, yerel
dizine düşer (M7.7); ne ağ ne yerel dizin varsa boş döner.

```ts
import { ResearchClient, mask } from '@juriscalendar/hukuk-ai'

const client = new ResearchClient({ transport: myTransport, localIndex: myIndex })
const masked = mask(caseText).text
await client.search({ text: masked, kind: 'yargitay', limit: 20 })
```

---

## 12. Ağ kapısı — `assertMasked`, `findUnmaskedContent`

M7.2/M7.3. Kaynak: `src/research/guard.ts`. `ResearchClient.search`'ün
kullandığı kilit; doğrudan da çağrılabilir (ör. UI'da önizleme için).

| Fonksiyon | İmza | Fırlatır |
|---|---|---|
| `assertMasked` | `(text: string, options?: GuardOptions) => void` | `UnmaskedContentError` — bulgu varsa |
| `findUnmaskedContent` | `(text: string, options?: GuardOptions) => readonly GuardFinding[]` | — |

`GuardOptions.ner?: NerBackend` — verilmezse yalnız desenli tipler (TCKN,
IBAN, …) denetlenir; ad/kurum/adres denetimi NER olmadan **yapılamaz**
(bilinen sınır, SPEC §7/2 ile aynı). `GuardFinding`: `type`, `start`, `end`,
`preview` (ham değer **hiçbir zaman** taşınmaz).

```ts
import { assertMasked, UnmaskedContentError } from '@juriscalendar/hukuk-ai'

try {
  assertMasked(rawText)
} catch (error) {
  if (error instanceof UnmaskedContentError) {
    console.log(error.findings.map((f) => f.type)) // ['TCKN', 'TEL']
  }
}
```

---

## 13. Araştırma sonucu özetleme — `createExtractiveSummaryBackend`, `summarizeDocuments`

M7.6. Kaynak: `src/research/summarize.ts`. **Deneysel.** Model bağımsız;
verilmezse modelsiz çıkartmalı (extractive) varsayılan çalışır.

| Fonksiyon | İmza |
|---|---|
| `createExtractiveSummaryBackend` | `(options?: ExtractiveSummaryOptions) => SummaryBackend` |
| `summarizeDocuments` | `(documents: readonly ResearchDocument[], backend?: SummaryBackend \| AsyncSummaryBackend) => Promise<readonly DocumentSummary[]>` |

Her belge **kendi geçişinde** özetlenir (`Promise.all`, bağımsız); girdi
sırası korunur. `backend` verilmezse `createExtractiveSummaryBackend()`
kullanılır. Fırlatmaz (backend fırlatmadıkça).

```ts
import { summarizeDocuments } from '@juriscalendar/hukuk-ai'

const summaries = await summarizeDocuments(searchResponse.documents)
// [{ documentId: '1', summary: '...' }, ...]
```

---

## 14. Olayla ilişkilendirme — `correlateDocuments`

M7.6. Kaynak: `src/research/correlate.ts`. **Deneysel.** "K bağımsız kısa
geçiş" tip düzeyinde zorlanır: `CorrelationBackend.correlate` imzası **tek**
belge alır, aday listesinin tamamını hiç göremez.

| Fonksiyon | İmza |
|---|---|
| `correlateDocuments` | `(caseSummary: string, documents: readonly ResearchDocument[], backend: CorrelationBackend \| AsyncCorrelationBackend, options?: CorrelateOptions) => Promise<readonly CorrelationResult[]>` |

`CorrelateOptions.limit` — ilk-K karar (verilmezse tümü). `CorrelationResult`
= `CorrelationVerdict & { documentId: string }`; `CorrelationVerdict`:
`relevant: boolean`, `reasoning?`, `confidence?`. Fırlatmaz (backend
fırlatmadıkça).

```ts
import { correlateDocuments } from '@juriscalendar/hukuk-ai'

const results = await correlateDocuments(caseSummary, documents, myBackend, { limit: 10 })
results.filter((r) => r.relevant)
```

---

## 15. Yapı/iskelet çıkarma — `extractStructure`

M8.2. Kaynak: `src/write/structure.ts`. **Deneysel.** Tamamen deterministik,
model gerekmez.

| Fonksiyon | İmza |
|---|---|
| `extractStructure` | `(text: string) => DocumentStructure` |

`DocumentStructure`: `headings: readonly string[]` (bölüm sırası),
`numberingStyle: 'arabic' \| 'roman' \| 'letter' \| 'none'` (gövdedeki
baskın biçim). Fırlatmaz; boş metinde `{headings: [], numberingStyle:
'none'}`.

```ts
extractStructure(oldPetitionText)
// { headings: ['AÇIKLAMALAR', 'SONUÇ VE İSTEM'], numberingStyle: 'arabic' }
```

---

## 16. Üslup profili — `StyleProfileBuilder`, `mergeState`

M8.3/M8.4. Kaynak: `src/write/styleProfile.ts`. **Deneysel.** Tam şema:
`docs/STYLE-PROFILE.md`. Artımlı ve birleştirilebilir — bkz. §M8.4.

| Üye | İmza |
|---|---|
| `new StyleProfileBuilder(initial?)` | `initial?: StyleProfileBuilderState` |
| `static .fromState(state)` | `(state: StyleProfileBuilderState) => StyleProfileBuilder` |
| `.toState()` | `() => StyleProfileBuilderState` |
| `.add(documentId, text)` | `(documentId: string, text: string) => void` |
| `.build()` | `() => StyleProfile` |
| `mergeState(a, b)` | `(a: StyleProfileBuilderState, b: StyleProfileBuilderState) => StyleProfileBuilderState` |

Hiçbiri fırlatmaz. `StyleProfileBuilderState` düz JSON'dur — kalıcı
saklanabilir, cihazlar arası aktarılabilir.

```ts
import { StyleProfileBuilder, mergeState } from '@juriscalendar/hukuk-ai'

const builder = new StyleProfileBuilder()
for (const [id, text] of oldPetitions) builder.add(id, text)
const profile = builder.build()

// oturumlar arası devam:
const state = builder.toState() // diske yaz
const resumed = StyleProfileBuilder.fromState(loadFromDisk())
```

---

## 17. Few-shot seçimi — `selectFewShot`

M8.5. Kaynak: `src/write/fewShot.ts`. **Deneysel.** Belge düzeyinde seçim;
bağlam bütçesi aşılırsa aday sessizce atılmaz, sayılır.

| Fonksiyon | İmza |
|---|---|
| `selectFewShot` | `(query: string, excerpts: readonly RepresentativeExcerpt[], options?: FewShotOptions) => FewShotSelection` |

`FewShotOptions`: `k?` (varsayılan 3), `maxTokens?` (varsayılan 2000).
`FewShotSelection`: `excerpts`, `estimatedTokens`, `droppedForBudget`.
Fırlatmaz; boş girdide boş sonuç.

```ts
selectFewShot(newCaseFacts, profile.excerpts, { k: 3, maxTokens: 2000 })
```

---

## 18. Aşamalı üretim — `generateDraft`

M8.7. Kaynak: `src/write/generate.ts`. **Deneysel.** İskelet → bölüm bölüm
(sırayla, kesintili) → tutarlılık (yalnız özetler üzerinde). Üç arka uç da
dışarıdan verilir; bu fonksiyon yalnız sırayı ve bağlam sınırını zorlar.

| Fonksiyon | İmza |
|---|---|
| `generateDraft` | `(caseSummary: string, styleProfile: StyleProfile, options: GenerateDraftOptions) => Promise<DraftResult>` |

`GenerateDraftOptions`: `outlineBackend`, `sectionBackend`,
`consistencyBackend` (zorunlu), `summarizeSection?` (varsayılan: ilk iki
cümle), `fewShotExcerpts?`, `fewShotOptions?`, `resume?: {outline,
sections}` (yarıda kalanı sürdürür). `DraftResult`: `outline`, `sections`,
`consistencyIssues`. Fırlatmaz (arka uçlar fırlatmadıkça).

```ts
import { generateDraft } from '@juriscalendar/hukuk-ai'

const result = await generateDraft(caseSummary, profile, {
  outlineBackend, sectionBackend, consistencyBackend,
  fewShotExcerpts: profile.excerpts,
})
// yarıda kesilirse: her bölüm üretildikçe { outline: result.outline, sections: result.sections }
// diske yazılır; sonraki çağrıda `resume` olarak geri verilir.
```
